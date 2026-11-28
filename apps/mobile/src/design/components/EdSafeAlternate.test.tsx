/** Dual-react preamble — see docs/rn-migration/findings/U-22.md. */
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

import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { setEdSafeMode } from '../edSafe';

import { EdSafeAlternate } from './EdSafeAlternate';

beforeEach(() => setEdSafeMode(false));
afterEach(() => setEdSafeMode(false));

const surface = (testID?: string) => (
  <EdSafeAlternate alternate={<Text>1 cup</Text>} testID={testID}>
    <Text>640 kcal</Text>
  </EdSafeAlternate>
);

describe('EdSafeAlternate', () => {
  it('renders its children and not the alternate while ED-safe mode is off', async () => {
    await render(surface());
    expect(screen.getByText('640 kcal')).toBeOnTheScreen();
    expect(screen.queryByText('1 cup')).toBeNull();
  });

  it('renders the alternate and not the children while ED-safe mode is on', async () => {
    setEdSafeMode(true);
    await render(surface());
    expect(screen.getByText('1 cup')).toBeOnTheScreen();
    expect(screen.queryByText('640 kcal')).toBeNull();
  });

  it('swaps live when the mode flips', async () => {
    await render(surface());
    expect(screen.getByText('640 kcal')).toBeOnTheScreen();
    await act(async () => setEdSafeMode(true));
    expect(screen.getByText('1 cup')).toBeOnTheScreen();
    expect(screen.queryByText('640 kcal')).toBeNull();
  });

  it('wraps the shown side in a view with the testID when one is given, mode off', async () => {
    await render(surface('swap'));
    expect(screen.getByTestId('swap')).toBeOnTheScreen();
    expect(screen.getByText('640 kcal')).toBeOnTheScreen();
  });

  it('wraps the shown side in a view with the testID when one is given, mode on', async () => {
    setEdSafeMode(true);
    await render(surface('swap'));
    expect(screen.getByTestId('swap')).toBeOnTheScreen();
    expect(screen.getByText('1 cup')).toBeOnTheScreen();
  });

  it('may have an empty alternate: then it is EdSafeCollapse', async () => {
    setEdSafeMode(true);
    await render(
      <EdSafeAlternate alternate={null}>
        <Text>640 kcal</Text>
      </EdSafeAlternate>,
    );
    expect(screen.queryByText('640 kcal')).toBeNull();
  });
});
