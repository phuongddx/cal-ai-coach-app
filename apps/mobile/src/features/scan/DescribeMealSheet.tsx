/**
 * DescribeMealSheet.swift — scan flow TEXT mode: free-text description, a meal picker and "Analyze description",
 * which feeds the same review sheet. Failures render the inline error card plus "Back to description".
 */
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ChipOption, PrimaryButton, radius, size, space, typography, useTokens } from '../../design';
import { ScanErrorCard } from './CaptureViewfinderView';
import { mealName } from './scanCopy';
import type { ScanModel } from './scanModel';
import { MEAL_SLOTS } from './scanTypes';
import { useScanState } from './useScanModel';

export const DESCRIBE_PLACEHOLDER = 'What did you eat? Describe the dish, portions, and anything hidden in it.';
export const DESCRIBE_LIMIT = 500;

export type DescribeMealSheetProps = {
  model: ScanModel;
  /** The search icon and the error card's "Search manually": the route opens the food search. */
  onSearchManually?: () => void;
};

export function DescribeMealSheet({ model, onSearchManually }: DescribeMealSheetProps) {
  const { colors } = useTokens();
  const state = useScanState(model);
  const trimmed = state.describeText.trim();
  const failure = state.phase.kind === 'failed' ? state.phase.failure : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" testID="scan.describeTitle" style={[typography.heading, styles.flex, { color: colors.textPrimary }]}>
            Describe your meal
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search the food database"
            testID="scan.describe.search"
            onPress={() => onSearchManually?.()}
            style={styles.search}
          >
            <SymbolView name="magnifyingglass" size={16} weight="semibold" tintColor={colors.textSecondary} />
          </Pressable>
        </View>

        <TextInput
          testID="scan.describeField"
          accessibilityLabel={DESCRIBE_PLACEHOLDER}
          placeholder={DESCRIBE_PLACEHOLDER}
          placeholderTextColor={colors.textTertiary}
          value={state.describeText}
          onChangeText={(text) => model.setDescribeText(text.slice(0, DESCRIBE_LIMIT))}
          multiline
          maxLength={DESCRIBE_LIMIT}
          style={[typography.body, styles.field, { color: colors.textPrimary, backgroundColor: colors.card }]}
        />

        <View testID="scan.describe.mealPicker" accessibilityLabel="Meal" style={styles.meals}>
          {MEAL_SLOTS.map((slot) => (
            <ChipOption key={slot} title={mealName(slot)} isSelected={state.mealSlot === slot} onSelect={() => model.setMealSlot(slot)} />
          ))}
        </View>

        <PrimaryButton
          title="Analyze description"
          testID="scan.describeSubmit"
          disabled={trimmed.length === 0}
          action={() => {
            if (trimmed.length === 0) return;
            model.analyzeDescription(trimmed);
          }}
        />
      </ScrollView>

      {failure ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.overlayColumn}>
            <ScanErrorCard failure={failure} onRetry={() => model.retry()} onSearchManually={() => onSearchManually?.()} />
            <Pressable accessibilityRole="button" testID="scan.describe.back" onPress={() => model.retry()} style={styles.back}>
              <Text style={[typography.subhead, { color: colors.textSecondary }]}>Back to description</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  search: { width: size.tapTarget, height: size.tapTarget, alignItems: 'center', justifyContent: 'center' },
  field: { padding: space.lg, borderRadius: radius.lg, minHeight: 120, textAlignVertical: 'top' },
  meals: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: space.lg },
  overlayColumn: { gap: space.md, alignItems: 'center' },
  back: { minHeight: size.tapTarget, justifyContent: 'center' },
});
