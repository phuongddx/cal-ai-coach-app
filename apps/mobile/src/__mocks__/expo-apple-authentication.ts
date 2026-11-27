/**
 * Manual Jest mock for `expo-apple-authentication`: Sign in with Apple succeeds with a fixed
 * credential unless a test overrides `signInAsync`. Enums and types come from the real package.
 */
const actual = jest.requireActual<typeof import('expo-apple-authentication')>('expo-apple-authentication');

export const credential = {
  user: '000000.mock-apple-user.0000',
  email: 'mock@privaterelay.appleid.com',
  fullName: { givenName: 'Mock', familyName: 'User', middleName: null, namePrefix: null, nameSuffix: null, nickname: null },
  realUserStatus: 1,
  state: null,
  identityToken: 'mock.identity.token',
  authorizationCode: 'mock-authorization-code',
};

export const isAvailableAsync = jest.fn(async () => true);
export const signInAsync = jest.fn(async () => credential);
export const getCredentialStateAsync = jest.fn(async () => actual.AppleAuthenticationCredentialState.AUTHORIZED);
export const addRevokeListener = jest.fn(() => ({ remove: jest.fn() }));

export const AppleAuthenticationScope = actual.AppleAuthenticationScope;
export const AppleAuthenticationCredentialState = actual.AppleAuthenticationCredentialState;
export const AppleAuthenticationButtonType = actual.AppleAuthenticationButtonType;
export const AppleAuthenticationButtonStyle = actual.AppleAuthenticationButtonStyle;
export const AppleAuthenticationUserDetectionStatus = actual.AppleAuthenticationUserDetectionStatus;

/** The native button, rendered as a plain view in tests. */
export const AppleAuthenticationButton = actual.AppleAuthenticationButton;

export function __reset(): void {
  isAvailableAsync.mockClear();
  signInAsync.mockClear();
  getCredentialStateAsync.mockClear();
  addRevokeListener.mockClear();
}
