import { StyleSheet, Text, View } from 'react-native';

// Skeleton placeholder for the spike console: replaced in plan tasks T1/T2/T3/T4.
export default function SpikeConsoleScreen() {
  return (
    <View style={styles.root} testID="spike:root">
      <Text style={styles.title}>Spike console (skeleton)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17 },
});
