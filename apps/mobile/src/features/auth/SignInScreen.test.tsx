/**
 * RNTL twin of SignInFlowTests (native/App/CoachCalUITests/SignInFlowTests.swift) plus the error and
 * busy states of SignInView.swift. The services are injected, so no native module is involved.
 *
 * Dual-react preamble: jest-expo pins `react-native` but not `react`; app-side requests are re-pointed
 * onto the renderer's copy. See findings/U-22.md.
 */
jest.mock('react', () => {
  const rnPath: string = (require as unknown as { resolve: (id: string) => string }).resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react`);
});
jest.mock('react/jsx-runtime', () => {
  const rnPath: string = (require as unknown as { resolve: (id: string) => string }).resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react/jsx-runtime`);
});

import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, textStyles } from '../../design';
import type { AuthServices } from '../../data/auth/authServices';
import type { AuthError, Session } from '../../data/auth/types';
import { SignInScreen } from './SignInScreen';

const session: Session = {
  user: { id: '26277672-8328-4b1a-9b77-c2da2631f63c', email: 'phuong@example.com', providers: ['email'] },
  tokens: { accessToken: 'a', refreshToken: 'r', expiresAt: '2099-01-01T00:00:00.000Z' },
};

function makeServices(overrides: Partial<AuthServices> = {}): jest.Mocked<AuthServices> {
  return {
    appleAvailable: jest.fn(async () => true),
    signInWithApple: jest.fn(async () => session),
    signInWithGoogle: jest.fn(async () => session),
    requestCode: jest.fn(async () => undefined),
    verifyCode: jest.fn(async () => session),
    signOut: jest.fn(async () => undefined),
    ...overrides,
  } as jest.Mocked<AuthServices>;
}

const authError = (kind: AuthError['kind'], extra: Record<string, unknown> = {}) =>
  ({ name: 'AuthError', kind, ...extra }) as unknown as AuthError;

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

beforeEach(() => {
  mockUseColorScheme.mockReturnValue('light');
});

/** One tap on "Continue with email": the e-mail step replaces the entry step. */
async function openEmailStep() {
  await userEvent.press(screen.getByTestId('auth.signInEmail'));
  await screen.findByTestId('auth.emailField');
}

async function renderScreen(services = makeServices(), onSignedIn = jest.fn()) {
  await render(<SignInScreen services={services} onSignedIn={onSignedIn} />);
  // let the Apple availability probe settle
  await waitFor(() => expect(services.appleAvailable).toHaveBeenCalled());
  return { services, onSignedIn };
}

