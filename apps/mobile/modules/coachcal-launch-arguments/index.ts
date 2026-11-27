/**
 * The JavaScript side of the local Expo module `CoachCalLaunchArguments` (PL-05): the process arguments of
 * the app, as the SwiftUI app read them from `ProcessInfo.processInfo.arguments`. The native side answers
 * with an empty list in a release build (Swift parses the arguments only under DEBUG).
 *
 * Optional on purpose: a development client built before this module existed, and Jest, have no such native
 * module, and the caller must not crash there. `readLaunchArguments` then returns an empty list.
 */
import { requireOptionalNativeModule } from 'expo';

type CoachCalLaunchArgumentsModule = {
  getArguments: () => unknown;
};

/** The process arguments; an empty list when the native module is missing or answers with something else. */
export function readLaunchArguments(): string[] {
  try {
    const native = requireOptionalNativeModule<CoachCalLaunchArgumentsModule>('CoachCalLaunchArguments');
    const result = native?.getArguments();
    return Array.isArray(result) ? result.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    // A native module that throws must not stop the launch; the flags then keep their defaults.
    return [];
  }
}
