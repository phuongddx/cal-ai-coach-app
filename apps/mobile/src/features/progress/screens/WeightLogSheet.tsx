/**
 * WeightLogSheet.swift — the weight log sheet: the heading + close, the wheel
 * field over the 40–250 kg domain in 0.1 steps (values pre-snapped so
 * selection equality holds), and Save. The wheel domain and the initial
 * selection mirror the Swift sheet exactly.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { PrimaryButton, Sheet, WheelField, useTokens } from '../../../design';

import { clampKg, KG_VALUES } from '../progressMath';

export type WeightLogSheetProps = {
  currentKg: number | null;
  onSave: (kg: number) => void;
  onDismiss: () => void;
};

export function WeightLogSheet({ currentKg, onSave, onDismiss }: WeightLogSheetProps) {
  const { colors, typography } = useTokens();
  const [selection, setSelection] = useState(() => clampKg(currentKg ?? 80));

  const save = () => {
    onSave(selection);
    onDismiss();
  };

  return (
    <Sheet>
      <View style={styles.header}>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>Log weight</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          testID="progress.closeWeightSheet"
          onPress={onDismiss}
          style={styles.closeButton}
        >
          <SymbolView name="xmark" size={14} weight="semibold" tintColor={colors.textSecondary} />
        </Pressable>
      </View>

      <WheelField
        label="Weight"
        items={KG_VALUES}
        selection={selection}
        onSelectionChange={setSelection}
        displayText={(kg) => `${kg.toFixed(1)} kg`}
      />

      <View testID="progress.saveWeight">
        <PrimaryButton title="Save" action={save} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  closeButton: { marginLeft: 'auto', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
