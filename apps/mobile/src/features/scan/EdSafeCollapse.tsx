/**
 * The ED-safe collapse of the Swift screens as a wrapper: it renders nothing while ED-safe is on. The flag
 * is read through the design system's hook; no branch on the policy lives in a screen (invariant I7).
 * The owner decides whether this moves into `src/design` (findings/U-30.md).
 */
import type { ReactNode } from 'react';

import { useEdSafeHidden } from '../../design';

export function EdSafeCollapse({ children }: { children: ReactNode }) {
  return useEdSafeHidden() ? null : <>{children}</>;
}
