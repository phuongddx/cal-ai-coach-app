/**
 * RNTL screen test of WeightLogSheet (PG-02): the heading, the close, the
 * wheel field over the clamped domain and the Save hand-over.
 */
import { render, screen, userEvent, within } from '@testing-library/react-native';

import { WeightLogSheet } from '../screens/WeightLogSheet';

describe('WeightLogSheet screen', () => {
  it('the sheet shows the heading, the close, the wheel at the current weight and Save', async () => {
    const onSave = jest.fn();
    const onDismiss = jest.fn();
    await render(<WeightLogSheet currentKg={82.4} onSave={onSave} onDismiss={onDismiss} />);

    expect(screen.getByText('Log weight')).toBeOnTheScreen();
    expect(screen.getByTestId('progress.closeWeightSheet')).toBeOnTheScreen();
    expect(screen.getByTestId('progress.saveWeight')).toBeOnTheScreen();
    expect(screen.getByTestId('wheel-value:Weight').props.children).toBe('82.4 kg'); // the current weight preselected
  });

  it('a missing current weight starts the wheel at 80 kg', async () => {
    const onSave = jest.fn();
    const onDismiss = jest.fn();
    await render(<WeightLogSheet currentKg={null} onSave={onSave} onDismiss={onDismiss} />);

    expect(screen.getByTestId('wheel-value:Weight').props.children).toBe('80.0 kg'); // the Swift default
  });

  it('an out-of-range current weight starts the wheel clamped', async () => {
    const onSave = jest.fn();
    const onDismiss = jest.fn();
    await render(<WeightLogSheet currentKg={1_000} onSave={onSave} onDismiss={onDismiss} />);

    expect(screen.getByTestId('wheel-value:Weight').props.children).toBe('250.0 kg'); // clamped at the model boundary
  });

  it('Close dismisses without saving', async () => {
    const onSave = jest.fn();
    const onDismiss = jest.fn();
    const user = userEvent.setup();
    await render(<WeightLogSheet currentKg={82.4} onSave={onSave} onDismiss={onDismiss} />);

    await user.press(screen.getByTestId('progress.closeWeightSheet'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Save hands the selection over and dismisses', async () => {
    const onSave = jest.fn();
    const onDismiss = jest.fn();
    const user = userEvent.setup();
    await render(<WeightLogSheet currentKg={82.4} onSave={onSave} onDismiss={onDismiss} />);

    await user.press(within(screen.getByTestId('progress.saveWeight')).getByRole('button'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(82.4);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
