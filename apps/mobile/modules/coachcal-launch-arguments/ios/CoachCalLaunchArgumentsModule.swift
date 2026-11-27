import ExpoModulesCore

/// Hands the process arguments of the app to JavaScript, once at startup (PL-05).
///
/// Swift's `DebugLaunchArguments.parse()` reads `ProcessInfo.processInfo.arguments` and only under DEBUG:
/// a release build must never let a launch argument alter behavior (T-P02-03). This module keeps that
/// rule: a release build answers with an empty list, so the nine `--cc*` arguments do nothing there.
/// `xcrun simctl launch <udid> <bundle id> --ccEDSafe` puts the arguments after the bundle id into
/// `ProcessInfo.arguments` (the first entry is the executable path).
public class CoachCalLaunchArgumentsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CoachCalLaunchArguments")

    Function("getArguments") { () -> [String] in
      #if DEBUG
      return ProcessInfo.processInfo.arguments
      #else
      return []
      #endif
    }
  }
}
