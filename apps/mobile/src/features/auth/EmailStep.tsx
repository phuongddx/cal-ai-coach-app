/**
 * The e-mail step of sign-in (frames 108 and 109, the error on 110 and 111): Back, "Continue with email"
 * and its subtitle, the "Email" field on `FillField` (text variant, focus ring, error border), the error
 * line under the field, and "Send code" docked above the home indicator.
 *
 * Not drawn (findings/U-77b.md, "Deviations"): the Sign in / Create account segment, "Forgot password?",
 * the password notes and the reset-link screen. The code is one path for a new address and a known one.
 *
 * The field does not take the focus on its own: `FillField` has no `autoFocus` (findings/U-77c.md, "Needs a
 * design component"); the frame draws it focused.
 */
import { PrimaryButton, FillField } from '../../design';
import { ErrorLine } from './ErrorLine';
import { StepFrame } from './StepFrame';

export type EmailStepProps = {
  email: string;
  onChangeEmail: (value: string) => void;
  isBusy: boolean;
  /** The error under the field, and whether the field border turns to the error color. */
  errorMessage: string | null;
  fieldError: boolean;
  onBack: () => void;
  onSendCode: () => void;
};

export function EmailStep({
  email,
  onChangeEmail,
  isBusy,
  errorMessage,
  fieldError,
  onBack,
  onSendCode,
}: EmailStepProps) {
  return (
    <StepFrame
      title="Continue with email"
      subtitle="We'll email you a 6-digit code. If you're new, the same code creates your account."
      onBack={onBack}
      dock={
        <PrimaryButton
          testID="auth.sendCode"
          title="Send code"
          disabled={isBusy || email.length === 0}
          action={onSendCode}
        />
      }
    >
      <FillField
        testID="auth.emailField"
        label="Email"
        accessibilityLabel="Email"
        placeholder="Email"
        variant="text"
        value={email}
        onChangeText={onChangeEmail}
        error={fieldError}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
      />
      {errorMessage !== null ? <ErrorLine message={errorMessage} /> : null}
    </StepFrame>
  );
}
