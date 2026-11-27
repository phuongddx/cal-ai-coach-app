/**
 * TargetEditSheet.swift — the "Goals & targets" edit sheet. Reuses the design
 * system's WheelField and the plan-reveal edit idiom (±50 kcal steps). The
 * ONLY save path funnels every edit back through TargetsEngine (the model's
 * `save`), so the floors and the 30/40/30 macro split re-clamp (PRS-02). The
 * daily-target section collapses under ED-safe mode through EdSafeCollapse.
 */
import { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  BannerNote,
  EdSafeCollapse,
  PrimaryButton,
  Sheet,
  WheelField,
  radius,
  space,
  typography,
  useTokens,
} from '../../design';

import { onboardingCopy } from '../onboarding/onboardingCopy';
import { grouped } from './grouping';
import type { TargetEditModel } from './targetEditModel';

export type TargetEditSheetProps = {
  model: TargetEditModel;
  /** Called after a successful save; the route closes the sheet. */
  onDismiss: () => void;
};

const GOAL_WEIGHT_ITEMS = Array.from({ length: 111 }, (_, index) => index + 40);

export function TargetEditSheet({ model, onDismiss }: TargetEditSheetProps) {
  useSyncExternalStore(model.subscribe, model.getRevision);
  const { colors } = useTokens();
  const [saving, setSaving] = useState(false);

  async function savePressed(): Promise<void> {
    setSaving(true);
    try {
      await model.save();
      onDismiss();
    } finally {
      setSaving(false);
    }
  }

  const macros = model.macros();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Sheet>
        <Text style={[typography.title, styles.title, { color: colors.textPrimary }]}>
          Edit targets
        </Text>

        <EdSafeCollapse>
          <View style={styles.dailySection}>
            <View style={styles.dailyHeadline}>
              <Text style={[typography.headline, { color: colors.textPrimary }]}>Daily target</Text>
              <View style={styles.steps}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Decrease daily target"
                  testID="settings.targetEdit.kcalDown"
                  onPress={() => model.adjustKcal(-50)}
                  style={[styles.stepButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={[styles.stepSymbol, { color: colors.textPrimary }]}>−</Text>
                </Pressable>
                <Text
                  testID="settings.targetEdit.kcal"
                  style={[styles.kcalValue, { color: colors.accentInk }]}
                >
                  {`${grouped(model.dailyKcal)} kcal`}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Increase daily target"
                  testID="settings.targetEdit.kcalUp"
                  onPress={() => model.adjustKcal(50)}
                  style={[styles.stepButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={[styles.stepSymbol, { color: colors.textPrimary }]}>+</Text>
                </Pressable>
              </View>
            </View>
            <Text style={[typography.footnote, { color: colors.textSecondary }]}>
              {`Protein ${macros.proteinG} g · Carbs ${macros.carbsG} g · Fat ${macros.fatG} g`}
            </Text>
            {model.isFloored && (
              <View testID="settings.targetEdit.safetyFloor">
                <BannerNote text={onboardingCopy.safetyFloorBanner} variant="success" markdown />
              </View>
            )}
          </View>
        </EdSafeCollapse>

        <View testID="settings.targetEdit.goalWeight">
          <WheelField<number>
            label="Goal weight"
            items={GOAL_WEIGHT_ITEMS}
            selection={Math.round(model.goalWeightKg)}
            onSelectionChange={(kg) => model.setGoalWeight(kg)}
            displayText={(kg) => `${kg} kg`}
          />
        </View>

        <PrimaryButton
          title="Save"
          disabled={saving}
          testID="settings.targetEdit.save"
          action={() => void savePressed()}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: { marginBottom: space.lg },
  dailySection: { gap: space.md, marginBottom: space.lg },
  dailyHeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
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
  kcalValue: {
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 96,
    textAlign: 'center',
  },
});
