@preconcurrency import ActivityKit
import CoachCalCore
import CoachCalNetworking
import CoachCalPersistence
import Foundation
import GRDB
import Observation
import SwiftUI
import UIKit

// Scan flow state machine (RESEARCH Pattern 1): capture → analyzing →
// review/saved/quota/failed. Zero live network — `api` is any CoachCalAPI
// (FixtureApiClient in Phase 3, edge functions behind the same protocol in
// Phase 4). Displayed kcal is ALWAYS recomputed via KcalArithmetic from the
// current grams (T-P05-02); the response's kcal fields are never the display
// source after an edit.
@MainActor
@Observable
final class ScanModel {
  enum AnalyzingStep: String, CaseIterable, Sendable {
    case detecting
    case reading
    case checking
    // Tier-2 escalation only (RESEARCH: extend AnalyzingStep, not a parallel
    // loading-state enum) — surfaced by a duration watchdog once a real
    // analyze-food call runs past the escalation budget, so the analyzing
    // screen never appears frozen during a real second-pass re-run.
    case confirming

    var title: String {
      switch self {
      case .detecting: "Detecting food"
      case .reading: "Reading nutrition"
      case .checking: "Checking accuracy"
      case .confirming: "Confirming with a second pass"
      }
    }
  }

  enum ScanFailure: Equatable, Sendable {
    case barcodeNotFound
    case analysisFailure
  }

  enum Phase: Equatable {
    case capture
    case analyzing(AnalyzingStep)
    case review
    case saved
    case quotaReached(EntitlementState)
    case failed(ScanFailure)
  }

  struct Correction: Equatable, Sendable {
    enum Kind: String, CaseIterable, Sendable {
      case wrongFood
      case portionOff
      case missingItem
      case other

      var title: String {
        switch self {
        case .wrongFood: "Wrong food"
        case .portionOff: "Portion way off"
        case .missingItem: "Missing item"
        case .other: "Something else"
        }
      }
    }

    let kind: Kind
    let note: String
  }

  struct ResultItem: Identifiable {
    let id: Int
    let source: ScanItem
    var grams: Int
    var isUnresolved: Bool
    var correction: Correction?
  }

  struct ScanResult {
    let scanId: UUID
    var items: [ResultItem]
    let scanConfidence: Double
  }

  struct Persistence {
    let pool: DatabasePool
    let entries: DiaryEntryRepository
    let details: DiaryDetailRepository
    let targets: TargetRepository
    let engagement: EngagementRepository
    let catalog: CatalogRepository
    // Phase 4 dispatch seam — nil default keeps every existing test call site
    // unmodified; the real app wires environment.notifyLocalMutation() here.
    var notifyMutation: (@Sendable () -> Void)?
    // ENG-04: read at save-time only, to carry ED-Safe state into the
    // bounded Live Activity content — the widget process can't reach
    // @Environment(\.edSafeMode) any more than the WidgetSnapshot's reader can
    // (same Pitfall 6 constraint). nil default keeps every existing test call
    // site unmodified.
    var edSafeMode: (@Sendable () -> Bool)?
  }

  private(set) var phase: Phase = .capture
  private(set) var result: ScanResult?
  private(set) var isAnalyzing = false
  private(set) var captureThumb: UIImage?
  var mealTitle = "Scanned meal"
  var mealSlot: MealSlot
  var describeText = ""
  private(set) var savedEntryIds: [UUID] = []
  private(set) var isSaving = false
  private(set) var savedKcal: Int?
  private(set) var todayKcal: Int?
  private(set) var goalKcal: Int?
  private(set) var streakCount: Int?
  private(set) var freezesLeft: Int = 0

  private let api: any CoachCalAPI
  private let persistence: Persistence?
  private let userId: UUID
  private let now: @Sendable () -> Date
  // Unstructured tasks owned by an in-flight analyze; cancelAnalyzing tears
  // both down. Handles stay MainActor-only; cancel is safe from any context.
  private var analyzeTask: Task<Void, Never>?
  private var workTask: Task<ScanResponse, Error>?
  // ENG-04: bounded, app-driven Live Activity around this scan's save
  // (Pattern 9, 04-RESEARCH.md) — never spans the app's full lifetime.
  private var liveActivity: Activity<CoachCalLiveActivityAttributes>?
  private static let stepInterval: Double = 0.5
  // Past this, a real analyze-food call is very likely mid a Tier-2
  // escalation re-run rather than merely slow (must_haves: "<5s budget on
  // Tier-1") — the analyzing screen must show the 4th step, never sit
  // apparently frozen on step one for the whole wait.
  private static let escalationBudgetSeconds: Double = 5.0

