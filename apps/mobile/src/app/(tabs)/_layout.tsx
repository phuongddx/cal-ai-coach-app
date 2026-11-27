import { GlassView } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { getColors } from '../../features/ember/tokens';

// Tab names and symbols are those of the SwiftUI MainShell.swift.
export default function TabsLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = getColors(scheme);
  const router = useRouter();

  return (
    <View style={styles.root}>
      <NativeTabs tintColor={c.accentInk} minimizeBehavior="onScrollDown">
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="sun.max" md="sunny" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="progress">
          <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" md="show_chart" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="coach">
          <NativeTabs.Trigger.Label>Coach</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="bell" md="notifications" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
        </NativeTabs.Trigger>
      </NativeTabs>
      {/* Scan button. NativeTabs has no inline trailing slot, so it floats above the bar. */}
      <View pointerEvents="box-none" style={styles.scanWrap}>
        <Pressable
          testID="shell.fab"
          accessibilityRole="button"
          accessibilityLabel="Scan a meal"
          onPress={() => router.push('/scan')}
        >
          <GlassView
            glassEffectStyle="regular"
            tintColor={c.accent}
            isInteractive
            colorScheme={scheme}
            style={styles.scan}
            pointerEvents="none"
          >
            <SymbolView name="camera.fill" size={24} weight="semibold" tintColor={c.onAccent} />
          </GlassView>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scanWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingRight: 20,
    paddingBottom: 104,
  },
  scan: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
