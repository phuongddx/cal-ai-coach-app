import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getColors } from './tokens';

/** Titled placeholder for the tabs that have no behaviour in the spike. */
export function Placeholder({ title }: { title: string }) {
  const c = getColors(useColorScheme() === 'dark' ? 'dark' : 'light');
  return (
    <View style={[styles.root, { backgroundColor: c.grouped }]} testID={`placeholder:${title.toLowerCase()}`}>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <Text style={{ color: c.text2 }}>Not part of the spike</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: { fontSize: 28, fontWeight: '800' },
});
