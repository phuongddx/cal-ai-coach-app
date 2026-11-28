/**
 * DiaryEditSheet — the edit sheet of a diary food row (DY-08), built on the
 * Designer frame d-edit-light (d-edit-dark / d-edit-ed are its token and
 * ED-Safe variants): the back bar with the "Edit item" title, the editable
 * name with its confidence badge and "time · source" caption, the total card
 * ("Total · was <kcal>", the recomputed kcal, the macro dots) that becomes the
 * leaf note under ED-Safe, the grams card (44 pt steppers, tappable field,
 * ruler; serving chips only when the entry carries a serving — the diary
 * detail carries none today), "Save changes" and the destructive "Delete
 * item" that hands the entry to the day sheet's delete confirmation.
 *
 * The kcal recomputes from the entry's stored per-100g basis
 * (KcalArithmetic); the macros scale by the same gram ratio when stored. The
 * save is one batch through the model and never types a kcal.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  ConfidenceBadge,
  EdSafeCollapse,
  EdSafeNote,
  GlassIconButton,
  GramsRuler,
  Icon,
  PrimaryButton,
  Sheet,
  parseGramsInput,
  space,
  useTokens,
} from '../../../design';

import { manualKcal } from '../diaryMath';
import type { DiaryDayItem } from '../diarySnapshot';
import type { DiaryDayModel } from '../diaryDayModel';

export type DiaryEditSheetProps = {
  item: DiaryDayItem;
  model: DiaryDayModel;
  onDismiss: () => void;
  /** The save's hand-over: the previous item (the undo's restore source), the saved grams and name. */
  onSaved: (prev: DiaryDayItem, grams: number, name: string) => void;
  /** Hands the entry to the day sheet's delete confirmation (the frame's "Delete item"). */
  onDelete: (item: DiaryDayItem) => void;
};

const GRAMS_RANGE = { min: 0, max: 9999 } as const;
/** The ruler shows the everyday range; the field and steppers clamp wider. */
const RULER_RANGE = { min: 0, max: 500 } as const;
const GRAMS_STEP = 10;

