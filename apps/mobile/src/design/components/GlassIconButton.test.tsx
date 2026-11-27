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

import { render, screen, userEvent } from '@testing-library/react-native';
import { Platform, useColorScheme } from 'react-native';

import { darkColors, lightColors, withAlpha } from '../tokens';

import { glassIconButtonColors, GlassIconButton, hasNativeGlass } from './GlassIconButton';

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

afterEach(() => mockUseColorScheme.mockReturnValue('light'));

describe('GlassIconButton', () => {
  it('is a button with its label, at least 44 by 44 pt and round', async () => {
    await render(<GlassIconButton icon="x" accessibilityLabel="Close" testID="close" onPress={() => {}} />);
    const button = screen.getByTestId('close');
    expect(button).toHaveProp('accessibilityRole', 'button');
    expect(button).toHaveProp('accessibilityLabel', 'Close');
    expect(button).toHaveStyle({ width: 44, height: 44, borderRadius: 22 });
  });

  it('never goes below 44 pt and can be larger (the 52 pt library button)', async () => {
    await render(
      <GlassIconButton icon="image" accessibilityLabel="Choose from library" testID="a" diameter={52} />,
    );
    expect(screen.getByTestId('a')).toHaveStyle({ width: 52, height: 52, borderRadius: 26 });
    await render(<GlassIconButton icon="image" accessibilityLabel="Small" testID="b" diameter={30} />);
    expect(screen.getByTestId('b')).toHaveStyle({ width: 44, height: 44 });
  });

  it('calls onPress', async () => {
    const onPress = jest.fn();
    await render(<GlassIconButton icon="flash" accessibilityLabel="Flash off" testID="flash" onPress={onPress} />);
    await userEvent.press(screen.getByTestId('flash'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('draws the dark glass with a light glyph over media, in both schemes', async () => {
    for (const scheme of ['light', 'dark'] as const) {
      mockUseColorScheme.mockReturnValue(scheme);
      await render(
        <GlassIconButton icon="x" tone="overMedia" accessibilityLabel="Close" testID={`media-${scheme}`} />,
      );
      expect(screen.getByTestId(`media-${scheme}`)).toHaveStyle({
        backgroundColor: withAlpha(darkColors.bg, 0.45),
      });
    }
    const colors = glassIconButtonColors(lightColors, false, 'overMedia');
    expect(colors.glyph).toBe(lightColors.emberText);
  });

  it('draws the surface glass of the canvas on a surface: card at 78% light, text at 10% dark', async () => {
    expect(glassIconButtonColors(lightColors, false, 'onSurface')).toEqual({
      background: withAlpha(lightColors.card, 0.78),
      border: lightColors.border,
      glyph: lightColors.text,
    });
    expect(glassIconButtonColors(darkColors, true, 'onSurface')).toEqual({
      background: withAlpha(darkColors.text, 0.1),
      border: darkColors.border,
      glyph: darkColors.text,
    });
    await render(<GlassIconButton icon="back" accessibilityLabel="Back" testID="surface" />);
    expect(screen.getByTestId('surface')).toHaveStyle({ backgroundColor: withAlpha(lightColors.card, 0.78) });
  });
});

describe('GlassIconButton native glass (D14)', () => {
  const original = Object.getOwnPropertyDescriptor(Platform, 'Version');
  const setVersion = (value: string | number | undefined) =>
    Object.defineProperty(Platform, 'Version', { configurable: true, get: () => value });
  afterEach(() => {
    if (original) Object.defineProperty(Platform, 'Version', original);
  });

  it('draws the native glass on iOS 26 and keeps the pressable the target of the testID', async () => {
    setVersion('26.5');
    expect(hasNativeGlass()).toBe(true);
    await render(<GlassIconButton icon="x" tone="overMedia" accessibilityLabel="Close" testID="g" />);
    expect(screen.getByTestId('g:glass')).toBeOnTheScreen();
    expect(screen.getByTestId('g')).toHaveProp('accessibilityRole', 'button');
    expect(screen.getByTestId('g')).toHaveStyle({ width: 44, height: 44, backgroundColor: 'transparent' });
  });

  it('falls back to the translucent fill on iOS 18', async () => {
    setVersion('18.4');
    expect(hasNativeGlass()).toBe(false);
    await render(<GlassIconButton icon="x" tone="overMedia" accessibilityLabel="Close" testID="g" />);
    expect(screen.queryByTestId('g:glass')).toBeNull();
    expect(screen.getByTestId('g')).toHaveStyle({ backgroundColor: withAlpha(darkColors.bg, 0.45) });
  });

  it('does not ask the native module when the system version is unknown', () => {
    setVersion(undefined);
    expect(hasNativeGlass()).toBe(false);
  });
});

describe('GlassIconButton spoken value', () => {
  it('carries an optional accessibility value and none by default', async () => {
    await render(<GlassIconButton icon="flip" accessibilityLabel="Switch camera" accessibilityValueText="Back camera" testID="flip" />);
    expect(screen.getByTestId('flip')).toHaveAccessibilityValue({ text: 'Back camera' });
    await render(<GlassIconButton icon="flip" accessibilityLabel="Switch camera" testID="plain" />);
    expect(screen.getByTestId('plain').props.accessibilityValue?.text).toBeUndefined();
  });
});
