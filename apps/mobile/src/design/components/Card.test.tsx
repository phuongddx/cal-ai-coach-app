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

import { Card } from './Card';
import { lightColors } from '../tokens';

describe('Card', () => {
  it('renders its children on the card surface', async () => {
    await render(
      <Card testID="card">
        <Text>inside</Text>
      </Card>,
    );
    expect(screen.getByText('inside')).toBeOnTheScreen();
    expect(screen.getByTestId('card')).toHaveStyle({
      backgroundColor: lightColors.card,
      borderRadius: 16,
    });
  });
});
