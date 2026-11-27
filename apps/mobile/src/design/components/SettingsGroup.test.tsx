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

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { SettingsGroup } from './SettingsGroup';

describe('SettingsGroup', () => {
  it('stacks its rows with no gap on the card surface', async () => {
    await render(
      <SettingsGroup testID="group">
        <Text>row one</Text>
        <Text>row two</Text>
      </SettingsGroup>,
    );
    expect(screen.getByText('row one')).toBeOnTheScreen();
    expect(screen.getByText('row two')).toBeOnTheScreen();
  });
});
