import CoachCalCore
import CoachCalDesignSystem
import CoachCalPersistence
import GRDB
import Observation
import SwiftUI

@MainActor
@Observable
final class ProfileModel {
  struct Stats: Equatable {
    var target: UserTarget?
    var latestKg: Double?
    var daysLogged: Int = 0
    var memberSince: Date?
  }

  private(set) var stats = Stats()

  private let pool: DatabasePool
  private let userId: UUID
  let now: @Sendable () -> Date
  // Task.cancel() is thread-safe; deinit runs nonisolated (Pitfall 1).
  nonisolated(unsafe) private var observationTask: Task<Void, Never>?

  init(
    pool: DatabasePool,
    userId: UUID,
    now: @escaping @Sendable () -> Date
  ) {
    self.pool = pool
    self.userId = userId
    self.now = now
    startObservation()
  }

  deinit {
    observationTask?.cancel()
  }

  private func startObservation() {
    observationTask?.cancel()
    let userId = userId
    let monthStart = ProfileModel.dayString(
      Calendar.current.date(byAdding: .day, value: -29, to: now())!
    )
    let observation = ValueObservation.tracking { database -> ProfileModel.Stats in
      let target = try UserTarget
        .filter(Column("user_id") == userId)
        .order(Column("updated_at").desc)
        .fetchOne(database)
      let memberSince = try Date
        .fetchOne(
          database,
          sql: "SELECT MIN(updated_at) FROM user_targets WHERE user_id = ?",
          arguments: [userId]
        )
      let latestKg = try Double.fetchOne(
        database,
        sql: """
          SELECT kg FROM weight_logs WHERE user_id = ?
          ORDER BY day DESC, created_at DESC LIMIT 1
          """,
        arguments: [userId]
      )
      let daysLogged = try Int.fetchOne(
        database,
        sql: """
          SELECT COUNT(DISTINCT date(e.created_at, 'localtime')) FROM diary_entries e
          WHERE e.deleted_at IS NULL AND e.user_id = ? AND date(e.created_at, 'localtime') >= ?
          """,
        arguments: [userId, monthStart]
      ) ?? 0
      return Stats(
        target: target,
        latestKg: latestKg,
        daysLogged: daysLogged,
        memberSince: memberSince
      )
    }

    observationTask = Task { [weak self] in
      guard let pool = self?.pool else { return }
      do {
        for try await fresh in observation.values(in: pool) {
          self?.stats = fresh
        }
      } catch {
        // Observation cancelled or pool closed; keep the last snapshot.
      }
    }
  }

  static func dayString(_ date: Date) -> String {
    DayKey.string(for: date)
  }
}

// Group F route: owns the environment and the two presentations (Settings
// push, target-edit sheet); the screens themselves are props-driven.
struct ProfileFlow: View {
  @Environment(AppEnvironment.self) private var environment
  @State private var model: ProfileModel?
  @State private var showsSettings = false
  @State private var showsTargetEdit = false

  var body: some View {
    NavigationStack {
      if let model {
        ProfileView(
          stats: model.stats,
          onEditTargets: model.stats.target == nil ? nil : { showsTargetEdit = true },
          onOpenSettings: { showsSettings = true }
        )
        .navigationDestination(isPresented: $showsSettings) {
          SettingsDetailView(
            edSafeToggle: environment.edSafeToggle,
            burnAddBackToggle: environment.burnAddBackToggle,
            onDeleteAccount: {
              Task { await environment.performLocalAccountReset() }
            }
          )
        }
        .sheet(isPresented: $showsTargetEdit) {
          if let target = model.stats.target {
            TargetEditSheet(
              initial: target,
              now: environment.now,
              onSave: { try? await environment.targetRepository.saveTarget($0) },
              onDismiss: { showsTargetEdit = false }
            )
          }
        }
      } else {
        Color.ccBackground.overlay(ProgressView())
      }
    }
    .task {
      if model == nil {
        model = ProfileModel(
          pool: environment.database,
          userId: environment.currentUserId,
          now: environment.now
        )
      }
    }
  }
}
