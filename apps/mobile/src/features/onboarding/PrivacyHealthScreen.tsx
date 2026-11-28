/**
 * PrivacyHealthView.swift — INT-01: the connect button makes a real JIT
 * HealthKit permission request through the model's injected
 * `requestHealthAccess`. Denial reveals the existing footnote below; a granted
 * authorization advances past it silently (no reaction, the CTA just works).
 *
 * U-73: the frame's ED-Safe row joins the group as a switch. The stored key
 * and the design flag setter are the model's injected dependencies (the route
 * file owns both, exactly as the Settings route does); the switch's value is
 * the design system's live flag, so a flip re-renders every screen through the
 * design hooks and the mode applies at once (invariant I7: the feature holds
 * no policy branch). The frame's meal-reminders row is not built: no stored
 * preference exists and the app draws no switch that does nothing (follow-up).
 */

import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import {
  BannerNote,
  SecondaryButton,
  SectionHeader,
  SettingsGroup,
  SettingsRow,
  radius,
  space,
  typography,
  useEdSafeMode,
  useTokens,
  withAlpha,
} from '../../design';

import { onboardingCopy } from './onboardingCopy';
import { StepScaffold } from './StepScaffold';
import { useOnboardingModel } from './useOnboardingModel';
import type { OnboardingModel } from './onboardingModel';

export function PrivacyHealthScreen({ model }: { model: OnboardingModel }) {
  useOnboardingModel(model);
  const { colors } = useTokens();
  const [showConnectNote, setShowConnectNote] = useState(false);
  // The design flag is the single source of the switch value (the Settings
  // switch's contract): flipping it re-renders every screen (I7).
  const safePolicyOn = useEdSafeMode();

  return (
    <StepScaffold
      title="Privacy & Health"
      subtitle="Your data, your choice"
      progress={model.progress}
      ctaTitle="Skip for now"
      action={() => model.advance()}
    >
      <View style={styles.rows}>
        <SettingsGroup>
          <SettingsRow
            icon="heart"
            label="Connect Apple Health"
            value="Sync steps, workouts, and weight automatically"
          />
          <SettingsRow icon="flame" label="Activity calories" value="Auto-adjust your daily target" />
          <SettingsRow icon="scalemass" label="Weight sync" value="Track progress without logging" />
          <View
            style={[
              styles.safeRow,
              { borderTopColor: colors.separator },
            ]}
          >
            <View style={[styles.safeTile, { backgroundColor: withAlpha(colors.fat, 0.15) }]}>
              {/* Decorative tile icon, like the settings rows' symbols. */}
              <SymbolView name="eye.slash" size={20} tintColor={colors.fat} />
            </View>
            <View style={styles.safeCopy}>
              <Text style={[styles.safeTitle, { color: colors.text }]}>ED-Safe mode</Text>
              <Text style={[styles.safeDetail, { color: colors.text2 }]}>
                Hide calorie numbers everywhere, including your plan on the next screen.
              </Text>
            </View>
            {/* The stored write happens first (the model records a failure and
                rethrows; this catch is the handler's guard so no rejection is
                ever unhandled), then the design flag applies at once. The
                switch's value IS the design flag, so it shows the state that
                is really applied. */}
            <Switch
              value={safePolicyOn}
              onValueChange={(on) => {
                void model.setSafeModePolicy(on).catch(() => undefined);
              }}
              trackColor={{ true: colors.fat, false: undefined }}
              testID="onboarding.edSafeToggle"
            />
          </View>
        </SettingsGroup>
        {model.safePolicyWriteError !== null && (
          <View testID="onboarding.edSafeError">
            {/* RN-only, as in Settings: the stored write is an async database
                write that can fail, and the screen says so instead of silently
                keeping a dead switch. */}
            <BannerNote text={model.safePolicyWriteError} />
          </View>
        )}
        <View style={styles.promise}>
          <SectionHeader title="Privacy promise" />
          <View testID="onboarding.privacyPromise">
            <BannerNote text={onboardingCopy.privacyPromiseBanner} variant="success" />
          </View>
        </View>
        <View testID="onboarding.healthConnect">
          <SecondaryButton
            title="Connect Apple Health"
            bordered
            action={() => {
              void model.requestHealthAccess().then((granted) => {
                // granted is the string 'granted' | 'denied' (Swift's Bool): the
                // footnote shows on anything but an explicit grant.
                setShowConnectNote(granted !== 'granted');
              });
            }}
          />
        </View>
        {showConnectNote && (
          <Text
            testID="onboarding.healthConnectNote"
            style={[styles.footnote, { color: colors.text2 }]}
          >
            {onboardingCopy.healthConnectNote}
          </Text>
        )}
      </View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  rows: { gap: space.lg },
  promise: { gap: space.sm },
  footnote: { ...typography.footnote },
  safeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  safeTile: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  safeCopy: { flex: 1, gap: 2 },
  safeTitle: { ...typography.subhead, fontWeight: '600' },
  safeDetail: { ...typography.footnote },
});
