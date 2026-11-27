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

import { size } from '../tokens';

import { ChipOption, chipHeight, chipHitSlop } from './ChipOption';

describe('ChipOption', () => {
  it('marks the selected chip', async () => {
    await render(<ChipOption title="Lose" isSelected />);
    const chip = screen.getByTestId('chip-option:Lose');
    expect(chip).toHaveProp('accessibilityState', { selected: true });
  });

  it('marks the unselected chip', async () => {
    await render(<ChipOption title="Gain" isSelected={false} />);
    expect(screen.getByTestId('chip-option:Gain')).toHaveProp(
      'accessibilityState',
      { selected: false },
    );
  });

  it('fires onSelect on press', async () => {
    const onSelect = jest.fn();
    await render(<ChipOption title="Maintain" isSelected={false} onSelect={onSelect} />);
    await userEvent.press(screen.getByTestId('chip-option:Maintain'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('has a target of at least 44 pt: the drawn height plus the hit slop', async () => {
    await render(<ChipOption title="Gain" isSelected={false} />);
    const chip = screen.getByTestId('chip-option:Gain');
    expect(chipHeight + 2 * chipHitSlop).toBeGreaterThanOrEqual(size.tap);
    expect(chip).toHaveProp('hitSlop', { top: chipHitSlop, bottom: chipHitSlop });
    expect(chip).toHaveStyle({ minHeight: chipHeight, minWidth: size.tap });
    expect(size.tap).toBe(44);
  });
});
