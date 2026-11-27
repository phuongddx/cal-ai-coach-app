import { render } from '@testing-library/react-native';

/**
 * The onboarding route's finish handler: it marks onboarding complete on the root controller first
 * (Swift's `completeOnboarding()`), then navigates. Before the fix the navigation ran with the gate
 * still guarding the shell, and the router fell back to onboarding until the target read landed.
 * The route file lives in `src/app/`, so this test sits outside it (every file there is a route).
 */
const mockOrder: string[] = [];
const mockReplace = jest.fn((path: string) => {
  mockOrder.push(`replace:${path}`);
});
let mockFinish: (() => void) | undefined;

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('../platform/rootRuntime', () => ({
  getRootController: () => ({
    completeOnboarding: () => {
      mockOrder.push('completeOnboarding');
    },
  }),
}));
jest.mock('../data/auth', () => ({ getSessionStore: () => ({ getSession: () => null }) }));
jest.mock('../data/environment', () => ({ getDataEnvironment: async () => ({ targets: { saveTarget: () => undefined } }) }));
jest.mock('../data/sync/runtime', () => ({ notifyLocalMutation: () => undefined }));
jest.mock('../features/onboarding/healthAccess', () => ({ requestHealthAccess: async () => undefined }));
jest.mock('../features/onboarding/OnboardingFlowView', () => ({
  OnboardingFlowView: ({ onFinished }: { onFinished: () => void }) => {
    mockFinish = onFinished;
    return null;
  },
}));

import OnboardingRoute from '../app/onboarding';

describe('onboarding route (PL-01)', () => {
  beforeEach(() => {
    mockOrder.length = 0;
    mockReplace.mockClear();
    mockFinish = undefined;
  });

  it('marks onboarding complete before it navigates to the shell', async () => {
    await render(<OnboardingRoute />);
    expect(mockFinish).toBeDefined();
    mockFinish!();
    expect(mockOrder).toEqual(['completeOnboarding', 'replace:/']);
  });
});
