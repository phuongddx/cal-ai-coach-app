/**
 * FoldGroup: a group that folds ("Advanced" of the custom food sheet). The header is one button of at
 * least 44 pt that announces its expanded state; the body is not rendered while folded. No blur: the
 * package for it does not exist, the header is a plain `card` row with the canvas chevron.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, size, space, typography, useTokens } from '../tokens';

import { Icon } from './Icon';

export type FoldGroupProps = {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  /** Identifier of the header button; the body is `<testID>:content`. */
  testID: string;
  children?: ReactNode;
};

export function foldGroupA11yHint(expanded: boolean): string {
  return expanded ? 'Collapses the group' : 'Expands the group';
}

export function FoldGroup({ label, expanded, onToggle, testID, children }: FoldGroupProps) {
  const { colors } = useTokens();
  return (
    <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={foldGroupA11yHint(expanded)}
        accessibilityState={{ expanded }}
        testID={testID}
        onPress={onToggle}
        style={styles.header}
      >
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <View style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}>
          <Icon name="chev" size={18} color={colors.text2} />
        </View>
      </Pressable>
      {expanded && (
        <View testID={`${testID}:content`} style={styles.content}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    minHeight: size.tapTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  label: {
    ...typography.headline,
    flex: 1,
  },
  content: {
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
  },
});
