/**
 * WaterCard.swift / WaterLogSheet.swift — the compact droplet-ring water card
 * and its log sheet with ±250 ml tiles. Water is glasses progress, not kcal
 * data: it deliberately bypasses the calorie ring's ED-safe policy and stays
 * visible under the mode. Mounted by the Today surface (U-33); owned here by
 * DY-07.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Svg, { Circle } from 'react-native-svg';

import { Sheet, size, space, useTokens, withAlpha, type Colors } from '../../../design';

import { glassesLogged, GLASS_ML } from '../waterModel';

/**
 * WaterDropletRing — the 56pt goal-variant ring geometry with a droplet
 * center, a fraction-of-goal lime arc.
 */
export function WaterDropletRing({ waterMl, goalMl }: { waterMl: number; goalMl: number }) {
  const { colors } = useTokens();
  const fraction = goalMl > 0 ? Math.min(Math.max(waterMl / goalMl, 0), 1) : 0;
  const stroke = size.ringGoalStroke;
  const radius = (size.ringGoal - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View
      testID="water-droplet-ring"
      style={{ width: size.ringGoal, height: size.ringGoal, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size.ringGoal} height={size.ringGoal} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size.ringGoal / 2}
          cy={size.ringGoal / 2}
          r={radius}
          stroke={ringTrackColor(colors)}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size.ringGoal / 2}
          cy={size.ringGoal / 2}
          r={radius}
          stroke={colors.accentLime}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference * fraction} ${circumference}`}
          rotation={-90}
          origin={`${size.ringGoal / 2}, ${size.ringGoal / 2}`}
        />
      </Svg>
      <SymbolView name="drop.fill" size={14} tintColor={colors.accentInk} />
    </View>
  );
}

function ringTrackColor(colors: Colors): string {
  // Dark mode strokes the track at white 10%; light mode uses the surface.
  return colors.background === '#000000' ? withAlpha('#FFFFFF', 0.1) : colors.surface;
}

export type WaterCardProps = {
  waterMl: number;
  glasses: number;
  onTap: () => void;
};

export function WaterCard({ waterMl, glasses, onTap }: WaterCardProps) {
  const { colors, radius, typography } = useTokens();
  const logged = glassesLogged(waterMl);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Water, ${logged} of ${glasses} glasses`}
      testID="today.waterCard"
      onPress={onTap}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.lg },
      ]}
    >
      <WaterDropletRing waterMl={waterMl} goalMl={glasses * GLASS_ML} />
      <View style={styles.cardText}>
        <Text style={[typography.headline, { color: colors.textPrimary }]}>Water</Text>
        <Text style={[typography.subhead, { color: colors.textSecondary }]}>
          {`${logged} of ${glasses} glasses`}
        </Text>
      </View>
      <SymbolView name="chevron.right" size={12} weight="semibold" tintColor={colors.textTertiary} />
    </Pressable>
  );
}

export type WaterLogSheetProps = {
  totalMl: number;
  glasses: number;
  onQuickAdd: (deltaMl: number) => void;
  onDismiss: () => void;
};

export function WaterLogSheet({ totalMl, glasses, onQuickAdd, onDismiss }: WaterLogSheetProps) {
  const { colors, radius, typography } = useTokens();
  const logged = glassesLogged(totalMl);
  return (
    <Sheet>
      <View style={styles.header}>
        <Text style={[typography.heading, { color: colors.textPrimary }]}>Water</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          testID="water.close"
          onPress={onDismiss}
          style={styles.closeButton}
        >
          <SymbolView name="xmark" size={14} weight="semibold" tintColor={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.summaryRow}>
        <WaterDropletRing waterMl={totalMl} goalMl={glasses * GLASS_ML} />
        <View style={styles.summaryText}>
          <Text style={[typography.headline, { color: colors.textPrimary }]}>
            {`${logged} of ${glasses} glasses`}
          </Text>
          <Text style={[typography.subhead, { color: colors.textSecondary }]}>
            {`${totalMl.toLocaleString('en-US')} ml today`}
          </Text>
        </View>
      </View>

      <View style={styles.tileRow}>
        <QuickAddTile
          symbol="minus"
          title="−250 ml"
          delta={-GLASS_ML}
          identifier="water.subtract"
          onQuickAdd={onQuickAdd}
        />
        <QuickAddTile
          symbol="plus"
          title="+250 ml"
          delta={GLASS_ML}
          identifier="water.add"
          onQuickAdd={onQuickAdd}
        />
      </View>
    </Sheet>
  );
}

function QuickAddTile({
  symbol,
  title,
  delta,
  identifier,
  onQuickAdd,
}: {
  symbol: 'minus' | 'plus';
  title: string;
  delta: number;
  identifier: string;
  onQuickAdd: (deltaMl: number) => void;
}) {
  const { colors, radius } = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      testID={identifier}
      onPress={() => onQuickAdd(delta)}
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}
    >
      <SymbolView name={symbol} size={15} weight="semibold" tintColor={colors.textPrimary} />
      <Text style={styles.tileTitle}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.lg, borderWidth: 1, padding: space.lg },
  cardText: { flex: 1, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'center' },
  closeButton: { marginLeft: 'auto', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.sm },
  summaryText: { gap: 4 },
  tileRow: { flexDirection: 'row', gap: space.sm },
  tile: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderWidth: 1,
  },
  tileTitle: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
