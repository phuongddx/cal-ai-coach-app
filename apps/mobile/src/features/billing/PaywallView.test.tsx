/**
 * RNTL tests of the paywall (U-77, frame 18 + round-3 loading/failed states):
 * the three states with no price in any of them, the always-visible Restore
 * and Close, the plan-choice selection, and the shell identifiers.
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

import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { PaywallView } from './PaywallView';
import { createPaywallModel, type PaywallModelDeps, type PlanOption } from './paywallModel';


/** The store's answer shape — every field store-sourced, none invented. The
    strings are deliberately not the frame's sample prices: no sample price
    exists anywhere in the app or its tests (owner handoff, D13). */
function makeOptions(overrides: Partial<PlanOption> = {}): PlanOption[] {
  return [
    {
      id: 'yearly',
      title: 'Yearly',
      detail: '1 week free, then US$52.00 / year',
      price: 'US$52.00',
      trial: true,
      ...overrides,
    },
    { id: 'monthly', title: 'Monthly', detail: 'US$9.49 / month, no trial', price: 'US$9.49', trial: false },
  ];
}

function makeModel(overrides: Partial<PaywallModelDeps> = {}) {
  const deps: PaywallModelDeps = {
    loadOptions: jest.fn(async () => makeOptions()),
    restore: jest.fn(async () => undefined),
    purchase: jest.fn(async () => undefined),
    ...overrides,
  };
  return { model: createPaywallModel(deps), deps };
}

