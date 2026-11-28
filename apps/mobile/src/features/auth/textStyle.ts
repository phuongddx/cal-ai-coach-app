/** Size, line height and weight of a token text style, as a React Native `TextStyle` (the `family` key is not a style). */
import type { TextStyle } from 'react-native';

import type { EmberTextStyle } from '../../design';

export function textStyle({ fontSize, lineHeight, fontWeight }: EmberTextStyle): TextStyle {
  return { fontSize, lineHeight, fontWeight };
}
