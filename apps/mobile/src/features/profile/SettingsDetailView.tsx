/**
 * SettingsDetailView.swift — the settings screen (model-driven; the route binds
 * the model's real seams). The locked copy lives in settingsCopy so the
 * verbatim strings are test-asserted. The subscription card is display-only
 * with inert buttons (the old app has no store code); the wellness switch
 * stores the policy through the model and every screen re-renders through the
 * design hooks (invariant I7).
 */
import { useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Share, Switch, Text, View } from 'react-native';
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
  useTokens,
  useEdSafeMode,
  withAlpha,
} from '../../design';

import { settingsCopy, wellnessAnnouncement } from './settingsCopy';
import type { SettingsModel } from './settingsModel';

export type SettingsDetailViewProps = {
  model: SettingsModel;
};

export function SettingsDetailView({ model }: SettingsDetailViewProps) {
  useSyncExternalStore(model.subscribe, model.getRevision);
  const { colors } = useTokens();
  const [showsDeleteConfirmation, setShowsDeleteConfirmation] = useState(false);
  // The design flag is the single source of the switch value: flipping it
  // re-renders every screen through the design hooks (I7).
  const policyOn = useEdSafeMode();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        bounces={false}
      >
        <SectionHeader title="Wellness" />
        <View
          testID="settings.wellnessCard"
          style={[
            styles.wellnessCard,
            {
              backgroundColor: withAlpha(colors.macroFat, 0.08),
              borderColor: withAlpha(colors.macroFat, 0.2),
            },
          ]}
        >
          <View style={styles.wellnessHeadline}>
            <View
              accessibilityElementsHidden={false}
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.heartTile,
                { backgroundColor: withAlpha(colors.macroFat, 0.15) },
              ]}
            >
              <SymbolView name="heart.fill" size={20} tintColor={colors.macroFat} />
            </View>
            <Text style={[typography.headline, { color: colors.textPrimary }]}>
              {settingsCopy.wellnessTitle}
            </Text>
            <Switch
              value={policyOn}
              onValueChange={(on) => void model.setWellnessPolicy(on)}
              trackColor={{ true: colors.macroFat, false: undefined }}
              testID="settings.wellnessToggle"
              accessibilityLabel={wellnessAnnouncement(policyOn)}
            />
          </View>
          <Text style={[typography.footnote, { color: colors.textSecondary }]}>
            {settingsCopy.wellnessDescription}
          </Text>
        </View>

        <SectionHeader title="Health" />
        <View>
          <SettingsGroup>
            <View style={styles.burnRow}>
              <SymbolView name="flame" size={20} tintColor={colors.textSecondary} />
              <Text style={[typography.subhead, { color: colors.textPrimary, flex: 1 }]}>
                {settingsCopy.burnAddBackTitle}
              </Text>
              <Switch
                value={model.burnAddBackOn}
                onValueChange={(on) => void model.setBurnAddBack(on)}
                testID="settings.burnAddBackToggle"
              />
            </View>
          </SettingsGroup>
          {/* IN-01: the toggle persists but nothing reads it yet — the row must
              not present as a working, descriptive control until the consumer lands. */}
          <View testID="settings.burnAddBackNote">
            <BannerNote text={settingsCopy.burnAddBackNote} />
          </View>
        </View>

        <SectionHeader title="Data & privacy" />
        <SettingsGroup>
          <Pressable
            accessibilityRole="button"
            testID="settings.row.export"
            disabled={model.exportedCsv === null}
            onPress={() => {
              if (model.exportedCsv !== null) {
                void Share.share({ title: 'CoachCal Data.csv', message: model.exportedCsv });
              }
            }}
          >
            <SettingsRow icon="square.and.arrow.up" label="Export CSV" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            testID="settings.row.deleteAccount"
            onPress={() => setShowsDeleteConfirmation(true)}
          >
            <SettingsRow icon="trash" label={settingsCopy.deleteAccountConfirm} />
          </Pressable>
        </SettingsGroup>

        <View
          testID="settings.subscriptionCard"
          style={[styles.subscriptionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.subscriptionHeadline}>
            <Text style={[typography.headline, { color: colors.textPrimary }]}>Subscription</Text>
            <View style={[styles.activeChip, { backgroundColor: withAlpha(colors.accentLime, 0.15) }]}>
              <Text style={[typography.caption, { color: colors.textPrimary }]}>Active</Text>
            </View>
          </View>
          <Text testID="settings.planValue" style={[typography.subhead, { color: colors.textPrimary }]}>
            Free
          </Text>
          <View style={styles.subscriptionButtons}>
            {/* Display-only (T-P07-05): no purchase code exists; the buttons are present but inert. */}
            <SecondaryButton title="Change plan" testID="settings.changePlan" />
            <SecondaryButton title="Cancel subscription" bordered testID="settings.cancelSubscription" />
          </View>
          <View testID="settings.billingNote">
            <BannerNote text={settingsCopy.billingNote} />
          </View>
        </View>

        <SectionHeader title="Support" />
        <SettingsGroup>
          <Pressable accessibilityRole="button" testID="settings.row.help" onPress={() => undefined}>
            <SettingsRow icon="questionmark.circle" label="Help & FAQ" />
          </Pressable>
          <Pressable accessibilityRole="button" testID="settings.row.contact" onPress={() => undefined}>
            <SettingsRow icon="envelope" label="Contact us" />
          </Pressable>
        </SettingsGroup>
        <Text
          testID="settings.version"
          style={[typography.caption, styles.version, { color: colors.textTertiary }]}
        >
          {settingsCopy.versionCaption}
        </Text>
      </ScrollView>

      {showsDeleteConfirmation && (
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.confirmScrim}>
            <View style={[styles.confirmCard, { backgroundColor: colors.card }]}>
              <Text style={[typography.headline, { color: colors.textPrimary }]}>
                {settingsCopy.deleteAccountTitle}
              </Text>
              <Text style={[typography.footnote, { color: colors.textSecondary }]}>
                {settingsCopy.deleteAccountMessage}
              </Text>
              <Pressable
                accessibilityRole="button"
                testID="settings.deleteConfirm"
                onPress={() => {
                  setShowsDeleteConfirmation(false);
                  void model.resetAccount();
                }}
                style={styles.confirmButton}
              >
                <Text style={[styles.confirmButtonText, { color: colors.errorInk }]}>
                  {settingsCopy.deleteAccountConfirm}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                testID="settings.cancelDelete"
                onPress={() => setShowsDeleteConfirmation(false)}
                style={styles.confirmButton}
              >
                <Text style={[styles.confirmButtonText, { color: colors.accentInk }]}>
                  {settingsCopy.cancel}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl5,
  },
  wellnessCard: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  wellnessHeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  heartTile: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  burnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
  },
  subscriptionCard: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  subscriptionHeadline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  subscriptionButtons: {
    flexDirection: 'row',
    gap: space.sm,
  },
  version: {
    textAlign: 'center',
    paddingTop: space.sm,
  },
  confirmScrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: space.xl,
  },
  confirmCard: {
    gap: space.md,
    width: '100%',
    maxWidth: 320,
    padding: space.lg,
    borderRadius: radius.lg,
  },
  confirmButton: {
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
  },
  confirmButtonText: {
    ...typography.subhead,
    fontWeight: '600',
  },
});
