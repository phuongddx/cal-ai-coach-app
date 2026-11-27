/**
 * CCInsightCard (Components/Cards.swift). Icon tile, title + text; accent
 * variant carries a lime left bar, info variant a blue left bar on a tinted
 * background.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { radius, space, typography, useTokens, withAlpha } from '../tokens';

export type InsightVariant = 'accent' | 'info';

export type InsightCardProps = {
  title: string;
  text: string;
  icon?: string;
  variant?: InsightVariant;
};

export function InsightCard({
  title,
  text,
  icon = 'lightbulb',
  variant = 'accent',
}: InsightCardProps) {
  const { colors } = useTokens();
  const isInfo = variant === 'info';
  const background = isInfo ? withAlpha(colors.info, 0.1) : colors.card;
  const tileBackground = isInfo ? withAlpha(colors.info, 0.12) : withAlpha(colors.accentLime, 0.15);
  const iconColor = isInfo ? colors.infoInk : colors.accentInk;
  const barColor = isInfo ? colors.info : colors.accentLime;
  return (
    <View
      testID={`insight-card:${variant}`}
      style={[
        styles.card,
        {
          backgroundColor: background,
          borderColor: isInfo ? withAlpha(colors.info, 0.2) : colors.border,
        },
      ]}
    >
      <View style={[styles.bar, { backgroundColor: barColor }]} />
      <View style={[styles.iconTile, { backgroundColor: tileBackground }]}>
        <SymbolView name={icon as SFSymbol} size={17} tintColor={iconColor} />
      </View>
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.text, { color: colors.textSecondary }]}>{text}</Text>
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
});
