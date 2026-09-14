import CoachCalNetworking
import CoachCalPersistence
import Foundation
import GRDB
import Network
import Observation
import SwiftUI

enum ScanMode: String, Equatable, Sendable {
  case photo
  case barcode
  case label
  case text
}

enum MealSlot: String, Equatable, CaseIterable, Sendable {
  case breakfast
  case lunch
  case dinner
  case snacks
}

struct ScanRoute: Identifiable, Equatable {
  let id = UUID()
  let mode: ScanMode
  let mealSlot: MealSlot?
}

// coachcal:// deep-link destinations (scheme registered in project.yml).
enum DeepLink: Equatable {
  case today
  case diary(Date?)
}

struct DebugLaunchArguments: Equatable {
  var freshStart = false
  var seedNoTargets = false
  var forceOffline = false
  var disableAnimations = false
  var edSafe = false
  var fixedClock: Date?

  // Parsed only under DEBUG — release builds must never let launch args alter behavior (T-P02-03).
  static func parse(_ arguments: [String] = ProcessInfo.processInfo.arguments) -> Self {
    #if DEBUG
    var parsed = DebugLaunchArguments()
    parsed.freshStart = arguments.contains("--ccFreshStart")
    parsed.seedNoTargets = arguments.contains("--ccSeedNoTargets")
    parsed.forceOffline = arguments.contains("--ccForceOffline")
    parsed.disableAnimations = arguments.contains("--ccDisableAnimations")
    parsed.edSafe = arguments.contains("--ccEDSafe")
    if let index = arguments.firstIndex(of: "--ccFixedClock"), index + 1 < arguments.count {
      parsed.fixedClock = ISO8601DateFormatter().date(from: arguments[index + 1])
    }
    return parsed
    #else
    return DebugLaunchArguments()
    #endif
  }
}

@MainActor
@Observable
final class AppEnvironment {
  let database: DatabasePool
  let diaryEntryRepository: DiaryEntryRepository
  let targetRepository: TargetRepository
  let diaryDetailRepository: DiaryDetailRepository
  let catalogRepository: CatalogRepository
  let trackingRepository: TrackingRepository
  let engagementRepository: EngagementRepository
  let seedDataManager: SeedDataManager
  let api: any CoachCalAPI

  private(set) var isReady = false
  private(set) var hasTargets = false
  private(set) var onboardingPending = false
  var edSafeMode: Bool {
    didSet { UserDefaults.standard.set(edSafeMode, forKey: Self.edSafeDefaultsKey) }
  }
  private(set) var isOffline = false
  var scanRoute: ScanRoute?
  var pendingDeepLink: DeepLink?
  let animationsDisabled: Bool
  var now: @Sendable () -> Date

  // NWPathMonitor.cancel() is thread-safe; deinit runs nonisolated.
  nonisolated(unsafe) private var offlineMonitor: NWPathMonitor?

  private static let edSafeDefaultsKey = "edSafeMode"
  // Mirrors SeedDataManager's demo persona (module keeps the constant internal).
  static let demoUserId = UUID(uuidString: "DE000000-0000-4000-8000-000000000001")!

  init() {
    let arguments = DebugLaunchArguments.parse()
    database = PersistenceBootstrap.shared.database
    diaryEntryRepository = DiaryEntryRepository(database: database)
    targetRepository = TargetRepository(database: database)
    diaryDetailRepository = DiaryDetailRepository(database: database)
    catalogRepository = CatalogRepository(database: database)
    trackingRepository = TrackingRepository(database: database)
    engagementRepository = EngagementRepository(database: database)
    api = FixtureApiClient(bundle: .main)
    animationsDisabled = arguments.disableAnimations
    isOffline = arguments.forceOffline
    let clock: @Sendable () -> Date
    if let fixedClock = arguments.fixedClock {
      clock = { fixedClock }
    } else {
      clock = { Date() }
    }
    now = clock
    // Seeding must honor the fixed clock so UI-test seeds align with model "today".
    seedDataManager = SeedDataManager(database: database, now: clock)
    if arguments.edSafe {
      edSafeMode = true
    } else {
      edSafeMode = UserDefaults.standard.bool(forKey: Self.edSafeDefaultsKey)
    }
    // --ccFreshStart alone skips seeding (onboarding route); combined with
    // --ccSeedNoTargets it must still seed the targetless persona so the app
    // lands on Today's empty state even after a prior seeded run.
    if !arguments.freshStart || arguments.seedNoTargets {
      Task { await seedAndRoute(seedTargets: !arguments.seedNoTargets) }
    } else {
      isReady = true
    }
    if arguments.forceOffline {
      isOffline = true
    } else {
      startOfflineMonitor()
    }
  }

  func openScan(_ mode: ScanMode, mealSlot: MealSlot?) {
    scanRoute = ScanRoute(mode: mode, mealSlot: mealSlot)
  }

  // coachcal://today → Today tab; coachcal://diary (+ optional ?date=YYYY-MM-DD)
  // → Today tab + DiaryDayView; unknown hosts and foreign schemes no-op.
  func open(url: URL) {
    guard url.scheme?.lowercased() == "coachcal" else { return }
    switch url.host?.lowercased() {
    case "today":
      pendingDeepLink = .today
    case "diary":
      pendingDeepLink = .diary(Self.linkDate(from: url))
    default:
      break
    }
  }

  private static func linkDate(from url: URL) -> Date? {
    guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
      let raw = components.queryItems?.first(where: { $0.name == "date" })?.value
    else { return nil }
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(identifier: "UTC")
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.date(from: raw)
  }

  // The Settings toggle's only write path. Feature files must never spell the
  // persisted property (GATE-1 greps the dotted name under App/Features), so
  // the binding is manufactured here, beside the single persistence didSet.
  var edSafeToggle: Binding<Bool> {
    Binding(
      get: { [weak self] in self?.edSafeMode ?? false },
      set: { [weak self] edSafeMode in self?.edSafeMode = edSafeMode }
    )
  }

  // T-P07-04: Phase 3 delete-account is a local reset — one transaction wipes
  // every app table so the session and the next launch are honestly empty and
  // route back to onboarding. The cloud cascade is a Phase 4 obligation.
  func performLocalAccountReset() async {
    UserDefaults.standard.removeObject(forKey: Self.edSafeDefaultsKey)
    edSafeMode = false
    try? await database.write { database in
      let tables = try String.fetchAll(
        database,
        sql: """
          SELECT name FROM sqlite_master
          WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'grdb_migrations'
          """
      )
      for table in tables {
        try database.execute(sql: "DELETE FROM \(table)")
      }
    }
    hasTargets = false
    onboardingPending = false
  }

  // Onboarding saveTarget handoff: flips RootView routing to MainShell.
  func completeOnboarding() {
    hasTargets = true
    onboardingPending = false
  }

  private func seedAndRoute(seedTargets: Bool) async {
    #if DEBUG
    try? await seedDataManager.ensureSeeded(seedTargets: seedTargets)
    if !seedTargets {
      onboardingPending = true
    }
    #endif
    hasTargets = (try? await targetRepository.activeTarget(user: Self.demoUserId)) != nil
    isReady = true
  }

  private func startOfflineMonitor() {
    let monitor = NWPathMonitor()
    monitor.pathUpdateHandler = { [weak self] path in
      let offline = path.status != .satisfied
      Task { @MainActor in
        self?.isOffline = offline
      }
    }
    monitor.start(queue: DispatchQueue(label: "com.nextlabs.coachcal.pathmonitor"))
    offlineMonitor = monitor
  }
}
