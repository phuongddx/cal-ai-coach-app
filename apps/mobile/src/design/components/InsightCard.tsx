/**
 * CCInsightCard (Components/Cards.swift). Icon tile, title + text; accent
 * variant carries an orange left bar (`accentStrong`) on an `accentTint` tile, info variant a
 * blue left bar on an `infoTint` background (Ember `#core` insight).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { radius, size, space, typography, useTokens } from '../tokens';

import { Icon } from './Icon';
import type { IconName } from './iconShapes';

export type InsightVariant = 'accent' | 'info';

export type InsightCardProps = {
  title: string;
  text: string;
  /** SF Symbol name of the earlier callers. Ignored when `iconName` is given. */
  icon?: string;
  /** Ember canvas glyph (`#i-*`) for the 40 pt icon tile, instead of the SF Symbol. */
  iconName?: IconName;
  variant?: InsightVariant;
  /** One optional action row under the text (a link-style button, at least 44 pt tall). */
  action?: InsightCardAction;
};

export type InsightCardAction = {
  label: string;
  onPress: () => void;
  testID?: string;
};

export function InsightCard({
  title,
  text,
  icon = 'lightbulb',
  iconName,
  variant = 'accent',
  action,
}: InsightCardProps) {
  const { colors } = useTokens();
  const isInfo = variant === 'info';
  const background = isInfo ? colors.infoTint : colors.card;
  const tileBackground = isInfo ? colors.infoTint : colors.accentTint;
  const iconColor = isInfo ? colors.infoInk : colors.accentInk;
  const barColor = isInfo ? colors.info : colors.accentStrong;
  return (
    <View
      testID={`insight-card:${variant}`}
      style={[
        styles.card,
        {
          backgroundColor: background,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.bar, { backgroundColor: barColor }]} />
      <View style={[styles.iconTile, { backgroundColor: tileBackground }]}>
        {iconName != null ? (
          <Icon name={iconName} size={20} color={iconColor} />
        ) : (
          <SymbolView name={icon as SFSymbol} size={17} tintColor={iconColor} />
        )}
      </View>
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.text, { color: colors.text2 }]}>{text}</Text>
        {action != null && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            testID={action.testID ?? `insight-card:${variant}:action`}
            onPress={action.onPress}
            hitSlop={space.sm}
            style={styles.action}
          >
            <Text style={[styles.actionLabel, { color: isInfo ? colors.infoInk : colors.accentInk }]}>
              {action.label}
            </Text>
          </Pressable>
        )}
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
    borderWidth: 1,
    padding: space.lg,
    overflow: 'hidden',
  },
  bar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
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
    gap: space.xs,
  },
  title: {
    ...typography.headline,
  },
  text: {
    ...typography.subhead,
  },
  action: {
    minHeight: size.tapTarget,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  actionLabel: {
    ...typography.subhead,
    fontWeight: '600',
  },
});
