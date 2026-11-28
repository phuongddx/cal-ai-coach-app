/**
 * CCToast (Components/Content.swift). Saved-entry toast with undo; auto-dismiss
 * after 4 s. ED-safe drops the kcal line. An optional `message` is a second line shown in every mode
 * (the name and grams of an edited entry) unless it carries a calorie word or figure, which ED-safe still hides.
 */

import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { radius, space, typography, useTokens } from '../tokens';

import { carriesCalorieFigure } from '../calorieFigure';
import { useEdSafeMode } from '../edSafe';

// The rule lives in ../calorieFigure (U-71f); re-exported so the barrel and every caller keep the same name.
export { carriesCalorieFigure };

export type ToastProps = {
  title: string;
  kcalText?: string;
  /** Second line under the title, shown in every mode unless it holds a calorie word or figure (then ED-safe hides it). */
  message?: string;
  undoTitle?: string;
  onUndo?: () => void;
  onDismiss?: () => void;
};

/** The pure ED-safe rule for the kcal line, assertable without rendering. */
export function toastVisibleKcalText(kcalText: string | undefined, edSafeMode: boolean): string | undefined {
  return edSafeMode ? undefined : kcalText;
}

/** The pure ED-safe rule for the message line: kept in every mode, hidden under ED-safe only if it holds a calorie word or figure. */
export function toastVisibleMessage(message: string | undefined, edSafeMode: boolean): string | undefined {
  if (message == null || message.length === 0) return undefined;
  return edSafeMode && carriesCalorieFigure(message) ? undefined : message;
}

export function Toast({
  title,
  kcalText,
  message,
  undoTitle = 'Undo',
  onUndo,
  onDismiss,
}: ToastProps) {
  const { colors, isDark } = useTokens();
  const edSafeMode = useEdSafeMode();
  const visibleKcalText = toastVisibleKcalText(kcalText, edSafeMode);
  const visibleMessage = toastVisibleMessage(message, edSafeMode);
  const spoken = [title, visibleMessage, visibleKcalText].filter((line) => line != null).join('. ');
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  // The Swift toast sleeps 4 s in a .task, then dismisses.
  useEffect(() => {
    if (onDismiss == null) return;
    const timer = setTimeout(() => dismissRef.current?.(), 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <View
      testID="toast"
      accessibilityRole="alert"
      accessibilityLabel={spoken}
      style={[
        styles.toast,
        {
          backgroundColor: colors.elevated,
          shadowColor: isDark ? colors.bg : colors.text,
          shadowOpacity: 0.4,
          shadowRadius: 32,
          shadowOffset: { width: 0, height: 8 },
        },
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: colors.successTint }]}>
        <SymbolView name="checkmark" size={16} weight="semibold" tintColor={colors.successInk} />
      </View>
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {visibleMessage != null && (
          <Text testID="toast:message" style={[styles.kcal, { color: colors.text2 }]}>
            {visibleMessage}
          </Text>
        )}
        {visibleKcalText != null && (
          <Text style={[styles.kcal, { color: colors.text2 }]}>{visibleKcalText}</Text>
        )}
      </View>
      {onUndo != null && (
        <Pressable
          accessibilityRole="button"
          onPress={onUndo}
          testID="toast:undo"
          hitSlop={8}
        >
          <Text style={[styles.undo, { color: colors.accentInk }]}>{undoTitle}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    padding: space.md,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.headline,
  },
  kcal: {
    ...typography.footnote,
  },
  undo: {
    ...typography.subhead,
    fontWeight: '500',
  },
});
