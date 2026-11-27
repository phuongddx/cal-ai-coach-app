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
import { Text, useColorScheme } from 'react-native';

import { Card } from './Card';
import { darkColors, lightColors } from '../tokens';

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

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
      borderRadius: 20,
    });
  });

  it('has the light shadow only on light and none on dark', async () => {
    mockUseColorScheme.mockReturnValue('light');
    const { rerender } = await render(<Card testID="card" />);
    expect(screen.getByTestId('card')).toHaveStyle({ shadowColor: lightColors.text, shadowOpacity: 0.04 });
    mockUseColorScheme.mockReturnValue('dark');
    await rerender(<Card testID="card" />);
    expect(screen.getByTestId('card')).toHaveStyle({ backgroundColor: darkColors.card, shadowOpacity: 0 });
    mockUseColorScheme.mockReturnValue('light');
  });
});
