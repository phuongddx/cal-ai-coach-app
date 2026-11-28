/**
 * Saved (Ember frame 06): a full screen, not a toast. A check circle, "Saved to <Meal>", the dish (with its kcal
 * unless ED-safe), the ember "Today so far" card with the streak line, an Undo card that stays until the person
 * leaves, and the dock "Scan another" / "View diary". Undo tombstones the just-written entries once.
 * ED-safe: the kcal in the subtitle and the whole "Today so far" block go; the streak line stays.
 */
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EdSafeAlternate, EmberCard, Icon, PrimaryButton, radius, size, space, typography, useTokens } from '../../design';
import { mealName } from './scanCopy';
import type { ScanModel } from './scanModel';
import { useScanState } from './useScanModel';

export type ScanSavedViewProps = {
  model: ScanModel;
  onViewDiary: () => void;
  onAddMore: () => void;
};

const CHECK = 96;
const HALO = 12;

export function ScanSavedView({ model, onViewDiary, onAddMore }: ScanSavedViewProps) {
  const { colors } = useTokens();
  const state = useScanState(model);
  const undoing = useRef(false);
  const streak = state.streakCount !== null && state.streakCount >= 1 ? state.streakCount : null;
  const today = state.todayKcal ?? 0;
  const goal = state.goalKcal;
  const fraction = goal !== null && goal > 0 ? Math.min(1, today / goal) : 0;
  const dish = state.mealTitle;

  const streakLine =
    streak === null ? null : (
      <View testID="scan.streakCard" style={styles.streakRow}>
        <Icon name="flame" size={20} color={colors.emberAccent} />
        <Text style={[typography.subhead, styles.streakText, { color: colors.emberText }]}>{`${streak}-day logging streak`}</Text>
      </View>
    );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        <View testID="scan.savedToast" accessible accessibilityLabel={`Saved to ${mealName(state.mealSlot)}`} style={styles.hero}>
          <View style={[styles.halo, { backgroundColor: colors.accentTint }]}>
            <View style={[styles.check, { backgroundColor: colors.accent }]}>
              <Icon name="check" size={48} color={colors.onAccent} />
            </View>
          </View>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>{`Saved to ${mealName(state.mealSlot)}`}</Text>
          <EdSafeAlternate
            alternate={<Text style={[typography.subhead, { color: colors.text2 }]}>{dish}</Text>}
          >
            <Text style={[typography.subhead, { color: colors.text2 }]}>
              {state.savedKcal === null ? dish : `${dish} · ${state.savedKcal} kcal`}
            </Text>
          </EdSafeAlternate>
        </View>

        <EdSafeAlternate
          alternate={
            streakLine === null ? null : (
              <EmberCard glow={false} style={styles.ember}>
                {streakLine}
              </EmberCard>
            )
          }
        >
          <EmberCard style={styles.ember}>
            <View testID="scan.todaySoFar" accessible style={styles.todayRow}>
              <Text style={[typography.subhead, { color: colors.emberText2 }]}>Today so far</Text>
              <View style={styles.todayValue}>
                <Text testID="scan.todayKcal" style={[styles.todayKcal, { color: colors.emberText }]}>
                  {today.toLocaleString('en-US')}
                </Text>
                <Text style={[typography.subhead, { color: colors.emberText2 }]}>
                  {goal !== null ? `/ ${goal.toLocaleString('en-US')} kcal` : 'kcal'}
                </Text>
              </View>
            </View>
            <View style={[styles.track, { backgroundColor: colors.emberTrack }]}>
              <View style={[styles.fill, { backgroundColor: colors.accent, width: `${Math.round(fraction * 100)}%` }]} />
            </View>
            {streakLine}
          </EmberCard>
        </EdSafeAlternate>

        <View style={[styles.undoCard, { backgroundColor: colors.grouped }]}>
          <Icon name="undo" size={20} color={colors.text2} />
          <View style={styles.flex}>
            <Text style={[typography.subhead, styles.undoTitle, { color: colors.text }]}>Logged by mistake?</Text>
            <Text style={[typography.footnote, { color: colors.text2 }]}>Undo stays here until you leave</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo"
            testID="toast:undo"
            onPress={() => {
              if (undoing.current) return;
              undoing.current = true;
              void model.undo().finally(() => {
                undoing.current = false;
              });
            }}
            style={[styles.undoChip, { backgroundColor: colors.accentTint }]}
          >
            <Text style={[typography.subhead, styles.undoLabel, { color: colors.accentInk }]}>Undo</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.dock}>
        <PrimaryButton title="Scan another" testID="scan.addMore" action={onAddMore} />
        <Pressable accessibilityRole="button" testID="scan.viewDiary" onPress={onViewDiary} style={styles.ghost}>
          <Text style={[typography.headline, { color: colors.text }]}>View diary</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: space.lg, gap: space.lg },
  hero: { alignItems: 'center', gap: space.sm },
  halo: { width: CHECK + HALO * 2, height: CHECK + HALO * 2, borderRadius: (CHECK + HALO * 2) / 2, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  check: { width: CHECK, height: CHECK, borderRadius: CHECK / 2, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 28, fontWeight: '700' },
  ember: { gap: space.md },
  todayRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  todayValue: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  todayKcal: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  streakText: { fontWeight: '600' },
  undoCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, padding: space.lg },
  undoTitle: { fontWeight: '600' },
  undoChip: { minHeight: size.tap, minWidth: size.tap, paddingHorizontal: space.lg, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  undoLabel: { fontWeight: '600' },
  dock: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.sm },
  ghost: { minHeight: size.btn, alignItems: 'center', justifyContent: 'center' },
});
