import { dayKey, kcalLeft, ringProgress, sumMacros } from '@coachcal/core';
import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, useColorScheme, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { EmberMeal, EmberTargets } from './fixture';
import { formatHeaderDate, formatTime, mealSlot, weekStrip } from './format';
import { fontRound, getColors, radius, size, space, type EmberColors, type EmberScheme } from './tokens';

export type EmberViewProps = {
  meals: readonly EmberMeal[];
  targets: EmberTargets;
  now: Date;
  isOffline: boolean;
  /** Streak is not a feature in the spike; the route passes 0. */
  streakDays?: number;
  /** Overrides the system appearance (tests, screenshots). */
  colorScheme?: EmberScheme;
};

const nf = (n: number) => n.toLocaleString('en-US');
const round: TextStyle = { fontFamily: fontRound, fontVariant: ['tabular-nums'] };

/** Pure: everything on screen comes from props and `@coachcal/core`. */
export function EmberView({ meals, targets, now, isOffline, streakDays = 0, colorScheme }: EmberViewProps) {
  const system = useColorScheme();
  const scheme: EmberScheme = colorScheme ?? (system === 'dark' ? 'dark' : 'light');
  const c = getColors(scheme);
  // The sticky week strip sticks to the top of the scroll view, so the scroll view itself starts below
  // the status bar (the strip then never sits under the clock).
  const insets = useSafeAreaInsets();

  const today = dayKey(now);
  const todays = meals.filter((m) => dayKey(new Date(m.eatenAt)) === today);
  const totals = sumMacros(todays);
  const left = kcalLeft(targets.kcal, totals.kcal);
  const progress = ringProgress(totals.kcal, targets.kcal);
  const week = weekStrip(now);

  const macros = [
    { key: 'protein', label: 'Protein', color: c.protein, eaten: totals.proteinG, goal: targets.proteinG },
    { key: 'carbs', label: 'Carbs', color: c.carbs, eaten: totals.carbsG, goal: targets.carbsG },
    { key: 'fat', label: 'Fat', color: c.fat, eaten: totals.fatG, goal: targets.fatG },
    { key: 'fiber', label: 'Fiber', color: c.fiber, eaten: totals.fiberG, goal: targets.fiberG },
  ] as const;

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: c.grouped }}>
    <ScrollView
      testID="ember:scroll"
      style={{ backgroundColor: c.grouped }}
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={styles.content}
      stickyHeaderIndices={[1]}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text testID="ember:date" style={[styles.dateLine, { color: c.text2 }]}>
            {formatHeaderDate(now)}
          </Text>
          <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>
            Today
          </Text>
        </View>
        {isOffline ? (
          <View testID="ember:offline" style={[styles.offlineChip, { backgroundColor: c.cautionTint }]}>
            <Text style={[styles.offlineText, { color: c.cautionInk }]}>Offline · syncs later</Text>
          </View>
        ) : (
          <GlassView
            testID="ember:glass-header-button"
            glassEffectStyle="regular"
            isInteractive
            colorScheme={scheme}
            style={styles.iconButton}
            accessibilityLabel="Pick a day"
          >
            <SymbolView name="calendar" size={20} weight="medium" tintColor={c.text} />
          </GlassView>
        )}
      </View>

      {/* 2. Week strip: sticky glass surface, so content scrolls behind it */}
      <View style={styles.stickyWrap}>
        <GlassView
          testID="ember:glass-week"
          glassEffectStyle="regular"
          colorScheme={scheme}
          style={styles.weekGlass}
        >
          {week.map((d) => (
            <View
              key={d.key}
              testID={`ember:week:${d.key}`}
              style={[styles.weekCell, d.selected && { backgroundColor: c.accentTint }]}
            >
              <Text style={[styles.weekLetter, { color: d.selected ? c.accentInk : c.text2 }]}>{d.letter}</Text>
              <Text style={[styles.weekDay, round, { color: d.selected ? c.accentInk : c.text }]}>{d.day}</Text>
            </View>
          ))}
        </GlassView>
      </View>

      {/* 3. Ember hero card (dark in both modes) */}
      <View style={[styles.hero, { backgroundColor: c.ember }]}>
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="glow" cx="78%" cy="12%" rx="55%" ry="70%" fx="78%" fy="12%">
              <Stop offset="0" stopColor={c.accent} stopOpacity={0.3} />
              <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
        </Svg>
        <Ring progress={progress} track={c.emberTrack} arc={c.accent}>
          <Text testID="ember:kcal-left" style={[styles.ringValue, round, { color: c.emberText }]}>
            {nf(left)}
          </Text>
          <Text style={[styles.ringCaption, { color: c.emberText2 }]}>kcal left</Text>
        </Ring>
        <View style={styles.heroStats}>
          <HeroStat label="Eaten" value={nf(totals.kcal)} testID="ember:eaten" c={c} />
          <HeroStat label="Goal" value={nf(targets.kcal)} testID="ember:goal" c={c} />
          <HeroStat label="Burned" value="0" testID="ember:burned" c={c} accent />
        </View>
      </View>

      {/* 4. Macro grid 2 × 2 */}
      <View style={[styles.card, styles.macroGrid, { backgroundColor: c.card, borderColor: c.border }]}>
        {macros.map((m) => (
          <View key={m.key} style={styles.macroCell} testID={`ember:macro:${m.key}`}>
            <View style={styles.macroTop}>
              <View style={styles.macroLabelRow}>
                <View style={[styles.dot, { backgroundColor: m.color }]} />
                <Text style={[styles.macroLabel, { color: c.text }]} numberOfLines={1}>
                  {m.label}
                </Text>
              </View>
              <Text style={[styles.macroValue, round, { color: c.text2 }]} numberOfLines={1}>
                {Math.round(m.eaten)} / {Math.round(m.goal)} g
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: c.fill }]}>
              <View style={[styles.bar, { backgroundColor: m.color, width: `${ringProgress(m.eaten, m.goal) * 100}%` }]} />
            </View>
          </View>
        ))}
      </View>

      {/* 5. Streak card */}
      <View style={[styles.card, styles.streak, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={[styles.streakIcon, { backgroundColor: c.accentTint }]}>
          <SymbolView name="flame.fill" size={22} weight="semibold" tintColor={c.accentInk} />
        </View>
        <View>
          <Text testID="ember:streak" style={[styles.streakTitle, { color: c.text }]}>
            {streakDays}-day streak
          </Text>
          <Text style={[styles.streakSub, { color: c.text2 }]}>Log a meal to start one</Text>
        </View>
      </View>

      {/* 6. Meals */}
      <View style={styles.mealsHeader}>
        <Text style={[styles.sectionTitle, { color: c.text2 }]}>Meals</Text>
        <Text style={[styles.diaryLink, { color: c.accentInk }]}>Diary</Text>
      </View>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        {todays.length === 0 ? (
          <Text testID="ember:empty" style={[styles.empty, { color: c.text2 }]}>
            No meals logged yet
          </Text>
        ) : (
          todays.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <View style={[styles.rowSep, { backgroundColor: c.separator }]} /> : null}
              <MealRow meal={m} c={c} />
            </View>
          ))
        )}
      </View>
    </ScrollView>
    </View>
  );
}

