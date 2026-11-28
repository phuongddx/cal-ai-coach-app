/**
 * The frame the e-mail step and the code step share (frames 108 and 112): the Back glass button at the
 * top left (`auth.emailBack`), the title and the subtitle, the scrolling body, and a dock above the home
 * indicator. The keyboard pushes the dock up.
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassIconButton, size, space, useTokens } from '../../design';
import { textStyle } from './textStyle';

export type StepFrameProps = {
  title: string;
  /** The subtitle: a string, or nested `Text` when part of it is bold. */
  subtitle: ReactNode;
  subtitleTestID?: string;
  onBack: () => void;
  /** Under the title block: the field, the cells, the error line and the note. */
  children: ReactNode;
  /** The buttons above the home indicator. */
  dock: ReactNode;
};

export function StepFrame({ title, subtitle, subtitleTestID, onBack, children, dock }: StepFrameProps) {
  const { colors, type } = useTokens();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
      <View style={styles.header}>
        <GlassIconButton icon="back" accessibilityLabel="Back" testID="auth.emailBack" onPress={onBack} />
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <Text accessibilityRole="header" style={[textStyle(type.title1), { color: colors.text }]}>
            {title}
          </Text>
          <Text testID={subtitleTestID} style={[textStyle(type.body), { color: colors.text2 }]}>
            {subtitle}
          </Text>
        </View>
        {children}
      </ScrollView>

      <View style={styles.dock}>{dock}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    minHeight: size.tap + space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
  },
  content: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xl, gap: space.lg },
  titleBlock: { gap: space.sm },
  dock: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg, gap: space.sm },
});
