/**
 * ED-safe note card of the Ember frames (Review ED-Safe, Manual log): `accentTint` card, `accentInk`
 * glyph (default the eye-off icon), a 600 title and a `text2` body. It renders nothing unless ED-safe
 * mode is on. That branch lives here (invariant I7 / standing order 20): a feature puts the note in
 * its tree unconditionally and never reads the mode to show it.
 */

import { StyleSheet, Text, View } from 'react-native';

import { useEdSafeMode } from '../edSafe';
import { radius, space, typography, useTokens } from '../tokens';

import { Icon } from './Icon';
import type { IconName } from './iconShapes';

export type EdSafeNoteProps = {
  title: string;
  body: string;
  icon?: IconName;
  testID?: string;
};

export function EdSafeNote({ title, body, icon = 'eyeoff', testID = 'ed-safe-note' }: EdSafeNoteProps) {
  const { colors } = useTokens();
  const edSafe = useEdSafeMode();
  if (!edSafe) return null;
  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${body}`}
      testID={testID}
      style={[styles.card, { backgroundColor: colors.accentTint }]}
    >
      <Icon name={icon} size={20} color={colors.accentInk} testID={`${testID}.icon`} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.text2 }]}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.subhead,
    fontWeight: '600',
  },
  body: {
    ...typography.footnote,
  },
});