  init(
    api: any CoachCalAPI,
    persistence: Persistence?,
    userId: UUID,
    now: @escaping @Sendable () -> Date,
    mealSlot: MealSlot
  ) {
    self.api = api
    self.persistence = persistence
    self.userId = userId
    self.now = now
    self.mealSlot = mealSlot
  }

  // MARK: - Analyze

  func analyze(with capture: ScanCapture) {
    captureThumb = capture.image
    startAnalyzing(request: capture.request)
  }

  func analyze(description: String) {
    startAnalyzing(request: ScanRequest(kind: .text, text: description))
  }

  func analyze(pickedImage image: UIImage, mode: ScanMode) {
    captureThumb = image
    Task {
      let request: ScanRequest
      switch mode {
      case .barcode:
        let barcode = await ScanImageAnalysis.detectBarcode(in: image)
        request = ScanRequest(kind: .barcode, barcode: barcode)
      case .label:
        let text = await ScanImageAnalysis.recognizeText(in: image)
        request = ScanRequest(kind: .label, text: text)
      default:
        request = ScanRequest(kind: .photo)
      }
      startAnalyzing(request: request)
    }
  }

  private func startAnalyzing(request: ScanRequest) {
    guard !isAnalyzing else { return }
    isAnalyzing = true
    phase = .analyzing(.detecting)
    let startedAt = Date()
    let work = Task { [api] in try await api.analyzeFood(request) }
    workTask = work
    analyzeTask = Task { [weak self] in
      await self?.finishAnalyzing(work, startedAt: startedAt)
    }
  }

  private func finishAnalyzing(_ work: Task<ScanResponse, Error>, startedAt: Date) async {
    // Watchdog, not a parallel loading enum (RESEARCH): while work.value is
    // still in flight past the escalation budget, surface the 4th step so a
    // real Tier-2 re-run never leaves the screen apparently frozen on step
    // one. defer cancels it on every exit path (success, cancellation, any
    // catch) so a stale fire can never clobber a later/cancelled analysis.
    let watchdog = Task { [weak self] in
      try? await Task.sleep(nanoseconds: UInt64(Self.escalationBudgetSeconds * 1_000_000_000))
      guard !Task.isCancelled else { return }
      self?.phase = .analyzing(.confirming)
    }
    defer { watchdog.cancel() }
    do {
      let response = try await work.value
      let escalated = phase == .analyzing(.confirming)
      let steps: [AnalyzingStep] = escalated
        ? AnalyzingStep.allCases
        : Array(AnalyzingStep.allCases.prefix(3))
      // Failure states surface immediately (quota/error never behind the
      // checklist); only the success path plays the checklist out to the
      // minimum dwell so the analyzing state is real and observable.
      for (index, step) in steps.enumerated() {
        guard !Task.isCancelled else { return }
        phase = .analyzing(step)
        let remaining = Double(index + 1) * Self.stepInterval - Date().timeIntervalSince(startedAt)
        if remaining > 0 {
          try await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
        }
      }
      // A cancelled task must never touch state: cancelAnalyzing may already
      // have started a new analysis whose phase/isAnalyzing a stale resume
      // would clobber (opening the re-entrancy gate mid-flight).
      guard !Task.isCancelled else { return }
      receive(response)
    } catch is CancellationError {
      guard !Task.isCancelled else { return }
      phase = .capture
    } catch let error as ScanAPIError {
      guard !Task.isCancelled else { return }
      route(error)
    } catch {
      guard !Task.isCancelled else { return }
      phase = .failed(.analysisFailure)
    }
    isAnalyzing = false
  }

  func cancelAnalyzing() {
    guard isAnalyzing else { return }
    workTask?.cancel()
    analyzeTask?.cancel()
    workTask = nil
    analyzeTask = nil
    phase = .capture
    isAnalyzing = false
  }

  // MARK: - Result state

  func receive(_ response: ScanResponse) {
    let items = response.items.enumerated().map { index, item in
      ResultItem(
        id: index,
        source: item,
        grams: item.grams,
        isUnresolved: item.unresolved,
        correction: nil
      )
    }
    result = ScanResult(scanId: response.scanId, items: items, scanConfidence: response.scanConfidence)
    mealTitle = "Scanned meal"
    phase = .review
  }

  private func route(_ error: ScanAPIError) {
    if error.isQuotaReached, case .envelope(_, _, let entitlement) = error {
      phase = .quotaReached(
        entitlement ?? EntitlementState(tier: "free", scansUsed: 0, scanLimit: 3, windowResetAt: now())
      )
    } else if error.isBarcodeNotFound {
      phase = .failed(.barcodeNotFound)
    } else {
      phase = .failed(.analysisFailure)
    }
  }

