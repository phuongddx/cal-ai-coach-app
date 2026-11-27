/**
 * AddFoodSheet.swift — the Add Food sheet: exactly five quick-action tiles
 * over a saved-meals rail with one-tap re-log. Props-driven so tests render it
 * without a data environment, exactly as the Swift snapshot tests do.
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { QuickActionTile, SectionHeader, Sheet, useTokens, useEdSafeHidden } from '../../../design';

import { mealName } from '../diaryMath';
import type { ScanMode } from '../addFoodModel';
import type { SavedMeal } from '../../../data/repos/catalogRepository';
import { createAddFoodModel, type SavedReceipt } from '../addFoodModel';
import type { DiaryDeps } from '../deps';
import { FoodSearchView } from './FoodSearchView';

export type AddFoodSheetProps = {
  mealSlot: string;
  savedMeals: SavedMeal[];
  onCapture: (mode: ScanMode) => void;
  onSearch: () => void;
  onRelog: (meal: SavedMeal) => void;
  onDismiss: () => void;
};

type TileEntry = { key: string; title: string; icon: string; mode: ScanMode | null };

// The DS grid is 3-col; Voice is v2 (INP2-01).
const TILES: TileEntry[] = [
  { key: 'photo', title: 'Photo', icon: 'camera', mode: 'photo' },
  { key: 'barcode', title: 'Barcode', icon: 'barcode.viewfinder', mode: 'barcode' },
  { key: 'label', title: 'Label', icon: 'doc.text.viewfinder', mode: 'label' },
  { key: 'describe', title: 'Describe', icon: 'pencil.line', mode: 'text' },
  { key: 'search', title: 'Search', icon: 'magnifyingglass', mode: null },
];

export function AddFoodSheet({
  mealSlot,
  savedMeals,
  onCapture,
  onSearch,
  onRelog,
  onDismiss,
}: AddFoodSheetProps) {
  const { colors, space, radius, typography } = useTokens();
  const kcalHidden = useEdSafeHidden();

  return (
    <Sheet>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[typography.heading, { color: colors.textPrimary }]}>Add food</Text>
          <Text style={[typography.footnote, { color: colors.textSecondary }]}>
            {`to ${mealName(mealSlot)}`}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          testID="addfood.close"
          onPress={onDismiss}
          style={styles.closeButton}
        >
          <SymbolView name="xmark" size={14} weight="semibold" tintColor={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.tileGrid}>
        {TILES.map((tile) => (
          <View
            key={tile.key}
            testID={tile.mode === null ? 'addfood.tile.search' : `addfood.tile.${tile.key}`}
            style={styles.tileCell}
          >
            <QuickActionTile
              title={tile.title}
              icon={tile.icon}
              isHighlighted={tile.key === 'photo'}
              action={tile.mode === null ? onSearch : () => onCapture(tile.mode as ScanMode)}
            />
          </View>
        ))}
      </View>

      <SectionHeader title="Saved meals" />

      {savedMeals.length === 0 ? (
        <View
          testID="addfood.savedMealsEmpty"
          style={[
            styles.emptyCard,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.lg },
          ]}
        >
          <Text style={[typography.subhead, { color: colors.textSecondary, textAlign: 'center' }]}>
            {'Save a meal and re-log it here in one tap.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.rail}
          contentContainerStyle={styles.railContent}
        >
          {savedMeals.map((meal) => (
            <Pressable
              key={meal.id}
              accessibilityRole="button"
              accessibilityLabel={`Log saved meal, ${meal.name}`}
              testID="addfood.savedMeal"
              onPress={() => onRelog(meal)}
              style={[
                styles.mealCard,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.md },
              ]}
            >
              <View
                style={[styles.mealSymbol, { backgroundColor: colors.surface, borderRadius: radius.sm }]}
              >
                <SymbolView
                  name={(meal.symbol ?? 'fork.knife') as never}
                  size={17}
                  tintColor={colors.textTertiary}
                />
              </View>
              <Text
                style={[styles.mealName, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {meal.name}
              </Text>
              {!kcalHidden && (
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {`${meal.kcal} kcal`}
                </Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}

/**
 * AddFoodSheetRoute.swift — the environment-backed wrapper: loads the saved
 * meals, performs the re-log through the add-food model and hosts the search
 * stack. The scan capture hands over through `onCapture` (the route file's
 * navigation callback).
 */
export type AddFoodSheetRouteProps = {
  mealSlot: string;
  deps: DiaryDeps;
  onSaved: (receipt: SavedReceipt) => void;
  onDismiss: () => void;
  onCapture: (mode: ScanMode) => void;
};

export function AddFoodSheetRoute({
  mealSlot,
  deps,
  onSaved,
  onDismiss,
  onCapture,
}: AddFoodSheetRouteProps) {
  const model = useMemo(
    () =>
      createAddFoodModel({
        catalog: deps.catalog,
        diaryEntries: deps.diaryEntries,
        mealSlot,
        userId: deps.ownerId,
        notify: deps.notify,
        now: deps.now,
        newId: deps.newId,
      }),
    [deps, mealSlot],
  );
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [isSearchPresented, setIsSearchPresented] = useState(false);

  useEffect(() => {
    let mounted = true;
    void model.loadSavedMeals().then((meals) => {
      if (mounted) {
        setSavedMeals(meals);
      }
    });
    return () => {
      mounted = false;
    };
  }, [model]);

  return (
    <>
      <AddFoodSheet
        mealSlot={mealSlot}
        savedMeals={savedMeals}
        onCapture={(mode) => {
          onDismiss();
          onCapture(mode);
        }}
        onSearch={() => setIsSearchPresented(true)}
        onRelog={(meal) => {
          void model.relog(meal).then((receipt) => {
            if (receipt !== null) {
              onSaved(receipt);
              onDismiss();
            }
          });
        }}
        onDismiss={onDismiss}
      />
      <Modal visible={isSearchPresented} animationType="slide" onRequestClose={() => setIsSearchPresented(false)}>
        <FoodSearchView
          mealSlot={mealSlot}
          userId={deps.ownerId}
          diaryEntries={deps.diaryEntries}
          diaryDetails={deps.diaryDetails}
          notify={deps.notify}
          now={deps.now}
          newId={deps.newId}
          catalog={deps.catalog}
          onSaved={onSaved}
          onDismiss={() => setIsSearchPresented(false)}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  headerText: { flex: 1, gap: 2 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tileCell: { width: '31%', flexGrow: 1 },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  rail: { marginTop: 4 },
  railContent: { gap: 8, paddingVertical: 4 },
  mealCard: { width: 100, borderWidth: 1, padding: 8, gap: 4 },
  mealSymbol: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  mealName: { fontSize: 12, fontWeight: '600' },
});
