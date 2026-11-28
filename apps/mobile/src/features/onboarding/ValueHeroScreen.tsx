/**
 * ValueHeroView.swift — the first step, restyled as the Ember welcome stage:
 * a dark-in-both-schemes stage with the plate, the accent corner brackets and
 * the high-confidence badge around the locked hero copy (OB-01 keeps the
 * strings; the frame's own hero sentence is a recorded deviation). The badge
 * carries a kcal number, so it collapses under ED-safe mode through the
 * design system's EdSafeCollapse — the feature holds no policy branch (I7).
 * The CTA keeps onboarding.getStarted; the frame's ghost sign-in entry and the
 * COACHCAL eyebrow are not in the unit's decisions (findings U-73).
 */

import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';

import { EdSafeCollapse, PrimaryButton, radius, space, typography, useTokens, withAlpha } from '../../design';

import { onboardingCopy } from './onboardingCopy';
import type { OnboardingModel } from './onboardingModel';

export function ValueHeroScreen({ model }: { model: OnboardingModel }) {
  const { colors } = useTokens();
  return (
    <View style={[styles.root, { backgroundColor: colors.ember }]}>
      <View style={styles.stage}>
        {/* The plate: a drawn stand-in for the frame's photo — no image asset exists on the branch. */}
        <Plate />
        <Bracket corner="topLeft" color={colors.accent} />
        <Bracket corner="topRight" color={colors.accent} />
        <Bracket corner="bottomLeft" color={colors.accent} />
        <Bracket corner="bottomRight" color={colors.accent} />
        {/* The badge is the one kcal number on the stage: the design component owns the branch. */}
        <EdSafeCollapse>
          <View style={[styles.badge, { backgroundColor: colors.successTint }]}>
            <View style={[styles.badgeDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.badgeText, { color: colors.successInk }]}>High confidence · 624 kcal</Text>
          </View>
        </EdSafeCollapse>
      </View>
      <View style={styles.copy}>
        <Text
          testID="onboarding.title.Track calories with a photo"
          style={[styles.title, { color: colors.emberText }]}
        >
          Track calories with a photo
        </Text>
        <Text style={[styles.subtitle, { color: colors.emberText2 }]}>The honest AI calorie coach</Text>
      </View>
      <View style={styles.rows}>
        <FeatureRow icon="eye" title="AI estimates with confidence" detail="See when AI is certain vs. guessing" />
        <FeatureRow icon="tag" title="Transparent pricing always" detail="No hidden fees. Cancel anytime." />
        <FeatureRow icon="heart" title={onboardingCopy.safeModeTitle} detail={onboardingCopy.safeModeSubtitle} />
      </View>
      <View style={styles.ctaWrap}>
        <View testID="onboarding.getStarted">
          {/* The Swift view hangs the accessibilityIdentifier on the button; the
              design-system button carries no testID prop, so the identifier rides
              the wrapper like every other step. */}
          <PrimaryButton title="Get started" action={() => model.advance()} />
        </View>
      </View>
    </View>
  );
}

/** The frame's plate: soft concentric rings with three food dots, token-colored. */
function Plate() {
  const { colors } = useTokens();
  const size = 280;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={withAlpha(colors.emberText, 0.07)} />
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - 22} fill={withAlpha(colors.emberText, 0.13)} />
      {/* Food dots: greens and the accent, as in the frame's plate photo. */}
      <Circle cx={size / 2 - 62} cy={size / 2 - 30} r={58} fill={withAlpha(colors.emberText, 0.3)} />
      <Circle cx={size / 2 + 58} cy={size / 2 - 52} r={34} fill={colors.success} />
      <Circle cx={size / 2 + 42} cy={size / 2 + 42} r={52} fill={colors.accent} />
      <Circle cx={size / 2 - 46} cy={size / 2 + 66} r={38} fill={withAlpha(colors.emberText, 0.24)} />
    </Svg>
  );
}

/** One rounded corner bracket of the frame's scan framing (stroke 6). */
function Bracket({ corner, color }: { corner: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'; color: string }) {
  const placement = {
    topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
    topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
    bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
    bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  };
  return <View style={[bracketStyles.bracket, { borderColor: color }, placement[corner]]} />;
}

const bracketStyles = StyleSheet.create({
  bracket: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderWidth: 6,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
});

function FeatureRow({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  const { colors } = useTokens();
  return (
    <View
      accessible
      accessibilityLabel={`${title}, ${detail}`}
      style={styles.row}
    >
      <View style={[styles.tile, { backgroundColor: withAlpha(colors.accent, 0.18), borderRadius: radius.md }]}>
        {/* The icon is decorative: hidden from accessibility like the Swift overlay. */}
        <SymbolView name={icon as never} size={20} tintColor={colors.emberAccent} />
      </View>
      <View style={styles.copyRow}>
        <Text style={[styles.rowTitle, { color: colors.emberText }]}>{title}</Text>
        <Text style={[styles.rowDetail, { color: colors.emberText2 }]}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xl4,
    marginBottom: space.xl,
  },
  badge: {
    position: 'absolute',
    bottom: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 28,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { ...typography.footnote, fontWeight: '600' },
  copy: {
    gap: space.xs,
    paddingHorizontal: space.lg,
  },
  title: { ...typography.title },
  subtitle: { ...typography.subhead },
  rows: {
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.xl2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tile: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  copyRow: { gap: 2 },
  rowTitle: { ...typography.headline },
  rowDetail: { ...typography.subhead },
  ctaWrap: {
    marginTop: 'auto',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xl3,
  },
});
