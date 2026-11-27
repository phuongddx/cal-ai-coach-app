import { dayKey, sumMacros } from '@coachcal/core';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, useColorScheme, View } from 'react-native';

import { useSyncState } from '../data/binding';
import { setDebugFlags, useDebugFlags, type DebugFlags } from '../debug/launchArgs';
import { setEdSafeMode, useEdSafeMode } from '../design/edSafe';
import { useEmberState } from '../features/ember/emberStore';
import { getColors } from '../features/ember/tokens';
import { getLastRuns, listSpikeActions, runSpikeAction, subscribeSpike } from '../spike/registry';
import type { SpikeItem } from '../spike/types';

/** The switch flags of `getDebugFlags()`, in the order of Swift's `DebugLaunchArguments`; `--ccFixedClock` and `--ccScanScenario` take a value and are not switches. */
const FLAG_SWITCHES: { flag: keyof Pick<DebugFlags, 'freshStart' | 'seedNoTargets' | 'forceOffline' | 'disableAnimations' | 'edSafe' | 'requireSignIn' | 'fixtureCapture'>; title: string; note: string }[] = [
  { flag: 'freshStart', title: '--ccFreshStart', note: 'read at launch: wipes the local data' },
  { flag: 'seedNoTargets', title: '--ccSeedNoTargets', note: 'read at launch: the tabs without a target' },
  { flag: 'forceOffline', title: '--ccForceOffline', note: 'the sync engine reports offline' },
  { flag: 'disableAnimations', title: '--ccDisableAnimations', note: 'read when a screen opens' },
  { flag: 'edSafe', title: '--ccEDSafe', note: 'read at launch: forces ED-safe mode on' },
  { flag: 'requireSignIn', title: '--ccRequireSignIn', note: 'the root gate asks for a session now' },
  { flag: 'fixtureCapture', title: '--ccFixtureCapture', note: 'the scan flow uses fixtures' },
];

const CARDS: { item: SpikeItem; title: string }[] = [
  { item: 'ui', title: '1 · Tabs, glass, Ember' },
  { item: 'widget', title: '2 · Widget' },
  { item: 'health', title: '3 · HealthKit' },
  { item: 'sync', title: '4 · Offline sync' },
];

export default function SpikeConsoleScreen() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = getColors(scheme);
  // React Compiler memoizes zero-arg calls: read the store only through the hook's return value.
  const runs = useSyncExternalStore(subscribeSpike, getLastRuns, getLastRuns);
  const ember = useEmberState();
  const sync = useSyncState();
  const actions = useSyncExternalStore(subscribeSpike, listSpikeActions, listSpikeActions);
  const flags = useDebugFlags();
  const edSafe = useEdSafeMode();

  return (
    <ScrollView
      testID="spike:root"
      style={{ backgroundColor: c.grouped }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.h1, { color: c.text }]}>Debug console</Text>
      <View testID="debug:flags:card" style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.cardTitle, { color: c.text }]}>Flags</Text>
        <Text style={[styles.status, { color: c.text3 }]}>
          Process arguments are read by the native slot (U-50); these switches set the same flags at runtime.
        </Text>
        {FLAG_SWITCHES.map(({ flag, title, note }) => (
          <FlagRow
            key={flag}
            testID={`debug:flag:${flag}`}
            title={title}
            note={note}
            value={flags[flag]}
            onValueChange={(value) => setDebugFlags({ [flag]: value })}
            c={c}
          />
        ))}
        <FlagRow
          testID="debug:flag:edSafeMode"
          title="ED-safe mode"
          note="the live mode (not stored: Settings stores it)"
          value={edSafe}
          onValueChange={setEdSafeMode}
          c={c}
        />
        <Text testID="debug:flags:values" style={[styles.status, { color: c.text2 }]}>
          fixedClock {flags.fixedClock === null ? 'real' : new Date(flags.fixedClock).toISOString()} · scanScenario {flags.scanScenario ?? 'live API'}
        </Text>
      </View>
      {CARDS.map(({ item, title }) => {
        const run = runs[item];
        const mine = actions.filter((a) => a.item === item);
        const wired = mine.length > 0 || item === 'ui';
        const statusText = !wired
          ? 'not wired yet'
          : run?.running
            ? `running ${run.name}…`
            : run?.result
              ? `${run.result.status}: ${run.result.summary}`
              : item === 'ui'
                ? `Ember offline chip follows the engine: ${ember.isOffline ? 'offline' : 'online'}`
                : 'idle';
        const json =
          item === 'ui'
            ? JSON.stringify(
                {
                  liquidGlass: isLiquidGlassAvailable(),
                  scheme,
                  isOffline: ember.isOffline,
                  today: dayKey(new Date()),
                  totals: sumMacros(ember.meals),
                  last: run?.result?.data ?? null,
                },
                null,
                2,
              )
            : run?.result
              ? JSON.stringify(run.result.data ?? null, null, 2)
              : 'null';
        return (
          <View key={item} testID={`spike:${item}:card`} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>{title}</Text>
            <View style={styles.row}>
              {mine.map((a) => (
                <Button key={a.name} testID={`spike:${item}:${a.name}`} label={a.title} onPress={() => void runSpikeAction(a.name)} c={c} />
              ))}
            </View>
            <Text testID={`spike:${item}:status`} style={[styles.status, { color: wired ? c.text2 : c.text3 }]}>
              {statusText}
            </Text>
            {item === 'sync' ? (
              <Text testID="spike:sync:state" style={[styles.status, { color: c.text2 }]}>
                {sync.ready
                  ? `${sync.online ? 'online' : sync.forcedOffline ? 'forced offline' : 'offline'} · last run ${sync.lastStatus} · outbox ${sync.outbox} · cursor ${sync.cursor} · quarantined ${sync.quarantined} · meals ${sync.meals}`
                  : 'sync runtime starting…'}
              </Text>
            ) : null}
            <Text testID={`spike:${item}:result`} selectable style={[styles.json, { backgroundColor: c.fill, color: c.text }]}>
              {json}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function FlagRow({
  title,
  note,
  value,
  onValueChange,
  testID,
  c,
}: {
  title: string;
  note: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  testID: string;
  c: ReturnType<typeof getColors>;
}) {
  return (
    <View style={styles.flagRow}>
      <View style={styles.flagText}>
        <Text style={[styles.flagTitle, { color: c.text }]}>{title}</Text>
        <Text style={[styles.status, { color: c.text3 }]}>{note}</Text>
      </View>
      <Switch testID={testID} accessibilityLabel={title} value={value} onValueChange={onValueChange} />
    </View>
  );
}

function Button({ label, onPress, testID, c }: { label: string; onPress: () => void; testID: string; c: ReturnType<typeof getColors> }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={[styles.button, { backgroundColor: c.accent }]}>
      <Text style={[styles.buttonText, { color: c.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 160, gap: 12 },
  h1: { fontSize: 28, fontWeight: '800' },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { paddingHorizontal: 12, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontWeight: '700' },
  status: { fontSize: 14 },
  flagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 },
  flagText: { flex: 1 },
  flagTitle: { fontSize: 15, fontWeight: '600' },
  json: { fontFamily: 'Menlo', fontSize: 11, padding: 8, borderRadius: 8, overflow: 'hidden' },
});
