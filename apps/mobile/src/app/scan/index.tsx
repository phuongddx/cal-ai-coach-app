import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getColors } from '../../features/ember/tokens';

/** Placeholder until SC-01 (U-30) replaces it. */
export default function ScanScreen() {
  const c = getColors(useColorScheme() === 'dark' ? 'dark' : 'light');
  return (
    <View style={[styles.root, { backgroundColor: c.grouped }]} testID="placeholder:scan">
      <Text style={[styles.title, { color: c.text }]}>Scan</Text>
      <Text style={{ color: c.text2 }}>Placeholder · SC-01 (U-30)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: { fontSize: 28, fontWeight: '800' },
});
