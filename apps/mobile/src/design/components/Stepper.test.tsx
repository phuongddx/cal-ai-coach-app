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

import { useState } from 'react';
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';

import { stepperNext, Stepper } from './Stepper';

// Port of ComponentContractTests.testStepperStepsAndClampsAtZero. The Swift test
// drives a Binding; here a stateful harness holds the controlled value.
describe('Stepper steps and clamps at zero', () => {
  it('steps +10 and back down', async () => {
    function Harness() {
      const [value, setValue] = useState(50);
      return <Stepper name="Rice" value={value} onValueChange={setValue} />;
    }
    await render(<Harness />);
    await userEvent.press(screen.getByTestId('ccstepper.decrement'));
    expect(screen.getByText('40 g', { includeHiddenElements: true })).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('ccstepper.increment'));
    expect(screen.getByText('50 g', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('clamps at the minimum and never goes negative', async () => {
    function Harness() {
      const [value, setValue] = useState(5);
      return <Stepper name="Rice" value={value} onValueChange={setValue} />;
    }
    await render(<Harness />);
    await userEvent.press(screen.getByTestId('ccstepper.decrement'));
    expect(screen.getByText('0 g', { includeHiddenElements: true })).toBeOnTheScreen();
    await userEvent.press(screen.getByTestId('ccstepper.decrement'));
    expect(screen.getByText('0 g', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(stepperNext(5, -10, 0)).toBe(0);
    expect(stepperNext(0, -10, 0)).toBe(0);
  });
});

// Port of ComponentContractTests.testStepperAdjustableActionMatchesButtons.
describe('Stepper adjustable action matches buttons', () => {
  it('decrements by the same step through the pure rule', () => {
    let value = 180;
    value = stepperNext(value, -10, 0);
    expect(value).toBe(170);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    value = stepperNext(value, -10, 0);
    expect(value).toBe(0);
    value = stepperNext(value, -10, 0);
    expect(value).toBe(0);
    value = stepperNext(value, 10, 0);
    expect(value).toBe(10);
  });

  it('shows the value and the a11y value text', async () => {
    await render(<Stepper name="Rice" value={180} onValueChange={() => {}} />);
    expect(screen.getByText('180 g', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('stepper:Rice')).toHaveProp(
      'accessibilityLabel',
      'Rice',
    );
    expect(screen.getByTestId('stepper:Rice')).toHaveProp('accessibilityValue', {
      text: '180 grams',
    });
  });

  it('routes both buttons through the same rule', async () => {
    const onValueChange = jest.fn();
    await render(
      <Stepper name="Rice" value={10} onValueChange={onValueChange} step={10} minimum={0} />,
    );
    fireEvent(screen.getByTestId('ccstepper.increment'), 'press');
    expect(onValueChange).toHaveBeenLastCalledWith(20);
  });
});
