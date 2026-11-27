/**
 * RNTL screen test of ExerciseLogSheet (DY-06): the type field, the 5-minute
 * stepper with its 0–600 clamp, the optional burned kcal clamped 0–5000 and
 * the disabled Save. The model is a test double.
 */
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { setEdSafeMode } from '../../../design';

import type { DiaryDayModel } from '../diaryDayModel';
import { ExerciseLogSheet } from '../screens/ExerciseLogSheet';

function makeModel(addExercise = jest.fn(async () => undefined)): DiaryDayModel {
  return {
    getSnapshot: () => {
      throw new Error('not used');
    },
    subscribe: () => () => undefined,
    refresh: async () => undefined,
    getDay: () => new Date(2026, 8, 12, 9, 0),
    selectDay: () => undefined,
    dayHeading: () => 'Saturday, Sep 12',
    isToday: () => true,
    eatenKcal: () => 0,
    goalKcal: () => null,
    leftKcal: () => null,
    sectionKcal: () => 0,
    burnedKcal: () => null,
    items: () => [],
    delete: async () => undefined,
    deleteEntry: async () => undefined,
    updateEntry: async () => undefined,
    undoDelete: async () => undefined,
    writeEntry: async () => undefined,
    addExercise,
  };
}

async function renderSheet(model = makeModel(), onDismiss = jest.fn()) {
  await render(<ExerciseLogSheet model={model} onDismiss={onDismiss} />);
  return { model, onDismiss };
}

afterEach(() => {
  setEdSafeMode(false);
});

describe('ExerciseLogSheet screen', () => {
  it('the sheet shows the type field, the duration stepper and the optional kcal', async () => {
    await renderSheet();

    expect(screen.getByText('Add exercise')).toBeOnTheScreen();
    expect(screen.getByTestId('exercise.close')).toBeOnTheScreen();
    expect(screen.getByTestId('exercise.typeField')).toBeOnTheScreen();
    expect(screen.getByTestId('ccstepper.decrement')).toBeOnTheScreen();
    expect(screen.getByTestId('ccstepper.increment')).toBeOnTheScreen();
    expect(screen.getByText('30 min')).toBeOnTheScreen();
    expect(screen.getByTestId('exercise.kcalField')).toBeOnTheScreen();
    expect(screen.queryByText('Activity and minutes only.')).toBeNull();
    expect(screen.queryByText('Burned kcal is hidden.')).toBeNull();
    expect(screen.getByTestId('exercise.save')).toBeOnTheScreen();
  });

  it('the burned kcal field hides behind the note in the ED-safe mode and returns when it is off', async () => {
    setEdSafeMode(true);
    await renderSheet();

    expect(screen.queryByTestId('exercise.kcalField')).toBeNull();
    expect(screen.getByText('Activity and minutes only.')).toBeOnTheScreen();
    expect(screen.getByText('Burned kcal is hidden.')).toBeOnTheScreen();
    // The activity fields and Save stay.
    expect(screen.getByTestId('exercise.typeField')).toBeOnTheScreen();
    expect(screen.getByTestId('exercise.save')).toBeOnTheScreen();

    setEdSafeMode(false);
    await waitFor(() => expect(screen.getByTestId('exercise.kcalField')).toBeOnTheScreen());
    expect(screen.queryByText('Activity and minutes only.')).toBeNull();
    expect(screen.queryByText('Burned kcal is hidden.')).toBeNull();
  });

  it('Save stays disabled while the type is empty', async () => {
    await renderSheet();
    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState.disabled).toBe(true);
  });

  it('the duration stepper moves in 5-minute steps', async () => {
    await renderSheet();

    await userEvent.press(screen.getByTestId('ccstepper.increment'));
    await waitFor(() => expect(screen.getByText('35 min')).toBeOnTheScreen());
    await userEvent.press(screen.getByTestId('ccstepper.decrement'));
    await userEvent.press(screen.getByTestId('ccstepper.decrement'));
    await waitFor(() => expect(screen.getByText('25 min')).toBeOnTheScreen());
  });

  it('saving writes the exercise and dismisses the sheet', async () => {
    const addExercise = jest.fn(async () => undefined);
    const { onDismiss } = await renderSheet(makeModel(addExercise));

    await userEvent.type(screen.getByTestId('exercise.typeField'), 'cycling');
    await userEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(addExercise).toHaveBeenCalledWith('cycling', 30, null));
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
  });

  it('the burned kcal clamps into 0…5000 at the model boundary', async () => {
    const addExercise = jest.fn(async () => undefined);
    await renderSheet(makeModel(addExercise));

    await userEvent.type(screen.getByTestId('exercise.typeField'), 'hiit');
    await userEvent.type(screen.getByTestId('exercise.kcalField'), '9000');
    await userEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(addExercise).toHaveBeenCalledWith('hiit', 30, 5000));
  });

  it('Close dismisses the sheet without writing', async () => {
    const addExercise = jest.fn(async () => undefined);
    const { onDismiss } = await renderSheet(makeModel(addExercise));
    await userEvent.press(screen.getByTestId('exercise.close'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(addExercise).not.toHaveBeenCalled();
  });
});
