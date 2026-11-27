/**
 * PlanRevealView.swift — the daily target, macro rings, weekly range and the
 * edit panel. Every reveal edit funnels back through the engine (floors
 * re-clamp, macros re-derive); Continue persists and hands off to the Today
 * tab. The kcal hero and the weekly range hide in ED-safe mode through the
 * design system's EdSafeCollapse (invariant I7: the policy branch lives in the
 * design component, never in the feature).
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  BannerNote,
  Card,
  EdSafeCollapse,
  PrimaryButton,
  ScaledNumber,
  SecondaryButton,
  radius,
  space,
  typography,
  useTokens,
} from '../../design';

import { onboardingCopy } from './onboardingCopy';
import { MacroRing } from './MacroRing';
import { useOnboardingModel } from './useOnboardingModel';
import type { MacroAxis, OnboardingModel } from './onboardingModel';

export type PlanRevealScreenProps = {
  model: OnboardingModel;
  /** Called after a successful `persistAndFinish`; the flow navigates to Today. */
  onFinished: () => void;
};

export function PlanRevealScreen({ model, onFinished }: PlanRevealScreenProps) {
  useOnboardingModel(model);
  const { colors } = useTokens();
  const [editing, setEditing] = useState(false);
  const reveal = model.reveal;

  async function continuePressed(): Promise<void> {
    await model.persistAndFinish();
    if (model.finished) onFinished();
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        <View style={styles.inner}>
          <Text
            testID="plan.reveal"
            style={[styles.title, { color: colors.textPrimary }]}
          >
            Your daily target
          </Text>
          {reveal !== null && (
            <>
              {/* The hero collapses under ED-safe mode (the Swift hero is .edSafeHidden()). */}
              <EdSafeCollapse>
                <View accessible accessibilityLabel={`${reveal.dailyKcal} calories per day`} style={styles.hero}>
                  <View testID="plan.kcalHero">
                    <ScaledNumber text={`${reveal.dailyKcal}`} role="planNumber" style={{ color: colors.textPrimary }} />
                  </View>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>calories per day</Text>
                </View>
              </EdSafeCollapse>
              <View style={styles.rings}>
                <MacroRing
                  color={colors.macroProtein}
                  grams={reveal.proteinG}
                  kcalShare={reveal.proteinG * 4}
                  totalKcal={reveal.dailyKcal}
                  label="Protein"
                  identifier="plan.macro.protein"
                />
                <MacroRing
                  color={colors.macroCarbs}
                  grams={reveal.carbsG}
                  kcalShare={reveal.carbsG * 4}
                  totalKcal={reveal.dailyKcal}
                  label="Carbs"
                  identifier="plan.macro.carbs"
                />
                <MacroRing
                  color={colors.macroFat}
                  grams={reveal.fatG}
                  kcalShare={reveal.fatG * 9}
                  totalKcal={reveal.dailyKcal}
                  label="Fat"
                  identifier="plan.macro.fat"
                />
              </View>
              <Card>
                <View style={styles.weeklyBlock}>
                  <Text style={[styles.headline, { color: colors.textPrimary }]}>Weekly range</Text>
                  {/* The range line collapses under ED-safe mode; the card, headline and caption stay (the Swift .edSafeHidden() sits on the range Text). */}
                  <EdSafeCollapse>
                    <Text
                      testID="plan.weeklyRange"
                      style={[styles.weeklyRange, { color: colors.textPrimary }]}
                    >
                      {`${grouped(reveal.dailyKcal * 7 - 250)} – ${grouped(reveal.dailyKcal * 7 + 250)} calories`}
                    </Text>
                  </EdSafeCollapse>
                  <Text style={[styles.footnote, { color: colors.textSecondary }]}>
                    {onboardingCopy.weeklyRangeCaption}
                  </Text>
                </View>
              </Card>
              <View testID="plan.adjust">
                <SecondaryButton
                  title="Not right? Adjust targets"
                  bordered
                  action={() => setEditing((value) => !value)}
                />
              </View>
              {editing && (
                <View
                  style={[
                    styles.editPanel,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <EditRow
                    label="Daily calories"
                    value={`${reveal.dailyKcal}`}
                    identifier="plan.editKcal"
                    decrement={() => model.adjustRevealKcal(-50)}
                    increment={() => model.adjustRevealKcal(50)}
                  />
                  <EditRow
                    label="Protein"
                    value={`${reveal.proteinG} g`}
                    identifier="plan.editProtein"
                    decrement={() => model.adjustRevealMacro('protein', -10)}
                    increment={() => model.adjustRevealMacro('protein', 10)}
                  />
                  <EditRow
                    label="Carbs"
                    value={`${reveal.carbsG} g`}
                    identifier="plan.editCarbs"
                    decrement={() => model.adjustRevealMacro('carbs', -10)}
                    increment={() => model.adjustRevealMacro('carbs', 10)}
                  />
                  <EditRow
                    label="Fat"
                    value={`${reveal.fatG} g`}
                    identifier="plan.editFat"
                    decrement={() => model.adjustRevealMacro('fat', -10)}
                    increment={() => model.adjustRevealMacro('fat', 10)}
                  />
                  {reveal.floored && (
                    <View testID="plan.safetyFloor">
                      <BannerNote text={onboardingCopy.safetyFloorBanner} variant="success" markdown />
                    </View>
                  )}
                </View>
              )}
              {model.persistError !== null && (
                <View testID="plan.persistError">
                  <BannerNote text={model.persistError} />
                </View>
              )}
            </>
          )}
          <Text
            testID="plan.medicalDisclaimer"
            style={[styles.disclaimer, { color: colors.textTertiary }]}
          >
            {onboardingCopy.medicalDisclaimer}
          </Text>
        </View>
      </ScrollView>
      <View style={styles.ctaWrap}>
        <View testID="onboarding.continue">
          <PrimaryButton title="Continue" action={() => void continuePressed()} />
        </View>
      </View>
    </View>
  );
}

function EditRow({
  label,
  value,
  identifier,
  decrement,
  increment,
}: {
  label: string;
  value: string;
  identifier: string;
  decrement: () => void;
  increment: () => void;
}) {
  const { colors } = useTokens();
  return (
    <View accessible accessibilityLabel={`${label}, ${value}`} style={styles.editRow}>
      <Text style={[styles.editLabel, { color: colors.textPrimary }]}>{label}</Text>
      <View style={styles.editControls}>
        <StepButton symbol="−" identifier={`${identifier}.decrement`} action={decrement} />
        <Text
          testID={identifier}
          style={[styles.editValue, { color: colors.textPrimary }]}
        >
          {value}
        </Text>
        <StepButton symbol="+" identifier={`${identifier}.increment`} action={increment} />
      </View>
    </View>
  );
}

function StepButton({
  symbol,
  identifier,
  action,
}: {
  symbol: string;
  identifier: string;
  action: () => void;
}) {
  const { colors } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      testID={identifier}
      onPress={action}
      style={[styles.stepButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.stepSymbol, { color: colors.textPrimary }]}>{symbol}</Text>
    </Pressable>
  );
}

/** en-US comma grouping without Intl (Hermes-safe): 11900 → "11,900". */
function grouped(value: number): string {
  const digits = Math.round(Math.max(value, 0)).toString();
  let groupedText = '';
  for (let index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 === 0) groupedText += ',';
    groupedText += digits[index];
  }
  return groupedText;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  inner: {
    gap: space.xl2,
    paddingHorizontal: space.lg,
    paddingTop: space.xl3,
    paddingBottom: space.lg,
  },
  title: { ...typography.title },
  subtitle: { ...typography.subhead },
  hero: {
    alignItems: 'center',
    gap: space.xs,
  },
  rings: {
    flexDirection: 'row',
    gap: space.md,
  },
  weeklyBlock: { gap: space.xs },
  headline: { ...typography.headline },
  weeklyRange: {
    ...typography.subhead,
    fontVariant: ['tabular-nums'],
  },
  footnote: { ...typography.footnote },
  editPanel: {
    gap: space.md,
    padding: space.md,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  editLabel: { ...typography.subhead, flex: 1 },
  editControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  editValue: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 56,
    textAlign: 'center',
  },
  stepButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  stepSymbol: {
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: { ...typography.footnote },
  ctaWrap: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl3,
  },
});
