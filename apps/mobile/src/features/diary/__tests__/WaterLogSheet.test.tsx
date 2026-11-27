/**
 * RNTL screen test of WaterLogSheet (DY-07): the ring, the totals copy, the
 * ±250 ml tiles with their Swift identifiers and the close button.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { WaterLogSheet } from '../screens/WaterCard';

describe('WaterLogSheet screen', () => {
  it('the sheet shows the ring, the glasses and the day total', async () => {
    await render(<WaterLogSheet totalMl={1250} glasses={8} onQuickAdd={() => undefined} onDismiss={() => undefined} />);

    expect(screen.getByText('Water')).toBeOnTheScreen();
    expect(screen.getByTestId('water-droplet-ring', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('5 of 8 glasses')).toBeOnTheScreen();
    expect(screen.getByText('1,250 ml today')).toBeOnTheScreen();
    expect(screen.getByTestId('water.close')).toBeOnTheScreen();
  });

  it('the minus tile hands −250 to the quick-add', async () => {
    const onQuickAdd = jest.fn();
    await render(<WaterLogSheet totalMl={1250} glasses={8} onQuickAdd={onQuickAdd} onDismiss={() => undefined} />);
    fireEvent.press(screen.getByTestId('water.subtract'));
    expect(onQuickAdd).toHaveBeenCalledWith(-250);
  });

  it('the plus tile hands +250 to the quick-add', async () => {
    const onQuickAdd = jest.fn();
    await render(<WaterLogSheet totalMl={1250} glasses={8} onQuickAdd={onQuickAdd} onDismiss={() => undefined} />);
    fireEvent.press(screen.getByTestId('water.add'));
    expect(onQuickAdd).toHaveBeenCalledWith(250);
  });

  it('Close dismisses the sheet', async () => {
    const onDismiss = jest.fn();
    await render(<WaterLogSheet totalMl={1250} glasses={8} onQuickAdd={() => undefined} onDismiss={onDismiss} />);
    fireEvent.press(screen.getByTestId('water.close'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
