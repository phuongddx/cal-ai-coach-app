/**
 * FoodSearchView.swift — back chevron + search field, the Recent card before a
 * query, the "Results for “{query}”" card, the verbatim empty state, and the
 * persistent "Create custom food" row. Rows open the manual-log sheet; saving
 * writes the diary mirror+outbox path and reports the receipt upward.
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import type { CatalogRepository } from '../../../data/repos/catalogRepository';
import type { DiaryEntryDetail, DiaryEntryRepository } from '../../../data/repos/diaryEntryRepository';
import type { DiaryDetailRepository } from '../../../data/repos/diaryDetailRepository';
import type { Clock, IdGenerator } from '../../../data/repos/sqlDb';
import { SearchField, useTokens } from '../../../design';

import { createManualLogSaver } from '../manualLogModel';
import type { SavedReceipt } from '../addFoodModel';
import { createFoodSearchModel, type FoodSearchModel, type FoodSearchRow } from '../foodSearchModel';
import { mealName } from '../diaryMath';
import { CustomFoodSheet } from './CustomFoodSheet';
import { ManualLogSheet } from './ManualLogSheet';

export type FoodSearchViewProps = {
  /** An already-created model; the route builds it over the real catalog. */
  model?: FoodSearchModel;
  mealSlot: string;
  catalog: CatalogRepository;
  userId: string;
  diaryEntries: DiaryEntryRepository;
  diaryDetails: DiaryDetailRepository;
  notify: () => void;
  now: Clock;
  newId: IdGenerator;
  onSaved: (receipt: SavedReceipt) => void;
  onDismiss: () => void;
};

export function FoodSearchView({
  model: modelProp,
  mealSlot,
  catalog,
  userId,
  diaryEntries,
  diaryDetails,
  notify,
  now,
  newId,
  onSaved,
  onDismiss,
}: FoodSearchViewProps) {
  const { colors, radius, typography } = useTokens();
  // The model the route omits is built here over the injected catalog — the
  // FoodSearchRoute half of the Swift file.
  const model = useMemo(
    () => modelProp ?? createFoodSearchModel({ catalog }),
    [modelProp, catalog],
  );
  const saveManual = useMemo(
    () => createManualLogSaver({ userId, diaryEntries, diaryDetails, notify, now, newId }),
    [userId, diaryEntries, diaryDetails, notify, now, newId],
  );

  const [manualRow, setManualRow] = useState<FoodSearchRow | null>(null);
  const [isCustomSheetPresented, setIsCustomSheetPresented] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [, setVersion] = useState(0);
  useEffect(() => model.subscribe(() => setVersion((version) => version + 1)), [model]);

  const query = model.getQuery();
  const trimmed = query.trim();
  const results = model.getResults();
  const recents = model.getRecents();

  const onManualSave = (detail: DiaryEntryDetail) => {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    void saveManual(detail).then((receipt) => {
      setIsSaving(false);
      setManualRow(null);
      onSaved(receipt);
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="search.back"
          onPress={onDismiss}
          style={styles.backButton}
        >
          <SymbolView name="chevron.left" size={16} weight="semibold" tintColor={colors.textSecondary} />
        </Pressable>
        <View testID="search.field" style={styles.fieldWrapper}>
          <SearchField
            text={query}
            onChangeText={(text) => model.setQuery(text)}
            placeholder="Search foods"
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {trimmed === '' ? (
          <ListCard title="Recent">
            {recents.map((row) => (
              <FoodSearchRowView key={row.id} row={row} leadingIcon="clock" onOpen={() => setManualRow(row)} />
            ))}
          </ListCard>
        ) : results.length === 0 ? (
          <View
            testID="search.emptyState"
            style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.lg }]}
          >
            <Text style={[typography.heading, { color: colors.textPrimary, textAlign: 'center' }]}>
              {`No results for \u201C${trimmed}\u201D`}
            </Text>
            <Text style={[typography.subhead, { color: colors.textSecondary, textAlign: 'center' }]}>
              {'Try a different search or create a custom food.'}
            </Text>
          </View>
        ) : (
          <ListCard title={`Results for \u201C${trimmed}\u201D`}>
            {results.map((row) => (
              <FoodSearchRowView key={row.id} row={row} leadingIcon="fork.knife" onOpen={() => setManualRow(row)} />
            ))}
          </ListCard>
        )}

        <Pressable
          accessibilityRole="button"
          testID="search.createCustom"
          onPress={() => setIsCustomSheetPresented(true)}
          style={[
            styles.createCustomRow,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.md },
          ]}
        >
          <SymbolView name="plus.circle" size={16} tintColor={colors.textSecondary} />
          <Text style={[styles.createCustomText, { color: colors.textSecondary }]}>
            Create custom food
          </Text>
        </Pressable>
      </ScrollView>

      <Modal visible={manualRow !== null} animationType="slide" transparent onRequestClose={() => setManualRow(null)}>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.background }]}>
          {manualRow !== null && (
            <ManualLogSheet
              row={manualRow}
              mealSlot={mealSlot}
              onSave={onManualSave}
              onDismiss={() => setManualRow(null)}
              newId={newId}
            />
          )}
        </View>
      </Modal>

      <Modal
        visible={isCustomSheetPresented}
        animationType="slide"
        transparent
        onRequestClose={() => setIsCustomSheetPresented(false)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: colors.background }]}>
          <CustomFoodSheet
            catalog={catalog}
            userId={userId}
            onCreated={() => {
              // The pending query re-runs when the custom food is saved.
              void model.applySearch(model.getQuery());
            }}
            onDismiss={() => setIsCustomSheetPresented(false)}
            now={now}
            newId={newId}
          />
        </View>
      </Modal>
      {/* The model publishes on every recents/results change; the
          subscription above re-renders this tree. */}
    </View>
  );
}

function ListCard({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, radius, typography } = useTokens();
  return (
    <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.lg }]}>
      <Text style={[typography.headline, { color: colors.textPrimary }]}>{title}</Text>
      <View>{children}</View>
    </View>
  );
}

function FoodSearchRowView({
  row,
  leadingIcon,
  onOpen,
}: {
  row: FoodSearchRow;
  leadingIcon: 'clock' | 'fork.knife';
  onOpen: () => void;
}) {
  const { colors, typography } = useTokens();
  const basis = row.basis === 'per_serving' ? 'serving' : '100g';
  const footnote = `${row.kcal} kcal · ${Math.round(row.proteinG)}g protein · ${basis}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add food, ${row.name}`}
      testID="search.foodRow"
      onPress={onOpen}
      style={styles.foodRow}
    >
      <View style={[styles.rowTile, { backgroundColor: colors.surface, borderRadius: 10 }]}>
        <SymbolView name={leadingIcon} size={14} tintColor={colors.textTertiary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[typography.subhead, { color: colors.textPrimary }]} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={[typography.footnote, { color: colors.textSecondary }]} numberOfLines={2}>
          {footnote}
        </Text>
      </View>
      <View style={[styles.plusCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SymbolView name="plus" size={15} weight="semibold" tintColor={colors.textPrimary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingTop: 8 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fieldWrapper: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  emptyState: { borderWidth: 1, padding: 20, gap: 8, alignItems: 'center' },
  listCard: { borderWidth: 1, padding: 12, gap: 4 },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  rowTile: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  plusCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  createCustomRow: { borderWidth: 1, borderStyle: 'dashed', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  createCustomText: { fontSize: 14, fontWeight: '500' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
});
