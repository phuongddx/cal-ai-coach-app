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

import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text, useColorScheme } from 'react-native';

import {
  colorsByMode,
  darkColors,
  getTokens,
  highContrastDarkColors,
  highContrastLightColors,
  lightColors,
  useTokens,
} from '../tokens';

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

/**
 * High Contrast: the double of `AccessibilityInfo`. React Native 0.88 names the setting "darker system
 * colors" (`isDarkerSystemColorsEnabled`, event `darkerSystemColorsChanged`); the brief's
 * `isHighContrastEnabled` / `highContrastChanged` do not exist in its typings (findings/U-71c.md).
 */
type Handler = (enabled: boolean) => void;

function ContrastProbe({ testID = 'contrast' }: { testID?: string }) {
  const tokens = useTokens();
  return (
    <Text testID={testID}>
      {`${tokens.scheme}:${tokens.highContrast ? 'hc' : 'normal'}:${tokens.colors.text}:${tokens.colors.accentInk}`}
    </Text>
  );
}

describe('useTokens under Increase Contrast', () => {
  let handlers: Handler[];
  let remove: jest.Mock;
  let query: jest.SpyInstance;
  let listen: jest.SpyInstance;

  function installDouble(initial: boolean | Error) {
    handlers = [];
    remove = jest.fn();
    query = jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockImplementation(() =>
      initial instanceof Error ? Promise.reject(initial) : Promise.resolve(initial),
    );
    listen = jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      name: string,
      handler: Handler,
    ) => {
      if (name === 'darkerSystemColorsChanged') handlers.push(handler);
      return { remove };
    }) as never);
  }

  afterEach(() => {
    query.mockRestore();
    listen.mockRestore();
    mockUseColorScheme.mockReturnValue('light');
  });

  const expected = (colors: typeof lightColors, scheme: string, mode: string) =>
    `${scheme}:${mode}:${colors.text}:${colors.accentInk}`;

  it.each([
    ['light', false, lightColors, 'light', 'normal'],
    ['dark', false, darkColors, 'dark', 'normal'],
    ['light', true, highContrastLightColors, 'light', 'hc'],
    ['dark', true, highContrastDarkColors, 'dark', 'hc'],
  ] as const)('scheme %s, Increase Contrast %s: returns the colors of that mode', async (scheme, on, colors, s, m) => {
    installDouble(on);
    mockUseColorScheme.mockReturnValue(scheme);
    await render(<ContrastProbe />);
    await act(async () => {});
    expect(screen.getByTestId('contrast')).toHaveTextContent(expected(colors, s, m));
  });

  it('the High Contrast sets really differ from the normal ones where the chain says so', () => {
    expect(highContrastLightColors.text).not.toBe(lightColors.text);
    expect(highContrastDarkColors.accentInk).not.toBe(darkColors.accentInk);
    // A token that .hc does not redeclare keeps its base value.
    expect(highContrastLightColors.card).toBe(lightColors.card);
    expect(highContrastDarkColors.card).toBe(darkColors.card);
  });

  it('follows the change event on and off, in light and in dark', async () => {
    installDouble(false);
    mockUseColorScheme.mockReturnValue('light');
    const { rerender } = await render(<ContrastProbe />);
    await act(async () => {});
    expect(screen.getByTestId('contrast')).toHaveTextContent(expected(lightColors, 'light', 'normal'));

    await act(async () => handlers[0](true));
    expect(screen.getByTestId('contrast')).toHaveTextContent(expected(highContrastLightColors, 'light', 'hc'));

    mockUseColorScheme.mockReturnValue('dark');
    await rerender(<ContrastProbe />);
    expect(screen.getByTestId('contrast')).toHaveTextContent(expected(highContrastDarkColors, 'dark', 'hc'));

    await act(async () => handlers[0](false));
    expect(screen.getByTestId('contrast')).toHaveTextContent(expected(darkColors, 'dark', 'normal'));
  });

  it('an event that arrives before the first answer wins over that answer', async () => {
    let resolveQuery: (value: boolean) => void = () => {};
    installDouble(false);
    query.mockImplementation(() => new Promise<boolean>((resolve) => (resolveQuery = resolve)));
    mockUseColorScheme.mockReturnValue('light');
    await render(<ContrastProbe />);
    await act(async () => handlers[0](true));
    await act(async () => resolveQuery(false));
    expect(screen.getByTestId('contrast')).toHaveTextContent(expected(highContrastLightColors, 'light', 'hc'));
  });

  it('treats a native build that cannot answer as normal contrast', async () => {
    installDouble(new Error('getCurrentDarkerSystemColorsState is not available'));
    mockUseColorScheme.mockReturnValue('light');
    await render(<ContrastProbe />);
    await act(async () => {});
    expect(screen.getByTestId('contrast')).toHaveTextContent(expected(lightColors, 'light', 'normal'));
  });

  it('shares one native listener between components and removes it with the last one', async () => {
    installDouble(true);
    mockUseColorScheme.mockReturnValue('light');
    const first = await render(<ContrastProbe testID="a" />);
    const second = await render(<ContrastProbe testID="b" />);
    await act(async () => {});
    expect(handlers).toHaveLength(1);
    expect(query).toHaveBeenCalledTimes(1);
    await act(async () => first.unmount());
    expect(remove).not.toHaveBeenCalled();
    await act(async () => second.unmount());
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('asks again after every component unmounted (the value is not kept)', async () => {
    installDouble(true);
    mockUseColorScheme.mockReturnValue('light');
    const earlier = await render(<ContrastProbe />);
    await act(async () => earlier.unmount());
    query.mockImplementation(() => Promise.resolve(false));
    await render(<ContrastProbe />);
    await act(async () => {});
    expect(screen.getByTestId('contrast')).toHaveTextContent(expected(lightColors, 'light', 'normal'));
  });

  it('space, radius, size and font are the same objects with contrast on', async () => {
    installDouble(true);
    mockUseColorScheme.mockReturnValue('dark');
    expect(getTokens({ colorScheme: 'dark', highContrast: true }).colors).toBe(colorsByMode.highContrastDark);
    expect(getTokens({ colorScheme: 'dark', highContrast: true }).space).toBe(getTokens('dark').space);
  });
});
