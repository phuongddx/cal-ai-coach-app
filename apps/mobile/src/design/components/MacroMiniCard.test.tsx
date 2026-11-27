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

import { MacroMiniCard, macroLabels } from './MacroMiniCard';


describe('MacroMiniCard', () => {
  it('renders rounded gram values and the accessibility label', async () => {
    await render(<MacroMiniCard macro="protein" value={82.4} goal={130.2} />);
    expect(screen.getByText('82/130g', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('macro-mini:protein')).toHaveProp(
      'accessibilityLabel',
      'Protein 82 of 130 grams',
    );
  });

  it.each(['protein', 'carbs', 'fat', 'fiber'] as const)('renders the %s variant', async (macro) => {
    await render(<MacroMiniCard macro={macro} value={10} goal={20} />);
    expect(screen.getByTestId(`macro-mini:${macro}`)).toHaveProp(
      'accessibilityLabel',
      `${macroLabels[macro]} 10 of 20 grams`,
    );
  });
});
