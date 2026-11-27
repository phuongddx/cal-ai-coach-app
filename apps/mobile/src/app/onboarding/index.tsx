import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getColors } from '../../features/ember/tokens';

/** Placeholder until OB-01 (U-31) replaces it. */
export default function OnboardingScreen() {
  const c = getColors(useColorScheme() === 'dark' ? 'dark' : 'light');
  return (
    <View style={[styles.root, { backgroundColor: c.grouped }]} testID="placeholder:onboarding">
      <Text style={[styles.title, { color: c.text }]}>Onboarding</Text>
      <Text style={{ color: c.text2 }}>Placeholder · OB-01 (U-31)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  title: { fontSize: 28, fontWeight: '800' },
});
