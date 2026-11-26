import { StyleSheet, Text, View } from 'react-native';

import { kcalFromMacros } from '@coachcal/core';

// Skeleton placeholder: replaced by the Ember screen in plan task T1.
export default function EmberScreen() {
  return (
    <View style={styles.root} testID="ember:root">
      <Text style={styles.title}>Ember (skeleton)</Text>
      <Text testID="ember:kcal">{kcalFromMacros({ proteinG: 10, carbsG: 20, fatG: 5 })} kcal</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 28, fontWeight: '700' },
});
