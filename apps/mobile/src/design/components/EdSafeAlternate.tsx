/**
 * Swaps one surface for another while ED-safe mode is on: `children` with the mode off, `alternate`
 * with it on. A feature replaces a calorie figure with a serving size (or a kcal line with a gram
 * line) without ever asking for the mode: the flag is read here, through the design system's hook,
 * so the policy branch lives in design (invariant I7 / standing order 20). `EdSafeCollapse` is the
 * special case whose alternate is nothing.
 */
import { Fragment, type ReactNode } from 'react';
import { View } from 'react-native';

import { useEdSafeHidden } from '../edSafe';

export type EdSafeAlternateProps = {
  /** Shown while ED-safe mode is on. */
  alternate: ReactNode;
  /** Shown while ED-safe mode is off. */
  children: ReactNode;
  /** When given, the shown side is wrapped in a `View` with this testID. */
  testID?: string;
};

export function EdSafeAlternate({ alternate, children, testID }: EdSafeAlternateProps) {
  const hidden = useEdSafeHidden();
  const shown = hidden ? alternate : children;
  if (testID === undefined) return <Fragment>{shown}</Fragment>;
  return <View testID={testID}>{shown}</View>;
}