describe('sign in screen', () => {
  // SignInFlowTests.testSignInEntryPointsAreReachable
  it('the sign in entry points are reachable', async () => {
    await renderScreen();
    expect(screen.getByText('Sign in to keep your diary safe')).toBeOnTheScreen();
    expect(await screen.findByTestId('auth.signInApple')).toBeOnTheScreen();
    expect(screen.getByTestId('auth.signInGoogle')).toBeOnTheScreen();
    expect(screen.getByText('Continue with Google')).toBeOnTheScreen();
    expect(screen.getByTestId('auth.signInEmail')).toBeOnTheScreen();
    expect(screen.getByText('Continue with email')).toBeOnTheScreen();
    // the e-mail field is one tap deeper
    expect(screen.queryByTestId('auth.emailField')).toBeNull();
    await userEvent.press(screen.getByTestId('auth.signInEmail'));
    expect(await screen.findByTestId('auth.emailField')).toBeOnTheScreen();
    expect(screen.getByPlaceholderText('Email')).toBeOnTheScreen();
    expect(screen.getByTestId('auth.sendCode')).toBeOnTheScreen();
    expect(screen.getByText('Send code')).toBeOnTheScreen();
  });

  // SignInFlowTests.testTappingAppleStartsTheAppleFlow (the system sheet is expo-apple-authentication's)
  it('tapping Apple starts the Apple sign in and hands the session on', async () => {
    const { services, onSignedIn } = await renderScreen();
    fireEvent(await screen.findByTestId('auth.signInApple'), 'press');
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(session));
    expect(services.signInWithApple).toHaveBeenCalledTimes(1);
  });

  it('the Apple button is not shown when Apple sign in is not available', async () => {
    await renderScreen(makeServices({ appleAvailable: jest.fn(async () => false) }));
    expect(screen.queryByTestId('auth.signInApple')).toBeNull();
    expect(screen.getByTestId('auth.signInGoogle')).toBeOnTheScreen();
  });

  it('Continue with Google signs in', async () => {
    const { services, onSignedIn } = await renderScreen();
    await userEvent.press(screen.getByText('Continue with Google'));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(session));
    expect(services.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('Send code is disabled while the email is empty', async () => {
    const { services } = await renderScreen();
    await openEmailStep();
    await userEvent.press(screen.getByText('Send code'));
    expect(services.requestCode).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send code' }).props.accessibilityState.disabled).toBe(true);
  });

  it('sending the code reveals the code field and Verify', async () => {
    const { services } = await renderScreen();
    await openEmailStep();
    expect(screen.queryByTestId('auth.otpField')).toBeNull();
    await userEvent.type(screen.getByTestId('auth.emailField'), 'phuong@example.com');
    await userEvent.press(screen.getByText('Send code'));

    expect(services.requestCode).toHaveBeenCalledWith('phuong@example.com');
    expect(await screen.findByTestId('auth.otpField')).toBeOnTheScreen();
    expect(screen.getByLabelText('6-digit code')).toBeOnTheScreen();
    expect(screen.getByTestId('auth.verifyCode')).toBeOnTheScreen();
    expect(screen.getByText('Verify')).toBeOnTheScreen();
    expect(screen.queryByText('Send code')).toBeNull();
  });

  it('verifying the code signs in with the e-mail and the code', async () => {
    const { services, onSignedIn } = await renderScreen();
    await openEmailStep();
    await userEvent.type(screen.getByTestId('auth.emailField'), 'phuong@example.com');
    await userEvent.press(screen.getByText('Send code'));
    await userEvent.type(await screen.findByTestId('auth.otpField'), '123456');
    await userEvent.press(screen.getByText('Verify'));

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(session));
    expect(services.verifyCode).toHaveBeenCalledWith('phuong@example.com', '123456');
  });

  it('shows one error line when sending the code fails and keeps Send code available', async () => {
    const requestCode = jest.fn(async () => {
      throw authError('network');
    });
    await renderScreen(makeServices({ requestCode }));
    await openEmailStep();
    await userEvent.type(screen.getByTestId('auth.emailField'), 'phuong@example.com');
    await userEvent.press(screen.getByText('Send code'));

    expect(await screen.findByText('Could not reach CoachCal. Check your connection and try again.')).toBeOnTheScreen();
    expect(screen.getByText('Send code')).toBeOnTheScreen();
    expect(screen.queryByTestId('auth.otpField')).toBeNull();
  });

  it('shows the error when the code is not accepted and does not sign in', async () => {
    const verifyCode = jest.fn(async () => {
      throw authError('envelope', { status: 401, code: 'UNAUTHORIZED' });
    });
    const { onSignedIn } = await renderScreen(makeServices({ verifyCode }));
    await openEmailStep();
    await userEvent.type(screen.getByTestId('auth.emailField'), 'phuong@example.com');
    await userEvent.press(screen.getByText('Send code'));
    await userEvent.type(await screen.findByTestId('auth.otpField'), '000000');
    await userEvent.press(screen.getByText('Verify'));

    expect(
      await screen.findByText('That code is wrong or has expired. Check the latest email, or send a new code.'),
    ).toBeOnTheScreen();
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('shows the error when Apple returns no usable credential', async () => {
    const signInWithApple = jest.fn(async () => {
      throw authError('incompleteCredential');
    });
    await renderScreen(makeServices({ signInWithApple }));
    fireEvent(await screen.findByTestId('auth.signInApple'), 'press');
    expect(await screen.findByText('Sign-in did not return a usable credential. Please try again.')).toBeOnTheScreen();
  });

  it('shows the error when Google sign in is cancelled', async () => {
    const signInWithGoogle = jest.fn(async () => {
      throw authError('cancelled');
    });
    await renderScreen(makeServices({ signInWithGoogle }));
    await userEvent.press(screen.getByText('Continue with Google'));
    expect(await screen.findByText('Sign-in was cancelled.')).toBeOnTheScreen();
  });

  it('clears the previous error when a new attempt starts', async () => {
    const signInWithGoogle = jest
      .fn<Promise<Session>, []>()
      .mockRejectedValueOnce(authError('cancelled'))
      .mockResolvedValueOnce(session);
    const { onSignedIn } = await renderScreen(makeServices({ signInWithGoogle }));
    await userEvent.press(screen.getByText('Continue with Google'));
    expect(await screen.findByText('Sign-in was cancelled.')).toBeOnTheScreen();
    await userEvent.press(screen.getByText('Continue with Google'));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(screen.queryByText('Sign-in was cancelled.')).toBeNull();
  });

  it('is busy while a sign in runs: the form is disabled and a second tap does nothing', async () => {
    let finish: (value: Session) => void = () => undefined;
    const signInWithGoogle = jest.fn(() => new Promise<Session>((resolve) => (finish = resolve)));
    const { onSignedIn } = await renderScreen(makeServices({ signInWithGoogle }));

    await userEvent.press(screen.getByText('Continue with Google'));
    await waitFor(() => expect(screen.getByTestId('auth.form').props.pointerEvents).toBe('none'));
    // the e-mail entry point is one tap away on this step; Send code lives on the next one
    expect(screen.getByRole('button', { name: 'Continue with email' }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByText('Continue with Google'));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);

    finish(session);
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(session));
    await waitFor(() => expect(screen.getByTestId('auth.form').props.pointerEvents).toBe('auto'));
  });
});

describe('sign in screen on Ember', () => {
  it('the Apple button is black in the light scheme and takes the white style in the dark scheme', async () => {
    const ButtonStyle = AppleAuthentication.AppleAuthenticationButtonStyle;
    await renderScreen();
    expect((await screen.findByTestId('auth.signInApple')).props.buttonStyle).toBe(ButtonStyle.BLACK);
    await screen.unmount();

    mockUseColorScheme.mockReturnValue('dark');
    await renderScreen();
    expect((await screen.findByTestId('auth.signInApple')).props.buttonStyle).toBe(ButtonStyle.WHITE);
    expect(screen.getByTestId('auth.signInApple').props.buttonType).toBe(
      AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN,
    );
  });

  it('the entry step draws the tile, the subtitle, the shield line and the "or" divider, and not the lock line', async () => {
    await renderScreen();
    expect(screen.getByTestId('auth.tile')).toBeOnTheScreen();
    expect(
      screen.getByText('Your meals, weight and streaks are backed up and stay in sync on your other devices.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('We never post anywhere or read your contacts.')).toBeOnTheScreen();
    expect(screen.getByTestId('icon:shield')).toBeOnTheScreen();
    // The divider is decoration for assistive tech (hidden from it), so the query includes hidden elements.
    expect(screen.getByText('or', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByText(/never to train models/)).toBeNull();
    expect(screen.queryByTestId('icon:lock')).toBeNull();
    expect(screen.queryByText(/Terms/)).toBeNull();
  });

  it('the e-mail step has the header Email with Back, the title and the labeled field, and no Apple or Google button', async () => {
    await renderScreen();
    await openEmailStep();
    expect(screen.getByRole('header', { name: 'Continue with email' })).toBeOnTheScreen();
    expect(screen.getByTestId('auth.emailBack')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Back' })).toBeOnTheScreen();
    expect(screen.getByText("We'll email you a 6-digit code. If you're new, the same code creates your account.")).toBeOnTheScreen();
    expect(screen.getByTestId('auth.emailField.label')).toBeOnTheScreen();
    expect(screen.getByLabelText('Email')).toBeOnTheScreen();
    expect(screen.queryByTestId('auth.signInApple')).toBeNull();
    expect(screen.queryByTestId('auth.signInGoogle')).toBeNull();
    expect(screen.queryByTestId('auth.signInEmail')).toBeNull();
    expect(screen.queryByText('Sign in to keep your diary safe')).toBeNull();
  });

  it('the e-mail field keeps the keyboard props of the old screen and the placeholder', async () => {
    await renderScreen();
    await openEmailStep();
    const field = screen.getByTestId('auth.emailField');
    expect(field).toHaveProp('autoCapitalize', 'none');
    expect(field).toHaveProp('autoCorrect', false);
    expect(field).toHaveProp('keyboardType', 'email-address');
    expect(field).toHaveProp('textContentType', 'emailAddress');
    expect(field).toHaveProp('autoComplete', 'email');
    expect(field).toHaveProp('placeholder', 'Email');
    expect(field).toHaveProp('accessibilityLabel', 'Email');
  });

  it('the code field keeps number-pad and the one-time-code autofill, and the placeholder', async () => {
    await renderScreen();
    await openEmailStep();
    await userEvent.type(screen.getByTestId('auth.emailField'), 'phuong@example.com');
    await userEvent.press(screen.getByText('Send code'));
    const field = await screen.findByTestId('auth.otpField');
    expect(field).toHaveProp('keyboardType', 'number-pad');
    expect(field).toHaveProp('textContentType', 'oneTimeCode');
    expect(field).toHaveProp('autoComplete', 'one-time-code');
    expect(field).toHaveProp('accessibilityLabel', '6-digit code');
  });

  it('the Apple button has the corners of the frame, 14 pt (radius.md)', async () => {
    await renderScreen();
    expect(await screen.findByTestId('auth.signInApple')).toHaveProp('cornerRadius', 14);
  });

  it('the e-mail step has no password, segment or reset-link controls', async () => {
    await renderScreen();
    await openEmailStep();
    expect(screen.queryByText('Forgot password?')).toBeNull();
    expect(screen.queryByText('Create account')).toBeNull();
    expect(screen.queryByText(/password/i)).toBeNull();
  });

  it('Back returns to the entry step and keeps the typed e-mail', async () => {
    await renderScreen();
    await openEmailStep();
    await userEvent.type(screen.getByTestId('auth.emailField'), 'phuong@example.com');
    await userEvent.press(screen.getByTestId('auth.emailBack'));

    expect(screen.getByText('Sign in to keep your diary safe')).toBeOnTheScreen();
    expect(screen.getByTestId('auth.signInEmail')).toBeOnTheScreen();
    expect(screen.queryByTestId('auth.emailField')).toBeNull();

    await userEvent.press(screen.getByTestId('auth.signInEmail'));
    expect((await screen.findByTestId('auth.emailField')).props.value).toBe('phuong@example.com');
  });

  it('after the code is requested one sentence says where it was sent and the e-mail field stays', async () => {
    await renderScreen();
    await openEmailStep();
    expect(screen.queryByText(/We sent a 6-digit code to/)).toBeNull();
    await userEvent.type(screen.getByTestId('auth.emailField'), 'phuong@example.com');
    await userEvent.press(screen.getByText('Send code'));

    // The code step (frames 112 and 113) puts the address in the sentence instead of a field.
    expect(await screen.findByTestId('auth.otpField')).toBeOnTheScreen();
    const sentence = screen.getByTestId('auth.codeSent');
    expect(sentence).toHaveTextContent('We sent a 6-digit code to phuong@example.com.');
    expect(screen.getByText('phuong@example.com').props.style).toEqual(
      expect.objectContaining({ fontWeight: textStyles.headline.fontWeight }),
    );
    expect(screen.queryByTestId('auth.emailField')).toBeNull();
    expect(screen.getByLabelText('6-digit code')).toBeOnTheScreen();
  });

  it('the error under the field is announced as an alert with the alert icon, in the error ink', async () => {
    const requestCode = jest.fn(async () => {
      throw authError('network');
    });
    await renderScreen(makeServices({ requestCode }));
    await openEmailStep();
    await userEvent.type(screen.getByTestId('auth.emailField'), 'phuong@example.com');
    await userEvent.press(screen.getByText('Send code'));

    const line = await screen.findByText('Could not reach CoachCal. Check your connection and try again.');
    expect(line.props.accessibilityRole).toBe('alert');
    expect(line.props.style).toEqual(expect.objectContaining({ color: lightColors.errorInk }));
    expect(screen.getByTestId('icon:alert')).toBeOnTheScreen();
  });

  it('an error from Google shows on the entry step and the next step starts without it', async () => {
    const signInWithGoogle = jest.fn(async () => {
      throw authError('cancelled');
    });
    await renderScreen(makeServices({ signInWithGoogle }));
    await userEvent.press(screen.getByText('Continue with Google'));
    expect(await screen.findByText('Sign-in was cancelled.')).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('auth.signInEmail'));
    await screen.findByTestId('auth.emailField');
    expect(screen.queryByText('Sign-in was cancelled.')).toBeNull();
  });

  it('colors follow the scheme: the dark title and the dark error ink', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    const requestCode = jest.fn(async () => {
      throw authError('network');
    });
    await renderScreen(makeServices({ requestCode }));
    expect(screen.getByText('Sign in to keep your diary safe').props.style).toEqual(
      expect.objectContaining({ color: darkColors.text }),
    );
    await openEmailStep();
    await userEvent.type(screen.getByTestId('auth.emailField'), 'phuong@example.com');
    await userEvent.press(screen.getByText('Send code'));
    const line = await screen.findByText('Could not reach CoachCal. Check your connection and try again.');
    expect(line.props.style).toEqual(expect.objectContaining({ color: darkColors.errorInk }));
  });

  it('the busy state still disables the e-mail step as a whole', async () => {
    let finish: () => void = () => undefined;
    const requestCode = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    await renderScreen(makeServices({ requestCode }));
    await openEmailStep();
    await userEvent.type(screen.getByTestId('auth.emailField'), 'phuong@example.com');
    await userEvent.press(screen.getByText('Send code'));
    await waitFor(() => expect(screen.getByTestId('auth.form').props.pointerEvents).toBe('none'));
    expect(screen.getByRole('button', { name: 'Send code' }).props.accessibilityState.disabled).toBe(true);
    finish();
    await waitFor(() => expect(screen.getByTestId('auth.form').props.pointerEvents).toBe('auto'));
  });
});

const sendErrorLine = "We couldn't send the code. Check the address and try again.";
const wrongCodeLine = 'That code is wrong or has expired. Check the latest email, or send a new code.';
const junkNote = "Can't find it? Look in Junk or Promotions.";

describe('sign in screen, the entry step (frames 61 and 62)', () => {
  it('Continue with email takes the leading mail icon and Google keeps no mark', async () => {
    await renderScreen();
    const email = screen.getByTestId('auth.signInEmail');
    expect(email).toHaveTextContent('Continue with email');
    expect(screen.getByTestId('icon:mail')).toBeOnTheScreen();
    expect(screen.getAllByTestId(/^icon:/).map((node) => node.props.testID)).not.toContain('icon:google');
    expect(screen.getByTestId('auth.signInGoogle')).toHaveTextContent('Continue with Google');
  });

  it('the word "or" and the address in bold use text styles of the design system', async () => {
    await renderScreen();
    expect(screen.getByText('or', { includeHiddenElements: true }).props.style).toEqual(
      expect.objectContaining({ fontSize: textStyles.footnote.fontSize, fontWeight: textStyles.footnote.fontWeight }),
    );
  });
});

describe('sign in screen, the e-mail step (frames 108 to 111)', () => {
  async function typeEmail(value = 'minh@example.com') {
    await openEmailStep();
    await userEvent.type(screen.getByTestId('auth.emailField'), value);
  }

  it('draws the title, the subtitle, the labeled field and the docked Send code of the frame', async () => {
    await renderScreen();
    await openEmailStep();
    expect(screen.getByRole('header', { name: 'Continue with email' })).toBeOnTheScreen();
    expect(screen.getByText("We'll email you a 6-digit code. If you're new, the same code creates your account.")).toBeOnTheScreen();
    expect(screen.getByTestId('auth.emailField.label')).toHaveTextContent('Email');
    expect(screen.getByTestId('auth.emailBack')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Send code' })).toBeOnTheScreen();
  });

  it('the field is the text variant of FillField: 17 over the whole box, with the focus ring', async () => {
    await renderScreen();
    await openEmailStep();
    const field = screen.getByTestId('auth.emailField');
    expect(field).toHaveStyle({ fontSize: textStyles.body.fontSize, flex: 1 });
    expect(screen.queryByTestId('auth.emailField.ring')).toBeNull();
    await fireEvent(field, 'focus');
    expect(screen.getByTestId('auth.emailField.ring')).toHaveStyle({ borderColor: lightColors.accent });
  });

  it('Send code is enabled once the address is typed and runs requestCode once per tap', async () => {
    const { services } = await renderScreen();
    await typeEmail();
    expect(screen.getByRole('button', { name: 'Send code' }).props.accessibilityState.disabled).toBe(false);
    await userEvent.press(screen.getByText('Send code'));
    expect(services.requestCode).toHaveBeenCalledTimes(1);
    expect(services.requestCode).toHaveBeenCalledWith('minh@example.com');
  });

  it.each([
    ['a rejected address (400)', authError('envelope', { status: 400, code: 'VALIDATION_ERROR' })],
    ['the rate limit of the server (429)', authError('envelope', { status: 429, code: 'VALIDATION_ERROR' })],
    ['a delivery failure (503)', authError('envelope', { status: 503, code: 'UPSTREAM_ERROR' })],
    ['an address the client rejects', authError('invalidInput', { message: 'Enter a valid e-mail.', issues: [] })],
  ])('the code could not be sent (%s): the field border in error and the line of frame 110', async (_name, error) => {
    const requestCode = jest.fn(async () => {
      throw error;
    });
    await renderScreen(makeServices({ requestCode }));
    await typeEmail();
    await userEvent.press(screen.getByText('Send code'));

    const line = await screen.findByText(sendErrorLine);
    expect(line.props.accessibilityRole).toBe('alert');
    expect(line.props.style).toEqual(expect.objectContaining({ color: lightColors.errorInk }));
    expect(screen.getByTestId('auth.emailField.ring')).toHaveStyle({ borderColor: lightColors.error });
    expect(screen.getByRole('button', { name: 'Send code' }).props.accessibilityState.disabled).toBe(false);
    expect(screen.queryByTestId('auth.otpField')).toBeNull();
  });

  it('an error that maps to neither line keeps the message of the service and leaves the field alone', async () => {
    const requestCode = jest.fn(async () => {
      throw authError('network');
    });
    await renderScreen(makeServices({ requestCode }));
    await typeEmail();
    await userEvent.press(screen.getByText('Send code'));
    expect(await screen.findByText('Could not reach CoachCal. Check your connection and try again.')).toBeOnTheScreen();
    expect(screen.queryByText(sendErrorLine)).toBeNull();
    expect(screen.queryByTestId('auth.emailField.ring')).toBeNull();
  });

  it('typing in the field clears the error line and the error border', async () => {
    const requestCode = jest.fn(async () => {
      throw authError('envelope', { status: 400, code: 'VALIDATION_ERROR' });
    });
    await renderScreen(makeServices({ requestCode }));
    await typeEmail();
    await userEvent.press(screen.getByText('Send code'));
    await screen.findByText(sendErrorLine);
    await userEvent.type(screen.getByTestId('auth.emailField'), 'm');
    expect(screen.queryByText(sendErrorLine)).toBeNull();
    expect(screen.queryByTestId('auth.emailField.ring')).toBeNull();
  });

  it('the error border follows the scheme: the dark error token', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    const requestCode = jest.fn(async () => {
      throw authError('envelope', { status: 400, code: 'VALIDATION_ERROR' });
    });
    await renderScreen(makeServices({ requestCode }));
    await typeEmail();
    await userEvent.press(screen.getByText('Send code'));
    await screen.findByText(sendErrorLine);
    expect(screen.getByTestId('auth.emailField.ring')).toHaveStyle({ borderColor: darkColors.error });
  });
});

describe('sign in screen, the code step (frames 112 to 115)', () => {
  const address = 'minh@example.com';

  afterEach(() => {
    jest.useRealTimers();
  });

  /** Renders under fake timers with an injected clock and walks to the code step with `fireEvent`. */
  async function toCodeStep(services = makeServices(), onSignedIn = jest.fn()) {
    jest.useFakeTimers();
    const clock = { now: 1_000_000 };
    await render(<SignInScreen services={services} onSignedIn={onSignedIn} now={() => clock.now} />);
    await waitFor(() => expect(services.appleAvailable).toHaveBeenCalled());
    await fireEvent.press(screen.getByTestId('auth.signInEmail'));
    await fireEvent.changeText(await screen.findByTestId('auth.emailField'), address);
    await fireEvent.press(screen.getByText('Send code'));
    await screen.findByTestId('auth.otpField');
    const advance = async (seconds: number) => {
      clock.now += seconds * 1000;
      await act(async () => {
        jest.advanceTimersByTime(seconds * 1000);
      });
    };
    return { services, onSignedIn, advance };
  }

  const typeCode = (value: string) => fireEvent.changeText(screen.getByTestId('auth.otpField'), value);
  const verifyDisabled = () => screen.getByRole('button', { name: 'Verify' }).props.accessibilityState.disabled;

  it('draws the title, the sentence with the address in bold, the six cells and the note of the frame', async () => {
    await toCodeStep();
    expect(screen.getByRole('header', { name: 'Enter the code' })).toBeOnTheScreen();
    expect(screen.getByTestId('auth.codeSent')).toHaveTextContent(`We sent a 6-digit code to ${address}.`);
    expect(screen.getByText(address).props.style).toEqual(
      expect.objectContaining({ fontWeight: textStyles.headline.fontWeight, color: lightColors.text }),
    );
    expect(screen.getByTestId('auth.codeCells')).toBeOnTheScreen();
    for (const index of [0, 1, 2, 3, 4, 5]) {
      expect(screen.getByTestId(`auth.otpField.cell.${index}`, { includeHiddenElements: true })).toBeOnTheScreen();
    }
    expect(screen.getByLabelText('6-digit code')).toBeOnTheScreen();
    expect(screen.getByText(junkNote)).toBeOnTheScreen();
    expect(screen.getByTestId('auth.emailBack')).toBeOnTheScreen();
    expect(screen.queryByTestId('auth.emailField')).toBeNull();
  });

  it('the code field takes the focus when the step opens', async () => {
    await toCodeStep();
    expect(screen.getByTestId('auth.otpField')).toHaveProp('autoFocus', true);
  });

  it('Verify is disabled at five digits and enabled at six', async () => {
    await toCodeStep();
    expect(verifyDisabled()).toBe(true);
    await typeCode('48291');
    expect(verifyDisabled()).toBe(true);
    await typeCode('482917');
    expect(verifyDisabled()).toBe(false);
  });

  it('a code of more than six digits is cut to six', async () => {
    await toCodeStep();
    await typeCode('4829171');
    expect(screen.getByTestId('auth.otpField').props.value).toBe('482917');
    await typeCode('482 917 55');
    expect(screen.getByTestId('auth.otpField').props.value).toBe('482917');
  });

  it('nothing submits when the sixth digit lands, and Verify runs verifyCode once with the address and the code', async () => {
    const { services, onSignedIn } = await toCodeStep();
    await typeCode('482917');
    expect(services.verifyCode).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Verify'));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1));
    expect(services.verifyCode).toHaveBeenCalledTimes(1);
    expect(services.verifyCode).toHaveBeenCalledWith(address, '482917');
    expect(onSignedIn).toHaveBeenCalledWith(session);
  });

  it('Resend code counts down from 60 seconds and is disabled until it reaches zero', async () => {
    const { services, advance } = await toCodeStep();
    const resend = () => screen.getByTestId('auth.resendCode');
    expect(resend()).toHaveTextContent('Resend code in 1:00');
    expect(resend().props.accessibilityState.disabled).toBe(true);
    await advance(18);
    expect(resend()).toHaveTextContent('Resend code in 0:42');
    await advance(41);
    expect(resend()).toHaveTextContent('Resend code in 0:01');
    expect(resend().props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(resend());
    expect(services.requestCode).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(resend()).toHaveTextContent('Resend code');
    expect(screen.queryByText(/Resend code in/)).toBeNull();
    expect(resend().props.accessibilityState.disabled).toBe(false);
  });

  it('a tap on Resend code at zero calls requestCode once more with the same address and starts the 60 seconds again', async () => {
    const { services, advance } = await toCodeStep();
    await advance(60);
    await fireEvent.press(screen.getByTestId('auth.resendCode'));
    await waitFor(() => expect(services.requestCode).toHaveBeenCalledTimes(2));
    expect(services.requestCode).toHaveBeenLastCalledWith(address);
    await waitFor(() => expect(screen.getByTestId('auth.resendCode')).toHaveTextContent('Resend code in 1:00'));
    expect(screen.getByTestId('auth.resendCode').props.accessibilityState.disabled).toBe(true);
  });

  it('Back on the code step returns to the e-mail step and keeps the address, Back again to the entry step', async () => {
    await toCodeStep();
    await fireEvent.press(screen.getByTestId('auth.emailBack'));
    expect((await screen.findByTestId('auth.emailField')).props.value).toBe(address);
    expect(screen.queryByTestId('auth.otpField')).toBeNull();
    await fireEvent.press(screen.getByTestId('auth.emailBack'));
    expect(screen.getByText('Sign in to keep your diary safe')).toBeOnTheScreen();
  });

  it('Use a different email returns to the e-mail step and keeps the typed address', async () => {
    await toCodeStep();
    await fireEvent.press(screen.getByText('Use a different email'));
    expect((await screen.findByTestId('auth.emailField')).props.value).toBe(address);
    expect(screen.getByText('Send code')).toBeOnTheScreen();
  });

  it('a code that is wrong or expired: the six cells in error, the digits kept, the line of frame 114, Verify still enabled', async () => {
    const verifyCode = jest.fn(async () => {
      throw authError('envelope', { status: 401, code: 'UNAUTHORIZED' });
    });
    const { onSignedIn } = await toCodeStep(makeServices({ verifyCode }));
    await typeCode('482917');
    await fireEvent.press(screen.getByText('Verify'));

    const line = await screen.findByText(wrongCodeLine);
    expect(line.props.accessibilityRole).toBe('alert');
    expect(line.props.style).toEqual(expect.objectContaining({ color: lightColors.errorInk }));
    for (const index of [0, 1, 2, 3, 4, 5]) {
      expect(screen.getByTestId(`auth.otpField.cell.${index}`, { includeHiddenElements: true })).toHaveStyle({
        borderColor: lightColors.error,
      });
    }
    expect(screen.getByTestId('auth.otpField').props.value).toBe('482917');
    expect(verifyDisabled()).toBe(false);
    expect(screen.getByText(junkNote)).toBeOnTheScreen();
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it('typing again clears the wrong-code error', async () => {
    const verifyCode = jest.fn(async () => {
      throw authError('envelope', { status: 401, code: 'UNAUTHORIZED' });
    });
    await toCodeStep(makeServices({ verifyCode }));
    await typeCode('482917');
    await fireEvent.press(screen.getByText('Verify'));
    await screen.findByText(wrongCodeLine);
    await typeCode('48291');
    expect(screen.queryByText(wrongCodeLine)).toBeNull();
    expect(screen.getByTestId('auth.otpField.cell.0', { includeHiddenElements: true })).toHaveStyle({ borderColor: 'transparent' });
  });

  it('the cells take the dark error token in the dark scheme', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    const verifyCode = jest.fn(async () => {
      throw authError('envelope', { status: 401, code: 'UNAUTHORIZED' });
    });
    await toCodeStep(makeServices({ verifyCode }));
    await typeCode('482917');
    await fireEvent.press(screen.getByText('Verify'));
    const line = await screen.findByText(wrongCodeLine);
    expect(line.props.style).toEqual(expect.objectContaining({ color: darkColors.errorInk }));
    expect(screen.getByTestId('auth.otpField.cell.3', { includeHiddenElements: true })).toHaveStyle({ borderColor: darkColors.error });
  });

  it('an error that maps to neither line keeps the message of the service and the cells stay quiet', async () => {
    const verifyCode = jest.fn(async () => {
      throw authError('network');
    });
    await toCodeStep(makeServices({ verifyCode }));
    await typeCode('482917');
    await fireEvent.press(screen.getByText('Verify'));
    expect(await screen.findByText('Could not reach CoachCal. Check your connection and try again.')).toBeOnTheScreen();
    expect(screen.queryByText(wrongCodeLine)).toBeNull();
    expect(screen.getByTestId('auth.otpField.cell.0', { includeHiddenElements: true })).toHaveStyle({ borderColor: 'transparent' });
  });

  it('a resend the server refuses says so on the code step and keeps the cooldown at zero', async () => {
    const requestCode = jest
      .fn<Promise<void>, [string]>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(authError('envelope', { status: 429, code: 'VALIDATION_ERROR' }));
    const { advance } = await toCodeStep(makeServices({ requestCode }));
    await advance(60);
    await fireEvent.press(screen.getByTestId('auth.resendCode'));
    expect(await screen.findByText(sendErrorLine)).toBeOnTheScreen();
    expect(screen.getByTestId('auth.resendCode')).toHaveTextContent('Resend code');
    expect(screen.queryByText(/Resend code in/)).toBeNull();
    expect(screen.getByTestId('auth.otpField.cell.0', { includeHiddenElements: true })).toHaveStyle({ borderColor: 'transparent' });
  });
});
