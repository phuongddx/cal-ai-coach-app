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

import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('renders its content under the grab handle', async () => {
    await render(
      <Sheet testID="sheet">
        <Text>sheet body</Text>
      </Sheet>,
    );
    expect(screen.getByText('sheet body')).toBeOnTheScreen();
    expect(screen.getByTestId('sheet')).toBeOnTheScreen();
  });
});
