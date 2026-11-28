/**
 * The paywall screen (U-77, frame "Plans / paywall" + round-3 loading/failed
 * states): the ember hero, the feature rows, the option cards, Close always
 * visible, the note under the button. The three states — loading (skeleton
 * price slots, disabled CTA), failed (the caution card with the frame's
 * "Try again" inside it, "Price unavailable" options, disabled CTA; this
 * build always ends here) and ready (the store's options, the plan choice
 * selected) — render through the model. Restore is recorded, not rendered:
 * no store is connected, so nothing about Restore is drawn anywhere (owner
 * correction — the model still binds the port and catches a rejection into
 * `restoreError` for the day a real port exists). No string on this screen
 * is a price: every price line is the store's own (`option.price`), and this
 * build's route injects a loader that always fails.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  EmberCard,
  GlassIconButton,
  Icon,
  PrimaryButton,
  OptionCard,
  SecondaryButton,
  radius,
  space,
  typography,
  useTokens,
} from '../../design';

import { billingCopy } from './billingCopy';
import type { PaywallModel } from './paywallModel';

export type PaywallViewProps = {
  model: PaywallModel;
  /** The route's close (the glass button and the swipe-back both dismiss). */
  onClose: () => void;
};

export function PaywallView({ model, onClose }: PaywallViewProps) {
  useSyncExternalStore(model.subscribe, model.getRevision);
  const { colors } = useTokens();
  useEffect(() => {
    void model.load();
  }, [model]);

  const state = model.state;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="plans.sheet">
      <View style={styles.navRow}>
        {/* Restore is recorded, not rendered: a control that cannot act is not
            drawn (owner correction) — shown when a store exists (findings §5).
            The model still binds the port and reports a rejection for that day. */}
        <GlassIconButton icon="x" onPress={onClose} accessibilityLabel="Close" testID="plans.close" />
      </View>

      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <EmberCard>
          <Text style={[styles.eyebrow, { color: colors.emberAccent }]}>{billingCopy.plansEyebrow}</Text>
          <Text style={[typography.heading, styles.headline, { color: colors.emberText }]}>
            {billingCopy.plansHeadline}
          </Text>
        </EmberCard>

        <View style={styles.features}>
          <FeatureRow icon="check" label={billingCopy.featureUnlimitedScans} />
          <FeatureRow icon="check" label={billingCopy.featureCoachReview} />
          <FeatureRow icon="check" label={billingCopy.featureExportHealth} />
          <FeatureRow icon="info" label={billingCopy.featureFreeLogging} muted />
        </View>

        {state.kind === 'loading' && (
          <View testID="plans.state.loading" style={styles.stack}>
            {/* Skeleton price slots: no text, no number (frame b-paywall-loading). */}
            <View style={[styles.skeletonCard, { borderColor: colors.border }]}>
              <View style={[styles.skeletonBar, { backgroundColor: colors.fill }]} />
              <View style={[styles.skeletonBar, { backgroundColor: colors.fill }]} />
            </View>
            <View style={[styles.skeletonCard, { borderColor: colors.border }]}>
              <View style={[styles.skeletonBar, { backgroundColor: colors.fill }]} />
              <View style={[styles.skeletonBar, { backgroundColor: colors.fill }]} />
            </View>
          </View>
        )}

        {state.kind === 'failed' && (
          <View testID="plans.state.failed" style={styles.stack}>
            <View testID="plans.caution" style={[styles.failedCard, { backgroundColor: colors.cautionTint }]}>
              <View style={styles.failedRow}>
                <Icon name="info" size={20} color={colors.cautionInk} />
                <Text style={[typography.footnote, styles.failedText, { color: colors.cautionInk }]}>
                  {billingCopy.failedCardText}
                </Text>
              </View>
              {/* The frame's Try again sits inside the caution card (79). */}
              <SecondaryButton
                title={billingCopy.tryAgain}
                testID="plans.retry"
                action={() => model.retry()}
              />
            </View>
            {/* The plans render unselectable with "Price unavailable". */}
            <View testID="plans.option.yearly">
              <OptionCard title="Yearly" subtitle={billingCopy.priceUnavailable} isSelected={false} />
            </View>
            <View testID="plans.option.monthly">
              <OptionCard title="Monthly" subtitle={billingCopy.priceUnavailable} isSelected={false} />
            </View>
          </View>
        )}

        {state.kind === 'ready' && (
          <View testID="plans.state.ready" style={styles.stack}>
            {state.options.map((option) => (
              <View key={option.id} testID={`plans.option.${option.id}`}>
                <OptionCard
                  title={option.title}
                  subtitle={option.detail ?? undefined}
                  isSelected={state.selectedId === option.id}
                  onSelect={() => model.select(option.id)}
                />
                {/* The price line is the store's own string, or "Price
                    unavailable" — never a sample (D13). */}
                <Text
                  testID={`plans.option.${option.id}.price`}
                  style={[typography.headline, styles.price, { color: colors.text }]}
                >
                  {option.price ?? billingCopy.priceUnavailable}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.dock}>
        <PrimaryButton
          title={
            state.kind === 'loading'
              ? billingCopy.loadingCta
              : state.kind === 'failed'
                ? billingCopy.failedCta
                : state.kind === 'ready' && state.options.some((option) => option.trial)
                  ? billingCopy.readyTrialCta
                  : billingCopy.readySubscribeCta
          }
          disabled={state.kind !== 'ready'}
          testID="plans.primary"
          action={() => void model.purchaseSelected()}
        />
        {/* The failed state draws no note: the slot held only the Restore
            sentence, which waits for a store like the button. */}
        {state.kind !== 'failed' && (
          <Text style={[typography.footnote, styles.dockNote, { color: colors.textSecondary }]}>
            {state.kind === 'loading' ? billingCopy.loadingNote : 'Terms · Privacy'}
          </Text>
        )}
      </View>
    </View>
  );
}

function FeatureRow({ icon, label, muted = false }: { icon: 'check' | 'info'; label: string; muted?: boolean }) {
  const { colors } = useTokens();
  return (
    <View style={styles.featureRow}>
      <Icon name={icon} size={20} color={muted ? colors.text2 : colors.accentInk} />
      <Text style={[typography.subhead, { color: muted ? colors.text2 : colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  content: {
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl5,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  headline: { marginTop: space.sm },
  features: { gap: space.md },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 32,
  },
  stack: { gap: space.md },
  skeletonCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  skeletonBar: { height: 16, borderRadius: radius.sm },
  failedCard: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
  },
  failedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  failedText: { flex: 1 },
  price: { marginTop: space.xs },
  dock: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.sm,
  },
  dockNote: { textAlign: 'center' },
});
