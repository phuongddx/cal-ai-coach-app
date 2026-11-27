/**
 * ScanFAB (Components/Shell.swift) placed as MainShell.swift places it: a lime circle with a black
 * plus, centered at the bottom of the shell, 28pt above the bottom safe area. The view's list keeps
 * the Swift bottom inset (CCSpace.xl5) so the button never covers a meal's kcal.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { size, useTokens } from '../../design';

/** MainShell: `.padding(.bottom, 28)` on the overlay. */
export const FAB_BOTTOM_PADDING = 28;

export function ScanFab({ onPress }: { onPress: () => void }) {
  const { colors } = useTokens();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingBottom: insets.bottom + FAB_BOTTOM_PADDING }]}>
      <Pressable
        testID="shell.fab"
        accessibilityRole="button"
        accessibilityLabel="Scan food"
        onPress={onPress}
        style={[
          styles.fab,
          {
            backgroundColor: colors.accentLime,
            shadowColor: colors.accentLime,
          },
        ]}
      >
        <SymbolView name="plus" size={28} weight="medium" tintColor="#000000" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'flex-end' },
  fab: {
    width: size.fab,
    height: size.fab,
    borderRadius: size.fab / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});
