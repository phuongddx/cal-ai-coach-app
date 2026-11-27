/**
 * ReviewSheetView.swift — the hero screen: confidence-badged, grams-editable meal review. Every kcal figure is
 * recomputed through KcalArithmetic from the CURRENT grams (the model selectors); the design components own the
 * ED-safe policy and `EdSafeCollapse` hides the feature-owned kcal framing.
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import {
  Card,
  ChipOption,
  ConfidenceBadge,
  PrimaryButton,
  SectionHeader,
  Stepper,
  WarningChip,
  radius,
  size,
  space,
  typography,
  useTokens,
} from '../../design';
import { CorrectionCaptureView } from './CorrectionCaptureView';
import { EdSafeCollapse } from '../../design';
import { ScanThumb } from './ScanThumb';
import { mealName } from './scanCopy';
import type { ScanModel } from './scanModel';
import { MEAL_SLOTS, type ResultItem } from './scanTypes';
import { useScanState } from './useScanModel';

export type ReviewSheetViewProps = {
  model: ScanModel;
  onClose: () => void;
};

export function ReviewSheetView({ model, onClose }: ReviewSheetViewProps) {
  const { colors } = useTokens();
  const state = useScanState(model);
  const [correctionItemId, setCorrectionItemId] = useState<number | null>(null);
  const items = state.result?.items ?? [];
  const correctionItem = items.find((item) => item.id === correctionItemId) ?? null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retake photo" testID="scan.retake" onPress={() => model.retake()} style={styles.iconButton}>
          <SymbolView name="chevron.left" size={16} weight="semibold" tintColor={colors.textPrimary} />
        </Pressable>
        <Text accessibilityRole="header" testID="scan.review" style={[typography.headline, { color: colors.textPrimary }]}>
          Review
        </Text>
        <View style={styles.flex} />
        <Pressable accessibilityRole="button" accessibilityLabel="Close scanner" testID="scan.close" onPress={onClose} style={styles.iconButton}>
          <SymbolView name="xmark" size={14} weight="semibold" tintColor={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.header}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <ScanThumb thumb={state.captureThumb} size={72} tone="review" />
          </View>
          <View style={styles.titleColumn}>
            <TextInput
              testID="scan.titleField"
              accessibilityLabel="Meal name"
              placeholder="Meal name"
              placeholderTextColor={colors.textTertiary}
              value={state.mealTitle}
              onChangeText={(title) => model.setMealTitle(title)}
              numberOfLines={1}
              style={[typography.headline, { color: colors.textPrimary, padding: 0 }]}
            />
            <View style={styles.badgeRow}>
              {state.result ? (
                <View testID="scan.badge">
                  <ConfidenceBadge confidence={state.result.scanConfidence} />
                </View>
              ) : null}
              <Text style={[typography.caption, styles.medium, { color: colors.textSecondary }]}>AI estimate</Text>
            </View>
          </View>
          <EdSafeCollapse>
            <View style={styles.totalRow}>
              <Text testID="scan.totalKcal" style={[styles.total, { color: colors.accentInk }]}>
                {model.mealKcal()}
              </Text>
              <Text style={[typography.footnote, { color: colors.textSecondary }]}>kcal</Text>
            </View>
          </EdSafeCollapse>
        </View>

        {model.hasHiddenFat() ? (
          <View testID="scan.warningChip">
            <WarningChip reason="Dressing not visible" addedKcal={model.hiddenFatAddedKcal()} />
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Ingredients" />
          {items.length > 0 ? (
            <Card>
              {items.map((item, index) => (
                <View key={item.id}>
                  <ItemRow model={model} item={item} onFix={() => setCorrectionItemId(item.id)} />
                  {index < items.length - 1 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.saveBar, { backgroundColor: colors.background }]}>
        <View testID="scan.mealPicker" accessibilityLabel="Meal" style={styles.mealPicker}>
          {MEAL_SLOTS.map((slot) => (
            <ChipOption key={slot} title={mealName(slot)} isSelected={state.mealSlot === slot} onSelect={() => model.setMealSlot(slot)} />
          ))}
        </View>
        <PrimaryButton
          title={`Save to ${mealName(state.mealSlot)}`}
          testID="scan.save"
          disabled={!model.isSaveEnabled()}
          action={() => {
            void model.save();
          }}
        />
      </View>

      <Modal visible={correctionItem !== null} transparent animationType="slide" onRequestClose={() => setCorrectionItemId(null)}>
        <View style={styles.backdrop}>
          {correctionItem ? <CorrectionCaptureView model={model} itemId={correctionItem.id} onDismiss={() => setCorrectionItemId(null)} /> : null}
        </View>
      </Modal>
    </View>
  );
}

function ItemRow({ model, item, onFix }: { model: ScanModel; item: ResultItem; onFix: () => void }) {
  const { colors } = useTokens();
  const lowConfidence = item.source.confidence < 0.5;
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemTitleRow}>
        <Text numberOfLines={1} style={[typography.headline, styles.shrink, { color: item.isUnresolved ? colors.errorInk : colors.textPrimary }]}>
          {item.source.label}
        </Text>
        {lowConfidence ? <ConfidenceBadge confidence={item.source.confidence} compact /> : null}
        <View style={styles.flex} />
        {item.isUnresolved ? (
          <Text testID={`scan.reviewNeeded.${item.id}`} style={[typography.caption, styles.medium, { color: colors.errorInk }]}>
            Review needed
          </Text>
        ) : item.correction ? (
          <Text style={[typography.caption, styles.medium, { color: colors.infoInk }]}>Fix noted</Text>
        ) : null}
      </View>
      <View style={styles.itemKcalRow}>
        <EdSafeCollapse>
          <Text testID={`scan.itemKcal.${item.id}`} numberOfLines={2} style={[typography.footnote, styles.mono, { color: colors.textSecondary }]}>
            {`${model.itemKcal(item.id)} kcal`}
          </Text>
        </EdSafeCollapse>
        <View style={styles.flex} />
        <View testID={`scan.grams.${item.id}`}>
          <Stepper name={item.source.label} value={item.grams} onValueChange={(grams) => model.setGrams(grams, item.id)} />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fix Issue"
        testID={`scan.fixIssue.${item.id}`}
        onPress={onFix}
        style={[styles.fix, { borderColor: colors.warning }]}
      >
        <Text style={[typography.footnote, styles.medium, { color: colors.warningInk }]}>Fix Issue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  medium: { fontWeight: '500' },
  mono: { fontVariant: ['tabular-nums'] },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
  iconButton: { width: size.tapTarget, height: size.tapTarget, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.lg, gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titleColumn: { flex: 1, gap: space.xs },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  total: { fontSize: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  section: { gap: space.sm },
  divider: { height: 1 },
  itemRow: { gap: space.xs, paddingVertical: space.md },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  itemKcalRow: { flexDirection: 'row', alignItems: 'center' },
  fix: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.xl * 2, paddingVertical: 6, paddingHorizontal: space.md },
  saveBar: { padding: space.lg, gap: space.sm },
  mealPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
});
