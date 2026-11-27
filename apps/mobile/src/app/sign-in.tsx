import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getColors } from '../features/ember/tokens';

/** Placeholder until AU-01 (U-20) replaces it. */
export default function SignInScreen() {
  const c = getColors(useColorScheme() === 'dark' ? 'dark' : 'light');
  return (
    <View style={[styles.root, { backgroundColor: c.grouped }]} testID="placeholder:sign-in">
      <Text style={[styles.title, { color: c.text }]}>Sign in</Text>
      <Text style={{ color: c.text2 }}>Placeholder · AU-01 (U-20)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: { fontSize: 28, fontWeight: '800' },
});
