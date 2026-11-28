/**
 * ProfileView.swift — the profile tab screen (props-driven; the route holds the
 * environment). The name is the account's (the route derives it from the
 * session — never a hard-coded name), the plan line derives from the
 * display-only subscription state, the quick stats are the frame's three
 * (kcal/day · kg now · kg goal) and the Apple Health row shows the real
 * connection status as its value. The daily-target framing collapses under
 * ED-safe mode through the design system's EdSafeCollapse, and the Apple Health
 * tap still reveals the honest footnote (`profile.healthNote`). The frame's
 * kg / lb switch is not built: unit conversion across the app is a new feature
 * (the row shows the unit; see findings/U-77.md).
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import {
  BannerNote,
  EdSafeCollapse,
  SectionHeader,
  SettingsGroup,
  SettingsRow,
  radius,
  space,
  typography,
  useTokens,
  withAlpha,
} from '../../design';

import { onboardingCopy } from '../onboarding/onboardingCopy';
import { grouped } from './grouping';
import { planLine, type ProfileStats } from './profileModel';

export type ProfileViewProps = {
  stats: ProfileStats;
  /** The injected plan name (display-only entitlement state; the route passes "Free"). */
  planName: string;
  /** The account's name: the display name when the sign-in gave one, else the e-mail. */
  accountName: string;
  /** The real Apple Health connection status (the route reads the step-type authorization). */
  healthConnected: boolean;
  /** Present only when a target exists to edit. */
  onEditTargets?: (() => void) | null;
  onOpenSettings: () => void;
};

/** The avatar's initial: the name's first grapheme, uppercased; '—' when unknown. */
export function avatarInitial(accountName: string): string {
  const first = accountName.trim().charAt(0);
  return first === '' ? '—' : first.toUpperCase();
}

export function ProfileView({
  stats,
  planName,
  accountName,
  healthConnected,
  onEditTargets,
  onOpenSettings,
}: ProfileViewProps) {
  const { colors } = useTokens();
  const [showsHealthNote, setShowsHealthNote] = useState(false);
  const line = planLine(planName, stats.memberSince);
  const editTargets = onEditTargets ?? null;
  const name = accountName.trim() === '' ? '—' : accountName;
  const goalWeightKg = stats.target?.goalWeightKg ?? stats.target?.weightKg ?? null;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      bounces={false}
    >
      <View
        testID="profile.userCard"
        accessible
        accessibilityLabel={`${name}, ${line}`}
        style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.avatar}>
          <Svg width={56} height={56}>
            <Defs>
              <SvgGradient id="profileAvatar" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={withAlpha(colors.accent, 0.9)} />
                <Stop offset="1" stopColor={withAlpha(colors.accent, 0.55)} />
              </SvgGradient>
            </Defs>
            <Circle cx={28} cy={28} r={28} fill="url(#profileAvatar)" />
          </Svg>
          {/* The Swift initial renders Color.black on the accent gradient. */}
          <Text aria-hidden style={styles.avatarInitial}>
            {avatarInitial(name)}
          </Text>
        </View>
        <View style={styles.userName}>
          <Text style={[typography.headline, { color: colors.textPrimary }]}>{name}</Text>
          <Text style={[typography.footnote, { color: colors.textSecondary }]}>{line}</Text>
        </View>
      </View>

      <View style={styles.quickStats}>
        {/* The kcal-derived stat is the only calorie framing on this screen, so
            it collapses under ED-safe like every other tracking surface. */}
        <EdSafeCollapse>
          <StatCard
            identifier="profile.stat.dailyTarget"
            value={stats.target === null ? '—' : grouped(stats.target.dailyKcal)}
            caption="kcal / day"
          />
        </EdSafeCollapse>
        <StatCard
          identifier="profile.stat.weight"
          value={stats.latestKg === null ? '—' : stats.latestKg.toFixed(1)}
          caption="kg now"
        />
        <StatCard
          identifier="profile.stat.goalWeight"
          value={goalWeightKg === null ? '—' : `${Math.round(goalWeightKg)}`}
          caption="kg goal"
        />
      </View>

      <SectionHeader title="Plan" />
      <SettingsGroup>
        <EdSafeCollapse>
          <Pressable
            accessibilityRole="button"
            testID="profile.row.dailyTarget"
            disabled={editTargets === null}
            onPress={editTargets ?? undefined}
          >
            <SettingsRow
              icon="flame"
              label="Daily target"
              value={stats.target === null ? '—' : `${grouped(stats.target.dailyKcal)} kcal`}
            />
          </Pressable>
        </EdSafeCollapse>
        <Pressable
          accessibilityRole="button"
          testID="profile.row.macroRatios"
          disabled={editTargets === null}
          onPress={editTargets ?? undefined}
        >
          <SettingsRow
            icon="chart.pie"
            label="Macro ratios"
            value={
              stats.target === null
                ? '—'
                : `${stats.target.proteinG}P · ${stats.target.carbsG}C · ${stats.target.fatG}F`
            }
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          testID="profile.row.goalWeight"
          disabled={editTargets === null}
          onPress={editTargets ?? undefined}
        >
          <SettingsRow
            icon="scalemass"
            label="Goal weight"
            value={goalWeightKg === null ? '—' : `${Math.round(goalWeightKg)} kg`}
          />
        </Pressable>
      </SettingsGroup>

      <SectionHeader title="App" />
      <SettingsGroup>
        <Pressable
          accessibilityRole="button"
          testID="profile.row.appleHealth"
          onPress={() => setShowsHealthNote(true)}
        >
          {/* The real connection status is the row's value (the frame's
              "Connected", success-tinted); the tap still reveals the honest
              footnote. */}
          <SettingsRow
            icon="heart.fill"
            label="Apple Health"
            value={healthConnected ? 'Connected' : 'Not connected'}
            tint={healthConnected ? 'success' : undefined}
          />
        </Pressable>
        {/* The frame's kg / lb segment is app-wide unit conversion — a new
            feature, not built. The row shows the unit, no chevron (the row has
            no action). */}
        <SettingsRow icon="globe" label="Units" value="Metric" chevron={false} />
      </SettingsGroup>
      {showsHealthNote && (
        <View testID="profile.healthNote">
          {/* INT-01 is Phase 4: an honest footnote, never a permission prompt. */}
          <BannerNote text={onboardingCopy.healthConnectNote} />
        </View>
      )}

      <SettingsGroup>
        <Pressable accessibilityRole="button" testID="profile.row.settings" onPress={onOpenSettings}>
          <SettingsRow icon="gearshape" label="Settings" />
        </Pressable>
      </SettingsGroup>
    </ScrollView>
  );
}

function StatCard({
  identifier,
  value,
  caption,
}: {
  identifier: string;
  value: string;
  caption: string;
}) {
  const { colors } = useTokens();
  return (
    <View
      testID={identifier}
      accessible
      accessibilityLabel={`${caption} ${value}`}
      style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <Text style={[styles.statValue, { color: colors.accentInk }]}>
        {value}
      </Text>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl5,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  avatar: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: {
    position: 'absolute',
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  userName: { gap: 2 },
  quickStats: { flexDirection: 'row', gap: space.sm },
  statCard: {
    flex: 1,
    alignItems: 'flex-start',
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
