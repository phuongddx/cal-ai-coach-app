/**
 * Hides a calorie framing while ED-safe mode is on: the wrapper of the SwiftUI screens. The flag is
 * read through the design system's hook, so the policy branch lives here and never in a feature
 * (invariant I7). A feature wraps its kcal hero, chart or range with it and holds no branch.
 */
import type { ReactNode } from 'react';

import { useEdSafeHidden } from '../edSafe';

export function EdSafeCollapse({ children }: { children: ReactNode }) {
  return useEdSafeHidden() ? null : <>{children}</>;
}
