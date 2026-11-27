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
  optionCardBackground,
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
      color: lightColors.accentStrong,
    });
    expect(optionCardBackground(lightColors, true)).toBe(lightColors.accentTint);
    expect(optionCardIconTile(lightColors, true)).toBe(lightColors.accent);
    expect(optionCardIconColor(lightColors, true)).toBe(lightColors.onAccent);
  });

  it('maps the unselected visual state', () => {
    expect(optionCardBorder(lightColors, false)).toEqual({
      width: 1,
      color: lightColors.border,
    });
    expect(optionCardBackground(lightColors, false)).toBe(lightColors.card);
    expect(optionCardIconTile(lightColors, false)).toBe(lightColors.surface);
    expect(optionCardIconColor(lightColors, false)).toBe(lightColors.textSecondary);
  });
});

describe('OptionCard selected fill (frames 21/22/24)', () => {
  it('tints the whole selected card with accentTint and leaves the unselected card on card', async () => {
    await render(
      <>
        <OptionCard title="On" iconName="flame" isSelected />
        <OptionCard title="Off" iconName="flame" isSelected={false} />
      </>,
    );
    expect(screen.getByTestId('option-card:On')).toHaveStyle({
      backgroundColor: lightColors.accentTint,
      borderWidth: 2,
    });
    expect(screen.getByTestId('option-card:Off')).toHaveStyle({
      backgroundColor: lightColors.card,
      borderWidth: 1,
    });
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

describe('OptionCard iconName (Ember icon tile and selected check)', () => {
  it('draws the Ember icon in the tile and the filled check when selected', async () => {
    await render(<OptionCard title="Lose weight" iconName="flame" isSelected />);
    expect(screen.getByTestId('option-card:Lose weight')).toHaveProp(
      'accessibilityLabel',
      'Lose weight, selected',
    );
    expect(screen.getByTestId('icon:flame')).toBeOnTheScreen();
    expect(screen.getByTestId('option-card:Lose weight:check')).toBeOnTheScreen();
    expect(screen.getByTestId('icon:check')).toBeOnTheScreen();
  });

  it('draws no check when unselected, and keeps the identifier of the card', async () => {
    await render(<OptionCard title="Lose weight" iconName="flame" isSelected={false} />);
    expect(screen.getByTestId('option-card:Lose weight')).toBeOnTheScreen();
    expect(screen.queryByTestId('option-card:Lose weight:check')).toBeNull();
  });
});
