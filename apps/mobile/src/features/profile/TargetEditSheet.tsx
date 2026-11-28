/**
 * TargetEditSheet.swift — the "Goals & targets" edit sheet. Reuses the design
 * system's WheelField and the plan-reveal edit idiom (±50 kcal steps). The
 * ONLY save path funnels every edit back through TargetsEngine (the model's
 * `save`), so the floors and the 30/40/30 macro split re-clamp (PRS-02). The
 * daily-target section collapses under ED-safe mode through EdSafeCollapse;
 * the weight and the save stay (frame p-target-ed).
 *
 * U-77 (frames p-target-*): the sheet is titled "Edit goal" with a close glass
 * button, the save button names the goal ("Save goal"), and when the engine
 * clamps a goal under its flat minimum the caution card names the clamped
 * value — the frame's height-based healthy floor is an engine follow-up, so no
 * height claim is made (settingsCopy.goalFloorCopy).
 */
import { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  BannerNote,
  EdSafeCollapse,
  GlassIconButton,
  PrimaryButton,
  Sheet,
  WheelField,
  radius,
  space,
  typography,
  useTokens,
} from '../../design';
import { onboardingCopy } from '../onboarding/onboardingCopy';
import { goalFloorCopy, settingsCopy } from './settingsCopy';
import { grouped } from './grouping';
import type { TargetEditModel } from './targetEditModel';

export type TargetEditSheetProps = {
  model: TargetEditModel;
  /** Called after a successful save; the route closes the sheet. */
  onDismiss: () => void;
};

const GOAL_WEIGHT_ITEMS = Array.from({ length: 111 }, (_, index) => index + 40);

export function TargetEditSheet({ model, onDismiss }: TargetEditSheetProps) {
  const snapshot = useSyncExternalStore(model.subscribe, model.getSnapshot);
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

  const { macros } = snapshot;
  const saveTitle = snapshot.goalClamped
    ? `Save ${snapshot.clampedGoalWeightKg} kg goal`
    : 'Save goal';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Sheet>
        <View style={styles.titleRow}>
          <Text style={[typography.title, styles.title, { color: colors.textPrimary }]}>
            {settingsCopy.targetSheetTitle}
          </Text>
          <GlassIconButton
            icon="x"
            onPress={onDismiss}
            accessibilityLabel="Close"
            testID="settings.targetEdit.close"
          />
        </View>

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
                  {`${grouped(snapshot.dailyKcal)} kcal`}
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
            {snapshot.isFloored && (
              <View testID="settings.targetEdit.safetyFloor">
                <BannerNote text={onboardingCopy.safetyFloorBanner} variant="success" markdown />
              </View>
            )}
          </View>
        </EdSafeCollapse>

        {snapshot.goalClamped && (
          <View testID="settings.targetEdit.goalFloor" style={styles.goalFloor}>
            {/* The engine's flat clamp, shown with the design system's caution
                banner — the height-based floor of the frame is an engine change
                (follow-up). */}
            <BannerNote
              variant="caution"
              markdown
              text={goalFloorCopy(snapshot.goalWeightKg, snapshot.clampedGoalWeightKg)}
            />
          </View>
        )}

        <View testID="settings.targetEdit.goalWeight">
          <WheelField<number>
            label="Goal weight"
            items={GOAL_WEIGHT_ITEMS}
            selection={Math.round(snapshot.goalWeightKg)}
            onSelectionChange={(kg) => model.setGoalWeight(kg)}
            displayText={(kg) => `${kg} kg`}
          />
        </View>

        <PrimaryButton
          title={saveTitle}
          disabled={saving}
          testID="settings.targetEdit.save"
          action={() => void savePressed()}
        />
        <Text style={[typography.footnote, styles.footnote, { color: colors.textSecondary }]}>
          {settingsCopy.targetSaveFootnote}
        </Text>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
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
  goalFloor: { marginBottom: space.md },
  footnote: { textAlign: 'center', paddingTop: space.sm },
});
