/** Dual-react preamble — see docs/rn-migration/findings/U-22.md. */
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

import { QuickActionTile } from './QuickActionTile';

describe('QuickActionTile', () => {
  it('renders title and icon and fires its action', async () => {
    const action = jest.fn();
    await render(<QuickActionTile title="Scan food" icon="camera.fill" action={action} />);
    await userEvent.press(screen.getByTestId('quick-action:Scan food'));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('renders the highlighted variant', async () => {
    await render(<QuickActionTile title="Log weight" icon="scalemass" isHighlighted />);
    expect(screen.getByTestId('quick-action:Log weight')).toBeOnTheScreen();
    expect(screen.getByTestId('quick-action:Log weight')).toHaveProp(
      'accessibilityLabel',
      'Log weight',
    );
  });
});
