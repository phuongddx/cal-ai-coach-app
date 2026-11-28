/**
 * WaterCard.swift / WaterLogSheet.swift — the compact water card and its log
 * sheet with the frame's info-tint droplet tile and the ±250 ml chips. Water
 * is glasses progress, not kcal data: it deliberately bypasses the calorie
 * ring's ED-safe policy and stays visible under the mode. Mounted by the
 * Today surface (U-33); owned here by DY-07.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, Sheet, SheetHeader, size, space, useEdSafeMode, useTokens } from '../../../design';

import { glassesLogged, litresText, GLASS_ML } from '../waterModel';

/**
 * WaterDropletTile — the frame's 40 pt info-tint tile with the droplet glyph
 * (Today-light water card). Decorative: accessibility-hidden, as the ring was.
 */
export function WaterDropletTile() {
  const { colors } = useTokens();
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: colors.infoTint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon name="drop" size={16} color={colors.infoInk} />
    </View>
  );
}

export type WaterCardProps = {
  waterMl: number;
  glasses: number;
  onTap: () => void;
};

export function WaterCard({ waterMl, glasses, onTap }: WaterCardProps) {
  const { colors, radius, typography } = useTokens();
  const edSafe = useEdSafeMode();
  const logged = glassesLogged(waterMl);
  // The Today frame: litres in the normal mode, glasses under ED-Safe. The
  // mode read is the third documented stay (findings, U-74 §10) until
  // EdSafeAlternate is on main.
  const copy = edSafe
    ? `${logged} of ${glasses} glasses`
    : `${litresText(waterMl)} of ${litresText(glasses * GLASS_ML)} L`;
  const chip = edSafe ? '+ 1 glass' : '+ 250 ml';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Water, ${copy}`}
      testID="today.waterCard"
      onPress={onTap}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.lg },
      ]}
    >
      <WaterDropletTile />
      <View style={styles.cardText}>
        <Text style={[typography.headline, { color: colors.textPrimary }]}>Water</Text>
        <Text style={[typography.subhead, { color: colors.textSecondary }]}>{copy}</Text>
      </View>
      {/* The frame's "+ 250 ml" / "+ 1 glass" chip: a 44 pt display target on
          the card (the quick-add lives in the log sheet — the card's props are
          frozen, so the whole card taps into the sheet). */}
      <View style={[styles.chip, { backgroundColor: colors.fill, borderRadius: radius.pill }]}>
        <Text style={[styles.chipText, { color: colors.textPrimary }]}>{chip}</Text>
      </View>
    </Pressable>
  );
}

export type WaterLogSheetProps = {  totalMl: number;
  glasses: number;
  onQuickAdd: (deltaMl: number) => void;
  onDismiss: () => void;
};

export function WaterLogSheet({ totalMl, glasses, onQuickAdd, onDismiss }: WaterLogSheetProps) {
  const { colors, typography } = useTokens();
  const logged = glassesLogged(totalMl);
  return (
    <Sheet>
      <SheetHeader title="Water" onClose={onDismiss} testID="water" />

      <View style={styles.summaryRow}>
        <WaterDropletTile />
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
      style={[styles.tile, { backgroundColor: colors.fill, borderRadius: radius.md }]}
    >
      <Icon name={symbol} size={15} color={colors.textPrimary} />
      <Text style={styles.tileTitle}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.lg, borderWidth: 1, padding: space.lg },
  cardText: { flex: 1, gap: 2 },
  chip: {
    minHeight: size.tap,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.sm },
  summaryText: { gap: 4 },
  tileRow: { flexDirection: 'row', gap: space.sm },
  tile: {
    flex: 1,
    minHeight: size.tap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  tileTitle: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
