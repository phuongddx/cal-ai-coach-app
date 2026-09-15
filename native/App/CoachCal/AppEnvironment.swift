import CoachCalNetworking
import CoachCalPersistence
import CoachCalSync
import Foundation
import GRDB
import Network
import Observation
import Supabase
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
  let authSessionStore: AuthSessionStore
  let accountDeletionTransport: AccountDeletionTransport
  let syncEngine: SyncEngine
  let requiresSignIn: Bool
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
    foregroundTrigger?.start()
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

  // The Task 1 fan-out seam: every diary/scan write calls this after a
  // successful local commit; later Phase 4 plans (notifications, widget)
  // extend this same method instead of re-touching the write call sites.
  func notifyLocalMutation() {
    Task { await syncEngine.notifyLocalMutation() }
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
}
