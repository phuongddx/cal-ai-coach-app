/**
 * CustomFoodSheet.swift — create a custom food on a per-100g or per-serving
 * basis with the Swift sheet's clamps, saved through the catalog repository.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import type { CatalogRepository } from '../../../data/repos/catalogRepository';
import type { Clock, IdGenerator } from '../../../data/repos/sqlDb';
import { ChipOption, PrimaryButton, Sheet, useEdSafeMode, useTokens, space } from '../../../design';

import {
  canSaveCustomFood,
  createCustomFoodModel,
  type CustomFoodBasis,
  type CustomFoodDraft,
} from '../customFoodModel';
import type { FoodSearchRow } from '../foodSearchModel';

export type CustomFoodSheetProps = {
  catalog: CatalogRepository;
  userId: string;
  onCreated: (row: FoodSearchRow) => void;
  onDismiss: () => void;
  now: Clock;
  newId: IdGenerator;
};

const BASES: Array<{ value: CustomFoodBasis; label: string }> = [
  { value: 'per100g', label: 'Per 100 g' },
  { value: 'per_serving', label: 'Per serving' },
];

export function CustomFoodSheet({
  catalog,
  userId,
  onCreated,
  onDismiss,
  now,
  newId,
}: CustomFoodSheetProps) {
  const { colors, radius, space, typography } = useTokens();
  const edSafe = useEdSafeMode();
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const model = useMemo(
    () => createCustomFoodModel({ catalog, userId, now, newId }),
    [catalog, userId, now, newId],
  );
  const [draft, setDraft] = useState<CustomFoodDraft>({
    name: '',
    basis: 'per100g',
    kcalText: '',
    proteinText: '',
    carbsText: '',
    fatText: '',
    fiberText: '',
    servingGramsText: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const patch = (changes: Partial<CustomFoodDraft>) =>
    setDraft((current) => ({ ...current, ...changes }));

  const canSave = canSaveCustomFood(draft);

  const save = () => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    void model.save(draft).then((row) => {
      setIsSaving(false);
      if (row !== null) {
        onCreated(row);
        onDismiss();
      }
    });
  };

  return (
    <Sheet>
      <View style={styles.header}>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>Create custom food</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          testID="custom.close"
          onPress={onDismiss}
          style={styles.closeButton}
        >
          <SymbolView name="xmark" size={14} weight="semibold" tintColor={colors.textSecondary} />
        </Pressable>
      </View>

      <Field
        title="Name"
        value={draft.name}
        onChangeText={(text) => patch({ name: text })}
        identifier="custom.nameField"
      />

      <View style={styles.basisRow}>
        {BASES.map((option) => (
          <View key={option.value} testID={`custom.basis.${option.value}`}>
            <ChipOption
              title={option.label}
              isSelected={draft.basis === option.value}
              onSelect={() => patch({ basis: option.value })}
            />
          </View>
        ))}
      </View>

      {edSafe && (
        <View style={[styles.noteCard, { backgroundColor: colors.accentTint, borderRadius: radius.md }]}>
          <SymbolView name="eye.slash" size={16} tintColor={colors.accentInk} />
          <Text style={[typography.footnote, { color: colors.textSecondary, flex: 1 }]}>
            {'Name and serving only. Nutrition fields fold into \u201CAdvanced\u201D, collapsed and blurred.'}
          </Text>
        </View>
      )}

      {edSafe ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: advancedExpanded }}
            onPress={() => setAdvancedExpanded((expanded) => !expanded)}
            style={styles.advancedHeader}
          >
            <Text style={[typography.subhead, { color: colors.textPrimary, fontWeight: '600' }]}>Advanced</Text>
            <SymbolView
              name={advancedExpanded ? 'chevron.down' : 'chevron.right'}
              size={12}
              weight="semibold"
              tintColor={colors.textSecondary}
            />
          </Pressable>
          {advancedExpanded && (
            <>
              <Field
                title="kcal"
                value={draft.kcalText}
                onChangeText={(text) => patch({ kcalText: text })}
                identifier="custom.kcalField"
                keyboardType="numbers-and-punctuation"
              />
              <Field
                title="Protein g"
                value={draft.proteinText}
                onChangeText={(text) => patch({ proteinText: text })}
                identifier="custom.proteinField"
                keyboardType="number-pad"
              />
              <Field
                title="Carbs g"
                value={draft.carbsText}
                onChangeText={(text) => patch({ carbsText: text })}
                identifier="custom.carbsField"
                keyboardType="number-pad"
              />
              <Field
                title="Fat g"
                value={draft.fatText}
                onChangeText={(text) => patch({ fatText: text })}
                identifier="custom.fatField"
                keyboardType="number-pad"
              />
              <Field
                title="Fiber g"
                value={draft.fiberText}
                onChangeText={(text) => patch({ fiberText: text })}
                identifier="custom.fiberField"
                keyboardType="number-pad"
              />
            </>
          )}
        </>
      ) : (
        <>
          <Field
            title="kcal"
            value={draft.kcalText}
            onChangeText={(text) => patch({ kcalText: text })}
            identifier="custom.kcalField"
            keyboardType="numbers-and-punctuation"
          />
          <Field
            title="Protein g"
            value={draft.proteinText}
            onChangeText={(text) => patch({ proteinText: text })}
            identifier="custom.proteinField"
            keyboardType="number-pad"
          />
          <Field
            title="Carbs g"
            value={draft.carbsText}
            onChangeText={(text) => patch({ carbsText: text })}
            identifier="custom.carbsField"
            keyboardType="number-pad"
          />
          <Field
            title="Fat g"
            value={draft.fatText}
            onChangeText={(text) => patch({ fatText: text })}
            identifier="custom.fatField"
            keyboardType="number-pad"
          />
          <Field
            title="Fiber g"
            value={draft.fiberText}
            onChangeText={(text) => patch({ fiberText: text })}
            identifier="custom.fiberField"
            keyboardType="number-pad"
          />
        </>
      )}
      {draft.basis === 'per_serving' && (
        <Field
          title="Serving grams"
          value={draft.servingGramsText}
          onChangeText={(text) => patch({ servingGramsText: text })}
          identifier="custom.servingGramsField"
          keyboardType="number-pad"
        />
      )}

      <View testID="custom.save">
        <PrimaryButton title="Save" action={save} disabled={!canSave || isSaving} />
      </View>
    </Sheet>
  );
}

function Field({
  title,
  value,
  onChangeText,
  identifier,
  keyboardType = 'default',
}: {
  title: string;
  value: string;
  onChangeText: (text: string) => void;
  identifier: string;
  keyboardType?: 'default' | 'number-pad' | 'numbers-and-punctuation';
}) {
  const { colors, space, radius, typography } = useTokens();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={title}
      placeholderTextColor={colors.textTertiary}
      keyboardType={keyboardType}
      testID={identifier}
      style={[
        styles.field,
        typography.body,
        {
          color: colors.textPrimary,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingVertical: space.sm,
          paddingHorizontal: space.lg,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  closeButton: { marginLeft: 'auto', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  basisRow: { flexDirection: 'row', gap: 8 },
  noteCard: { flexDirection: 'row', gap: space.md, padding: space.lg, alignItems: 'flex-start' },
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: space.sm,
  },
  field: { borderWidth: 1 },
});
