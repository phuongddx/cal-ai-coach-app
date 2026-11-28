/**
 * AU-01: the sign-in screen (port of SignInView.swift), on Ember (frames 61 to 67 and 108 to 115). Three
 * ways in: Sign in with Apple, Continue with Google, and a one-time code sent to the e-mail. Three steps
 * of one screen: the entry step (`EntryStep`), the e-mail step (`EmailStep`, behind `auth.signInEmail`)
 * and the code step (`CodeStep`, after `requestCode` answered).
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
import type { Session } from '../../data/auth/types';
import { useTokens } from '../../design';
import { providerFailure, sendCodeFailure, verifyCodeFailure, type Failure } from './authCopy';
import { CodeStep } from './CodeStep';
import { EmailStep } from './EmailStep';
import { EntryStep } from './EntryStep';
import { useResendCountdown } from './useResendCountdown';

export type SignInScreenProps = {
  /** Called once with the stored session after any of the three sign-ins succeeds. */
  onSignedIn: (session: Session) => void;
  /** Injected in tests; defaults to the app's services. */
  services?: AuthServices;
  /** The clock of the resend cooldown, in milliseconds; injected in tests. Defaults to `Date.now`. */
  now?: () => number;
};

type Step = 'entry' | 'email' | 'code';

export function SignInScreen({ onSignedIn, services, now = Date.now }: SignInScreenProps) {
  const { colors } = useTokens();
  const auth = useRef<AuthServices | null>(services ?? null);
  const getServices = () => (auth.current ??= getAuthServices());

  const [step, setStep] = useState<Step>('entry');
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const busy = useRef(false);
  const { secondsLeft, start: startCountdown } = useResendCountdown(now);

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

  /** Runs one action under the busy state; shows the failure the mapper gives when it throws. */
  async function run(action: () => Promise<void>, toFailure: (error: unknown) => Failure) {
    if (busy.current) return;
    busy.current = true;
    setIsBusy(true);
    setFailure(null);
    try {
      await action();
    } catch (error) {
      setFailure(toFailure(error));
    } finally {
      busy.current = false;
      setIsBusy(false);
    }
  }

  const signedIn = (session: Session) => onSignedIn(session);

  /** Moving between the steps keeps the typed address and drops the old error. */
  function goTo(next: Step) {
    setFailure(null);
    setStep(next);
  }

  /** Asks for a code and starts the cooldown of Resend once the server accepted. */
  async function requestCode() {
    await getServices().requestCode(email);
    startCountdown();
  }

  const errorMessage = failure?.message ?? null;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.root, { backgroundColor: colors.background }]}>
      <View testID="auth.form" pointerEvents={isBusy ? 'none' : 'auto'} style={styles.form}>
        {step === 'entry' ? (
          <EntryStep
            appleAvailable={appleAvailable}
            isBusy={isBusy}
            errorMessage={errorMessage}
            onApple={() => void run(async () => signedIn(await getServices().signInWithApple()), providerFailure)}
            onGoogle={() => void run(async () => signedIn(await getServices().signInWithGoogle()), providerFailure)}
            onEmail={() => goTo('email')}
          />
        ) : null}
        {step === 'email' ? (
          <EmailStep
            email={email}
            onChangeEmail={(value) => {
              setEmail(value);
              setFailure(null);
            }}
            isBusy={isBusy}
            errorMessage={errorMessage}
            fieldError={failure?.target === 'field'}
            onBack={() => goTo('entry')}
            onSendCode={() =>
              void run(async () => {
                await requestCode();
                setOtpCode('');
                setStep('code');
              }, sendCodeFailure)
            }
          />
        ) : null}
        {step === 'code' ? (
          <CodeStep
            email={email}
            code={otpCode}
            onChangeCode={(value) => {
              setOtpCode(value);
              setFailure(null);
            }}
            isBusy={isBusy}
            errorMessage={errorMessage}
            cellsError={failure?.target === 'cells'}
            secondsLeft={secondsLeft}
            onBack={() => goTo('email')}
            onVerify={() =>
              void run(async () => signedIn(await getServices().verifyCode(email, otpCode)), verifyCodeFailure)
            }
            onResend={() => void run(requestCode, sendCodeFailure)}
            onDifferentEmail={() => goTo('email')}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  form: { flex: 1 },
});
