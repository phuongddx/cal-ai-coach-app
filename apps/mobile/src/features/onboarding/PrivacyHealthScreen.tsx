/**
 * PrivacyHealthView.swift — INT-01: the connect button makes a real JIT
 * HealthKit permission request through the model's injected
 * `requestHealthAccess`. Denial reveals the existing footnote below; a granted
 * authorization advances past it silently (no reaction, the CTA just works).
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  BannerNote,
  SecondaryButton,
  SectionHeader,
  SettingsGroup,
  SettingsRow,
  space,
  typography,
  useTokens,
} from '../../design';

import { onboardingCopy } from './onboardingCopy';
import { StepScaffold } from './StepScaffold';
import { useOnboardingModel } from './useOnboardingModel';
import type { OnboardingModel } from './onboardingModel';

export function PrivacyHealthScreen({ model }: { model: OnboardingModel }) {
  useOnboardingModel(model);
  const { colors } = useTokens();
  const [showConnectNote, setShowConnectNote] = useState(false);

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
        </SettingsGroup>
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
            style={[styles.footnote, { color: colors.textSecondary }]}
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
});
