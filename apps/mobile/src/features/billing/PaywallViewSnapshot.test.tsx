/**
 * PaywallView over the REAL PaywallModel with the model changing while the view is mounted (U-84 B):
 * a selection made outside the view, a reload that goes loading → failed → ready. The app compiles
 * with the React Compiler; run with `npm run test:compiler` this suite is green on the view as it
 * was (it reads `model.state` once into a local, and the model replaces `state` on every change)
 * and stays green on the view that reads the published snapshot.
 *
 * Dual-react preamble: see PaywallView.test.tsx and findings/U-22.md.
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

import { act, render, screen, waitFor } from '@testing-library/react-native';

import { PaywallView } from './PaywallView';
import { createPaywallModel, type PlanOption } from './paywallModel';

const OPTIONS: PlanOption[] = [
  { id: 'yearly', title: 'Yearly', detail: '1 week free, then a year', price: 'a-year', trial: true },
  { id: 'monthly', title: 'Monthly', detail: 'a month, no trial', price: 'a-month', trial: false },
];

describe('PaywallView over the real model, model changing while mounted', () => {
  it('a plan selected outside the view moves the selected card', async () => {
    const model = createPaywallModel({
      loadOptions: async () => OPTIONS,
      restore: async () => undefined,
      purchase: async () => undefined,
    });
    await render(<PaywallView model={model} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByTestId('plans.state.ready')).toBeOnTheScreen());
    expect(screen.getByTestId('option-card:Yearly').props.accessibilityState?.selected).toBe(true);

    await act(async () => {
      model.select('monthly');
    });

    expect(screen.getByTestId('option-card:Monthly').props.accessibilityState?.selected).toBe(true);
    expect(screen.getByTestId('option-card:Yearly').props.accessibilityState?.selected).toBe(false);
  });

  it('a reload walks loading, failed and ready on the same mounted view', async () => {
    let attempt = 0;
    const model = createPaywallModel({
      loadOptions: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('no store');
        return OPTIONS;
      },
      restore: async () => undefined,
      purchase: async () => undefined,
    });
    await render(<PaywallView model={model} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByTestId('plans.state.failed')).toBeOnTheScreen());

    await act(async () => {
      await model.load();
    });

    expect(screen.getByTestId('plans.state.ready')).toBeOnTheScreen();
    expect(screen.queryByTestId('plans.state.failed')).toBeNull();
  });
});
