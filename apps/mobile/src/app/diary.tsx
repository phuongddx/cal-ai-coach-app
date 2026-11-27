import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getColors } from '../features/ember/tokens';

/** Placeholder until DY-01 (U-32) replaces it. */
export default function DiaryScreen() {
  const c = getColors(useColorScheme() === 'dark' ? 'dark' : 'light');
  return (
    <View style={[styles.root, { backgroundColor: c.grouped }]} testID="placeholder:diary">
      <Text style={[styles.title, { color: c.text }]}>Diary</Text>
      <Text style={{ color: c.text2 }}>Placeholder · DY-01 (U-32)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: { fontSize: 28, fontWeight: '800' },
});
