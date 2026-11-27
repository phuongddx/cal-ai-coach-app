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

import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { useState } from 'react';

import { GramsField, parseGramsInput } from './GramsField';

function Harness({ initial = 150, servings }: { initial?: number; servings?: Array<{ label: string; grams: number }> }) {
  const [grams, setGrams] = useState(initial);
  return <GramsField id="item1" value={grams} onValueChange={setGrams} servings={servings} />;
}

describe('GramsField (Ember grams control)', () => {
  it('carries the scan.grams.<id> testIDs and 44 pt buttons', async () => {
    await render(<Harness />);
    for (const suffix of ['decrement', 'increment']) {
      expect(screen.getByTestId(`scan.grams.item1.${suffix}`)).toHaveStyle({ width: 44, height: 44 });
    }
    expect(screen.getByTestId('scan.grams.item1.field')).toBeOnTheScreen();
    expect(screen.getByTestId('scan.grams.item1.field')).toHaveProp('value', '150');
  });

  it('steps by 10 and clamps at zero', async () => {
    await render(<Harness initial={5} />);
    await userEvent.press(screen.getByTestId('scan.grams.item1.increment'));
    expect(screen.getByTestId('scan.grams.item1.field')).toHaveProp('value', '15');
    await userEvent.press(screen.getByTestId('scan.grams.item1.decrement'));
    await userEvent.press(screen.getByTestId('scan.grams.item1.decrement'));
    expect(screen.getByTestId('scan.grams.item1.field')).toHaveProp('value', '0');
  });

  it('takes typed grams through the number-pad field', async () => {
    const onValueChange = jest.fn();
    await render(<GramsField id="item2" value={150} onValueChange={onValueChange} />);
    const field = screen.getByTestId('scan.grams.item2.field');
    expect(field).toHaveProp('keyboardType', 'number-pad');
    await fireEvent.changeText(field, '2a35');
    expect(onValueChange).toHaveBeenLastCalledWith(235);
    await fireEvent.changeText(field, '');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('parses digits only and clamps into the range', () => {
    expect(parseGramsInput('', 0, 9999)).toBeNull();
    expect(parseGramsInput('abc', 0, 9999)).toBeNull();
    expect(parseGramsInput('0120', 0, 9999)).toBe(120);
    expect(parseGramsInput('99999', 0, 9999)).toBe(9999);
    expect(parseGramsInput('3', 10, 9999)).toBe(10);
  });

  it('sets the grams from a serving chip', async () => {
    await render(<Harness servings={[{ label: '1 slice', grams: 30 }, { label: '1 cup', grams: 240 }]} />);
    await userEvent.press(screen.getByTestId('chip-option:1 cup'));
    expect(screen.getByTestId('scan.grams.item1.field')).toHaveProp('value', '240');
    expect(screen.getByTestId('chip-option:1 cup')).toHaveProp('accessibilityState', { selected: true });
    expect(screen.getByTestId('chip-option:1 slice')).toHaveProp('accessibilityState', { selected: false });
  });
});
