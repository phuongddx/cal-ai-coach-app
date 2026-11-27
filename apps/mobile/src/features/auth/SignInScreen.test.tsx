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

import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors } from '../../design';
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
    expect(screen.getByPlaceholderText('6-digit code')).toBeOnTheScreen();
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

    expect(await screen.findByText('That code or credential was not accepted. Please try again.')).toBeOnTheScreen();
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
    expect(screen.getByRole('header', { name: 'Email' })).toBeOnTheScreen();
    expect(screen.getByTestId('auth.emailBack')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Back' })).toBeOnTheScreen();
    expect(screen.getByText('Sign in with email')).toBeOnTheScreen();
    expect(screen.getByTestId('auth.emailField.label')).toBeOnTheScreen();
    expect(screen.getByLabelText('Email')).toBeOnTheScreen();
    expect(screen.queryByTestId('auth.signInApple')).toBeNull();
    expect(screen.queryByTestId('auth.signInGoogle')).toBeNull();
    expect(screen.queryByTestId('auth.signInEmail')).toBeNull();
    expect(screen.queryByText('Sign in to keep your diary safe')).toBeNull();
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
    expect(screen.queryByText(/We sent a code to/)).toBeNull();
    await userEvent.type(screen.getByTestId('auth.emailField'), 'phuong@example.com');
    await userEvent.press(screen.getByText('Send code'));

    expect(await screen.findByTestId('auth.otpField')).toBeOnTheScreen();
    const sentence = screen.getByTestId('auth.codeSent');
    expect(sentence).toHaveTextContent('We sent a code to phuong@example.com.');
    expect(screen.getByText('phuong@example.com').props.style).toEqual(
      expect.objectContaining({ fontWeight: '700' }),
    );
    expect(screen.getByTestId('auth.emailField')).toBeOnTheScreen();
    expect(screen.getByTestId('auth.otpField.label')).toBeOnTheScreen();
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
