/**
 * Analyzing (Ember frame 02): a 200 pt thumb with a 3 pt accent ring and a soft glow, "Reading your plate",
 * "Usually under 5 seconds" and a pinned Cancel. The model reports no stages (the scan API answers in one
 * request), so there is no checklist and no timer: only observed facts are shown.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { darkColors, radius, size, space, useTokens, withAlpha } from '../../design';
import { ScanThumb } from './ScanThumb';
import type { ScanModel } from './scanModel';
import { useScanState } from './useScanModel';

const THUMB = 200;
const RING = 3;
const THUMB_RADIUS = 32;

export type AnalyzingViewProps = {
  model: ScanModel;
  /** `--ccDisableAnimations`: pins the glow and stops the pulse. */
  animationsDisabled?: boolean;
};

export function AnalyzingView({ model, animationsDisabled = false }: AnalyzingViewProps) {
  const { colors } = useTokens();
  const state = useScanState(model);
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (animationsDisabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animationsDisabled, pulse]);

  return (
    <View style={[styles.root, { backgroundColor: darkColors.bg }]}>
      <View style={styles.column}>
        <View style={styles.spacer} />
        <View testID="scan.analyzing.thumb" style={styles.thumbWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              { backgroundColor: withAlpha(colors.accent, 0.25), shadowColor: colors.accent, opacity: animationsDisabled ? 0.8 : pulse },
            ]}
          />
          <View style={[styles.ring, { borderColor: colors.accent }]}>
            <ScanThumb thumb={state.captureThumb} size={THUMB} cornerRadius={THUMB_RADIUS} tone="analyzing" />
          </View>
        </View>
        <View style={styles.headings}>
          <Text testID="scan.analyzing" accessibilityRole="header" style={[styles.heading, { color: colors.emberText }]}>
            Reading your plate
          </Text>
          <Text style={[styles.subhead, { color: colors.emberText2 }]}>Usually under 5 seconds</Text>
        </View>
        <View style={styles.spacer} />
        <Pressable
          accessibilityRole="button"
          testID="scan.cancel"
          onPress={() => model.cancelAnalyzing()}
          style={[styles.cancel, { backgroundColor: withAlpha(darkColors.elevated, 0.9) }]}
        >
          <Text style={[styles.cancelText, { color: colors.emberText }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { flex: 1, alignItems: 'center', gap: space.xl2, paddingHorizontal: space.xl2, paddingBottom: space.xl3 },
  spacer: { flex: 1 },
  thumbWrap: { width: THUMB + RING * 2, height: THUMB + RING * 2, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: THUMB + RING * 2,
    height: THUMB + RING * 2,
    borderRadius: THUMB_RADIUS + RING,
    shadowOpacity: 0.6,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  ring: { borderWidth: RING, borderRadius: THUMB_RADIUS + RING, overflow: 'hidden' },
  headings: { alignItems: 'center', gap: space.sm },
  heading: { fontSize: 28, fontWeight: '700' },
  subhead: { fontSize: 15, fontWeight: '400' },
  cancel: { minHeight: size.btn, alignSelf: 'stretch', borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 17, fontWeight: '600' },
});
