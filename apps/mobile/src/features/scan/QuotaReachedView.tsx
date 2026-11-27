/**
 * QuotaReachedView + NeutralPlansSheet (both live in ReviewSheetView.swift). Presentational only: "See plans" opens a
 * copy-neutral placeholder, "Log manually" hands off to the route (AddFoodSheetRoute belongs to another unit).
 */
import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { PrimaryButton, SecondaryButton, Sheet, radius, space, typography, useTokens, withAlpha } from '../../design';
import type { ScanModel } from './scanModel';
import { abbreviatedDate } from './scanCopy';
import { useScanState } from './useScanModel';

export function NeutralPlansSheet({ onLogManually }: { onLogManually: () => void }) {
  const { colors } = useTokens();
  return (
    <Sheet testID="scan.plansSheet">
      <View style={styles.plans}>
        <Text accessibilityRole="header" testID="scan.plansTitle" style={[typography.heading, { color: colors.textPrimary }]}>
          Plans
        </Text>
        <Text style={[typography.subhead, { color: colors.textSecondary }]}>
          CoachCal plan options will be available at launch. Logging meals manually stays free and unlimited.
        </Text>
        <SecondaryButton title="Log manually" bordered testID="scan.plansLogManually" action={onLogManually} />
      </View>
    </Sheet>
  );
}

export type QuotaReachedViewProps = {
  model: ScanModel;
  /** "Log manually": the route opens its manual-log flow and closes this one when a meal is logged. */
  onLogManually: () => void;
};

export function QuotaReachedView({ model, onLogManually }: QuotaReachedViewProps) {
  const { colors } = useTokens();
  const state = useScanState(model);
  const [plansOpen, setPlansOpen] = useState(false);
  const entitlement = state.phase.kind === 'quotaReached' ? state.phase.entitlement : null;
  const resetText = entitlement ? `Your scans reset ${abbreviatedDate(entitlement.windowResetAt)}. You can still log everything manually.` : '';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={[styles.tile, { backgroundColor: withAlpha(colors.accentLime, 0.15) }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <SymbolView name="info" size={16} tintColor={colors.accentInk} />
        </View>
        <Text accessibilityRole="header" testID="scan.quotaTitle" style={[typography.heading, { color: colors.textPrimary }]}>
          You've used all 3 free scans this week
        </Text>
        <Text testID="scan.quotaBody" style={[typography.subhead, { color: colors.textSecondary }]}>
          {resetText}
        </Text>
        <PrimaryButton title="See plans" testID="scan.seePlans" action={() => setPlansOpen(true)} />
        <SecondaryButton title="Log manually" bordered testID="scan.logManually" action={onLogManually} />
      </View>
      <Modal visible={plansOpen} transparent animationType="slide" onRequestClose={() => setPlansOpen(false)}>
        <View style={styles.modalBackdrop}>
          <NeutralPlansSheet
            onLogManually={() => {
              setPlansOpen(false);
              onLogManually();
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: space.lg },
  card: { borderRadius: radius.lg, padding: space.xl, gap: space.lg },
  tile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  plans: { gap: space.md, paddingBottom: space.xl3 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
});
