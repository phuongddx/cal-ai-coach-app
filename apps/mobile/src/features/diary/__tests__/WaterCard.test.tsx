/**
 * RNTL screen test of WaterCard (DY-07): the droplet tile, the glasses copy,
 * the accessibility label and the tap into the log sheet.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { WaterCard } from '../screens/WaterCard';

describe('WaterCard screen', () => {
  it('the card shows the droplet tile, the glasses copy and the goal caption', async () => {
    const onTap = jest.fn();
    await render(<WaterCard waterMl={1250} glasses={8} onTap={onTap} />);

    expect(screen.getByTestId('today.waterCard')).toBeOnTheScreen();
    expect(screen.getByLabelText('Water, 5 of 8 glasses')).toBeOnTheScreen();
    expect(screen.getByText('Water')).toBeOnTheScreen();
    expect(screen.getByText('5 of 8 glasses')).toBeOnTheScreen();
  });

  it('a tap hands over to the log sheet', async () => {
    const onTap = jest.fn();
    await render(<WaterCard waterMl={1250} glasses={8} onTap={onTap} />);
    fireEvent.press(screen.getByTestId('today.waterCard'));
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});
