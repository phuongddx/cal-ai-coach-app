/**
 * The code step of sign-in (frames 112 and 113, the error on 114 and 115): Back, "Enter the code", the
 * sentence with the address in bold, the six cells of `CodeField` over one hidden one-time-code input, the
 * error line under the cells, the note about Junk, and the dock: "Verify" (enabled at six digits, never
 * submitted by itself), "Resend code in m:ss" and "Use a different email".
 *
 * `auth.otpField` is the hidden input, `auth.codeCells` wraps the six cells.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CodeField, codeLength, PrimaryButton, size, space, useTokens } from '../../design';
import { ErrorLine } from './ErrorLine';
import { StepFrame } from './StepFrame';
import { textStyle } from './textStyle';
import { formatCountdown } from './useResendCountdown';

export type CodeStepProps = {
  email: string;
  code: string;
  onChangeCode: (value: string) => void;
  isBusy: boolean;
  errorMessage: string | null;
  /** The six cells take the error border (the code was not accepted). */
  cellsError: boolean;
  /** Seconds until "Resend code" is available; 0 when it is. */
  secondsLeft: number;
  onBack: () => void;
  onVerify: () => void;
  onResend: () => void;
  onDifferentEmail: () => void;
};

export function CodeStep({
  email,
  code,
  onChangeCode,
  isBusy,
  errorMessage,
  cellsError,
  secondsLeft,
  onBack,
  onVerify,
  onResend,
  onDifferentEmail,
}: CodeStepProps) {
  const { colors, type } = useTokens();
  const counting = secondsLeft > 0;
  const resendLabel = counting ? `Resend code in ${formatCountdown(secondsLeft)}` : 'Resend code';
  const resendDisabled = counting || isBusy;
  return (
    <StepFrame
      title="Enter the code"
      subtitleTestID="auth.codeSent"
      subtitle={
        <>
          We sent a 6-digit code to{' '}
          <Text style={{ ...textStyle(type.headline), color: colors.text }}>{email}</Text>.
        </>
      }
      onBack={onBack}
      dock={
        <>
          <PrimaryButton
            testID="auth.verifyCode"
            title="Verify"
            disabled={isBusy || code.length < codeLength}
            action={onVerify}
          />
          <Pressable
            testID="auth.resendCode"
            accessibilityRole="button"
            accessibilityState={{ disabled: resendDisabled }}
            disabled={resendDisabled}
            onPress={onResend}
            style={styles.textButton}
          >
            <Text style={[textStyle(type.headline), { color: counting ? colors.text2 : colors.accentInk }]}>
              {resendLabel}
            </Text>
          </Pressable>
          <Pressable
            testID="auth.useDifferentEmail"
            accessibilityRole="button"
            onPress={onDifferentEmail}
            style={styles.textButton}
          >
            <Text style={[textStyle(type.headline), { color: colors.accentInk }]}>Use a different email</Text>
          </Pressable>
        </>
      }
    >
      <View testID="auth.codeCells">
        <CodeField testID="auth.otpField" value={code} onChangeText={onChangeCode} error={cellsError} autoFocus />
      </View>
      {errorMessage !== null ? <ErrorLine message={errorMessage} /> : null}
      <Text style={[textStyle(type.subheadline), { color: colors.text2 }]}>
        Can&apos;t find it? Look in Junk or Promotions.
      </Text>
    </StepFrame>
  );
}

const styles = StyleSheet.create({
  textButton: { minHeight: size.tap, alignItems: 'center', justifyContent: 'center' },
});
