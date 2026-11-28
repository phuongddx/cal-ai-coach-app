/**
 * The cancel flow (U-77, frame "Cancel flow" + b-cancel-dark): the
 * informational screen between the Settings button and Apple's sheet. The
 * primary hands the cancellation to Apple — this build has no in-app
 * manage-subscriptions sheet (no native module yet, decision D14), so the
 * route binds the primary to the App Store's subscriptions page through
 * `Linking`. The dock's two buttons carry equal weight: no survey wall, no
 * confirmation loop. No renewal date is shown — this build has no stored
 * subscription to read `{expiryDate}` from (D13).
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  DestructiveButton,
  Icon,
  SecondaryButton,
  SheetHeader,
  radius,
  space,
  typography,
  useTokens,
} from '../../design';

import { billingCopy } from './billingCopy';

export type CancelFlowViewProps = {
  /** The route binds the App Store subscriptions page (`Linking.openURL`). */
  onContinue: () => void;
  /** The route's dismiss ("Keep Plus"). */
  onKeep: () => void;
};

export function CancelFlowView({ onContinue, onKeep }: CancelFlowViewProps) {
  const { colors } = useTokens();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="cancelFlow.screen">
      <SheetHeader
        title={billingCopy.cancelFlowTitle}
        onBack={onKeep}
        backAccessibilityLabel="Back"
        testID="cancelFlow.header"
      />
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <Text style={[typography.heading, styles.headline, { color: colors.text }]}>
          {billingCopy.cancelFlowHeadline}
        </Text>
        <View style={[styles.checksCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <CheckRow label={billingCopy.cancelKeepLine} />
          <CheckRow label={billingCopy.cancelDataLine} />
          <CheckRow label={billingCopy.cancelFreeLine} />
        </View>
        <Text style={[typography.footnote, styles.note, { color: colors.textSecondary }]}>
          {billingCopy.cancelAppleNote}
        </Text>
      </ScrollView>
      <View style={styles.dock}>
        {/* Equal visual weight with "Keep Plus": destructive on its tint, no
            survey, no "are you sure?" loop (frame 19, App Review 5.6). */}
        <DestructiveButton title={billingCopy.cancelContinue} action={onContinue} testID="cancelFlow.continue" />
        <SecondaryButton title={billingCopy.cancelKeep} bordered action={onKeep} testID="cancelFlow.keep" />
      </View>
    </View>
  );
}

function CheckRow({ label }: { label: string }) {
  const { colors } = useTokens();
  return (
    <View style={styles.checkRow}>
      <Icon name="check" size={20} color={colors.successInk} />
      <Text style={[typography.subhead, styles.checkText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl5,
  },
  headline: { maxWidth: 320 },
  checksCard: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  checkText: { flex: 1 },
  note: { maxWidth: 320 },
  dock: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.sm,
  },
});
