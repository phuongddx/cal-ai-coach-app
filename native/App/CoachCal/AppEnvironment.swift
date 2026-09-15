import CoachCalCore
import CoachCalNetworking
import CoachCalPersistence
import CoachCalSync
import Foundation
import GRDB
import MetricKit
import Network
import Observation
import PostHog
import Sentry
import Supabase
import SwiftUI
import WidgetKit

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
  // Used only by SignInFlowTests to force the sign-in gate under DEBUG —
  // every other existing DEBUG launch-argument combination leaves this false.
  var requireSignIn = false

  // Parsed only under DEBUG — release builds must never let launch args alter behavior (T-P02-03).
  static func parse(_ arguments: [String] = ProcessInfo.processInfo.arguments) -> Self {
    #if DEBUG
    var parsed = DebugLaunchArguments()
    parsed.freshStart = arguments.contains("--ccFreshStart")
    parsed.seedNoTargets = arguments.contains("--ccSeedNoTargets")
    parsed.forceOffline = arguments.contains("--ccForceOffline")
    parsed.disableAnimations = arguments.contains("--ccDisableAnimations")
    parsed.edSafe = arguments.contains("--ccEDSafe")
    parsed.requireSignIn = arguments.contains("--ccRequireSignIn")
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
  let healthKitService: HealthKitService
  // ENG-04: App Group snapshot the widget extension reads; cleared on
  // account reset (T-P45-03) so widget data never lingers past sign-out.
  let widgetSnapshotStore = WidgetSnapshotStore()
  var notificationScheduler: NotificationScheduler
  private(set) var isReady = false
  private(set) var hasTargets = false
  private(set) var onboardingPending = false
  var edSafeMode: Bool {
    didSet { UserDefaults.standard.set(edSafeMode, forKey: Self.edSafeDefaultsKey) }
  }
  var burnAddBackEnabled: Bool {
    didSet {
      UserDefaults.standard.set(burnAddBackEnabled, forKey: HealthKitSettingsKey.burnAddBackEnabled)
    }
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
  let authSessionStore: AuthSessionStore
  let accountDeletionTransport: AccountDeletionTransport
  let syncEngine: SyncEngine
  let requiresSignIn: Bool
  // T-P46-01/T-P46-02: Sentry/PostHog/MetricKit composition root. `false`
  // means "no operator-supplied DSN/API key this session" — every
  // subsequent call guards on these flags so a fresh checkout without live
  // credentials never crashes (RESEARCH "Missing dependencies with fallback").
  private let sentryConfigured: Bool
  private let postHogConfigured: Bool
  private var metricKitSubscriber: MetricKitSubscriber?
  // Reactive mirror of authSessionStore's session — @Observable tracks stored
  // properties on THIS class, not values reached through a plain struct, so
  // RootView's sign-in gate reads this instead of authSessionStore.currentSession.
  private(set) var authSession: Session?
  // The single call-site swap (Phase 4): a real signed-in session routes
  // scans through the live Edge Function; DEBUG demo-seeded tests
  // (requiresSignIn == false) and a session still restoring keep the
  // deterministic fixture untouched. Computed, not stored, so it always
  // reflects authSession as soon as sign-in/restore completes — never a
  // stale snapshot captured at app-launch init() time.
  var api: any CoachCalAPI {
    guard requiresSignIn, authSession != nil else { return FixtureApiClient(bundle: .main) }
    return LiveApiClient(client: authSessionStore.client)
  }
  // Keeps the foreground-notification observer alive; NotificationCenter only
  // holds a weak reference to it via its `[weak self]` fire callback.
  private var foregroundTrigger: ForegroundTrigger?

  init() {
    let arguments = DebugLaunchArguments.parse()
    // Started as early as possible so even a startup crash is captured; both
    // no-op safely (return false) when no operator-supplied credential is
    // configured this session — never crashes a fresh checkout.
    let sentryOK = Self.configureSentry()
    let postHogOK = Self.configurePostHog()
    sentryConfigured = sentryOK
    postHogConfigured = postHogOK
    database = PersistenceBootstrap.shared.database
    diaryEntryRepository = DiaryEntryRepository(database: database)
    targetRepository = TargetRepository(database: database)
    diaryDetailRepository = DiaryDetailRepository(database: database)
    catalogRepository = CatalogRepository(database: database)
    trackingRepository = TrackingRepository(database: database)
    engagementRepository = EngagementRepository(database: database)
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

    // Reuses SupabaseConfiguration's Info.plist boundary — never reads
    // SUPABASE_URL/SUPABASE_ANON_KEY ad hoc a second time.
    let configuration = try? SupabaseConfiguration()
    let authStore = AuthSessionStore(
      supabaseURL: configuration?.url ?? URL(string: "http://127.0.0.1:54321")!,
      anonKey: configuration?.anonKey ?? ""
    )
    authSessionStore = authStore
    accountDeletionTransport = AccountDeletionTransport(client: authStore.client)
    healthKitService = HKHealthKitService()
    syncEngine = SyncEngine(
      transport: SupabaseSyncTransport(client: authStore.client),
      outbox: OutboxRepository(database: database),
      merge: SyncMergeRepository(database: database),
      now: clock
    )
    #if DEBUG
    requiresSignIn = arguments.requireSignIn
    #else
    requiresSignIn = true
    #endif

    if arguments.edSafe {
      edSafeMode = true
    } else {
      edSafeMode = UserDefaults.standard.bool(forKey: Self.edSafeDefaultsKey)
    }
    burnAddBackEnabled = UserDefaults.standard.bool(forKey: HealthKitSettingsKey.burnAddBackEnabled)
    // Placeholder: reassigned below with the real self-capturing closures
    // once every other stored property has a value (two-phase init forbids
    // escaping `self` into a closure before that point).
    notificationScheduler = NotificationScheduler(
      mealsLoggedToday: { [] },
      edSafeMode: { false },
      now: clock
    )
    foregroundTrigger = ForegroundTrigger { [weak self] in
      Task { @MainActor in self?.notifyLocalMutation() }
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
    let metricKitSubscriber = MetricKitSubscriber(
      onMetricPayloads: { payloads in
        AppEnvironment.reportMetricKitMetrics(
          count: payloads.count, sentryConfigured: sentryOK, postHogConfigured: postHogOK
        )
      },
      onDiagnosticPayloads: { payloads in
        AppEnvironment.reportMetricKitDiagnostics(
          payloads, sentryConfigured: sentryOK, postHogConfigured: postHogOK
        )
      }
    )
    MXMetricManager.shared.add(metricKitSubscriber)
    self.metricKitSubscriber = metricKitSubscriber
    foregroundTrigger?.start()
    notificationScheduler = NotificationScheduler(
      mealsLoggedToday: { [weak self] in
        guard let self else { return [] }
        let day = DayKey.string(for: self.now(), calendar: .current)
        var logged: Set<NotificationScheduler.MealSlot> = []
        if let details = try? await self.diaryDetailRepository.details(forDay: day, mealSlot: MealSlot.lunch.rawValue),
          !details.isEmpty
        {
          logged.insert(.lunch)
        }
        if let details = try? await self.diaryDetailRepository.details(forDay: day, mealSlot: MealSlot.dinner.rawValue),
          !details.isEmpty
        {
          logged.insert(.dinner)
        }
        return logged
      },
      edSafeMode: { [weak self] in self?.edSafeMode ?? false },
      now: clock
    )
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

  // Parsed on the LOCAL calendar (noon-anchored) — the diary consumer groups
  // by date(e.created_at, 'localtime'), so a UTC-midnight parse opened the
  // sheet a day back west of UTC. Internal for the hosted contract test.
  static func linkDate(from url: URL) -> Date? {
    guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
      let raw = components.queryItems?.first(where: { $0.name == "date" })?.value
    else { return nil }
    let parts = raw.split(separator: "-")
    guard parts.count == 3, let year = Int(parts[0]), let month = Int(parts[1]),
      let day = Int(parts[2])
    else { return nil }
    var local = DateComponents()
    local.year = year
    local.month = month
    local.day = day
    local.hour = 12
    return Calendar.current.date(from: local)
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

  // Same single-write-path convention as edSafeToggle (TRK-03 burn add-back).
  var burnAddBackToggle: Binding<Bool> {
    Binding(
      get: { [weak self] in self?.burnAddBackEnabled ?? false },
      set: { [weak self] enabled in self?.burnAddBackEnabled = enabled }
    )
  }

  // T-P07-04: Phase 3 delete-account is a local reset; Phase 4 adds the
  // server-side cascade (explicit table purge + admin.deleteUser) ahead of
  // it. A cascade failure still falls through to the local wipe — the
  // device must never be left showing stale rows even if the server call
  // failed (documented here, not silently swallowed).
  func performLocalAccountReset() async {
    do {
      try await accountDeletionTransport.deleteAccount()
      try? await authSessionStore.signOut()
    } catch {
      // Server cascade failed (offline, already deleted, etc.) — the local
      // wipe below still runs so this device is never left in a stale state.
    }
    authSession = nil
    UserDefaults.standard.removeObject(forKey: Self.edSafeDefaultsKey)
    edSafeMode = false
    UserDefaults.standard.removeObject(forKey: HealthKitSettingsKey.burnAddBackEnabled)
    burnAddBackEnabled = false
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
    widgetSnapshotStore.clear()
    hasTargets = false
    onboardingPending = false
  }

  // Onboarding saveTarget handoff: flips RootView routing to MainShell.
  func completeOnboarding() {
    hasTargets = true
    onboardingPending = false
  }

  // The Task 1 fan-out seam: every diary/scan write calls this after a
  // successful local commit; later Phase 4 plans (notifications, widget)
  // extend this same method instead of re-touching the write call sites.
  func notifyLocalMutation() {
    Task { await syncEngine.notifyLocalMutation() }
    Task { await notificationScheduler.refresh() }
    Task { await refreshWidgetSnapshot() }
  }

  // ENG-04, 04-RESEARCH.md Pattern 7: recomputes calories-remaining from the
  // same diary/target totals ScanModel.loadSavedContext uses, writes the App
  // Group snapshot (carrying edSafeMode explicitly — Pitfall 6), and reloads
  // the widget's timeline. Only ever called from notifyLocalMutation()'s
  // existing foregrounded-write/foreground-trigger seam, never a background
  // timer (Pitfall 5 — foreground/app-triggered reloads are budget-free).
  private func refreshWidgetSnapshot() async {
    let day = DayKey.string(for: now(), calendar: .current)
    var total = 0
    for slot in MealSlot.allCases {
      let details = (try? await diaryDetailRepository.details(forDay: day, mealSlot: slot.rawValue)) ?? []
      total += details.reduce(0) { $0 + ($1.kcal ?? 0) }
    }
    let goal = (try? await targetRepository.activeTarget(user: currentUserId))?.dailyKcal ?? 0
    widgetSnapshotStore.write(
      WidgetSnapshot(caloriesRemaining: goal - total, edSafeMode: edSafeMode, updatedAt: now())
    )
    WidgetCenter.shared.reloadTimelines(ofKind: "CoachCalCaloriesWidget")
  }

  // requiresSignIn's userId source: demoUserId is the single-tenant local
  // persona used by every pre-Phase-4 screen (untouched, still correct once
  // signed in — the local SQLite install has exactly one active user at a
  // time); once a real session exists it becomes the sync engine's owner.
  var currentUserId: UUID {
    if requiresSignIn, let authSession {
      return authSession.user.id
    }
    return Self.demoUserId
  }

  // Called by SignInView after any of the three sign-in paths succeeds.
  func handleSignIn(_ session: Session) async {
    authSession = session
    await syncEngine.bind(session.user.id)
  }

  private func seedAndRoute(seedTargets: Bool) async {
    #if DEBUG
    try? await seedDataManager.ensureSeeded(seedTargets: seedTargets)
    if !seedTargets {
      onboardingPending = true
    }
    #endif
    hasTargets = (try? await targetRepository.activeTarget(user: Self.demoUserId)) != nil
    if requiresSignIn, let restored = try? await authSessionStore.restoreSession() {
      authSession = restored
      await syncEngine.bind(restored.user.id)
    } else if requiresSignIn {
      #if DEBUG
      // E2ESyncConvergenceTests-only fallback (04-07): a UI test can't script
      // a real Apple/Google system dialog or retrieve an email OTP code, so
      // when TEST_EMAIL/TEST_PASSWORD are present in the launch environment
      // (same idiom as AuthSessionTests/RealAuthConvergenceProof), sign in
      // directly against the real local Supabase account instead of leaving
      // SignInView with no scriptable path forward. Silently no-ops when
      // either var is absent — every other DEBUG launch combination
      // (SignInFlowTests included) is unaffected.
      let testCredentials = ProcessInfo.processInfo.environment
      if let email = testCredentials["TEST_EMAIL"] ?? testCredentials["COACHCAL_TEST_EMAIL"],
        let password = testCredentials["TEST_PASSWORD"] ?? testCredentials["COACHCAL_TEST_PASSWORD"],
        let session = try? await authSessionStore.signIn(email: email, password: password)
      {
        authSession = session
        await syncEngine.bind(session.user.id)
      }
      #endif
    }
    isReady = true
  }

  private func startOfflineMonitor() {
    let monitor = NWPathMonitor()
    monitor.pathUpdateHandler = { [weak self] path in
      let offline = path.status != .satisfied
      Task { @MainActor in
        guard let self else { return }
        let wasOffline = self.isOffline
        self.isOffline = offline
        if wasOffline && !offline {
          self.notifyLocalMutation()
        }
      }
    }
    monitor.start(queue: DispatchQueue(label: "com.nextlabs.coachcal.pathmonitor"))
    offlineMonitor = monitor
  }

  #if DEBUG
  // E2ESyncConvergenceTests-only seam (T-P47-01): flips the same isOffline
  // flag --ccForceOffline sets at launch, but mid-test — DebugLaunchArguments
  // parses once at init() and can't be toggled after a save already
  // happened. Wired to SettingsDetailView's debug.toggleOffline control.
  // Never present in a Release build.
  func setOfflineOverrideForTesting(_ value: Bool) {
    isOffline = value
  }
  #endif

  // MARK: - Sentry / PostHog / MetricKit (T-P46-01, T-P46-02, T-P46-SC)
  //
  // Allow-list: only these event names/properties may ever leave the device —
  // app lifecycle (PostHog's own captureApplicationLifecycleEvents) and the
  // metrickit_* counts below. Nothing here is ever a photo, a HealthKit- or
  // scan-derived value; feature code must never call Sentry/PostHog directly
  // (grep-gated: git grep -riE "Sentry|PostHog" -- Modules App/Features/Health
  // App/Features/Scan | grep -v Tests must report nothing outside this file).

  private static func configureSentry() -> Bool {
    guard let dsn = Bundle.main.object(forInfoDictionaryKey: "SENTRY_DSN") as? String,
      !dsn.isEmpty
    else {
      return false
    }
    SentrySDK.start { options in
      options.dsn = dsn
      options.tracesSampleRate = 0.2
      // T-P46-01: a screenshot or on-screen view hierarchy could show a food
      // photo or a HealthKit-derived value — never attach either.
      options.attachScreenshot = false
      options.attachViewHierarchy = false
      options.beforeSend = { event in
        event.breadcrumbs = event.breadcrumbs?.filter {
          Self.isAllowListedText($0.message) && Self.isAllowListedText($0.category)
        }
        event.extra = event.extra?.filter { Self.isAllowListedKey($0.key) }
        event.tags = event.tags?.filter { Self.isAllowListedKey($0.key) }
        return event
      }
    }
    return true
  }

  private static func configurePostHog() -> Bool {
    guard let apiKey = Bundle.main.object(forInfoDictionaryKey: "POSTHOG_API_KEY") as? String,
      !apiKey.isEmpty
    else {
      return false
    }
    let config = PostHogConfig(apiKey: apiKey)
    // T-P46-01: every autocapture/session-replay surface is off — only the
    // explicit metrickit_* events below (and PostHog's own app-lifecycle
    // events) ever leave the device; setBeforeSend is a defense-in-depth
    // strip of any photo/health-shaped property.
    config.captureScreenViews = false
    config.captureElementInteractions = false
    config.sessionReplay = false
    config.captureApplicationLifecycleEvents = true
    config.setBeforeSend { event in
      event.properties = event.properties.filter { Self.isAllowListedKey($0.key) }
      return event
    }
    PostHogSDK.shared.setup(config)
    return true
  }

  private static let disallowedPayloadFragments = [
    "photo", "image", "scan", "health", "hk", "kcal", "calorie", "weight", "meal", "food", "diary",
  ]

  private static func isAllowListedKey(_ key: String) -> Bool {
    let lowered = key.lowercased()
    return !Self.disallowedPayloadFragments.contains { lowered.contains($0) }
  }

  private static func isAllowListedText(_ text: String?) -> Bool {
    guard let text else { return true }
    return Self.isAllowListedKey(text)
  }

  // T-P46-02: MetricKit payloads never leave the device raw — only counts,
  // through the same allow-listed path as every other event. Never
  // symbolicated, never the payload's own JSON/stack-trace representation.
  nonisolated private static func reportMetricKitMetrics(
    count: Int, sentryConfigured: Bool, postHogConfigured: Bool
  ) {
    if sentryConfigured {
      SentrySDK.capture(message: "metrickit_metrics_received count=\(count)")
    }
    if postHogConfigured {
      PostHogSDK.shared.capture("metrickit_metrics_received", properties: ["count": count])
    }
  }

  nonisolated private static func reportMetricKitDiagnostics(
    _ payloads: [MXDiagnosticPayload], sentryConfigured: Bool, postHogConfigured: Bool
  ) {
    let crashCount = payloads.reduce(0) { $0 + ($1.crashDiagnostics?.count ?? 0) }
    let hangCount = payloads.reduce(0) { $0 + ($1.hangDiagnostics?.count ?? 0) }
    if sentryConfigured {
      SentrySDK.capture(
        message:
          "metrickit_diagnostics_received count=\(payloads.count) crash=\(crashCount) hang=\(hangCount)"
      )
    }
    if postHogConfigured {
      PostHogSDK.shared.capture(
        "metrickit_diagnostics_received",
        properties: ["count": payloads.count, "crash_count": crashCount, "hang_count": hangCount]
      )
    }
  }
}

// MXMetricManagerSubscriber's ObjC declaration is `<NSObject>` — a plain
// @Observable class can't satisfy that without inheriting NSObject, so this
// tiny adapter is the standard bridge rather than retrofitting NSObject onto
// the whole environment.
private final class MetricKitSubscriber: NSObject, MXMetricManagerSubscriber {
  private let onMetricPayloads: @Sendable ([MXMetricPayload]) -> Void
  private let onDiagnosticPayloads: @Sendable ([MXDiagnosticPayload]) -> Void

  init(
    onMetricPayloads: @escaping @Sendable ([MXMetricPayload]) -> Void,
    onDiagnosticPayloads: @escaping @Sendable ([MXDiagnosticPayload]) -> Void
  ) {
    self.onMetricPayloads = onMetricPayloads
    self.onDiagnosticPayloads = onDiagnosticPayloads
  }

  func didReceive(_ payloads: [MXMetricPayload]) {
    onMetricPayloads(payloads)
  }

  func didReceive(_ payloads: [MXDiagnosticPayload]) {
    onDiagnosticPayloads(payloads)
  }
}
