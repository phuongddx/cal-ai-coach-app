/**
 * Nav bar of a sheet or a pushed screen in the Ember frames: an optional back glass button on the
 * left, the title in the middle (600 17), an optional close glass button on the right. A missing
 * button leaves a 44 pt spacer so the title stays centred. Built from `GlassIconButton`.
 *
 * testIDs: `<testID>` (the bar), `<testID>.title`, `<testID>.back`, `<testID>.close`.
 */

import { StyleSheet, Text, View } from 'react-native';

import { size, space, typography, useTokens } from '../tokens';

import { GlassIconButton } from './GlassIconButton';

export type SheetHeaderProps = {
  title: string;
  onBack?: () => void;
  backAccessibilityLabel?: string;
  onClose?: () => void;
  closeAccessibilityLabel?: string;
  testID?: string;
};

export function SheetHeader({
  title,
  onBack,
  backAccessibilityLabel = 'Back',
  onClose,
  closeAccessibilityLabel = 'Close',
  testID = 'sheet-header',
}: SheetHeaderProps) {
  const { colors } = useTokens();
  return (
    <View testID={testID} style={styles.bar}>
      <View style={styles.slot}>
        {onBack != null && (
          <GlassIconButton
            icon="back"
            onPress={onBack}
            accessibilityLabel={backAccessibilityLabel}
            testID={`${testID}.back`}
          />
        )}
      </View>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        testID={`${testID}.title`}
        style={[styles.title, { color: colors.text }]}
      >
        {title}
      </Text>
      <View style={styles.slot}>
        {onClose != null && (
          <GlassIconButton
            icon="x"
            onPress={onClose}
            accessibilityLabel={closeAccessibilityLabel}
            testID={`${testID}.close`}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  slot: {
    width: size.tap,
    height: size.tap,
  },
  title: {
    ...typography.headline,
    flex: 1,
    textAlign: 'center',
  },
});