  func reportCaptureFailure() {
    guard !isAnalyzing else { return }
    phase = .failed(.analysisFailure)
  }

  func retry() {
    phase = .capture
  }

  func retake() {
    result = nil
    captureThumb = nil
    phase = .capture
  }

  func startNewScan() {
    result = nil
    captureThumb = nil
    savedEntryIds = []
    savedKcal = nil
    phase = .capture
  }

  // MARK: - Review edits (kcal invariant lives here)

  func setGrams(_ grams: Int, at itemId: Int) {
    guard let index = result?.items.firstIndex(where: { $0.id == itemId }) else { return }
    result?.items[index].grams = max(0, grams)
  }

  func itemGramsBinding(for itemId: Int) -> Binding<Int> {
    Binding(
      get: { [weak self] in self?.result?.items.first { $0.id == itemId }?.grams ?? 0 },
      set: { [weak self] in self?.setGrams($0, at: itemId) }
    )
  }

  // Deterministic recompute from CURRENT grams — never the fixture's kcal.
  func itemKcal(at itemId: Int) -> Int {
    guard let item = result?.items.first(where: { $0.id == itemId }) else { return 0 }
    return KcalArithmetic.mealKcal(per100gKcal: item.source.per100g.kcal, grams: item.grams)
  }

  var mealKcal: Int {
    guard let items = result?.items else { return 0 }
    return items.reduce(0) { $0 + itemKcal(at: $1.id) }
  }

  var hasHiddenFat: Bool {
    result?.items.contains { $0.source.hiddenFatLikely } ?? false
  }

  // The chip's "+{kcal} added" is the recomputed contribution of the
  // not-fully-visible item(s) already inside the total — never an invented
  // number.
  var hiddenFatAddedKcal: Int {
    guard let items = result?.items else { return 0 }
    return items
      .filter { $0.source.hiddenFatLikely }
      .reduce(0) { $0 + itemKcal(at: $1.id) }
  }

  var hasUnresolved: Bool {
    result?.items.contains { $0.isUnresolved } ?? false
  }

  var isSaveEnabled: Bool {
    result != nil && !hasUnresolved && !isAnalyzing && !isSaving && savedEntryIds.isEmpty
  }

  func captureCorrection(kind: Correction.Kind, note: String, for itemId: Int) {
    guard let index = result?.items.firstIndex(where: { $0.id == itemId }) else { return }
    result?.items[index].correction = Correction(kind: kind, note: note)
    // Resolving the flagged concern is the only path off "Review needed".
    if result?.items[index].isUnresolved == true {
      result?.items[index].isUnresolved = false
    }
  }

  // MARK: - Save / Undo

  // Mirror + outbox via the diary repositories (one pending op per entry,
  // detail row per item with recomputed nutrition). The whole batch commits
  // in one transaction and isSaving rejects re-entrant Save taps, so a
  // double-tap or mid-write failure can never duplicate entries. Outbox
  // DISPATCH is wired in Phase 4 — the write path matches 03-03's committed
  // diary idiom.
  func save() async {
    guard !isSaving, let result, let persistence, isSaveEnabled else { return }
    isSaving = true
    defer { isSaving = false }
    let stamp = now()
    do {
      let upserts = result.items.map { item in
        let entry = DiaryEntry(
          id: UUID(),
          userId: userId,
          displayText: item.source.label,
          createdAt: stamp,
          updatedAt: stamp,
          deletedAt: nil,
          serverVersion: 0,
          acceptedOpId: nil,
          serverUpdatedAt: stamp
        )
        let detail = DiaryEntryDetail(
          entryId: entry.id,
          mealSlot: mealSlot.rawValue,
          title: item.id == 0 ? mealTitle : item.source.label,
          grams: item.grams,
          kcal: itemKcal(at: item.id),
          proteinG: KcalArithmetic.macroGrams(per100g: item.source.per100g.proteinG, grams: item.grams),
          carbsG: KcalArithmetic.macroGrams(per100g: item.source.per100g.carbsG, grams: item.grams),
          fatG: KcalArithmetic.macroGrams(per100g: item.source.per100g.fatG, grams: item.grams),
          fiberG: KcalArithmetic.macroGrams(per100g: item.source.per100g.fiberG, grams: item.grams),
          confidence: item.source.confidence,
          hiddenFatLikely: item.source.hiddenFatLikely,
          source: "scan",
          unresolved: item.isUnresolved,
          scanId: result.scanId.uuidString
        )
        return DiaryEntryRepository.EntryDetailUpsert(entry: entry, detail: detail)
      }
      let operations = try await persistence.entries.recordUpserts(upserts, now: stamp)
      savedEntryIds = operations.map(\.recordId)
      persistence.notifyMutation?()
      savedKcal = mealKcal
      phase = .saved
      await persistSavedMeal()
      await loadSavedContext()
      await startBoundedLiveActivity()
    } catch {
      // Local-first write failure keeps the review open so Save can retry
      // from a clean slate — the rolled-back transaction left nothing behind.
    }
  }

