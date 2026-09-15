import CoachCalCore
import CoachCalPersistence
import GRDB
import SwiftUI
import ViewInspector
import XCTest

@testable import CoachCal

nonisolated final class SettingsTests: XCTestCase {
  private let edSafeDefaultsKey = "edSafeMode"
  private let fixedNow = ISO8601DateFormatter().date(from: "2026-09-12T09:00:00Z")!

  @MainActor
  private func makeTarget(
    dailyKcal: Int = 2150,
    sex: String = "female",
    goalWeightKg: Double? = 65
  ) -> UserTarget {
    UserTarget(
      id: UUID(),
      userId: AppEnvironment.demoUserId,
      dailyKcal: dailyKcal,
      proteinG: 161,
      carbsG: 215,
      fatG: 72,
      fiberGoalG: 30,
      waterGlasses: 8,
      sex: sex,
      heightCm: 165,
      weightKg: 70,
      goalWeightKg: goalWeightKg,
      paceKgPerWeek: 0.5,
      activity: "moderate",
      goal: "lose",
      updatedAt: fixedNow
    )
  }

  // The toggle is the only mutation path: flipping it writes the UserDefaults
  // key, and a fresh instance (the relaunch contract) reads that value back.
  @MainActor
  func testToggleFlipsAndPersistsEdSafeStateAcrossRelaunch() {
    UserDefaults.standard.removeObject(forKey: edSafeDefaultsKey)
    defer { UserDefaults.standard.removeObject(forKey: edSafeDefaultsKey) }

    let environment = AppEnvironment()
    XCTAssertFalse(environment.edSafeMode, "clean defaults must boot ED-Safe off")

    environment.edSafeToggle.wrappedValue = true
    XCTAssertTrue(environment.edSafeMode)
    XCTAssertTrue(
      UserDefaults.standard.bool(forKey: edSafeDefaultsKey),
      "flipping the toggle must persist the policy"
    )

    let relaunched = AppEnvironment()
    XCTAssertTrue(
      relaunched.edSafeMode,
      "a fresh instance must read the persisted policy (relaunch contract)"
    )

    environment.edSafeToggle.wrappedValue = false
    let thirdLaunch = AppEnvironment()
    XCTAssertFalse(thirdLaunch.edSafeMode)
  }

  @MainActor
  func testToggleAnnouncesEdSafeModeOnOff() throws {
    XCTAssertEqual(SettingsCopy.edSafeAnnouncement(isOn: true), "ED-Safe Mode, on")
    XCTAssertEqual(SettingsCopy.edSafeAnnouncement(isOn: false), "ED-Safe Mode, off")

    let view = SettingsDetailView(
      edSafeToggle: .constant(false),
      burnAddBackToggle: .constant(false),
      onDeleteAccount: {},
      csvExportAction: { Data() },
      onToggleDebugOffline: {}
    )
    let toggle = try view.inspect().find(ViewType.Toggle.self)
    XCTAssertEqual(
      try toggle.accessibilityIdentifier(),
      "settings.edSafeToggle",
      "the announcement-bearing toggle must be the settings.edSafeToggle element"
    )
  }

  // TRK-03: burn add-back defaults off and its Settings toggle flips the exact stored flag
  // HealthKitService reads (single source of truth, no independently-drifting copy).
  @MainActor
  func testBurnAddBackTogglePersistsAndDefaultsOff() throws {
    UserDefaults.standard.removeObject(forKey: HealthKitSettingsKey.burnAddBackEnabled)
    defer { UserDefaults.standard.removeObject(forKey: HealthKitSettingsKey.burnAddBackEnabled) }

    let environment = AppEnvironment()
    XCTAssertFalse(environment.burnAddBackEnabled, "burn add-back must default off (ROADMAP TRK-03)")

    let view = SettingsDetailView(
      edSafeToggle: .constant(false),
      burnAddBackToggle: .constant(false),
      onDeleteAccount: {},
      csvExportAction: { Data() },
      onToggleDebugOffline: {}
    )
    let toggle = try view.inspect().find(ViewType.Toggle.self) { toggle in
      (try? toggle.accessibilityIdentifier()) == "settings.burnAddBackToggle"
    }
    XCTAssertEqual(try toggle.accessibilityIdentifier(), "settings.burnAddBackToggle")

    environment.burnAddBackToggle.wrappedValue = true
    XCTAssertTrue(environment.burnAddBackEnabled)
    XCTAssertTrue(
      environment.healthKitService.burnAddBackEnabled,
      "HealthKitService must read the same stored flag the Settings toggle just flipped"
    )
  }

  // Locked destructive copy (T-P07-04) — grep-locked verbatim.
  @MainActor
  func testDeleteAccountDialogCopyIsVerbatim() {
    XCTAssertEqual(SettingsCopy.deleteAccountTitle, "Delete account?")
    XCTAssertEqual(
      SettingsCopy.deleteAccountMessage,
      "This permanently deletes your data on this device. Cloud deletion arrives with sync in a later update."
    )
    XCTAssertEqual(SettingsCopy.deleteAccountConfirm, "Delete account")
    XCTAssertEqual(SettingsCopy.cancel, "Cancel")
  }

  // T-P07-04: the confirmed destructive action must really delete local data
  // (never a silent no-op button presented as deletion).
  @MainActor
  func testLocalAccountResetWipesTablesAndRoutesToOnboarding() async throws {
    let environment = AppEnvironment()
    for _ in 0..<100 {
      if environment.hasTargets { break }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    XCTAssertTrue(environment.hasTargets, "seeded store must hold targets before the reset")

    // T-P45-03: prove the App Group snapshot is actually gone post-reset,
    // not merely never written. CoachCalTests runs hosted inside CoachCal.app
    // (TEST_HOST), so it shares the host app's App Group entitlement.
    environment.widgetSnapshotStore.write(
      WidgetSnapshot(caloriesRemaining: 500, edSafeMode: false, updatedAt: fixedNow)
    )
    XCTAssertNotNil(
      environment.widgetSnapshotStore.read(),
      "sanity: the App Group container must be reachable from this hosted test before asserting its absence"
    )

    environment.edSafeToggle.wrappedValue = true
    await environment.performLocalAccountReset()

    XCTAssertFalse(environment.hasTargets)
    XCTAssertFalse(environment.onboardingPending, "RootView must fall through to onboarding")
    XCTAssertFalse(environment.edSafeMode, "the reset clears the policy too")
    XCTAssertNil(
      environment.widgetSnapshotStore.read(),
      "widget snapshot must be gone immediately after account deletion/local reset"
    )
    let remainingTargets = try await environment.database.read { database in
      try Int.fetchOne(database, sql: "SELECT COUNT(*) FROM user_targets")
    }
    XCTAssertEqual(remainingTargets, 0, "local tables must be empty after the reset")
    UserDefaults.standard.removeObject(forKey: edSafeDefaultsKey)
  }

  @MainActor
  func testSubscriptionCardRendersDisplayOnly() throws {
    let view = SettingsDetailView(
      edSafeToggle: .constant(true),
      burnAddBackToggle: .constant(false),
      onDeleteAccount: {},
      csvExportAction: { Data() },
      onToggleDebugOffline: {}
    )
    let texts = try view.inspect().findAll(ViewType.Text.self).map { try $0.string() }
    XCTAssertTrue(texts.contains("Subscription"), "texts: \(texts)")
    XCTAssertTrue(texts.contains("Free"), "display-only plan state must be Free: \(texts)")
    XCTAssertTrue(texts.contains("Active"), "Active chip missing: \(texts)")
    XCTAssertTrue(texts.contains("Change plan"), "texts: \(texts)")
    XCTAssertTrue(texts.contains("Cancel subscription"), "texts: \(texts)")
    XCTAssertTrue(
      texts.contains(SettingsCopy.billingNote),
      "Phase-5 footnote missing: \(texts)"
    )
    XCTAssertTrue(
      texts.contains(SettingsCopy.versionCaption),
      "version caption missing: \(texts)"
    )
    XCTAssertTrue(
      texts.contains(SettingsCopy.edSafeDescription),
      "verbatim ED-Safe description missing: \(texts)"
    )
  }

  // TRU-03: real ShareLink export replaces the Phase-3 "Available soon" stub.
  // The ShareLink is structurally present regardless of load state (disabled
  // until the injected action resolves; see SettingsDetailView's own `.task`).
  // The closure is a stored property, so its wiring is verified by invoking
  // it directly rather than through a simulated tap — ViewInspector cannot
  // re-render @State after a tap on a manually-constructed view (see the
  // Apple Health tap test above for the established workaround pattern).
  @MainActor
  func testExportCsvPresentsShareLink() async throws {
    let expectedCSV = Data("# user_targets\nid\n".utf8)
    let view = SettingsDetailView(
      edSafeToggle: .constant(false),
      burnAddBackToggle: .constant(false),
      onDeleteAccount: {},
      csvExportAction: { expectedCSV },
      onToggleDebugOffline: {}
    )
    let shareLink = try view.inspect().find(ViewType.ShareLink.self)
    XCTAssertEqual(try shareLink.accessibilityIdentifier(), "settings.row.export")

    let produced = try await view.csvExportAction()
    XCTAssertEqual(
      produced, expectedCSV,
      "Export CSV must share exactly what the injected action produces"
    )
  }

  // Every save funnels through TargetsEngine: sub-floor requests clamp to the
  // sex floor, macros re-derive 30/40/30, goal weight respects the 40 kg bound.
  @MainActor
  func testTargetEditSaveReclampsThroughTargetsEngine() {
    let female = makeTarget(dailyKcal: 2150, sex: "female", goalWeightKg: 65)
    let reclamped = TargetEditSheet.reclamped(
      female,
      requestedKcal: 900,
      requestedGoalWeightKg: 30,
      now: fixedNow
    )
    XCTAssertEqual(reclamped.dailyKcal, TargetsEngine.femaleFloorKcal, "floor must clamp")
    let macros = TargetsEngine.macroGrams(forKcal: reclamped.dailyKcal)
    XCTAssertEqual(
      reclamped.proteinG, macros.proteinG,
      "macros must re-derive from the clamped kcal, never echo the request"
    )
    XCTAssertEqual(reclamped.carbsG, macros.carbsG)
    XCTAssertEqual(reclamped.fatG, macros.fatG)
    XCTAssertEqual(reclamped.goalWeightKg, TargetsEngine.minGoalWeightKg, "40 kg bound")
    XCTAssertEqual(reclamped.updatedAt, fixedNow)
    XCTAssertEqual(reclamped.id, female.id, "an edit updates the same target row")

    let male = makeTarget(dailyKcal: 100, sex: "male", goalWeightKg: 90)
    let clampedMale = TargetEditSheet.reclamped(
      male,
      requestedKcal: 100,
      requestedGoalWeightKg: 90,
      now: fixedNow
    )
    XCTAssertEqual(clampedMale.dailyKcal, TargetsEngine.maleFloorKcal)

    // In-range edits pass through unchanged except the timestamp.
    let untouched = TargetEditSheet.reclamped(
      female,
      requestedKcal: 2150,
      requestedGoalWeightKg: 65,
      now: fixedNow
    )
    XCTAssertEqual(untouched.dailyKcal, 2150)
    XCTAssertEqual(untouched.goalWeightKg, 65)
  }

  @MainActor
  func testProfileRendersGroupFInventory() throws {
    let stats = ProfileModel.Stats(
      target: makeTarget(),
      latestKg: 80.0,
      daysLogged: 21,
      memberSince: fixedNow
    )
    let view = ProfileView(stats: stats, onEditTargets: nil, onOpenSettings: {})
    let texts = try view.inspect().findAll(ViewType.Text.self).map { try $0.string() }
    XCTAssertTrue(texts.contains("Alex"), "user card name missing: \(texts)")
    XCTAssertTrue(texts.contains("Free · Since Sep 2026"), "plan line missing: \(texts)")
    XCTAssertTrue(texts.contains("Days logged"), "quick stats missing: \(texts)")
    XCTAssertTrue(texts.contains("Weight, kg"), "quick stats missing: \(texts)")
    XCTAssertTrue(texts.contains("kcal / day"), "quick stats missing: \(texts)")
    XCTAssertTrue(texts.contains("Goals & targets"), "goals group missing: \(texts)")
    XCTAssertTrue(texts.contains("Daily target"), "goals rows missing: \(texts)")
    XCTAssertTrue(texts.contains("Macro ratios"), "goals rows missing: \(texts)")
    XCTAssertTrue(texts.contains("Goal weight"), "goals rows missing: \(texts)")
    XCTAssertTrue(texts.contains("Integrations"), "integrations group missing: \(texts)")
    XCTAssertTrue(texts.contains("Apple Health"), "health row missing: \(texts)")
    XCTAssertTrue(texts.contains("Not connected"), "health value missing: \(texts)")
    XCTAssertTrue(texts.contains("Preferences"), "preferences group missing: \(texts)")
    XCTAssertTrue(texts.contains("Reminders"), "preference rows missing: \(texts)")
    XCTAssertTrue(texts.contains("Appearance"), "preference rows missing: \(texts)")
    XCTAssertTrue(texts.contains("System"), "preference values missing: \(texts)")
    XCTAssertTrue(texts.contains("Units"), "preference rows missing: \(texts)")
    XCTAssertTrue(texts.contains("Metric"), "preference values missing: \(texts)")
    XCTAssertTrue(texts.contains("Settings"), "settings entry row missing: \(texts)")

    let identifiers = try view.inspect().findAll(ViewType.Button.self)
      .compactMap { try? $0.accessibilityIdentifier() }
    XCTAssertFalse(
      identifiers.contains { $0.lowercased().contains("healthconnect") },
      "no Health Connect row may exist (Android is out of scope post-pivot)"
    )
  }

  // The Apple Health row reveals the Phase-4 footnote — never a permission
  // prompt. (The reveal state is injected: ViewInspector cannot re-render
  // @State after a tap on a manually-constructed view.)
  @MainActor
  func testAppleHealthTapShowsPhase4Footnote() throws {
    let stats = ProfileModel.Stats(target: nil, daysLogged: 0)
    let view = ProfileView(
      stats: stats,
      onOpenSettings: {},
      healthNoteRevealed: true
    )
    let texts = try view.inspect().findAll(ViewType.Text.self).map { try $0.string() }
    XCTAssertTrue(
      texts.contains(OnboardingCopy.healthConnectNote),
      "Phase-4 footnote missing: \(texts)"
    )
    XCTAssertEqual(
      OnboardingCopy.healthConnectNote,
      "Apple Health connects in a later update."
    )

    let hidden = ProfileView(stats: stats, onOpenSettings: {})
    let hiddenTexts = try hidden.inspect().findAll(ViewType.Text.self).map { try $0.string() }
    XCTAssertFalse(
      hiddenTexts.contains(OnboardingCopy.healthConnectNote),
      "footnote must stay hidden until the row is tapped"
    )
  }
}
