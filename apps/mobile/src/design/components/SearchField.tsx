/**
 * CCSearchField (Components/Controls.swift). Magnifying-glass text field on a
 * card surface.
 */

import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { radius, space, typography, useTokens } from '../tokens';

export type SearchFieldProps = {
  text: string;
  onChangeText: (text: string) => void;
  placeholder: string;
};

export function SearchField({ text, onChangeText, placeholder }: SearchFieldProps) {
  const { colors } = useTokens();
  return (
    <View
      testID="search-field"
      style={[
        styles.field,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <SymbolView name="magnifyingglass" size={15} tintColor={colors.textSecondary} />
      <TextInput
        accessibilityLabel={placeholder}
        value={text}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, { color: colors.textPrimary }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  input: {
    ...typography.body,
    flex: 1,
    padding: 0,
  },
});
