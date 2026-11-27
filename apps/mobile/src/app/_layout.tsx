import { GlassView } from 'expo-glass-effect';
import { NativeTabs } from 'expo-router/native-tabs';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { getColors } from '../features/ember/tokens';
import { startDataBinding } from '../data/binding';
import { startSpikeDeepLinks } from '../spike/deepLink';
import { registerBuiltinSpikeActions } from '../spike/builtinActions';

registerBuiltinSpikeActions();

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = getColors(scheme);

  useEffect(() => startSpikeDeepLinks(), []);
  // Sync triggers, widget foreground reload, SQLite -> Ember/widget binding.
  useEffect(() => startDataBinding(), []);

  return (
    <View style={styles.root}>
      <StatusBar style="auto" />
      <NativeTabs tintColor={c.accentInk} minimizeBehavior="onScrollDown">
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Ember</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="sun.max" md="sunny" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="progress">
          <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="show_chart" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="coach">
          <NativeTabs.Trigger.Label>Coach</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="spike">
          <NativeTabs.Trigger.Label>Spike</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="ladybug" md="bug_report" />
        </NativeTabs.Trigger>
      </NativeTabs>
      {/* Visual-only Scan button. NativeTabs has no inline trailing slot, so it floats above the bar. */}
      <View pointerEvents="box-none" style={styles.scanWrap}>
        <GlassView
          testID="scan:button"
          glassEffectStyle="regular"
          tintColor={c.accent}
          isInteractive
          colorScheme={scheme}
          style={styles.scan}
          accessibilityLabel="Scan a meal"
        >
          <SymbolView name="camera.fill" size={24} weight="semibold" tintColor={c.onAccent} />
        </GlassView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scanWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: 'flex-end', justifyContent: 'flex-end', paddingRight: 20, paddingBottom: 104 },
  scan: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
