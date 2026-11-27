import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getColors } from '../features/ember/tokens';

/** Placeholder until PR-02 (U-41) replaces it. */
export default function SettingsScreen() {
  const c = getColors(useColorScheme() === 'dark' ? 'dark' : 'light');
  return (
    <View style={[styles.root, { backgroundColor: c.grouped }]} testID="placeholder:settings">
      <Text style={[styles.title, { color: c.text }]}>Settings</Text>
      <Text style={{ color: c.text2 }}>Placeholder · PR-02 (U-41)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: { fontSize: 28, fontWeight: '800' },
});