export function DiaryEditSheet({ item, model, onDismiss, onSaved, onDelete }: DiaryEditSheetProps) {
  const { colors, radius, space, typography } = useTokens();
  const [name, setName] = useState(item.title);
  const [grams, setGrams] = useState(item.grams ?? 0);

  // The entry's own per-100g basis (kcal / grams × 100); without a stored
  // basis there is nothing to recompute from and the stored values are kept.
  const basis =
    item.kcal !== null && item.grams !== null && item.grams > 0
      ? (item.kcal / item.grams) * 100
      : null;
  const ratio = basis !== null ? grams / (item.grams as number) : null;
  const displayedKcal = basis === null ? item.kcal : manualKcal(basis, grams);
  const displayedProtein =
    ratio !== null && item.detail.proteinG !== null ? item.detail.proteinG * ratio : item.detail.proteinG;
  const displayedCarbs =
    ratio !== null && item.detail.carbsG !== null ? item.detail.carbsG * ratio : item.detail.carbsG;
  const displayedFat =
    ratio !== null && item.detail.fatG !== null ? item.detail.fatG * ratio : item.detail.fatG;

  const clamp = (value: number) => Math.min(Math.max(value, GRAMS_RANGE.min), GRAMS_RANGE.max);

  const save = () => {
    const finalGrams = clamp(grams);
    const finalName = name.trim() === '' ? item.title : name.trim();
    void model.updateEntry(item, finalGrams, finalName).then(() => onSaved(item, finalGrams, finalName));
  };

  const time = item.loggedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const hasMacros =
    displayedProtein !== null || displayedCarbs !== null || displayedFat !== null;

  return (
    <Sheet detent="large" style={{ flex: 1 }}>
      <View style={styles.bar} testID="diary.edit">
        <GlassIconButton icon="back" accessibilityLabel="Close" testID="diary.edit.close" onPress={onDismiss} />
        <Text
          accessibilityRole="header"
          testID="diary.edit.title"
          style={[styles.barTitle, typography.headline, { color: colors.textPrimary }]}
        >
          Edit item
        </Text>
        <View style={styles.barSpacer} />
      </View>

      <View style={styles.itemHeader}>
        <TextInput
          value={name}
          onChangeText={setName}
          accessibilityLabel="Name"
          style={[styles.nameField, typography.heading, { color: colors.textPrimary }]}
        />
        <Icon name="pencil" size={16} color={colors.textTertiary} />
      </View>
      <View style={styles.itemMeta}>
        {item.confidence !== null && <ConfidenceBadge confidence={item.confidence} compact />}
        <Text style={[typography.footnote, { color: colors.textSecondary }]}>
          {item.source === null ? time : `${time} · ${item.source}`}
        </Text>
      </View>

      <EdSafeCollapse>
        <View style={[styles.totalCard, { backgroundColor: colors.card, borderRadius: radius.lg }]}>
          {item.kcal !== null && (
            <Text style={[typography.footnote, { color: colors.textSecondary }]}>{`Total · was ${item.kcal}`}</Text>
          )}
          <View style={styles.totalRow}>
            {displayedKcal !== null && (
              <View style={styles.totalKcalRow}>
                <Text style={[styles.totalKcal, { color: colors.textPrimary }]}>{`${displayedKcal}`}</Text>
                <Text style={[typography.body, { color: colors.textSecondary }]}>kcal</Text>
              </View>
            )}
            {hasMacros && (
              <View style={styles.macroDots}>
                {displayedProtein !== null && (
                  <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                    {`P ${Math.round(displayedProtein)} g`}
                  </Text>
                )}
                {displayedCarbs !== null && (
                  <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                    {`C ${Math.round(displayedCarbs)} g`}
                  </Text>
                )}
                {displayedFat !== null && (
                  <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                    {`F ${Math.round(displayedFat)} g`}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </EdSafeCollapse>
      <EdSafeNote
        icon="leaf"
        title="Adjust the grams if the portion looks off."
        body="Numbers are hidden in ED-Safe mode."
      />

      <View style={[styles.gramsCard, { backgroundColor: colors.card, borderRadius: radius.lg }]}>
        <View testID={`diary.edit.grams.${item.id}`} style={styles.gramsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${item.title} by ${GRAMS_STEP} grams`}
            testID="ccstepper.decrement"
            onPress={() => setGrams(clamp(grams - GRAMS_STEP))}
            style={[styles.stepButton, { backgroundColor: colors.fill, borderRadius: radius.sm }]}
          >
            <Icon name="minus" size={16} color={colors.textPrimary} />
          </Pressable>
          <TextInput
            value={`${grams}`}
            onChangeText={(text) => {
              const parsed = parseGramsInput(text, GRAMS_RANGE.min, GRAMS_RANGE.max);
              if (parsed !== null) {
                setGrams(parsed);
              }
            }}
            keyboardType="number-pad"
            accessibilityLabel={`Grams of ${item.title}`}
            style={[
              styles.gramsField,
              typography.body,
              { color: colors.textPrimary, borderColor: colors.accent, borderRadius: radius.sm },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Increase ${item.title} by ${GRAMS_STEP} grams`}
            testID="ccstepper.increment"
            onPress={() => setGrams(clamp(grams + GRAMS_STEP))}
            style={[styles.stepButton, { backgroundColor: colors.fill, borderRadius: radius.sm }]}
          >
            <Icon name="plus" size={16} color={colors.textPrimary} />
          </Pressable>
        </View>
        <GramsRuler
          value={grams}
          onChange={setGrams}
          min={RULER_RANGE.min}
          max={RULER_RANGE.max}
          accessibilityLabel={`Grams ruler of ${item.title}`}
          testID={`diary.edit.grams.${item.id}.ruler`}
        />
      </View>

      <View testID="diary.edit.save">
        <PrimaryButton title="Save changes" action={save} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete, ${item.title}`}
        onPress={() => onDelete(item)}
        style={styles.deleteRow}
      >
        <Icon name="trash" size={16} color={colors.errorInk} />
        <Text style={[typography.body, { color: colors.errorInk, fontWeight: '600' }]}>Delete item</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  barTitle: { flex: 1, textAlign: 'center' },
  barSpacer: { width: 44 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  nameField: { flex: 1, paddingVertical: 0 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  totalCard: { padding: space.lg, gap: 2 },
  totalRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  totalKcalRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  totalKcal: { fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'] },
  macroDots: { alignItems: 'flex-end', gap: 2 },
  gramsCard: { padding: space.lg, gap: space.sm },
  gramsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gramsField: {
    flex: 1,
    height: 44,
    borderWidth: 2,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
  },
});
