/**
 * CorrectionCaptureView.swift — the "Fix Issue" sheet: a kind chip grid, an optional note, and Save note, which
 * records the correction on the item (`captureCorrection`) and dismisses. Default kind is wrongFood.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ChipOption, PrimaryButton, Sheet, space, typography, useTokens } from '../../design';
import type { ScanModel } from './scanModel';
import { CORRECTION_KINDS, CORRECTION_KIND_TITLE, type CorrectionKind } from './scanTypes';
import { useScanState } from './useScanModel';

export type CorrectionCaptureViewProps = {
  model: ScanModel;
  itemId: number;
  onDismiss: () => void;
};

export function CorrectionCaptureView({ model, itemId, onDismiss }: CorrectionCaptureViewProps) {
  const { colors } = useTokens();
  const state = useScanState(model);
  const label = state.result?.items.find((item) => item.id === itemId)?.source.label ?? '';
  const [kind, setKind] = useState<CorrectionKind>('wrongFood');
  const [note, setNote] = useState('');

  return (
    <Sheet testID="scan.correction.sheet">
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[typography.heading, { color: colors.textPrimary }]}>
            Fix Issue
          </Text>
          <Text style={[typography.footnote, { color: colors.textSecondary }]}>{label}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" testID="scan.correction.close" onPress={onDismiss} style={styles.close}>
          <SymbolView name="xmark" size={14} tintColor={colors.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {CORRECTION_KINDS.map((option) => (
          <View key={option} testID={`scan.correction.kind.${option}`} style={styles.cell}>
            <ChipOption title={CORRECTION_KIND_TITLE[option]} isSelected={kind === option} onSelect={() => setKind(option)} />
          </View>
        ))}
      </View>
      <TextInput
        testID="scan.correction.note"
        accessibilityLabel="Add a note (optional)"
        placeholder="Add a note (optional)"
        placeholderTextColor={colors.textTertiary}
        value={note}
        onChangeText={setNote}
        style={[typography.body, styles.note, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      <PrimaryButton
        title="Save note"
        testID="scan.correction.save"
        action={() => {
          model.captureCorrection(kind, note, itemId);
          onDismiss();
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.md },
  titles: { flex: 1, gap: space.xs },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  cell: { width: '48%' },
  note: { borderWidth: 1, borderRadius: 12, padding: space.md, marginBottom: space.lg },
});
