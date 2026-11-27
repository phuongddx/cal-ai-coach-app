/**
 * FoodSearchView.swift — back chevron + search field, the Search / Saved /
 * Recent segment, the verbatim empty state, the per-row add button, the
 * dashed escape card (describe / manual) and the persistent "Create custom
 * food" row. The kcal footnote collapses under ED-Safe into the serving size
 * (EdSafeCollapse owns that branch); rows open the manual-log sheet; saving
 * writes the diary mirror+outbox path and reports the receipt upward.
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import type { CatalogRepository } from '../../../data/repos/catalogRepository';
import type { DiaryEntryDetail, DiaryEntryRepository } from '../../../data/repos/diaryEntryRepository';
import type { DiaryDetailRepository } from '../../../data/repos/diaryDetailRepository';
import type { Clock, IdGenerator } from '../../../data/repos/sqlDb';
import { EdSafeCollapse, SearchField, useEdSafeMode, useTokens } from '../../../design';

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
  /** The describe escape's hand-over into the scan flow's text mode. */
  onDescribe: () => void;
  onSaved: (receipt: SavedReceipt) => void;
  onDismiss: () => void;
};

type SearchSegment = 'search' | 'saved' | 'recent';

const SEGMENTS: Array<{ value: SearchSegment; label: string }> = [
  { value: 'search', label: 'Search' },
  { value: 'saved', label: 'Saved' },
  { value: 'recent', label: 'Recent' },
];

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
  onDescribe,
  onSaved,
  onDismiss,
}: FoodSearchViewProps) {
  const { colors, radius, typography } = useTokens();
  const edSafe = useEdSafeMode();
  // The model the route omits is built here over the injected catalog — the
  // FoodSearchRoute half of the Swift file.
  const model = useMemo(
    () => modelProp ?? createFoodSearchModel({ catalog }),
    [modelProp, catalog],
  );
  const saveManual = useMemo(
    () => createManualLogSaver({ userId, diaryEntries, diaryDetails, notify, now, newId }),
    [userId, diaryDetails, diaryEntries, notify, now, newId],
  );

  const [segment, setSegment] = useState<SearchSegment>('recent');
  const [manualRow, setManualRow] = useState<FoodSearchRow | null>(null);
  const [isCustomSheetPresented, setIsCustomSheetPresented] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [, setVersion] = useState(0);
  useEffect(() => model.subscribe(() => setVersion((version) => version + 1)), [model]);

  const query = model.getQuery();
  const trimmed = query.trim();
  const results = model.getResults();
  const recents = model.getRecents();
  const saved = model.getSaved();

  /** Typing is a search: the segment follows the query out of Recent. */
  const onQueryChange = (text: string) => {
    model.setQuery(text);
    if (text.trim() !== '') {
      setSegment('search');
    }
  };

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
    <View style={[styles.root, { backgroundColor: colors.grouped }]}>
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
            onChangeText={onQueryChange}
            placeholder="Search foods"
          />
        </View>
      </View>

      <View style={[styles.segmentTrack, { backgroundColor: colors.fill, borderRadius: radius.md }]}>
        {SEGMENTS.map((option) => {
          const selected = segment === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              testID={`search.segment.${option.value}`}
              onPress={() => setSegment(option.value)}
              style={[
                styles.segmentOption,
                selected && { backgroundColor: colors.card, borderRadius: radius.sm },
              ]}
            >
              <Text
                style={[styles.segmentLabel, { color: selected ? colors.textPrimary : colors.textSecondary }]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {segment === 'recent' ? (
          <ListCard title="Recent">
            {recents.map((row) => (
              <FoodSearchRowView key={row.id} row={row} leadingIcon="clock" onOpen={() => setManualRow(row)} />
            ))}
          </ListCard>
        ) : segment === 'saved' ? (
          saved.length > 0 ? (
            <ListCard title="Saved">
              {saved.map((row) => (
                <FoodSearchRowView key={row.id} row={row} leadingIcon="fork.knife" onOpen={() => setManualRow(row)} />
              ))}
            </ListCard>
          ) : null
        ) : trimmed === '' ? null : results.length === 0 ? (
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

        <View style={[styles.escapeCard, { borderColor: colors.border, borderRadius: radius.md }]}>
          <Pressable
            accessibilityRole="button"
            testID="search.escape.describe"
            onPress={onDescribe}
            style={styles.escapeRow}
          >
            <SymbolView name="pencil.line" size={16} tintColor={colors.accentInk} />
            <Text style={[styles.escapeText, { color: colors.textPrimary }]}>
              {"Can't find it? Describe it or log manually"}
            </Text>
            <SymbolView name="chevron.right" size={12} weight="semibold" tintColor={colors.textTertiary} />
          </Pressable>
          <View style={[styles.escapeDivider, { backgroundColor: colors.separator }]} />
          <Pressable
            accessibilityRole="button"
            testID="search.escape.manual"
            onPress={() => setIsCustomSheetPresented(true)}
            style={styles.escapeRow}
          >
            <Text style={[styles.escapeManualText, { color: colors.accentInk }]}>Log manually</Text>
            <SymbolView name="chevron.right" size={12} weight="semibold" tintColor={colors.textTertiary} />
          </Pressable>
        </View>

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
              // The pending query re-runs and the Saved segment gains the row.
              void model.applySearch(model.getQuery());
              void model.loadSaved();
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
  const edSafe = useEdSafeMode();
  const basis = row.basis === 'per_serving' ? 'serving' : '100g';
  const footnote = `${row.kcal} kcal · ${Math.round(row.proteinG)}g protein · ${basis}`;
  // The ED-safe slot: the serving size, or the basis string when the row has
  // no serving. The kcal figure returns in the same slot when the mode is off.
  const servingFootnote = row.servingGrams !== null ? `${row.servingGrams} g` : basis;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add food, ${row.name}`}
      testID="search.foodRow"
      onPress={onOpen}
      style={styles.foodRow}
    >
      <View style={[styles.rowTile, { backgroundColor: colors.fill, borderRadius: 10 }]}>
        <SymbolView name={leadingIcon} size={14} tintColor={colors.textTertiary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[typography.subhead, { color: colors.textPrimary }]} numberOfLines={1}>
          {row.name}
        </Text>
        <EdSafeCollapse>
          <Text style={[typography.footnote, { color: colors.textSecondary }]} numberOfLines={2}>
            {footnote}
          </Text>
        </EdSafeCollapse>
        {edSafe && (
          <Text style={[typography.footnote, { color: colors.textSecondary }]} numberOfLines={2}>
            {servingFootnote}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${row.name}`}
        testID={`search.addRow.${row.id}`}
        onPress={onOpen}
        style={[styles.addRow, { backgroundColor: colors.accentTint }]}
      >
        <SymbolView name="plus" size={15} weight="semibold" tintColor={colors.accentInk} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingTop: 8 },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fieldWrapper: { flex: 1 },
  segmentTrack: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 2,
    gap: 2,
  },
  segmentOption: {
    flex: 1,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentLabel: { fontSize: 13, fontWeight: '600' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 },
  emptyState: { borderWidth: 1, padding: 20, gap: 8, alignItems: 'center' },
  listCard: { borderWidth: 1, padding: 12, gap: 4 },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  rowTile: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  addRow: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  escapeCard: { borderWidth: 1, borderStyle: 'dashed' },
  escapeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  escapeText: { flex: 1, fontSize: 14, fontWeight: '500' },
  escapeDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 12 },
  escapeManualText: { flex: 1, fontSize: 14, fontWeight: '500' },
  createCustomRow: { borderWidth: 1, borderStyle: 'dashed', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  createCustomText: { fontSize: 14, fontWeight: '500' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
});
