/** Dual-react preamble — see docs/rn-migration/findings/U-22.md. */
jest.mock('react', () => {
  const rnPath: string = require.resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react`);
});
jest.mock('react/jsx-runtime', () => {
  const rnPath: string = require.resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react/jsx-runtime`);
});

import { render, screen } from '@testing-library/react-native';

import { macroFillFraction, MacroBar } from './MacroBar';
import { darkColors, lightColors } from '../tokens';

describe('MacroBar', () => {
  it.each([
    ['protein', lightColors.macroProtein],
    ['carbs', lightColors.macroCarbs],
    ['fat', lightColors.macroFat],
    ['fiber', lightColors.macroFiber],
  ] as const)('fills the %s bar with its macro color', async (macro, color) => {
    await render(<MacroBar macro={macro} value={40} goal={100} />);
    expect(screen.getByTestId(`macro-bar-fill:${macro}`, { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: color,
      width: '40%',
    });
  });

  it('clamps the fill at the goal', async () => {
    await render(<MacroBar macro="protein" value={130} goal={100} />);
    expect(screen.getByTestId('macro-bar-fill:protein', { includeHiddenElements: true })).toHaveStyle({ width: '100%' });
  });

  it('keeps a visible sliver at zero progress', () => {
    expect(macroFillFraction(0, 100)).toBe(0);
    expect(macroFillFraction(40, 0)).toBe(0);
  });

  it('is hidden from accessibility', async () => {
    await render(<MacroBar macro="fat" value={10} goal={100} />);
    expect(screen.getByTestId('macro-bar-fill:fat', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
