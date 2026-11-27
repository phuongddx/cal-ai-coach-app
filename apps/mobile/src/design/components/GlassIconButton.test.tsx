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
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, withAlpha } from '../tokens';

import { glassDisabledGlyphAlpha, glassIconButtonColors, GlassIconButton } from './GlassIconButton';

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

  it('draws mediaScrim with an onMedia glyph over media, in both schemes', async () => {
    for (const scheme of ['light', 'dark'] as const) {
      mockUseColorScheme.mockReturnValue(scheme);
      await render(
        <GlassIconButton icon="x" tone="overMedia" accessibilityLabel="Close" testID={`media-${scheme}`} />,
      );
      expect(screen.getByTestId(`media-${scheme}`)).toHaveStyle({
        backgroundColor: (scheme === 'dark' ? darkColors : lightColors).mediaScrim,
      });
    }
    for (const [palette, dark] of [[lightColors, false], [darkColors, true]] as const) {
      expect(glassIconButtonColors(palette, dark, 'overMedia')).toEqual({
        background: palette.mediaScrim,
        border: 'transparent',
        glyph: palette.onMedia,
      });
    }
  });

  describe('disabled', () => {
    it('reports its state, ignores presses and dims the glyph', async () => {
      const onPress = jest.fn();
      await render(
        <GlassIconButton icon="flash" accessibilityLabel="Flash" testID="off" onPress={onPress} disabled />,
      );
      const button = screen.getByTestId('off');
      expect(button).toHaveProp('accessibilityState', { disabled: true });
      await userEvent.press(button);
      expect(onPress).not.toHaveBeenCalled();
      expect(glassDisabledGlyphAlpha).toBe(0.4);
    });

    it('is enabled by default and reports that', async () => {
      const onPress = jest.fn();
      await render(<GlassIconButton icon="flash" accessibilityLabel="Flash" testID="on" onPress={onPress} />);
      expect(screen.getByTestId('on')).toHaveProp('accessibilityState', { disabled: false });
      await userEvent.press(screen.getByTestId('on'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
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