function Ring({ progress, track, arc, children }: { progress: number; track: string; arc: string; children: ReactNode }) {
  const stroke = size.ringStroke;
  const r = (size.ring - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <View style={styles.ring} testID="ember:ring">
      <Svg width={size.ring} height={size.ring} style={StyleSheet.absoluteFill}>
        <Circle cx={size.ring / 2} cy={size.ring / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size.ring / 2}
          cy={size.ring / 2}
          r={r}
          stroke={arc}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circ * progress} ${circ}`}
          rotation={-90}
          origin={`${size.ring / 2}, ${size.ring / 2}`}
        />
      </Svg>
      {children}
    </View>
  );
}

function HeroStat({ label, value, testID, c, accent }: { label: string; value: string; testID: string; c: EmberColors; accent?: boolean }) {
  return (
    <View>
      <Text style={[styles.heroLabel, { color: c.emberText2 }]}>{label}</Text>
      <Text testID={testID} style={[styles.heroValue, round, { color: accent ? c.emberAccent : c.emberText }]}>
        {value}
      </Text>
    </View>
  );
}

function MealRow({ meal, c }: { meal: EmberMeal; c: EmberColors }) {
  const conf =
    meal.confidence === 'high'
      ? { label: 'High', fg: c.successInk, bg: c.successTint, dot: c.success }
      : meal.confidence === 'medium'
        ? { label: 'Medium', fg: c.cautionInk, bg: c.cautionTint, dot: c.caution }
        : meal.confidence === 'low'
          ? { label: 'Low', fg: c.errorInk, bg: c.errorTint, dot: c.error }
          : null;
  return (
    <View style={styles.mealRow} testID={`ember:meal:${meal.id}`}>
      <View style={[styles.thumb, { backgroundColor: c.accentTint }]}>
        <SymbolView name="fork.knife" size={22} weight="medium" tintColor={c.accentInk} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.mealName, { color: c.text }]} numberOfLines={1}>
          {meal.name}
        </Text>
        <View style={styles.mealMeta}>
          <Text style={[styles.mealSub, { color: c.text2 }]}>
            {mealSlot(meal.eatenAt)} · {formatTime(meal.eatenAt)}
          </Text>
          {conf ? (
            <View style={[styles.chip, { backgroundColor: conf.bg }]}>
              <View style={[styles.chipDot, { backgroundColor: conf.dot }]} />
              <Text style={[styles.chipText, { color: conf.fg }]}>{conf.label}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text testID={`ember:meal-kcal:${meal.id}`} style={[styles.mealKcal, round, { color: c.text }]}>
        {nf(meal.kcal)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Bottom inset: tab bar (~96) + floating Scan button (64 + 104 offset) + air, so the last row ends above both.
  content: { paddingHorizontal: space.s4, paddingBottom: 216 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: space.s2, paddingBottom: space.s2 },
  dateLine: { fontSize: 15 },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  iconButton: { width: size.tap, height: size.tap, borderRadius: size.tap / 2, alignItems: 'center', justifyContent: 'center' },
  offlineChip: { paddingHorizontal: space.s3, height: 36, borderRadius: radius.pill, justifyContent: 'center' },
  offlineText: { fontSize: 14, fontWeight: '700' },
  stickyWrap: { paddingVertical: space.s2 },
  weekGlass: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: space.s1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  weekCell: { width: 46, minHeight: size.tap + 8, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  weekLetter: { fontSize: 12, fontWeight: '600' },
  weekDay: { fontSize: 17, fontWeight: '700' },
  hero: {
    marginTop: space.s2,
    borderRadius: radius.xl,
    padding: space.s6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s5,
    overflow: 'hidden',
  },
  ring: { width: size.ring, height: size.ring, alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 44, fontWeight: '800' },
  ringCaption: { fontSize: 14 },
  heroStats: { flex: 1, gap: space.s3 },
  heroLabel: { fontSize: 14 },
  heroValue: { fontSize: 22, fontWeight: '800' },
  card: { marginTop: space.s3, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: space.s4, rowGap: space.s4, columnGap: space.s5 },
  macroCell: { width: '47%', flexGrow: 1, gap: space.s2 },
  macroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  macroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: space.s2 },
  dot: { width: 8, height: 8, borderRadius: 2 },
  macroLabel: { fontSize: 15, fontWeight: '700' },
  macroValue: { fontSize: 15, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  bar: { height: 6, borderRadius: 3 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: space.s3, padding: space.s3 },
  streakIcon: { width: size.tap, height: size.tap, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  streakTitle: { fontSize: 17, fontWeight: '700' },
  streakSub: { fontSize: 13 },
  mealsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.s5, paddingHorizontal: space.s1 },
  sectionTitle: { fontSize: 14, fontWeight: '600' },
  diaryLink: { fontSize: 17, fontWeight: '700' },
  empty: { padding: space.s4, fontSize: 15 },
  rowSep: { height: StyleSheet.hairlineWidth, marginLeft: 76 },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: space.s3, padding: space.s3 },
  thumb: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  mealName: { fontSize: 17, fontWeight: '700' },
  mealMeta: { flexDirection: 'row', alignItems: 'center', gap: space.s2, marginTop: 2, flexWrap: 'wrap' },
  mealSub: { fontSize: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: space.s2, height: 22, borderRadius: radius.pill },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 13, fontWeight: '600' },
  mealKcal: { fontSize: 20, fontWeight: '800' },
});
