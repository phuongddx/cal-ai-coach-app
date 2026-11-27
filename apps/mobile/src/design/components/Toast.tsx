/**
 * CCToast (Components/Content.swift). Saved-entry toast with undo; auto-dismiss
 * after 4 s. ED-safe drops the kcal line.
 */

import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { radius, space, typography, useTokens, withAlpha } from '../tokens';

import { useEdSafeMode } from '../edSafe';

export type ToastProps = {
  title: string;
  kcalText?: string;
  undoTitle?: string;
  onUndo?: () => void;
  onDismiss?: () => void;
};

/** The pure ED-safe rule for the kcal line, assertable without rendering. */
export function toastVisibleKcalText(kcalText: string | undefined, edSafeMode: boolean): string | undefined {
  return edSafeMode ? undefined : kcalText;
}

export function Toast({
  title,
  kcalText,
  undoTitle = 'Undo',
  onUndo,
  onDismiss,
}: ToastProps) {
  const { colors } = useTokens();
  const edSafeMode = useEdSafeMode();
  const visibleKcalText = toastVisibleKcalText(kcalText, edSafeMode);
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
      accessibilityLabel={visibleKcalText == null ? title : `${title}. ${visibleKcalText}`}
      style={[
        styles.toast,
        {
          backgroundColor: colors.card,
          shadowColor: '#000000',
          shadowOpacity: 0.4,
          shadowRadius: 32,
          shadowOffset: { width: 0, height: 8 },
        },
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: withAlpha(colors.success, 0.2) }]}>
        <SymbolView name="checkmark" size={16} weight="semibold" tintColor={colors.successInk} />
      </View>
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        {visibleKcalText != null && (
          <Text style={[styles.kcal, { color: colors.textSecondary }]}>{visibleKcalText}</Text>
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
