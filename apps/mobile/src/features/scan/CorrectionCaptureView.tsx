/**
 * "Report a problem" (Ember frames s-fix-light / s-fix-dark / s-fix-sent; CorrectionCaptureView.swift): which item,
 * what is wrong, an optional note and "Save report". A report does not change the item: the sheet offers the direct
 * fixes first ("Fix it now"), and the report is recorded on the item (`captureCorrection`) and shown as "Review needed"
 * cleared, exactly as the Swift sheet did. No report endpoint exists in the contract and there is no photo toggle, so
 * nothing leaves the device: the dock says "Save report" and the confirmation says it is saved on this device.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { GlassIconButton, Icon, PrimaryButton, radius, SecondaryButton, Sheet, size, space, typography, useTokens } from '../../design';
import type { ScanModel } from './scanModel';
import { CORRECTION_KINDS, CORRECTION_KIND_TITLE, type CorrectionKind } from './scanTypes';
import { useScanState } from './useScanModel';

export type CorrectionCaptureViewProps = {
  model: ScanModel;
  itemId: number;
  onDismiss: () => void;
  /** "Fix it now: edit the grams": the review expands that item's editor. */
  onEditGrams?: (itemId: number) => void;
};

/** The one-line hint under each reason; `wrongFood` names the item, "Something else" has none. */
export function correctionKindHint(kind: CorrectionKind, label: string): string | null {
  switch (kind) {
    case 'wrongFood':
      return `It isn't ${label.toLowerCase()}`;
    case 'portionOff':
      return 'More or less than that';
    case 'notEaten':
      return "I didn't eat this";
    case 'nutritionOff':
      return 'The numbers seem wrong';
    case 'other':
      return null;
  }
}

export function CorrectionCaptureView({ model, itemId, onDismiss, onEditGrams }: CorrectionCaptureViewProps) {
  const { colors } = useTokens();
  const state = useScanState(model);
  const items = state.result?.items ?? [];
  const [selectedId, setSelectedId] = useState(itemId);
  const [kind, setKind] = useState<CorrectionKind>('wrongFood');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const label = items.find((item) => item.id === selectedId)?.source.label ?? '';
  // The direct fix that fits the reason. Renaming an item is not built (it would leave the grounded nutrition behind).
  const fixKind = kind === 'portionOff' || kind === 'notEaten' ? kind : null;

  function fixNow(): void {
    if (fixKind === 'notEaten') model.removeItem(selectedId);
    else onEditGrams?.(selectedId);
    onDismiss();
  }

  if (sent) {
    return (
      <Sheet testID="scan.correction.sheet" style={styles.sentSheet}>
        <View style={styles.headerRow}>
          <View style={styles.flex} />
          <GlassIconButton icon="x" accessibilityLabel="Close" testID="scan.correction.close" onPress={onDismiss} />
        </View>
        <View style={styles.sentBody}>
          <View testID="scan.correction.sentTile" style={[styles.sentTile, { backgroundColor: colors.successTint }]}>
            <Icon name="check" size={32} color={colors.successInk} />
          </View>
          <Text testID="scan.correction.sentTitle" accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            Report saved on this device
          </Text>
          <Text style={[typography.body, { color: colors.text2 }]}>
            Nothing leaves it. Your review hasn't changed: to fix this meal now, edit the item.
          </Text>
        </View>
        <View style={styles.sentDock}>
          <PrimaryButton title="Back to review" testID="scan.correction.back" action={onDismiss} />
          {fixKind !== null ? (
            <SecondaryButton
              title={fixKind === 'notEaten' ? `Remove ${label}` : `Edit grams of ${label}`}
              testID="scan.correction.fixNow"
              leading={fixKind === 'notEaten' ? undefined : 'pencil'}
              action={fixNow}
            />
          ) : null}
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet testID="scan.correction.sheet" detent="large">
      <View style={styles.headerRow}>
        <Text accessibilityRole="header" style={[styles.title, styles.flex, { color: colors.text }]}>
          Report a problem
        </Text>
        <GlassIconButton icon="x" accessibilityLabel="Close" testID="scan.correction.close" onPress={onDismiss} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <Text style={[typography.subhead, styles.section, { color: colors.text2 }]}>Which item?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
          {items.map((item) => {
            const selected = item.id === selectedId;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                testID={`scan.correction.item.${item.id}`}
                onPress={() => setSelectedId(item.id)}
                style={[styles.pill, { backgroundColor: selected ? colors.accent : colors.fill }]}
              >
                <Text style={[typography.headline, { color: selected ? colors.onAccent : colors.text }]}>{item.source.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={[typography.subhead, styles.section, { color: colors.text2 }]}>What's wrong?</Text>
        <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {CORRECTION_KINDS.map((option, index) => {
            const selected = kind === option;
            const hint = correctionKindHint(option, label);
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                testID={`scan.correction.kind.${option}`}
                onPress={() => setKind(option)}
                style={[styles.row, index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null]}
              >
                <View style={styles.flex}>
                  <Text style={[typography.headline, { color: colors.text, fontWeight: selected ? '700' : '500' }]}>
                    {CORRECTION_KIND_TITLE[option]}
                  </Text>
                  {hint !== null ? <Text style={[typography.subhead, { color: colors.text2 }]}>{hint}</Text> : null}
                </View>
                {selected ? <Icon name="check" size={22} color={colors.accentInk} /> : null}
              </Pressable>
            );
          })}
        </View>

        {fixKind !== null ? (
          <Pressable accessibilityRole="button" testID="scan.correction.fixNow" onPress={fixNow} style={styles.fixNow}>
            <Icon name="pencil" size={20} color={colors.accentInk} />
            <Text style={[typography.headline, { color: colors.accentInk }]}>
              {fixKind === 'notEaten' ? 'Fix it now: remove the item' : 'Fix it now: edit the grams'}
            </Text>
          </Pressable>
        ) : null}

        <TextInput
          testID="scan.correction.note"
          accessibilityLabel="Add a note (optional)"
          placeholder="Add a note (optional)"
          placeholderTextColor={colors.text3}
          value={note}
          onChangeText={setNote}
          multiline
          style={[typography.body, styles.note, { color: colors.text, backgroundColor: colors.fill }]}
        />
      </ScrollView>
      <PrimaryButton
        title="Save report"
        testID="scan.correction.save"
        action={() => {
          model.captureCorrection(kind, note, selectedId);
          setSent(true);
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  title: { fontSize: 28, fontWeight: '700' },
  body: { gap: space.md, paddingBottom: space.lg },
  section: { fontWeight: '600', paddingHorizontal: space.xs },
  pills: { gap: space.sm },
  pill: { minHeight: size.tap, borderRadius: radius.button, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
  list: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.tap, paddingHorizontal: space.lg, paddingVertical: space.md },
  fixNow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.tap },
  note: { borderRadius: radius.lg, padding: space.lg, minHeight: 64, textAlignVertical: 'top' },
  // Frame 77: a 520 pt sheet whose dock sits at the bottom, the text block above it.
  sentSheet: { minHeight: 520 },
  sentBody: { flex: 1, gap: space.md, paddingVertical: space.lg },
  sentTile: { width: 64, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  sentDock: { gap: space.sm, paddingTop: space.xl },
});
