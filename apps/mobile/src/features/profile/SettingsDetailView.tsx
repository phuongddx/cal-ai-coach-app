/**
 * SettingsDetailView.swift — the settings screen (model-driven; the route binds
 * the model's real seams). The locked copy lives in settingsCopy so the
 * verbatim strings are test-asserted. The subscription card stays display-only
 * — the plan buttons are visibly disabled and the billing note says why (no
 * store in this build) — and the export row opens the share sheet with the file
 * on tap (U-77): the three round-3 states (write failed, nothing logged,
 * cancelled share) render as rows under the export row. The wellness switch
 * stores the policy through the model and every screen re-renders through the
 * design hooks (invariant I7).
 */
import { useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import {
  BannerNote,
  PrimaryButton,
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
import { StateNote } from './StateNote';

export type SettingsDetailViewProps = {
  model: SettingsModel;
  /** The injected plan name of the display-only entitlement state (the route passes "Free"). */
  planName: string;
};

export function SettingsDetailView({ model, planName }: SettingsDetailViewProps) {
  useSyncExternalStore(model.subscribe, model.getRevision);
  const { colors } = useTokens();
  const [showsDeleteConfirmation, setShowsDeleteConfirmation] = useState(false);
  // The design flag is the single source of the switch value: flipping it
  // re-renders every screen through the design hooks (I7).
  const policyOn = useEdSafeMode();

  const exportLoaded = model.exportedCsv !== null && !model.exportEmpty;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        bounces={false}
      >
        <SectionHeader title="Subscription" />
        <View
          testID="settings.subscriptionCard"
          style={[styles.subscriptionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text testID="settings.planValue" style={[typography.headline, { color: colors.textPrimary }]}>
            {`${planName} plan`}
          </Text>
          <View style={styles.subscriptionButtons}>
            {/* Display-only (no store in this build): the buttons stay visibly
                disabled — no action, dimmed — and the note says why. */}
            <View style={styles.inertButton} pointerEvents="none">
              <SecondaryButton title="Change plan" testID="settings.changePlan" />
            </View>
            <View style={styles.inertButton} pointerEvents="none">
              <SecondaryButton title="Cancel subscription" bordered testID="settings.cancelSubscription" />
            </View>
          </View>
          <View testID="settings.billingNote">
            <BannerNote text={settingsCopy.billingNote} />
          </View>
        </View>

        <SectionHeader title="Wellbeing" />
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
              onValueChange={(on) => {
                // The model records a failed write (wellnessWriteError) and
                // rethrows; this catch is the handler's guard so no rejection
                // is ever unhandled.
                void model.setWellnessPolicy(on).catch(() => undefined);
              }}
              trackColor={{ true: colors.macroFat, false: undefined }}
              testID="settings.edSafeToggle"
              accessibilityLabel={wellnessAnnouncement(policyOn)}
            />
          </View>
          <Text style={[typography.footnote, { color: colors.textSecondary }]}>
            {settingsCopy.wellnessDescription}
          </Text>
          {model.wellnessWriteError !== null && (
            <View testID="settings.wellnessError">
              {/* RN-only: the Swift write is a synchronous UserDefaults set; the
                  async database write can fail and the screen says so instead of
                  silently keeping a dead switch. */}
              <BannerNote text={model.wellnessWriteError} />
            </View>
          )}
        </View>
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

        <SectionHeader title="Your data" />
        <SettingsGroup>
          <Pressable
            accessibilityRole="button"
            testID="settings.row.export"
            disabled={!exportLoaded}
            onPress={() => void model.shareExport()}
          >
            <SettingsRow icon="square.and.arrow.up" label={settingsCopy.exportRowTitle} />
          </Pressable>
          {model.exportEmpty && (
            <View style={styles.exportRow} testID="settings.exportEmpty">
              <BannerNote
                text={`**${settingsCopy.exportEmptyTitle}.** ${settingsCopy.exportEmptyBody}`}
                variant="info"
                markdown
              />
            </View>
          )}
          {model.exportShare.kind === 'failed' && (
            <View style={styles.exportRow} testID="settings.exportError">
              <StateNote
                variant="error"
                text={`**${settingsCopy.exportFailedTitle}.** ${model.exportShare.reason}`}
              />
              {/* The frame's error code line (x-write-*). */}
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                {settingsCopy.exportFailedCode}
              </Text>
              <View style={styles.exportButtons}>
                <PrimaryButton
                  title={settingsCopy.exportRetry}
                  testID="settings.exportRetry"
                  action={() => void model.shareExport()}
                />
                {/* The contact path of settings.row.contact, which has no
                    action today and no support address exists in the app
                    (Swift included) — the button stays inert (findings). */}
                <SecondaryButton
                  title={settingsCopy.exportContact}
                  testID="settings.exportContact"
                />
              </View>
            </View>
          )}
          {model.exportShare.kind === 'cancelled' && (
            <View style={styles.exportRow} testID="settings.exportCancelled">
              {/* A cancelled share is not an error: the file stays, the row
                  offers "Share again" and "Done" (frame x-cancel). */}
              <BannerNote
                text={`**${settingsCopy.exportCancelledTitle}.** ${settingsCopy.exportCancelledBody}`}
                variant="info"
                markdown
              />
              <View style={styles.exportButtons}>
                <SecondaryButton
                  title={settingsCopy.exportShareAgain}
                  testID="settings.exportRetry"
                  action={() => void model.shareExport()}
                />
                <SecondaryButton
                  title={settingsCopy.exportDone}
                  testID="settings.exportDone"
                  action={() => model.dismissExportShare()}
                />
              </View>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            testID="settings.row.deleteAccount"
            onPress={() => setShowsDeleteConfirmation(true)}
          >
            <SettingsRow icon="trash" label={settingsCopy.deleteAccountConfirm} />
          </Pressable>
        </SettingsGroup>

        <SectionHeader title="Support" />
        <SettingsGroup>
          <Pressable accessibilityRole="button" testID="settings.row.help" onPress={() => undefined}>
            <SettingsRow icon="questionmark.circle" label={settingsCopy.supportRowTitle} />
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
  subscriptionButtons: {
    flexDirection: 'row',
    gap: space.sm,
  },
  /** The inert plan buttons read visibly disabled: dimmed and untouchable. */
  inertButton: { flex: 1, opacity: 0.5 },
  exportRow: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  exportButtons: {
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
