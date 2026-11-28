/**
 * RNTL test of the cancel flow (U-77, frame 19 + b-cancel-dark): the three
 * check rows, the Apple note, and the two equal-weight exits — the primary
 * opens the App Store subscriptions page (the route binds `Linking`), "Keep
 * Plus" dismisses. No survey wall, no confirmation loop.
 *
 * Dual-react preamble: jest-expo pins `react-native` but not `react`; app-side
 * requests are re-pointed onto the renderer's copy. See findings/U-22.md.
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

import { render, screen, userEvent } from '@testing-library/react-native';

import { CancelFlowView } from './CancelFlowView';
import { billingCopy } from './billingCopy';

describe('cancel flow', () => {
  it('renders the informational screen with its three outcomes and the Apple note', async () => {
    await render(<CancelFlowView onContinue={() => undefined} onKeep={() => undefined} />);

    expect(screen.getByTestId('cancelFlow.screen')).toBeOnTheScreen();
    expect(screen.getByText(billingCopy.cancelFlowHeadline)).toBeOnTheScreen();
    expect(screen.getByText(billingCopy.cancelKeepLine)).toBeOnTheScreen();
    expect(screen.getByText(billingCopy.cancelDataLine)).toBeOnTheScreen();
    expect(screen.getByText(billingCopy.cancelFreeLine)).toBeOnTheScreen();
    expect(screen.getByText(billingCopy.cancelAppleNote)).toBeOnTheScreen();
    // No renewal date exists on the screen: this build has no subscription to
    // read `{expiryDate}` from (D13).
    expect(screen.queryByText(/until \d{1,2} /)).toBeNull();
  });

  it("opens the App Store subscriptions page from the primary and dismisses on Keep Plus", async () => {
    const onContinue = jest.fn();
    const onKeep = jest.fn();
    await render(<CancelFlowView onContinue={onContinue} onKeep={onKeep} />);

    await userEvent.press(screen.getByTestId('cancelFlow.continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);

    await userEvent.press(screen.getByTestId('cancelFlow.keep'));
    expect(onKeep).toHaveBeenCalledTimes(1);
  });
});
