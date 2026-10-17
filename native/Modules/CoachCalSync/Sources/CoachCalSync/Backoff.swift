import Foundation

/// Delay policy for failed dispatches.
public enum Backoff {
  public static let base: Duration = .seconds(1)
  public static let cap: Duration = .seconds(30)
  private static let factor = 2.0

  /// `attempts` counts failed dispatches: the first waits one second, then
  /// each later failure doubles through the 30-second cap.
  public static func delay(forDispatchAttempts attempts: Int) -> Duration {
    guard attempts > 1 else { return base }
    let exponent = Double(min(attempts - 1, 5))
    let seconds = Int(pow(factor, exponent))
    return .seconds(min(seconds, 30))
  }
}
