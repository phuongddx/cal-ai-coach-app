import { NativeTabs } from 'expo-router/native-tabs';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>Ember</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="sun.max" md="sunny" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="spike">
          <NativeTabs.Trigger.Label>Spike</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="ladybug" md="bug_report" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
