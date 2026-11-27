/**
 * RNTL screen test of WaterCard (DY-07, the Today frame): litres in the
 * normal mode with the "+ 250 ml" chip, glasses under ED-Safe with the
 * "+ 1 glass" chip, the accessibility label and the tap into the log sheet.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { setEdSafeMode } from '../../../design';

import { WaterCard } from '../screens/WaterCard';

afterEach(() => {
  setEdSafeMode(false);
});

describe('WaterCard screen', () => {
  it('the card shows litres with the +250 ml chip in the normal mode', async () => {
    const onTap = jest.fn();
    await render(<WaterCard waterMl={1250} glasses={8} onTap={onTap} />);

    expect(screen.getByTestId('today.waterCard')).toBeOnTheScreen();
    expect(screen.getByLabelText('Water, 1.25 of 2 L')).toBeOnTheScreen();
    expect(screen.getByText('Water')).toBeOnTheScreen();
    expect(screen.getByText('1.25 of 2 L')).toBeOnTheScreen();
    expect(screen.getByText('+ 250 ml')).toBeOnTheScreen();
    expect(screen.queryByText('5 of 8 glasses')).toBeNull();
  });

  it('the card shows glasses with the +1 glass chip in the ED-safe mode and returns when it is off', async () => {
    setEdSafeMode(true);
    await render(<WaterCard waterMl={1250} glasses={8} onTap={jest.fn()} />);

    expect(screen.getByLabelText('Water, 5 of 8 glasses')).toBeOnTheScreen();
    expect(screen.getByText('5 of 8 glasses')).toBeOnTheScreen();
    expect(screen.getByText('+ 1 glass')).toBeOnTheScreen();
    expect(screen.queryByText('1.25 of 2 L')).toBeNull();
    expect(screen.queryByText('+ 250 ml')).toBeNull();

    setEdSafeMode(false);
    await waitFor(() => expect(screen.getByText('1.25 of 2 L')).toBeOnTheScreen());
    expect(screen.queryByText('5 of 8 glasses')).toBeNull();
  });

  it('a tap hands over to the log sheet', async () => {
    const onTap = jest.fn();
    await render(<WaterCard waterMl={1250} glasses={8} onTap={onTap} />);
    fireEvent.press(screen.getByTestId('today.waterCard'));
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});
