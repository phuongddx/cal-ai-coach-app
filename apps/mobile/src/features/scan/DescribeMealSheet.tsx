/**
 * DescribeMealSheet.swift, drawn from the Ember frames s-describe-light / s-describe-dark (typing, with the keyboard)
 * and s-describe-estimating: the text scan. Title with a close button (back to the camera), the field with the
 * helper line and the length over 500, the meal, the dock with "Estimate". While the text is analyzed the field is
 * read-only and the dock shows "Estimating…" and Cancel. Failures render the inline error card plus "Back to description".
 * The free-scan line shows nothing until the server sends the limit (follow-up).
 */
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { darkColors, GlassIconButton, PrimaryButton, radius, Segment, Sheet, size, space, typography, useTokens } from '../../design';
import { ScanErrorCard } from './CaptureViewfinderView';
import { mealName, MEAL_SEGMENT_OPTIONS } from './scanCopy';
import type { ScanModel } from './scanModel';
import type { MealSlot } from './scanTypes';
import { useScanState } from './useScanModel';

export const DESCRIBE_PLACEHOLDER = 'What did you eat? Describe the dish, portions, and anything hidden in it.';
export const DESCRIBE_HELPER = 'Amounts help: “1 cup”, “a palm-sized piece”.';
export const DESCRIBE_LIMIT = 500;

export type DescribeMealSheetProps = {
  model: ScanModel;
  /** The error card's "Search manually": the route opens the food search. */
  onSearchManually?: () => void;
  /** The close button returns to the camera (the Describe chip of the viewfinder led here). */
  onBackToCamera?: () => void;
};

export function DescribeMealSheet({ model, onSearchManually, onBackToCamera }: DescribeMealSheetProps) {
  const { colors } = useTokens();
  const state = useScanState(model);
  const [focused, setFocused] = useState(false);
  const trimmed = state.describeText.trim();
  const estimating = state.phase.kind === 'analyzing';
  const failure = state.phase.kind === 'failed' ? state.phase.failure : null;

  return (
    <View style={[styles.root, { backgroundColor: darkColors.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Sheet style={styles.sheet} testID="scan.describe.sheet">
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" testID="scan.describeTitle" style={[styles.title, styles.flex, { color: colors.text }]}>
              Describe your meal
            </Text>
            <GlassIconButton icon="x" accessibilityLabel="Close" testID="scan.describe.close" onPress={() => onBackToCamera?.()} />
          </View>

          <ScrollView keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            {estimating ? (
              <Text style={[typography.body, { color: colors.text2 }]}>
                We estimate each item and show how sure we are. You can fix anything before saving.
              </Text>
            ) : null}

            <TextInput
              testID="scan.describeField"
              accessibilityLabel={DESCRIBE_PLACEHOLDER}
              placeholder={DESCRIBE_PLACEHOLDER}
              placeholderTextColor={colors.text3}
              value={state.describeText}
              editable={!estimating}
              onChangeText={(text) => model.setDescribeText(text.slice(0, DESCRIBE_LIMIT))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              multiline
              maxLength={DESCRIBE_LIMIT}
              selectionColor={colors.accent}
              style={[
                typography.body,
                styles.field,
                { color: colors.text, backgroundColor: colors.fill, borderColor: focused && !estimating ? colors.accent : 'transparent' },
              ]}
            />
            <View style={styles.helperRow}>
              <Text style={[typography.footnote, styles.flex, { color: colors.text2 }]}>{DESCRIBE_HELPER}</Text>
              <Text testID="scan.describe.counter" style={[typography.footnote, styles.tabular, { color: colors.text2 }]}>
                {`${state.describeText.length}/${DESCRIBE_LIMIT}`}
              </Text>
            </View>

            <Text style={[typography.subhead, styles.section, { color: colors.text2 }]}>Meal</Text>
            <Segment<MealSlot>
              variant="text"
              options={MEAL_SEGMENT_OPTIONS}
              value={state.mealSlot}
              onChange={(slot) => {
                if (!estimating) model.setMealSlot(slot);
              }}
              accessibilityLabel="Meal"
              testID="scan.describe.mealPicker"
            />

            {estimating ? (
              <View testID="scan.describe.estimating" style={[styles.estimating, { backgroundColor: colors.fill }]}>
                <ActivityIndicator color={colors.accentInk} />
                <View style={styles.flex}>
                  <Text accessibilityRole="header" style={[typography.headline, { color: colors.text }]}>
                    Reading your description
                  </Text>
                  <Text style={[typography.subhead, { color: colors.text2 }]}>Usually under 5 seconds</Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {estimating ? (
            <View style={styles.dockColumn}>
              <PrimaryButton title="Estimating..." testID="scan.describeSubmit" disabled action={() => undefined} />
              <Pressable accessibilityRole="button" testID="scan.cancel" onPress={() => model.cancelAnalyzing()} style={styles.cancel}>
                <Text style={[typography.headline, { color: colors.accentInk }]}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.dockRow}>
              <Text testID="scan.describe.meal" style={[typography.subhead, styles.flex, { color: colors.text2 }]}>
                {mealName(state.mealSlot)}
              </Text>
              <View style={styles.estimate}>
                <PrimaryButton
                  title="Estimate"
                  testID="scan.describeSubmit"
                  disabled={trimmed.length === 0}
                  action={() => {
                    if (trimmed.length === 0) return;
                    model.analyzeDescription(trimmed);
                  }}
                />
              </View>
            </View>
          )}
        </Sheet>
      </KeyboardAvoidingView>

      {failure ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.overlayColumn}>
            <ScanErrorCard failure={failure} onRetry={() => model.retry()} onSearchManually={() => onSearchManually?.()} />
            <Pressable accessibilityRole="button" testID="scan.describe.back" onPress={() => model.retry()} style={styles.back}>
              <Text style={[typography.subhead, { color: colors.text2 }]}>Back to description</Text>
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
  sheet: { flex: 1, marginTop: space.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  title: { fontSize: 28, fontWeight: '700' },
  body: { gap: space.md, paddingBottom: space.lg },
  field: { padding: space.lg, borderRadius: radius.lg, borderWidth: 2, minHeight: 120, textAlignVertical: 'top' },
  helperRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  section: { fontWeight: '600', paddingHorizontal: space.xs },
  estimating: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, padding: space.lg },
  dockRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  estimate: { minWidth: 160 },
  dockColumn: { gap: space.xs },
  cancel: { minHeight: size.tap, alignItems: 'center', justifyContent: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', padding: space.lg },
  overlayColumn: { gap: space.md, alignItems: 'center' },
  back: { minHeight: size.tap, justifyContent: 'center' },
});
