/**
 * Dual-react preamble: jest-expo pins `react-native` but not `react`; app-side
 * requests are re-pointed onto the renderer's copy. See findings/U-22.md.
 */
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

import { render, screen, userEvent } from '@testing-library/react-native';

import { SecondaryButton, secondaryButtonStyle } from './SecondaryButton';
import { lightColors } from '../tokens';

describe('SecondaryButton', () => {
  it('renders its title and fires its action', async () => {
    const action = jest.fn();
    await render(<SecondaryButton title="Skip" action={action} />);
    await userEvent.press(screen.getByRole('button'));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('shows a border only in the bordered variant', async () => {
    const { rerender } = await render(<SecondaryButton title="Skip" bordered />);
    expect(screen.getByRole('button')).toHaveStyle({
      borderColor: lightColors.border,
    });
    await rerender(<SecondaryButton title="Skip" />);
    expect(screen.getByRole('button')).toHaveStyle({
      borderColor: 'transparent',
    });
  });

  it('maps the pressed visual state like CCSecondaryButtonStyle', () => {
    expect(secondaryButtonStyle(true, lightColors.border, false)).toEqual(
      expect.objectContaining({
        borderWidth: 1,
        borderColor: lightColors.border,
        opacity: 1,
      }),
    );
    expect(secondaryButtonStyle(true, lightColors.border, true)).toEqual(
      expect.objectContaining({ opacity: 0.7 }),
    );
    expect(secondaryButtonStyle(false, lightColors.border, false)).toEqual(
      expect.objectContaining({ borderColor: 'transparent' }),
    );
  });
});