  // Tombstones the just-written entries and deletes their detail rows.
  func undo() async {
    guard let persistence else { return }
    for entryId in savedEntryIds {
      if let entry = try? await persistence.pool.read({ database in
        try DiaryEntry.fetchOne(database, key: entryId)
      }) {
        _ = try? await persistence.entries.recordTombstone(entry, now: now())
        persistence.notifyMutation?()
      }
      try? await persistence.details.delete(entryId: entryId)
    }
    savedEntryIds = []
    savedKcal = nil
    phase = .review
    await endLiveActivityImmediately()
    await loadSavedContext()
  }

  // LOG-07: the review's save also feeds the saved-meals rail contract —
  // itemsJson mirrors SavedMealItem's [{name, grams, kcal}] shape that 03-04's
  // one-tap re-log decodes. kcal is KcalArithmetic-derived per item so the
  // re-log never persists the meal's aggregate figure on a single row.
  struct SavedMealItemPayload: Codable {
    let name: String
    let grams: Int
    let kcal: Int
  }

  private func persistSavedMeal() async {
    guard let persistence, let result else { return }
    let items = result.items.map { item in
      SavedMealItemPayload(name: item.source.label, grams: item.grams, kcal: itemKcal(at: item.id))
    }
    guard let itemsJson = try? String(data: JSONEncoder().encode(items), encoding: .utf8) else {
      return
    }
    let meal = SavedMeal(
      id: UUID(),
      userId: userId,
      name: mealTitle,
      symbol: nil,
      kcal: mealKcal,
      itemsJson: itemsJson,
      createdAt: now()
    )
    try? await persistence.catalog.saveMeal(meal)
  }

  private func loadSavedContext() async {
    guard let persistence else { return }
    let day = Self.dayString(now())
    var total = 0
    for slot in MealSlot.allCases {
      let details = (try? await persistence.details.details(forDay: day, mealSlot: slot.rawValue)) ?? []
      total += details.reduce(0) { $0 + ($1.kcal ?? 0) }
    }
    todayKcal = total
    goalKcal = (try? await persistence.targets.activeTarget(user: userId))?.dailyKcal
    let streak = try? await persistence.engagement.streakState()
    streakCount = streak?.currentStreak
    freezesLeft = streak?.freezesLeft ?? 0
  }

  // ENG-04: starts a bounded Live Activity right after a successful save,
  // then schedules its own dismissal ~60s later — "bounded logging events"
  // per ROADMAP, never a persistent all-day activity. undo() can still
  // shorten that window via endLiveActivityImmediately(). The dismissal is
  // a local timer (not ActivityKit's own dismissalPolicy: .after(...)) so
  // end() is only ever called once, from endLiveActivityImmediately() —
  // calling it inline here while self.liveActivity still aliases the same
  // value is rejected by Swift 6's sending checks (two live MainActor
  // references to a value being sent to @concurrent end()).
  // try?: Live Activities can be disabled system-wide/per-app; a refusal
  // here is silent, matching this feature's "optional" scope.
  private func startBoundedLiveActivity() async {
    let remaining = todayKcal.map { (goalKcal ?? 0) - $0 } ?? 0
    let edSafe = persistence?.edSafeMode?() ?? false
    guard
      let activity = try? Activity<CoachCalLiveActivityAttributes>.request(
        attributes: CoachCalLiveActivityAttributes(mealSlot: mealSlot.rawValue),
        content: .init(state: .init(caloriesRemaining: remaining, edSafeMode: edSafe), staleDate: nil)
      )
    else { return }
    liveActivity = activity
    Task { [weak self] in
      try? await Task.sleep(for: .seconds(60))
      await self?.endLiveActivityImmediately()
    }
  }

  private func endLiveActivityImmediately() async {
    guard let activity = liveActivity else { return }
    liveActivity = nil
    await activity.end(nil, dismissalPolicy: .immediate)
  }

  static func dayString(_ date: Date) -> String {
    DayKey.string(for: date)
  }

  #if DEBUG
  // Snapshot-test seam: deterministic phase placement without driving the
  // async analyze pipeline.
  func setPhaseForTesting(_ newPhase: Phase) {
    phase = newPhase
  }
  #endif
}
