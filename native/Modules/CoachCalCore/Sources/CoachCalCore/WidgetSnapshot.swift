import Foundation

// ENG-04, 04-RESEARCH.md Pattern 7: the host app writes this to the shared
// App Group container on every relevant write and on foreground; the
// widget extension's TimelineProvider only ever reads it — zero network,
// zero access to the host's SwiftUI Environment (a separate process can't
// reach it). edSafeMode is carried explicitly here because of that: it is
// the ONLY channel ED-Safe state has to reach the widget (Pitfall 6).
public struct WidgetSnapshot: Codable, Equatable, Sendable {
  public let caloriesRemaining: Int
  public let edSafeMode: Bool
  public let updatedAt: Date

  public init(caloriesRemaining: Int, edSafeMode: Bool, updatedAt: Date) {
    self.caloriesRemaining = caloriesRemaining
    self.edSafeMode = edSafeMode
    self.updatedAt = updatedAt
  }
}

// File-backed read/write for the App Group snapshot. Both the host app
// target and the CoachCalWidget extension target link this SAME type from
// CoachCalCore, so the shape is never independently duplicated across the
// process boundary (T-P45-02: the decode path is Codable's own strict
// decode — a missing or malformed file just decodes to nil, never crashes).
public struct WidgetSnapshotStore: Sendable {
  private let appGroupIdentifier: String
  private static let fileName = "widget-snapshot.json"

  public init(appGroupIdentifier: String = "group.com.nextlabs.coachcal") {
    self.appGroupIdentifier = appGroupIdentifier
  }

  private var fileURL: URL? {
    FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)?
      .appendingPathComponent(Self.fileName)
  }

  /// Silent no-op when the App Group container is unavailable (T-P45-02) —
  /// never a crash. The widget's own `read()` then falls back to a
  /// placeholder rather than observing a partially-written file.
  public func write(_ snapshot: WidgetSnapshot) {
    guard let url = fileURL, let data = try? JSONEncoder().encode(snapshot) else { return }
    try? data.write(to: url, options: .atomic)
  }

  public func read() -> WidgetSnapshot? {
    guard let url = fileURL, let data = try? Data(contentsOf: url) else { return nil }
    return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
  }

  /// Called from AppEnvironment.performLocalAccountReset() so App Group
  /// data never lingers past sign-out/account deletion (T-P45-03).
  public func clear() {
    guard let url = fileURL else { return }
    try? FileManager.default.removeItem(at: url)
  }
}
