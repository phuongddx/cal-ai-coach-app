/**
 * AnalyzingView.swift — 160pt thumb (radius-lg) with a 1.5s shimmer, headings, a 3-step checklist
 * (completed check / spinner / idle circle) plus a 4th escalation-only row, and Cancel back to capture.
 */
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { radius, space, typography, useTokens } from '../../design';
import { ScanThumb } from './ScanThumb';
import type { ScanModel } from './scanModel';
import { ANALYZING_STEPS, ANALYZING_STEP_TITLE, type AnalyzingStep } from './scanTypes';
import { useScanState } from './useScanModel';

const THUMB = 160;

export type AnalyzingViewProps = {
  model: ScanModel;
  /** `--ccDisableAnimations` of the Swift view: pins a static "in progress" glyph and no shimmer. */
  animationsDisabled?: boolean;
};

/** The rows shown: three, plus the escalation row only once the call outlasts the budget. */
export function visibleSteps(active: AnalyzingStep | null): readonly AnalyzingStep[] {
  return active === 'confirming' ? ANALYZING_STEPS : ANALYZING_STEPS.slice(0, 3);
}

export function AnalyzingView({ model, animationsDisabled = false }: AnalyzingViewProps) {
  const { colors } = useTokens();
  const state = useScanState(model);
  const active = state.phase.kind === 'analyzing' ? state.phase.step : null;
  const steps = visibleSteps(active);
  const activeIndex = active === null ? -1 : steps.indexOf(active);

  const shimmer = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    if (animationsDisabled) return;
    const loop = Animated.loop(Animated.timing(shimmer, { toValue: 2, duration: 1500, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [animationsDisabled, shimmer]);

  return (
    <View style={styles.root}>
      <View style={styles.column}>
        <View style={styles.spacer} />
        <View testID="scan.analyzing.thumb" style={styles.thumb}>
          <ScanThumb thumb={state.captureThumb} size={THUMB} cornerRadius={radius.lg} tone="analyzing" />
          {!animationsDisabled && (
            <Animated.View
              pointerEvents="none"
              style={[styles.shimmer, { transform: [{ translateX: Animated.multiply(shimmer, THUMB) }] }]}
            />
          )}
        </View>
        <View style={styles.headings}>
          <Text testID="scan.analyzing" accessibilityRole="header" style={styles.heading}>
            Analyzing your meal
          </Text>
          <Text style={styles.subhead}>AI estimate in progress</Text>
        </View>
        <View testID="scan.checklist" style={styles.checklist}>
          {steps.map((step, index) => {
            const reached = index <= activeIndex;
            return (
              <View
                key={step}
                testID={`scan.step.${step}`}
                accessible
                accessibilityLabel={ANALYZING_STEP_TITLE[step]}
                accessibilityState={{ busy: index === activeIndex, checked: index < activeIndex }}
                style={styles.stepRow}
              >
                {index < activeIndex ? (
                  <SymbolView name="checkmark.circle.fill" size={20} tintColor={colors.accentLime} />
                ) : index === activeIndex ? (
                  animationsDisabled ? (
                    <SymbolView name="circle.dotted" size={20} tintColor={colors.accentLime} />
                  ) : (
                    <ActivityIndicator color={colors.accentLime} style={styles.spinner} />
                  )
                ) : (
                  <View style={styles.idleCircle} />
                )}
                <Text style={[styles.stepTitle, { color: reached ? '#FFFFFF' : 'rgba(255,255,255,0.4)' }]}>{ANALYZING_STEP_TITLE[step]}</Text>
              </View>
            );
          })}
        </View>
        <View style={styles.spacer} />
        <Pressable accessibilityRole="button" testID="scan.cancel" onPress={() => model.cancelAnalyzing()} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  column: { flex: 1, alignItems: 'center', gap: space.xl, paddingHorizontal: space.xl2, paddingBottom: space.xl },
  spacer: { flex: 1 },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.lg, overflow: 'hidden' },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: THUMB * 0.6, backgroundColor: 'rgba(255,255,255,0.18)' },
  headings: { alignItems: 'center', gap: space.xs },
  heading: { ...typography.heading, color: '#FFFFFF' },
  subhead: { ...typography.subhead, color: 'rgba(255,255,255,0.7)' },
  checklist: { alignSelf: 'flex-start', gap: space.md, paddingVertical: space.lg },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepTitle: { ...typography.subhead },
  spinner: { width: 20, height: 20 },
  idleCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  cancel: { padding: space.md, minHeight: 44, justifyContent: 'center' },
  cancelText: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.8)' },
});
