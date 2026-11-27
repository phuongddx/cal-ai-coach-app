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

import { carriesCalorieFigure, toastVisibleKcalText, toastVisibleMessage, Toast } from './Toast';
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

/** The table of the U-71f brief, the same rows as FoodRow.test.tsx and calorieFigure.test.ts. */
const HIDDEN_MESSAGES = [
  'Calories today: 1,850',
  '640 kcal',
  'kJ',
  '220 cals',
  '5 kilojoules',
  '640kJs',
  '220cals',
  '1,850 Calories',
  '6CAL',
  'Cal 640',
  '640kcal',
  'kcal.',
  'calories,',
  'kilojoule',
  'About 300 cal',
];
const SHOWN_MESSAGES = [
  'Changes saved',
  'Chicken · 180 g',
  'Edited',
  'Calm bowl',
  'calcium 220 mg',
  'December',
  'escalate',
  'scalable',
  'Calzone',
  '150 g · 2 pieces',
];

describe('Toast ED-safe screen of the message, every form of the calorie words', () => {
  it.each(HIDDEN_MESSAGES)('hides the message %j under ED-safe, from the line and the spoken label, and shows it otherwise', async (text) => {
    expect(toastVisibleMessage(text, true)).toBeUndefined();
    expect(toastVisibleMessage(text, false)).toBe(text);
    await render(<Toast title="Saved" message={text} />);
    expect(screen.getByTestId('toast:message', { includeHiddenElements: true })).toHaveTextContent(text);
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.queryByTestId('toast:message', { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByText(text, { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('toast')).toHaveProp('accessibilityLabel', 'Saved');
  });

  it.each(SHOWN_MESSAGES)('keeps the message %j under ED-safe, on the line and in the spoken label', async (text) => {
    expect(toastVisibleMessage(text, true)).toBe(text);
    await render(<Toast title="Saved" message={text} />);
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.getByTestId('toast:message', { includeHiddenElements: true })).toHaveTextContent(text);
    expect(screen.getByTestId('toast')).toHaveProp('accessibilityLabel', `Saved. ${text}`);
  });
});

describe('Toast message line', () => {
  it('spots a calorie figure', () => {
    expect(carriesCalorieFigure('640 kcal')).toBe(true);
    expect(carriesCalorieFigure('640kcal added')).toBe(true);
    expect(carriesCalorieFigure('Chicken salad · 1,200 Cal')).toBe(true);
    expect(carriesCalorieFigure('Total kcal today')).toBe(true);
    expect(carriesCalorieFigure('Chicken salad · 180 g')).toBe(false);
    expect(carriesCalorieFigure('Calm bowl · 250 g')).toBe(false);
  });

  it('hides a calorie word whatever comes before it, and a number followed by one', () => {
    for (const text of ['Calories today: 1,850', 'Calories: 640', '640 kcal', 'kJ', 'Total cal', '2,400kJ left', 'Calorie goal']) {
      expect(carriesCalorieFigure(text)).toBe(true);
      expect(toastVisibleMessage(text, true)).toBeUndefined();
      expect(toastVisibleMessage(text, false)).toBe(text);
    }
    for (const text of ['Changes saved', 'Chicken · 180 g', 'Edited']) {
      expect(carriesCalorieFigure(text)).toBe(false);
      expect(toastVisibleMessage(text, true)).toBe(text);
    }
  });

  it('renders none of "Calories today: 1,850" under ED-safe and all six cases through the component', async () => {
    const { rerender } = await render(<Toast title="Saved" message="Calories today: 1,850" />);
    expect(screen.getByText('Calories today: 1,850', { includeHiddenElements: true })).toBeOnTheScreen();
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.queryByText('Calories today: 1,850', { includeHiddenElements: true })).toBeNull();
    for (const hidden of ['640 kcal', 'kJ']) {
      await rerender(<Toast title="Saved" message={hidden} />);
      expect(screen.queryByText(hidden, { includeHiddenElements: true })).toBeNull();
    }
    for (const shown of ['Changes saved', 'Chicken · 180 g', 'Edited']) {
      await rerender(<Toast title="Saved" message={shown} />);
      expect(screen.getByText(shown, { includeHiddenElements: true })).toBeOnTheScreen();
    }
  });

  it('keeps a plain message in every mode and hides a kcal message only under ED-safe', () => {
    expect(toastVisibleMessage('Chicken salad · 180 g', true)).toBe('Chicken salad · 180 g');
    expect(toastVisibleMessage('Chicken salad · 180 g', false)).toBe('Chicken salad · 180 g');
    expect(toastVisibleMessage('Chicken salad · 640 kcal', false)).toBe('Chicken salad · 640 kcal');
    expect(toastVisibleMessage('Chicken salad · 640 kcal', true)).toBeUndefined();
    expect(toastVisibleMessage(undefined, false)).toBeUndefined();
    expect(toastVisibleMessage('', false)).toBeUndefined();
  });

  it('renders the message as the second line and in the spoken label', async () => {
    await render(<Toast title="Entry updated" message="Chicken salad · 180 g" />);
    expect(screen.getByTestId('toast:message', { includeHiddenElements: true })).toHaveTextContent('Chicken salad · 180 g');
    expect(screen.getByTestId('toast')).toHaveProp('accessibilityLabel', 'Entry updated. Chicken salad · 180 g');
  });

  it('shows a plain message under ED-safe', async () => {
    await render(<Toast title="Entry updated" message="Chicken salad · 180 g" />);
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.getByText('Chicken salad · 180 g', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('hides a kcal message under ED-safe from the line and the spoken label, and shows it otherwise', async () => {
    await render(<Toast title="Saved" message="Chicken salad · 640 kcal" />);
    expect(screen.getByText('Chicken salad · 640 kcal', { includeHiddenElements: true })).toBeOnTheScreen();
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.queryByText('Chicken salad · 640 kcal', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('toast')).toHaveProp('accessibilityLabel', 'Saved');
  });

  it('leaves the kcal line behavior alone when both are given', async () => {
    await render(<Toast title="Saved" message="Rice · 150 g" kcalText="200 kcal added" />);
    expect(screen.getByText('Rice · 150 g', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('200 kcal added', { includeHiddenElements: true })).toBeOnTheScreen();
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(screen.getByText('Rice · 150 g', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByText('200 kcal added', { includeHiddenElements: true })).toBeNull();
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
