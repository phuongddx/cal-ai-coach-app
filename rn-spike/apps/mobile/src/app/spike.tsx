import { dayKey, sumMacros } from '@coachcal/core';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { useSyncState } from '../data/binding';
import { useEmberState } from '../features/ember/emberStore';
import { getColors } from '../features/ember/tokens';
import { getLastRuns, listSpikeActions, runSpikeAction, subscribeSpike } from '../spike/registry';
import type { SpikeItem } from '../spike/types';

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

  return (
    <ScrollView
      testID="spike:root"
      style={{ backgroundColor: c.grouped }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.h1, { color: c.text }]}>Spike console</Text>
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
  json: { fontFamily: 'Menlo', fontSize: 11, padding: 8, borderRadius: 8, overflow: 'hidden' },
});
