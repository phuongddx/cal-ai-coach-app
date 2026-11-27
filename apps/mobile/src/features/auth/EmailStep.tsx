/**
 * The e-mail step of sign-in: the look of frames 63 to 67 with the one-time code where the frames have
 * a password. Header "Email" with Back, the title, the labeled fields, the docked button above the home
 * indicator, one sentence once the code was requested, the error under the fields.
 *
 * Not drawn (findings/U-77b.md, "Deviations"): the Sign in / Create account segment, "Forgot password?",
 * the password notes under the dock and the reset-link screen. The code is one path for a new address and
 * a known one, and the API has no password creation and no reset route.
 *
 * The header is two controls and not `SheetHeader`: `SheetHeader` names its back button
 * `<testID>.back`, and the identifier of this one is `auth.emailBack`.
 */
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FillField, GlassIconButton, PrimaryButton, size, space, textStyles, typography, useTokens } from '../../design';
import { ErrorLine } from './ErrorLine';

export type EmailStepProps = {
  email: string;
  onChangeEmail: (value: string) => void;
  otpCode: string;
  onChangeOtpCode: (value: string) => void;
  otpSent: boolean;
  isBusy: boolean;
  errorMessage: string | null;
  onBack: () => void;
  onSendCode: () => void;
  onVerify: () => void;
};

export function EmailStep({
  email,
  onChangeEmail,
  otpCode,
  onChangeOtpCode,
  otpSent,
  isBusy,
  errorMessage,
  onBack,
  onSendCode,
  onVerify,
}: EmailStepProps) {
  const { colors } = useTokens();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
      <View style={styles.header}>
        <GlassIconButton icon="back" accessibilityLabel="Back" testID="auth.emailBack" onPress={onBack} />
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: typography.headline.fontSize,
            fontWeight: typography.headline.fontWeight,
            color: colors.text,
          }}
        >
          Email
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontSize: textStyles.title1.fontSize,
            fontWeight: textStyles.title1.fontWeight,
            lineHeight: textStyles.title1.lineHeight,
            color: colors.text,
          }}
        >
          Sign in with email
        </Text>

        <View style={styles.fields}>
          <FillField
            label="Email"
            testID="auth.emailField"
            accessibilityLabel="Email"
            placeholder="Email"
            keyboardType="email-address"
            value={email}
            onChangeText={onChangeEmail}
          />

          {otpSent ? (
            <>
              <Text
                testID="auth.codeSent"
                style={{
                  fontSize: typography.body.fontSize,
                  fontWeight: typography.body.fontWeight,
                  lineHeight: textStyles.body.lineHeight,
                  color: colors.text2,
                }}
              >
                We sent a code to <Text style={{ fontWeight: '700', color: colors.text }}>{email}</Text>.
              </Text>
              <FillField
                label="Code"
                testID="auth.otpField"
                accessibilityLabel="6-digit code"
                placeholder="6-digit code"
                keyboardType="number-pad"
                value={otpCode}
                onChangeText={onChangeOtpCode}
              />
            </>
          ) : null}
        </View>

        {errorMessage !== null ? <ErrorLine message={errorMessage} /> : null}
      </ScrollView>

      <View style={styles.dock}>
        {otpSent ? (
          <View testID="auth.verifyCode">
            <PrimaryButton title="Verify" disabled={isBusy} action={onVerify} />
          </View>
        ) : (
          <View testID="auth.sendCode">
            <PrimaryButton title="Send code" disabled={isBusy || email.length === 0} action={onSendCode} />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    minHeight: size.tap + space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  headerSpacer: { width: size.tap, height: size.tap },
  content: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xl, gap: space.lg },
  fields: { gap: space.lg },
  dock: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg },
});
