/**
 * ValueHeroView.swift — the first step. Locked hero copy, three feature rows,
 * the "Get started" CTA (onboarding.getStarted). The ED-safe line is locked
 * copy, not a policy branch: the components own that (I7).
 */

import { StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { radius, space, typography, useTokens, withAlpha } from '../../design';

import { onboardingCopy } from './onboardingCopy';
import { StepScaffold } from './StepScaffold';
import { useOnboardingModel } from './useOnboardingModel';
import type { OnboardingModel } from './onboardingModel';

export function ValueHeroScreen({ model }: { model: OnboardingModel }) {
  useOnboardingModel(model);
  return (
    <StepScaffold
      title="Track calories with a photo"
      subtitle="The honest AI calorie coach"
      progress={model.progress}
      ctaTitle="Get started"
      ctaIdentifier="onboarding.getStarted"
      action={() => model.advance()}
    >
      <View style={styles.rows}>
        <FeatureRow icon="eye" title="AI estimates with confidence" detail="See when AI is certain vs. guessing" />
        <FeatureRow icon="tag" title="Transparent pricing always" detail="No hidden fees. Cancel anytime." />
        <FeatureRow icon="heart" title={onboardingCopy.safeModeTitle} detail={onboardingCopy.safeModeSubtitle} />
      </View>
    </StepScaffold>
  );
}

function FeatureRow({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  const { colors } = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={`${title}, ${detail}`}
      style={styles.row}
    >
      <View style={[styles.tile, { backgroundColor: withAlpha(colors.accentLime, 0.15), borderRadius: radius.md }]}>
        {/* The icon is decorative: hidden from accessibility like the Swift overlay. */}
        <SymbolView name={icon as never} size={20} tintColor={colors.accentInk} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.detail, { color: colors.textSecondary }]}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tile: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: 2 },
  title: { ...typography.headline },
  detail: { ...typography.subhead },
});
