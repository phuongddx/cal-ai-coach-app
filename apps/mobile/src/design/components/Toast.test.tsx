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

import { act, render, screen, userEvent } from '@testing-library/react-native';
import { useEffect } from 'react';

import { toastVisibleKcalText, Toast } from './Toast';
import { setEdSafeMode } from '../edSafe';

beforeEach(() => setEdSafeMode(false));

// Port of ComponentContractTests.testToastHidesKcalLineUnderEDSafe.
describe('Toast ED-safe kcal rule', () => {
  it('hides the kcal line with the mode on', () => {
    expect(toastVisibleKcalText('640 kcal added', true)).toBeUndefined();
    expect(toastVisibleKcalText('640 kcal added', false)).toBe('640 kcal added');
  });
});

// Port of ComponentContractTests.testToastRendersTitleAndKcalByDefault.
describe('Toast rendering', () => {
  it('renders title and kcal line and exposes undo', async () => {
    const onUndo = jest.fn();
    await render(<Toast title="Saved to Lunch" kcalText="640 kcal added" onUndo={onUndo} />);
    expect(screen.getByText('Saved to Lunch', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('640 kcal added', { includeHiddenElements: true })).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('toast:undo'));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('drops the kcal line while ED-safe mode is on', async () => {
    await render(<Toast title="Saved to Lunch" kcalText="640 kcal added" />);
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.queryByText('640 kcal added', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('Saved to Lunch', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('auto-dismisses after 4 seconds', async () => {
    jest.useFakeTimers();
    try {
      const onDismiss = jest.fn();
      await render(<Toast title="Saved" onDismiss={onDismiss} />);
      expect(onDismiss).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(4000);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not schedule a dismissal without onDismiss', async () => {
    const onDismissSpy = jest.spyOn(globalThis, 'setTimeout');
    await render(<Toast title="Saved" />);
    expect(onDismissSpy).not.toHaveBeenCalled();
    onDismissSpy.mockRestore();
  });
});

// The timer path goes through useEffect — a bare probe proving effects run.
describe('effects', () => {
  it('run for rendered components', async () => {
    let ran = false;
    function EffectProbe() {
      useEffect(() => {
        ran = true;
      }, []);
      return null;
    }
    await render(<EffectProbe />);
    expect(ran).toBe(true);
  });
});
