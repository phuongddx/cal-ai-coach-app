/**
 * AU-01: the sign-in screen (port of SignInView.swift). Three entry points (Sign in with Apple,
 * Continue with Google, e-mail one-time code) behind the same identifiers the XCUITests used:
 * `auth.signInApple`, `auth.signInGoogle`, `auth.emailField`, `auth.sendCode`, `auth.otpField`,
 * `auth.verifyCode`. One busy state disables the whole form; one error line shows what went wrong.
 *
 * Props-driven: the route passes `onSignedIn`; the services default to the app's wiring and are
 * created on first render, so importing this file touches no native module.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { getAuthServices } from '../../data/auth';
import type { AuthServices } from '../../data/auth/authServices';
import { authErrorMessage, isAuthError, type Session } from '../../data/auth/types';
import { PrimaryButton, radius, SecondaryButton, space, typography, useTokens } from '../../design';

export type SignInScreenProps = {
  /** Called once with the stored session after any of the three sign-ins succeeds. */
  onSignedIn: (session: Session) => void;
  /** Injected in tests; defaults to the app's services. */
  services?: AuthServices;
};

const APPLE_BUTTON_HEIGHT = 44;

export function SignInScreen({ onSignedIn, services }: SignInScreenProps) {
  const { colors } = useTokens();
  const auth = useRef<AuthServices | null>(services ?? null);
  const getServices = () => (auth.current ??= getAuthServices());

  const [appleAvailable, setAppleAvailable] = useState(false);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    getServices()
      .appleAvailable()
      .then((available) => live && setAppleAvailable(available))
      .catch(() => live && setAppleAvailable(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- probe once on mount
  }, []);

  /** Runs one action under the busy state; shows the error line when it throws. */
  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await action();
    } catch (error) {
      setErrorMessage(isAuthError(error) ? authErrorMessage(error) : 'Sign-in failed. Please try again.');
    } finally {
      busy.current = false;
      setIsBusy(false);
    }
  }

  const signedIn = (session: Session) => onSignedIn(session);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        testID="auth.form"
        pointerEvents={isBusy ? 'none' : 'auto'}
        style={styles.form}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>Sign in to CoachCal</Text>

        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            testID="auth.signInApple"
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={radius.md}
            style={styles.apple}
            onPress={() => void run(async () => signedIn(await getServices().signInWithApple()))}
          />
        ) : null}

        <View testID="auth.signInGoogle">
          <SecondaryButton
            title="Continue with Google"
            bordered
            action={() => void run(async () => signedIn(await getServices().signInWithGoogle()))}
          />
        </View>

        <View style={styles.emailBlock}>
          <TextInput
            testID="auth.emailField"
            accessibilityLabel="Email"
            placeholder="Email"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.card, borderColor: colors.border }]}
          />

          {otpSent ? (
            <>
              <TextInput
                testID="auth.otpField"
                accessibilityLabel="6-digit code"
                placeholder="6-digit code"
                placeholderTextColor={colors.textTertiary}
                value={otpCode}
                onChangeText={setOtpCode}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.card, borderColor: colors.border }]}
              />
              <View testID="auth.verifyCode">
                <PrimaryButton
                  title="Verify"
                  disabled={isBusy}
                  action={() => void run(async () => signedIn(await getServices().verifyCode(email, otpCode)))}
                />
              </View>
            </>
          ) : (
            <View testID="auth.sendCode">
              <PrimaryButton
                title="Send code"
                disabled={isBusy || email.length === 0}
                action={() =>
                  void run(async () => {
                    await getServices().requestCode(email);
                    setOtpSent(true);
                  })
                }
              />
            </View>
          )}
        </View>

        {errorMessage !== null ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>
            {errorMessage}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  form: { padding: space.xl2, gap: space.xl2 },
  title: { ...typography.heading, textAlign: 'center' },
  apple: { height: APPLE_BUTTON_HEIGHT, width: '100%' },
  emailBlock: { gap: space.md },
  input: {
    ...typography.body,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  error: { ...typography.footnote, textAlign: 'center' },
});
