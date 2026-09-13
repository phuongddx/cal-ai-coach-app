import Foundation

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif
#if canImport(Network)
import Network
import Synchronization
#endif

/// A system scheduling signal reduced to one engine-side action.
public protocol SyncTriggering: AnyObject, Sendable {
  func fire()
}

public typealias SyncFireAction = @Sendable () -> Void

/// Foreground notifications are attached through `start`; the returned
/// closure cancels observation while the trigger itself remains stateless.
public final class ForegroundTrigger: SyncTriggering {
  private let fireAction: SyncFireAction

  public init(fire: @escaping SyncFireAction) {
    self.fireAction = fire
  }

  public func fire() {
    fireAction()
  }

  @discardableResult
  public func start(
    notificationCenter: NotificationCenter = .default
  ) -> @Sendable () -> Void {
    #if canImport(UIKit)
      let name = UIApplication.didBecomeActiveNotification
    #elseif canImport(AppKit)
      let name = NSApplication.didBecomeActiveNotification
    #else
      let name = Notification.Name("CoachCalForegroundTriggerUnavailable")
    #endif

    nonisolated(unsafe) let observer = notificationCenter.addObserver(
      forName: name,
      object: nil,
      queue: nil
    ) { [weak self] _ in
      self?.fire()
    }
    return { notificationCenter.removeObserver(observer) }
  }
}

#if canImport(Network)
/// Network-reachability trigger. `start` emits only on a satisfied edge, as
/// NetInfo's reconnect semantics did in the original lifecycle.
public final class NWPathTrigger: SyncTriggering {
  private let fireAction: SyncFireAction

  public init(fire: @escaping SyncFireAction) {
    self.fireAction = fire
  }

  public func fire() {
    fireAction()
  }

  @discardableResult
  public func start(queue: DispatchQueue = DispatchQueue(label: "coachcal.sync.path")) -> @Sendable () -> Void {
    let monitor = NWPathMonitor()
    let wasSatisfied = Mutex(false)
    monitor.pathUpdateHandler = { [weak self] path in
      let satisfied = path.status == .satisfied
      let previous = wasSatisfied.withLock { $0 }
      if satisfied, !previous {
        self?.fire()
      }
      wasSatisfied.withLock { $0 = satisfied }
    }
    monitor.start(queue: queue)
    return { monitor.cancel() }
  }
}
#endif

/// BGTask scheduling boundary. Registration and real `BGTaskScheduler` launch
/// handling stay in the app shell; this seam only wraps submission and maps a
/// launch to the engine's normal fire action.
public final class BGTaskTrigger: SyncTriggering {
  private let fireAction: SyncFireAction
  private let submitAction: @Sendable () throws -> Void

  public init(
    fire: @escaping SyncFireAction,
    submit: @escaping @Sendable () throws -> Void = {}
  ) {
    self.fireAction = fire
    self.submitAction = submit
  }

  public func fire() {
    fireAction()
  }

  public func submit() throws {
    try submitAction()
    fire()
  }
}