describe('paywall', () => {
  it('loads into the ready state: the store options render, the first plan preselected', async () => {
    const { model, deps } = makeModel();
    await render(<PaywallView model={model} onClose={() => undefined} />);

    await waitFor(() => expect(screen.getByTestId('plans.state.ready')).toBeOnTheScreen());
    expect(screen.getByText('Yearly')).toBeOnTheScreen();
    expect(screen.getByText('Monthly')).toBeOnTheScreen();
    // The price lines are exactly the store's own strings — never a sample.
    expect(screen.getByTestId('plans.option.yearly.price')).toHaveTextContent('US$52.00');
    expect(screen.getByTestId('plans.option.monthly.price')).toHaveTextContent('US$9.49');
    // Nothing is selected apart from the plan choice: the first plan starts selected.
    expect(screen.getByTestId('option-card:Yearly').props.accessibilityState?.selected).toBe(true);
    expect(screen.getByTestId('option-card:Monthly').props.accessibilityState?.selected).toBe(false);
    expect(deps.loadOptions).toHaveBeenCalledTimes(1);

    // Shell identifiers: Restore and Close always visible, sheet + primary.
    expect(screen.getByTestId('plans.sheet')).toBeOnTheScreen();
    expect(screen.getByTestId('plans.restore')).toBeOnTheScreen();
    expect(screen.getByTestId('plans.close')).toBeOnTheScreen();
    expect(screen.getByTestId('plans.primary')).toBeOnTheScreen();
  });

  it('ends in the failed state when no store answers and shows no price anywhere', async () => {
    const { model } = makeModel({
      loadOptions: jest.fn(async () => {
        throw new Error('no store');
      }),
    });
    await render(<PaywallView model={model} onClose={() => undefined} />);

    await waitFor(() => expect(screen.getByTestId('plans.state.failed')).toBeOnTheScreen());
    // The plans render unselectable with "Price unavailable".
    expect(screen.getByText("Prices didn't load. Check your connection and try again. You'll always see the price before you pay.")).toBeOnTheScreen();
    expect(screen.getAllByText('Price unavailable')).toHaveLength(2);
    expect(screen.getByTestId('plans.option.yearly')).toBeOnTheScreen();
    expect(screen.getByTestId('plans.option.monthly')).toBeOnTheScreen();
    // The primary is disabled and names the blocker; the note offers restore.
    expect(screen.getByTestId('plans.primary').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText('Prices unavailable')).toBeOnTheScreen();
    expect(screen.getByText('Already subscribed? Restore works without prices.')).toBeOnTheScreen();
    // No price text anywhere on the screen.
    expect(screen.queryByText(/US?\$\s*\d/)).toBeNull();
  });

  it('shows the loading state with skeleton price slots and no price text', async () => {
    // A load that stays pending keeps the loading state on screen.
    const { model } = makeModel({
      loadOptions: () => new Promise<readonly PlanOption[]>(() => undefined),
    });
    await render(<PaywallView model={model} onClose={() => undefined} />);

    expect(screen.getByTestId('plans.state.loading')).toBeOnTheScreen();
    expect(screen.getByText('Loading prices…')).toBeOnTheScreen();
    expect(screen.getByTestId('plans.primary').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText('Prices come from the App Store in your currency.')).toBeOnTheScreen();
    // No price text anywhere on the screen.
    expect(screen.queryByText(/US?\$\s*\d/)).toBeNull();
    expect(screen.queryByText('Yearly')).toBeNull();
    expect(screen.queryByText('Monthly')).toBeNull();
  });

  it('selects a plan on tap and presses purchase only in the ready state', async () => {
    const { model, deps } = makeModel();
    await render(<PaywallView model={model} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByTestId('plans.state.ready')).toBeOnTheScreen());

    await userEvent.press(screen.getByTestId('option-card:Monthly'));
    expect(screen.getByTestId('option-card:Monthly').props.accessibilityState?.selected).toBe(true);
    expect(screen.getByTestId('option-card:Yearly').props.accessibilityState?.selected).toBe(false);

    await userEvent.press(screen.getByTestId('plans.primary'));
    await waitFor(() => expect(deps.purchase).toHaveBeenCalledWith('monthly'));
  });

  it('retries from the failed card and keeps Restore and Close working in every state', async () => {
    const loadOptions = jest
      .fn<Promise<readonly PlanOption[]>, []>()
      .mockRejectedValueOnce(new Error('no store'))
      .mockResolvedValueOnce(makeOptions());
    const onClose = jest.fn();
    const { model, deps } = makeModel({ loadOptions });
    await render(<PaywallView model={model} onClose={onClose} />);
    await waitFor(() => expect(screen.getByTestId('plans.state.failed')).toBeOnTheScreen());

    await userEvent.press(screen.getByText('Try again'));
    await waitFor(() => expect(screen.getByTestId('plans.state.ready')).toBeOnTheScreen());
    expect(loadOptions).toHaveBeenCalledTimes(2);

    await userEvent.press(screen.getByTestId('plans.restore'));
    await waitFor(() => expect(deps.restore).toHaveBeenCalledTimes(1));
    await userEvent.press(screen.getByTestId('plans.close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows "Price unavailable" in the ready state when the store exposes no price', async () => {
    const { model } = makeModel({
      loadOptions: jest.fn(async () =>
        makeOptions().map((option) => ({ ...option, price: null, detail: null, trial: false })),
      ),
    });
    await render(<PaywallView model={model} onClose={() => undefined} />);

    await waitFor(() => expect(screen.getByTestId('plans.state.ready')).toBeOnTheScreen());
    expect(screen.getAllByText('Price unavailable')).toHaveLength(2);
    // No trial from the store: the CTA reads "Subscribe" (design-system §15).
    expect(screen.getByText('Subscribe')).toBeOnTheScreen();
    // No price text anywhere on the screen.
    expect(screen.queryByText(/US?\$\s*\d/)).toBeNull();
  });
});

describe('paywall model', () => {
  it('keeps restore available while loading and after a failure', async () => {
    const { model, deps } = makeModel({
      loadOptions: jest.fn(async () => {
        throw new Error('no store');
      }),
    });
    const loading = model.load();
    await expect(model.restore()).resolves.toBeUndefined();
    expect(deps.restore).toHaveBeenCalledTimes(1);
    await loading;
    expect(model.state).toEqual({ kind: 'failed' });
    model.retry();
    expect(model.state).toEqual({ kind: 'loading' });
  });
});
