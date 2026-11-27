/**
 * CCFoodRow (Components/Content.swift). List row with the fork-and-knife tile,
 * title, meta, optional compact badge, sync-pending chip and the kcal value —
 * the kcal clause is the ED-safe branch: it disappears while the mode is on.
 */

import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { space, typography, useTokens } from '../tokens';

import { useEdSafeMode } from '../edSafe';

export type FoodRowProps = {
  title: string;
  meta?: string;
  kcal?: number;
  compactBadge?: ReactNode;
  syncPending?: boolean;
};

export function FoodRow({ title, meta, kcal, compactBadge, syncPending = false }: FoodRowProps) {
  const { colors } = useTokens();
  const edSafeMode = useEdSafeMode();
  return (
    <View
      testID={`food-row:${title}`}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <View style={[styles.tile, { backgroundColor: colors.surface }]}>
        <SymbolView name="fork.knife" size={15} tintColor={colors.textTertiary} />
      </View>
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        {meta != null && (
          <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={2}>
            {meta}
          </Text>
        )}
        {compactBadge}
      </View>
      {syncPending && (
        <View style={styles.syncPending}>
          <SymbolView name="clock" size={11} tintColor={colors.textTertiary} />
          <Text style={[styles.syncText, { color: colors.textTertiary }]}>Syncs later</Text>
        </View>
      )}
      {!edSafeMode && kcal != null && (
        <Text style={[styles.kcal, { color: colors.textPrimary }]} testID={`food-row-kcal:${title}`}>
          {`${kcal} kcal`}
        </Text>
      )}
      <SymbolView name="chevron.right" size={12} weight="semibold" tintColor={colors.textTertiary} />
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
