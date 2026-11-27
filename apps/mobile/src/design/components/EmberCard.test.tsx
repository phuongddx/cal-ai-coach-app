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
import { useColorScheme, Text } from 'react-native';

import { EmberCard, emberGlowOpacity } from './EmberCard';
import { darkColors, lightColors } from '../tokens';

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

describe('EmberCard (Ember hero card)', () => {
  it('is the dark ember card in the light scheme', async () => {
    mockUseColorScheme.mockReturnValue('light');
    await render(
      <EmberCard>
        <Text>hero</Text>
      </EmberCard>,
    );
    expect(screen.getByText('hero')).toBeOnTheScreen();
    expect(screen.getByTestId('ember-card')).toHaveStyle({
      backgroundColor: lightColors.ember,
      borderRadius: 28,
      padding: 20,
    });
    // Dark in both modes: the light scheme's ember is the same near-black family as the dark one.
    expect(lightColors.ember).not.toBe(lightColors.card);
  });

  it('is the dark ember card in the dark scheme', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    await render(<EmberCard />);
    expect(screen.getByTestId('ember-card')).toHaveStyle({ backgroundColor: darkColors.ember });
    mockUseColorScheme.mockReturnValue('light');
  });

  it('draws the orange glow at 30% and can switch it off', async () => {
    expect(emberGlowOpacity).toBe(0.3);
    const { rerender } = await render(<EmberCard />);
    expect(screen.getByTestId('ember-card:glow')).toBeOnTheScreen();
    await rerender(<EmberCard glow={false} />);
    expect(screen.queryByTestId('ember-card:glow')).toBeNull();
  });
});
