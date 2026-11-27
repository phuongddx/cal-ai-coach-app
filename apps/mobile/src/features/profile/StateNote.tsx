/**
 * Local state banner for the two tints the design system's BannerNote does not
 * carry yet (U-77): caution (the goal-weight floor card, frame p-target-floor)
 * and error (the failed export row, frames x-write-*). Token-only — no literal
 * color — and recorded under "Needs a design component" in findings/U-77.md:
 * a `BannerNote` caution/error variant in `src/design` replaces this file.
 */
import { StyleSheet, Text, View } from 'react-native';

import { Icon, markdownSegments, radius, space, typography, useTokens } from '../../design';

export type StateNoteVariant = 'caution' | 'error';

export type StateNoteProps = {
  variant: StateNoteVariant;
  /** Bold lead (`**text**` markdown, like BannerNote's), then the body. */
  text: string;
  testID?: string;
};

export function StateNote({ variant, text, testID }: StateNoteProps) {
  const { colors } = useTokens();
  const background = variant === 'caution' ? colors.cautionTint : colors.errorTint;
  const ink = variant === 'caution' ? colors.cautionInk : colors.errorInk;
  return (
    <View
      testID={testID ?? `state-note:${variant}`}
      accessibilityRole="text"
      style={[styles.banner, { backgroundColor: background }]}
    >
      <Icon name="info" size={20} color={ink} />
      <Text style={[typography.footnote, styles.text, { color: ink }]}>
        {markdownSegments(text).map((segment, index) => (
          <Text key={index} style={segment.bold ? styles.bold : undefined}>
            {segment.text}
          </Text>
        ))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
  },
  text: { flex: 1 },
  bold: { fontWeight: '700' },
});
