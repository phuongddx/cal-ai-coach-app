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

import {
  optionCardA11yLabel,
  optionCardBorder,
  optionCardIconColor,
  optionCardIconTile,
  OptionCard,
} from './OptionCard';
import { lightColors } from '../tokens';

// Port of ComponentContractTests.testOptionCardSelectionStateBooleans.
describe('OptionCard selection state booleans', () => {
  it('maps the selected visual state', () => {
    expect(optionCardBorder(lightColors, true)).toEqual({
      width: 2,
      color: lightColors.accentLime,
    });
    expect(optionCardIconTile(lightColors, true)).toBe(
      'rgba(180,240,74,0.15)',
    );
    expect(optionCardIconColor(lightColors, true)).toBe(lightColors.accentInk);
  });

  it('maps the unselected visual state', () => {
    expect(optionCardBorder(lightColors, false)).toEqual({
      width: 1,
      color: lightColors.border,
    });
    expect(optionCardIconTile(lightColors, false)).toBe(lightColors.surface);
    expect(optionCardIconColor(lightColors, false)).toBe(lightColors.textSecondary);
  });
});

describe('OptionCard rendering', () => {
  it('renders selected with subtitle and selected a11y state', async () => {
    const onSelect = jest.fn();
    await render(
      <OptionCard
        title="Lose weight"
        subtitle="A mild deficit"
        icon="flame"
        isSelected
        onSelect={onSelect}
      />,
    );
    const card = screen.getByTestId('option-card:Lose weight');
    expect(card).toHaveProp('accessibilityLabel', 'Lose weight, A mild deficit, selected');
    expect(card).toHaveProp('accessibilityState', { selected: true });
    await userEvent.press(card);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders unselected without the checkmark', async () => {
    await render(<OptionCard title="Lose weight" icon="flame" isSelected={false} />);
    const card = screen.getByTestId('option-card:Lose weight');
    expect(card).toHaveProp('accessibilityLabel', 'Lose weight, not selected');
    expect(optionCardA11yLabel('Lose weight', undefined, false)).toBe('Lose weight, not selected');
  });
});
