/**
 * CCFoodRow (Components/Content.swift). List row with the fork-and-knife tile,
 * title, meta, optional compact badge, sync-pending chip and the kcal value —
 * the kcal clause is the ED-safe branch: it disappears while the mode is on.
 */

import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { radius, space, typography, useTokens } from '../tokens';

import { useEdSafeMode } from '../edSafe';

export type FoodRowProps = {
  title: string;
  meta?: string;
  kcal?: number;
  compactBadge?: ReactNode;
  syncPending?: boolean;
  /** Short label drawn on the row under the meta, such as "Edited". */
  chip?: string;
  /** Identifier of the chip when the caller must keep its own (`diary.editedChip.<id>`). Default `food-row-chip:<title>`. */
  chipTestID?: string;
};

export function FoodRow({
  title,
  meta,
  kcal,
  compactBadge,
  syncPending = false,
  chip,
  chipTestID,
}: FoodRowProps) {
  const { colors } = useTokens();
  const edSafeMode = useEdSafeMode();
  return (
    <View
      testID={`food-row:${title}`}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <View style={[styles.tile, { backgroundColor: colors.fill }]}>
        <SymbolView name="fork.knife" size={15} tintColor={colors.text3} />
      </View>
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {meta != null && (
          <Text style={[styles.meta, { color: colors.text2 }]} numberOfLines={2}>
            {meta}
          </Text>
        )}
        {compactBadge}
        {chip != null && chip.length > 0 && (
          <View
            testID={chipTestID ?? `food-row-chip:${title}`}
            style={[styles.chip, { backgroundColor: colors.fill }]}
          >
            <Text style={[styles.chipText, { color: colors.text2 }]}>{chip}</Text>
          </View>
        )}
      </View>
      {syncPending && (
        <View style={styles.syncPending}>
          <SymbolView name="clock" size={11} tintColor={colors.text3} />
          <Text style={[styles.syncText, { color: colors.text3 }]}>Syncs later</Text>
        </View>
      )}
      {!edSafeMode && kcal != null && (
        <Text style={[styles.kcal, { color: colors.text }]} testID={`food-row-kcal:${title}`}>
          {`${kcal} kcal`}
        </Text>
      )}
      <SymbolView name="chevron.right" size={12} weight="semibold" tintColor={colors.text3} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 0.5,
  },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.headline,
  },
  meta: {
    ...typography.footnote,
  },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  chipText: {
    ...typography.caption,
  },
  syncPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  syncText: {
    ...typography.caption,
  },
  kcal: {
    fontSize: 14,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
