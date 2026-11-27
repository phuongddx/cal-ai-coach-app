import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { setEdSafeMode } from '../edSafe';

import { EdSafeCollapse } from './EdSafeCollapse';

beforeEach(() => setEdSafeMode(false));
afterEach(() => setEdSafeMode(false));

describe('EdSafeCollapse', () => {
  it('renders its children while ED-safe mode is off', async () => {
    await render(
      <EdSafeCollapse>
        <Text>640 kcal</Text>
      </EdSafeCollapse>,
    );
    expect(screen.getByText('640 kcal')).toBeOnTheScreen();
  });

  it('renders nothing while ED-safe mode is on', async () => {
    setEdSafeMode(true);
    await render(
      <EdSafeCollapse>
        <Text>640 kcal</Text>
      </EdSafeCollapse>,
    );
    expect(screen.queryByText('640 kcal')).toBeNull();
  });
});
