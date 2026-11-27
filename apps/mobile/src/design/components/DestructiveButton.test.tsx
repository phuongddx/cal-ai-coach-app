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

import { render, screen, userEvent } from '@testing-library/react-native';

import { DestructiveButton, destructiveButtonStyle } from './DestructiveButton';
import { darkColors, lightColors } from '../tokens';

describe('DestructiveButton (Ember .btn.danger)', () => {
  it('draws errorTint with an errorInk label, 56 pt, radius 18', async () => {
    await render(<DestructiveButton title="Delete account" action={() => undefined} testID="del" />);
    expect(screen.getByTestId('del')).toBe(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveStyle({
      backgroundColor: lightColors.errorTint,
      minHeight: 56,
      borderRadius: 18,
    });
    expect(screen.getByText('Delete account')).toHaveStyle({ color: lightColors.errorInk });
  });

  it('maps both schemes and the pressed state', () => {
    for (const colors of [lightColors, darkColors]) {
      expect(destructiveButtonStyle(colors, false)).toEqual(
        expect.objectContaining({ backgroundColor: colors.errorTint, opacity: 1 }),
      );
    }
    expect(destructiveButtonStyle(lightColors, true)).toEqual(expect.objectContaining({ opacity: 0.7 }));
  });

  it('fires its required action', async () => {
    const action = jest.fn();
    await render(<DestructiveButton title="Cancel plan" action={action} />);
    await userEvent.press(screen.getByRole('button'));
    expect(action).toHaveBeenCalledTimes(1);
  });
});
