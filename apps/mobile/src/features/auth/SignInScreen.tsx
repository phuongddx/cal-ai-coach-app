/**
 * AU-01: the sign-in screen (port of SignInView.swift), on Ember (frames 61 to 67). Three ways in:
 * Sign in with Apple, Continue with Google, and a one-time code sent to the e-mail. Two steps of one
 * screen: the entry step (`EntryStep`) and the e-mail step (`EmailStep`, behind `auth.signInEmail`).
 *
 * The identifiers the XCUITests used stay: `auth.signInApple`, `auth.signInGoogle`, `auth.emailField`,
 * `auth.sendCode`, `auth.otpField`, `auth.verifyCode`, `auth.form`. One busy state disables the whole
 * form, whichever step is shown; one error line shows what went wrong.
 *
 * Props-driven: the route passes `onSignedIn`; the services default to the app's wiring and are
 * created on first render, so importing this file touches no native module.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAuthServices } from '../../data/auth';
import type { AuthServices } from '../../data/auth/authServices';
import { authErrorMessage, isAuthError, type Session } from '../../data/auth/types';
import { useTokens } from '../../design';
import { EmailStep } from './EmailStep';
import { EntryStep } from './EntryStep';

export type SignInScreenProps = {
  /** Called once with the stored session after any of the three sign-ins succeeds. */
  onSignedIn: (session: Session) => void;
  /** Injected in tests; defaults to the app's services. */
  services?: AuthServices;
};

type Step = 'entry' | 'email';

export function SignInScreen({ onSignedIn, services }: SignInScreenProps) {
  const { colors } = useTokens();
  const auth = useRef<AuthServices | null>(services ?? null);
  const getServices = () => (auth.current ??= getAuthServices());

  const [step, setStep] = useState<Step>('entry');
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

  /** Moving between the steps keeps what was typed and the requested code, and drops the old error. */
  function goTo(next: Step) {
    setErrorMessage(null);
    setStep(next);
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: colors.background }]}>
      <View testID="auth.form" pointerEvents={isBusy ? 'none' : 'auto'} style={styles.form}>
        {step === 'entry' ? (
          <EntryStep
            appleAvailable={appleAvailable}
            isBusy={isBusy}
            errorMessage={errorMessage}
            onApple={() => void run(async () => signedIn(await getServices().signInWithApple()))}
            onGoogle={() => void run(async () => signedIn(await getServices().signInWithGoogle()))}
            onEmail={() => goTo('email')}
          />
        ) : (
          <EmailStep
            email={email}
            onChangeEmail={setEmail}
            otpCode={otpCode}
            onChangeOtpCode={setOtpCode}
            otpSent={otpSent}
            isBusy={isBusy}
            errorMessage={errorMessage}
            onBack={() => goTo('entry')}
            onSendCode={() =>
              void run(async () => {
                await getServices().requestCode(email);
                setOtpSent(true);
              })
            }
            onVerify={() => void run(async () => signedIn(await getServices().verifyCode(email, otpCode)))}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  form: { flex: 1 },
});
