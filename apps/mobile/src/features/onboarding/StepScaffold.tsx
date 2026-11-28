/**
 * OnboardingStepScaffold (OnboardingFlowView.swift). Shared Group A layout:
 * progress rail under the status bar, title (28 semibold) + subhead (15),
 * content, pinned bottom CCPrimaryButton (16pt side / 32pt bottom).
 */

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, ProgressRail, space, typography, useTokens } from '../../design';

import { QUIZ_STEP_COUNT } from './onboardingModel';

export type StepScaffoldProps = {
  title: string;
  subtitle?: string;
  progress: number;
  ctaTitle?: string;
  ctaIdentifier?: string;
  ctaEnabled?: boolean;
  action: () => void;
  children: ReactNode;
};

export function StepScaffold({
  title,
  subtitle,
  progress,
  ctaTitle = 'Continue',
  ctaIdentifier = 'onboarding.continue',
  ctaEnabled = true,
  action,
  children,
}: StepScaffoldProps) {
  const { colors } = useTokens();
  // The frame's caption over the rail: "Step N of 9" (the rail fills up to the
  // current quiz position, so the same number names the step).
  const stepNumber = Math.round(progress * QUIZ_STEP_COUNT);
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.rail}>
        <Text style={[styles.stepCaption, { color: colors.text2 }]}>Step {stepNumber} of 9</Text>
        <ProgressRail progress={progress} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={styles.inner}>
          <Text style={[styles.title, { color: colors.textPrimary }]} testID={`onboarding.title.${title}`}>
            {title}
          </Text>
          {subtitle !== undefined && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          )}
          {children}
        </View>
      </ScrollView>
      <View style={styles.ctaWrap}>
        {/* The Swift view hangs the accessibilityIdentifier on the button; the RN
            design-system button carries no testID prop, so the identifier rides
            the wrapper like the sign-in screen does. */}
        <View testID={ctaIdentifier}>
          <PrimaryButton title={ctaTitle} action={action} disabled={!ctaEnabled} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rail: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
  },
  stepCaption: {
    ...typography.footnote,
    fontWeight: '600',
  },
  scrollContent: { flexGrow: 1 },
  inner: {
    gap: space.xl2,
    paddingHorizontal: space.lg,
    paddingTop: space.xl3,
    paddingBottom: space.lg,
  },
  title: { ...typography.title },
  subtitle: { ...typography.subhead },
  ctaWrap: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl3,
  },
});
