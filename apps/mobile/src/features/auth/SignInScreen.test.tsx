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
    expect(screen.getByText('Sign in to CoachCal')).toBeOnTheScreen();
    expect(await screen.findByTestId('auth.signInApple')).toBeOnTheScreen();
    expect(screen.getByTestId('auth.signInGoogle')).toBeOnTheScreen();
    expect(screen.getByText('Continue with Google')).toBeOnTheScreen();
    expect(screen.getByTestId('auth.emailField')).toBeOnTheScreen();
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
    await userEvent.press(screen.getByText('Send code'));
    expect(services.requestCode).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send code' }).props.accessibilityState.disabled).toBe(true);
  });

  it('sending the code reveals the code field and Verify', async () => {
    const { services } = await renderScreen();
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
    expect(screen.getByRole('button', { name: 'Send code' }).props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByText('Continue with Google'));
    expect(signInWithGoogle).toHaveBeenCalledTimes(1);

    finish(session);
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(session));
    await waitFor(() => expect(screen.getByTestId('auth.form').props.pointerEvents).toBe('auto'));
  });
});
