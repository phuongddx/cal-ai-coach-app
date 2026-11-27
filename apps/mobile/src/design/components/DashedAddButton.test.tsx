/**
 * Dual-react preamble: jest-expo pins `react-native` but not `react`; app-side
 * requests are re-pointed onto the renderer's copy. See findings/U-22.md.
 */
jest.mock('react', () => {
  const rnPath: string = require.resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react`);
});
jest.mock('react/jsx-runtime', () => {
  const rnPath: string = require.resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react/jsx-runtime`);
});

import { render, screen, userEvent } from '@testing-library/react-native';

import { DashedAddButton } from './DashedAddButton';

describe('DashedAddButton', () => {
  it('defaults its title to "Add food" and fires its action', async () => {
    const action = jest.fn();
    await render(<DashedAddButton action={action} />);
    expect(screen.getByText('Add food')).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button'));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('renders a custom title', async () => {
    await render(<DashedAddButton title="Add snack" />);
    expect(screen.getByText('Add snack')).toBeOnTheScreen();
  });
});
