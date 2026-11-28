/**
 * Quota reached (Ember frames 17-billing-quota-reached-sheet and 56-darkmode-quota-reached-dark-sheet): a sheet over a
 * dimmed backdrop with a close glass button, the 64 pt scan tile, the title, the body and a dock with "See plans" and
 * "Log manually, free" at equal weight. The limit and the reset day come from the server's entitlement on the 402
 * envelope; when the envelope carries none the sheet names no number and no day (the client never invents a limit).
 * Presentational only: "See plans" opens the plans route and "Log manually" hands off, both through the route.
 */
import { StyleSheet, Text, View } from 'react-native';

import { darkColors, GlassIconButton, Icon, PrimaryButton, radius, SecondaryButton, Sheet, space, typography, useTokens, withAlpha } from '../../design';
import type { ScanModel } from './scanModel';
import { resetWeekday } from './scanCopy';
import { useScanState } from './useScanModel';

export type QuotaReachedViewProps = {
  model: ScanModel;
  /** "Log manually, free": the route opens its manual-log flow and closes this one when a meal is logged. */
  onLogManually: () => void;
  /** "See plans": the route opens the plans (paywall) screen. */
  onSeePlans: () => void;
  /** The close glass button: the route leaves the scan flow. */
  onClose: () => void;
};

const FREE_PATHS = 'You can still log anything by search, barcode or description, for free.';

export function QuotaReachedView({ model, onLogManually, onSeePlans, onClose }: QuotaReachedViewProps) {
  const { colors } = useTokens();
  const state = useScanState(model);
  const entitlement = state.phase.kind === 'quotaReached' ? state.phase.entitlement : null;
  const weekday = entitlement ? resetWeekday(entitlement.windowResetAt) : '';
  const title = entitlement
    ? `You've used this week's ${entitlement.scanLimit} free scans`
    : "You've used this week's free scans";
  const body = weekday ? `Scans reset ${weekday}. ${FREE_PATHS}` : FREE_PATHS;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View testID="scan.quotaBackdrop" style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(darkColors.bg, 0.4) }]} />
      <Sheet testID="scan.quotaSheet">
        <View style={styles.close}>
          <GlassIconButton icon="x" accessibilityLabel="Close" testID="scan.quotaClose" onPress={onClose} />
        </View>
        <View style={styles.content}>
          <View
            testID="scan.quotaTile"
            style={[styles.tile, { backgroundColor: colors.accentTint }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Icon name="scan" size={28} color={colors.accentInk} />
          </View>
          <Text accessibilityRole="header" testID="scan.quotaTitle" style={[styles.title, { color: colors.text }]}>
            {title}
          </Text>
          <Text testID="scan.quotaBody" style={[typography.body, { color: colors.text2 }]}>
            {body}
          </Text>
        </View>
        <View style={styles.dock}>
          <PrimaryButton title="See plans" testID="scan.seePlans" action={onSeePlans} />
          <SecondaryButton title="Log manually, free" bordered testID="scan.logManually" action={onLogManually} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  close: { position: 'absolute', top: space.sm, right: space.lg, zIndex: 1 },
  content: { gap: space.md, paddingTop: space.sm, paddingBottom: space.xl },
  tile: { width: 64, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700' },
  dock: { gap: space.md },
});
