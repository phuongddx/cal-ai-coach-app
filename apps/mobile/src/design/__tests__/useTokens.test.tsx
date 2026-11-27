/**
 * useTokens() follows the color scheme. The `useColorScheme` from
 * react-native is a `jest.fn(() => 'light')` under the RN jest preset, so the
 * scheme flips through `mockReturnValue`.
 *
 * The jest.mock preamble is the dual-react fix: see findings/U-22.md.
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

import { render, screen } from '@testing-library/react-native';
import { useColorScheme, Text } from 'react-native';

import { darkColors, lightColors, useTokens } from '../tokens';

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

function SchemeProbe() {
  const tokens = useTokens();
  return (
    <Text testID="probe">
      {`${tokens.colors.background === darkColors.background ? 'dark' : 'light'}:${tokens.colors.textSecondary}`}
    </Text>
  );
}

describe('useTokens', () => {
  it('returns the light set by default', async () => {
    mockUseColorScheme.mockReturnValue('light');
    await render(<SchemeProbe />);
    expect(screen.getByTestId('probe')).toHaveTextContent(`light:${lightColors.textSecondary}`);
  });

  it('returns the dark set when the scheme is dark', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    await render(<SchemeProbe />);
    expect(screen.getByTestId('probe')).toHaveTextContent(`dark:${darkColors.textSecondary}`);
  });

  it('treats a null scheme as light', async () => {
    mockUseColorScheme.mockReturnValue(null);
    await render(<SchemeProbe />);
    expect(screen.getByTestId('probe')).toHaveTextContent(`light:${lightColors.textSecondary}`);
  });
});
