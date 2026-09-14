import CoachCalPersistence
import GRDB
import ViewInspector
import XCTest

@testable import CoachCal
@testable import CoachCalDesignSystem

nonisolated final class ChartDescriptorTests: XCTestCase {
  private var pool: DatabasePool!

  override func setUpWithError() throws {
    try super.setUpWithError()
    let directory = FileManager.default.temporaryDirectory
      .appending(component: "chart-descriptor-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    pool = try Database.makePool(
      at: directory.appending(component: "coach-cal.sqlite").path(percentEncoded: false)
    )
    try Migrations.foundationSync.migrate(pool)
  }

  @MainActor
  private func makeSeededModel() async throws -> (ProgressModel, Date) {
    let clock = Date()
    let seeder = SeedDataManager(database: pool, now: { clock })
    try await seeder.ensureSeeded()
    let model = ProgressModel(
      pool: pool,
      userId: AppEnvironment.demoUserId,
      tracking: TrackingRepository(database: pool),
      engagement: EngagementRepository(database: pool),
      now: { clock }
    )
    for _ in 0..<100 {
      if model.snapshot.weights.count == 8 { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    XCTAssertEqual(model.snapshot.weights.count, 8, "seed carries 8 weight logs")
    return (model, clock)
  }

  @MainActor
  func testDescriptorMatchesSeededEightPointSeries() async throws {
    let (model, _) = try await makeSeededModel()

    let points = model.weightPoints
    XCTAssertEqual(points.count, 8)

    let descriptor = WeightChartDescriptor(points: points).makeChartDescriptor()
    XCTAssertEqual(descriptor.series.count, 1)
    XCTAssertEqual(descriptor.series.first?.dataPoints.count, 8)

    let values = points.map(\.value)
    XCTAssertEqual(
      WeightChartDescriptor.yRange(points),
      (values.min()!...values.max()!),
      "descriptor y-range must span the logged data"
    )
  }

  @MainActor
  func testLogWeightReObservesAndDescriptorUpdates() async throws {
    let (model, _) = try await makeSeededModel()

    try await model.logWeight(81.2)

    for _ in 0..<100 {
      if model.snapshot.weights.count == 9 { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    XCTAssertEqual(model.snapshot.weights.count, 9, "log-weight write must re-observe")

    let descriptor = WeightChartDescriptor(points: model.weightPoints).makeChartDescriptor()
    XCTAssertEqual(descriptor.series.first?.dataPoints.count, 9)
    XCTAssertTrue(
      model.snapshot.weights.contains { $0.kg == 81.2 },
      "the logged weight row must be observed"
    )
  }

  // T-P06-02: untrusted numeric entry clamps to 40–250 at the model boundary.
  @MainActor
  func testWeightBoundsClampAtModelBoundary() async throws {
    let (model, _) = try await makeSeededModel()

    try await model.logWeight(1_000)
    for _ in 0..<100 {
      if model.snapshot.weights.count == 9 { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    XCTAssertTrue(
      model.snapshot.weights.contains { $0.kg == 250.0 },
      "out-of-range high input must clamp to 250"
    )

    try await model.logWeight(10)
    for _ in 0..<100 {
      if model.snapshot.weights.count == 10 { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    XCTAssertTrue(
      model.snapshot.weights.contains { $0.kg == 40.0 },
      "out-of-range low input must clamp to 40"
    )

    XCTAssertEqual(ProgressModel.clampKg(123.456), 123.5, "values snap to 0.1 steps")
  }

  // Week-energy labels must exist as text (day initials + values) — never
  // color-only (UI-SPEC a11y backstop).
  @MainActor
  func testWeeklyEnergyLabelsArePresentAsText() async throws {
    let (model, _) = try await makeSeededModel()

    let view = WeeklyEnergyView(model: model)
    let texts = try view.inspect().findAll(ViewType.Text.self).map { try $0.string() }

    XCTAssertTrue(texts.contains("Weekly energy"), "texts: \(texts)")
    XCTAssertTrue(texts.contains("Avg deficit"))
    let footer = try XCTUnwrap(texts.first { $0.contains("kcal/day") })
    XCTAssertTrue(footer.contains("1721"), "seeded avg deficit 2150 − 429 → −1721, got \(footer)")

    let symbols = Set(ProgressModel.databaseCalendar.veryShortWeekdaySymbols)
    let dayInitials = texts.filter { $0.count == 1 && $0 != "–" }
    XCTAssertEqual(dayInitials.count, 7, "7 day-initial captions expected, texts: \(texts)")
    XCTAssertTrue(dayInitials.allSatisfy { symbols.contains($0) })

    // Today's seeded meal (Spaghetti Bolognese) is one of the value labels.
    XCTAssertTrue(texts.contains("543"), "per-day value labels expected, texts: \(texts)")
  }
}
