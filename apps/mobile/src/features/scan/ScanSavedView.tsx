/**
 * ScanSavedView.swift — Saved + Undo: the design toast (Undo tombstones the just-written entries), the "Today so far"
 * peek, the first-log streak card, and View diary / Add more. The toast, streak card and kcal framing own ED-safe.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SecondaryButton, StreakCard, Toast, space, typography, useTokens } from '../../design';
import { EdSafeCollapse } from './EdSafeCollapse';
import { mealName } from './scanCopy';
import type { ScanModel } from './scanModel';
import { useScanState } from './useScanModel';

export type ScanSavedViewProps = {
  model: ScanModel;
  onViewDiary: () => void;
  onAddMore: () => void;
};

export function ScanSavedView({ model, onViewDiary, onAddMore }: ScanSavedViewProps) {
  const { colors } = useTokens();
  const state = useScanState(model);
  const [toastVisible, setToastVisible] = useState(true);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {toastVisible ? (
        <View testID="scan.savedToast">
          <Toast
            title={`Saved to ${mealName(state.mealSlot)}`}
            kcalText={state.savedKcal === null ? undefined : `${state.savedKcal} kcal added`}
            undoTitle="Undo"
            onUndo={() => {
              setToastVisible(false);
              void model.undo();
            }}
            onDismiss={() => setToastVisible(false)}
          />
        </View>
      ) : null}

      <EdSafeCollapse>
        <View testID="scan.todaySoFar" accessible style={styles.peek}>
          <Text style={[typography.caption, styles.peekLabel, { color: colors.textSecondary }]}>Today so far</Text>
          <View style={styles.peekRow}>
            <Text testID="scan.todayKcal" style={[styles.peekKcal, { color: colors.textPrimary }]}>
              {state.todayKcal ?? 0}
            </Text>
            {state.goalKcal !== null ? <Text style={[typography.subhead, { color: colors.textSecondary }]}>{`of ${state.goalKcal} kcal`}</Text> : null}
          </View>
        </View>
      </EdSafeCollapse>

      {state.streakCount === 1 ? (
        <View testID="scan.streakCard" style={styles.padded}>
          <StreakCard emoji="🔥" streak={1} title="Day 1 streak started!" freezesLeft={state.freezesLeft} />
        </View>
      ) : null}

      <View style={[styles.actions, styles.padded]}>
        <SecondaryButton title="View diary" testID="scan.viewDiary" action={onViewDiary} />
        <SecondaryButton title="Add more" testID="scan.addMore" action={onAddMore} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', gap: space.lg },
  padded: { paddingHorizontal: space.lg },
  peek: { alignItems: 'center', gap: space.xs },
  peekLabel: { fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.55 },
  peekRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  peekKcal: { fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: space.md, justifyContent: 'center' },
});
