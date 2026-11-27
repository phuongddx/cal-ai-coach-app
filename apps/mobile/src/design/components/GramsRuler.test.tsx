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

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { lightColors } from '../tokens';

import {
  GramsRuler,
  rulerTickOpacity,
  rulerTicks,
  rulerValueAfterDrag,
  snapRulerValue,
} from './GramsRuler';

function Harness({ initial = 180, step }: { initial?: number; step?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <GramsRuler
      value={value}
      onChange={setValue}
      min={0}
      max={1000}
      step={step}
      accessibilityLabel="Grams ruler"
      testID="ruler"
    />
  );
}

async function laidOut(node: React.ReactElement) {
  await render(node);
  await fireEvent(screen.getByTestId('ruler'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 48 } },
  });
}

describe('GramsRuler pure rules', () => {
  it('snaps to the step grid and clamps into min..max', () => {
    expect(snapRulerValue(183.4, 0, 1000, 1)).toBe(183);
    expect(snapRulerValue(183.4, 0, 1000, 5)).toBe(185);
    expect(snapRulerValue(-20, 0, 1000, 1)).toBe(0);
    expect(snapRulerValue(5000, 0, 1000, 1)).toBe(1000);
  });

  it('lowers the value when dragged right and raises it when dragged left, 1 pt per unit', () => {
    expect(rulerValueAfterDrag(180, 30, 0, 1000, 1)).toBe(150);
    expect(rulerValueAfterDrag(180, -45, 0, 1000, 1)).toBe(225);
    expect(rulerValueAfterDrag(180, -45, 0, 1000, 10)).toBe(230);
    expect(rulerValueAfterDrag(20, 100, 0, 1000, 1)).toBe(0);
  });

  it('draws minor ticks every 10 pt and a major tick every 50', () => {
    const ticks = rulerTicks(180, 300, 50);
    expect(ticks.map((tick) => tick.unit - 180)).toContain(0);
    expect(ticks.find((tick) => tick.unit === 150)?.major).toBe(true);
    expect(ticks.find((tick) => tick.unit === 160)?.major).toBe(false);
    expect(ticks.find((tick) => tick.unit === 180)?.x).toBe(150);
    expect(ticks.find((tick) => tick.unit === 190)?.x).toBe(160);
  });

  it('fades ticks toward the two edges', () => {
    expect(rulerTickOpacity(0, 300)).toBe(1);
    expect(rulerTickOpacity(149, 300)).toBeLessThan(0.1);
    expect(rulerTickOpacity(-149, 300)).toBe(rulerTickOpacity(149, 300));
  });
});

describe('GramsRuler', () => {
  it('is an adjustable element with a label, the value and increment / decrement actions', async () => {
    await laidOut(<Harness />);
    const ruler = screen.getByTestId('ruler');
    expect(ruler).toHaveProp('accessibilityRole', 'adjustable');
    expect(ruler).toHaveProp('accessibilityLabel', 'Grams ruler');
    expect(ruler).toHaveProp('accessibilityValue', { min: 0, max: 1000, now: 180, text: '180' });
    expect(ruler).toHaveProp('accessibilityActions', [{ name: 'increment' }, { name: 'decrement' }]);
  });

  it('increments and decrements by step through the accessibility actions', async () => {
    const onChange = jest.fn();
    await render(
      <GramsRuler
        value={180}
        onChange={onChange}
        min={0}
        max={1000}
        step={5}
        accessibilityLabel="Grams ruler"
        testID="ruler"
      />,
    );
    const ruler = screen.getByTestId('ruler');
    await fireEvent(ruler, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(185);
    await fireEvent(ruler, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith(175);
  });

  it('does not go past min or max through the accessibility actions', async () => {
    const onChange = jest.fn();
    await render(
      <GramsRuler value={0} onChange={onChange} min={0} max={1000} accessibilityLabel="Grams ruler" testID="ruler" />,
    );
    await fireEvent(screen.getByTestId('ruler'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('changes the value in whole units while dragging', async () => {
    await laidOut(<Harness />);
    const ruler = screen.getByTestId('ruler');
    await act(async () => {
      fireEvent(ruler, 'responderGrant', { nativeEvent: { pageX: 200 } });
      fireEvent(ruler, 'responderMove', { nativeEvent: { pageX: 170 } });
    });
    expect(screen.getByTestId('ruler.value')).toHaveTextContent('210');
    await act(async () => {
      fireEvent(ruler, 'responderMove', { nativeEvent: { pageX: 230.4 } });
    });
    expect(screen.getByTestId('ruler.value')).toHaveTextContent('150');
  });

  it('shows the needle in accent strong and the value in accent ink', async () => {
    await laidOut(<Harness />);
    expect(screen.getByTestId('ruler.needle')).toHaveStyle({ backgroundColor: lightColors.accentStrong, width: 3 });
    expect(screen.getByTestId('ruler.value')).toHaveStyle({ color: lightColors.accentInk, fontWeight: '700' });
  });

  it('draws the ticks once it has a width', async () => {
    await render(<Harness />);
    expect(screen.queryByTestId('ruler.tick.180')).toBeNull();
    await fireEvent(screen.getByTestId('ruler'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 48 } },
    });
    expect(screen.getByTestId('ruler.tick.180')).toBeOnTheScreen();
    expect(screen.getByTestId('ruler.tick.150')).toHaveProp('strokeWidth', 2);
    expect(screen.getByTestId('ruler.tick.160')).toHaveProp('strokeWidth', 1);
  });
});
