import { useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { StyleSheet, View } from 'react-native';

import { useTokens } from '../../design';
import { ScanFab } from '../../features/today/ScanFab';

// Tab names are those of the SwiftUI MainShell.swift; the symbols follow the Ember design (U-76): Today sun,
// Progress chart, Coach sparkles (was bell), Profile person (was gear).
export default function TabsLayout() {
  const { colors } = useTokens();
  const router = useRouter();

  return (
    <View style={styles.root}>
      <NativeTabs tintColor={colors.accentInk} minimizeBehavior="onScrollDown">
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
          <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
        </NativeTabs.Trigger>
      </NativeTabs>
      {/* MainShell's overlay: the Scan button floats at the bottom center, over the tab bar. */}
      <ScanFab onPress={() => router.push('/scan')} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
