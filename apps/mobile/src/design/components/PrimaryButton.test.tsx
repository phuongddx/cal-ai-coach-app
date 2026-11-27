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

import { PrimaryButton, primaryButtonLabelColor, primaryButtonStyle } from './PrimaryButton';
import { darkColors, lightColors, radius, size } from '../tokens';

describe('PrimaryButton', () => {
  it('renders its title as a button', async () => {
    await render(<PrimaryButton title="Save entry" />);
    expect(screen.getByRole('button')).toBeOnTheScreen();
    expect(screen.getByText('Save entry')).toBeOnTheScreen();
  });

  it('passes testID to the Pressable', async () => {
    await render(<PrimaryButton title="Save entry" testID="scan.save" />);
    expect(screen.getByTestId('scan.save')).toBe(screen.getByRole('button'));
  });

  it('fires its action on press', async () => {
    const action = jest.fn();
    await render(<PrimaryButton title="Save entry" action={action} />);
    await userEvent.press(screen.getByRole('button'));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not fire while disabled and shows the disabled fill', async () => {
    const action = jest.fn();
    await render(<PrimaryButton title="Save entry" action={action} disabled />);
    const button = screen.getByRole('button');
    expect(button.props.accessibilityState.disabled).toBe(true);
    await userEvent.press(button);
    expect(action).not.toHaveBeenCalled();
    expect(primaryButtonStyle(lightColors, false, false)).toEqual(
      expect.objectContaining({ backgroundColor: lightColors.fill, opacity: 1 }),
    );
  });

  it('maps the pressed/enabled visual state like CCPrimaryButtonStyle', () => {
    expect(primaryButtonStyle(lightColors, false, true)).toEqual(
      expect.objectContaining({
        backgroundColor: lightColors.accent,
        opacity: 1,
        transform: [{ scale: 1 }],
      }),
    );
    expect(primaryButtonStyle(lightColors, true, true)).toEqual(
      expect.objectContaining({
        backgroundColor: lightColors.accentPressed,
        transform: [{ scale: 0.96 }],
        opacity: 1,
      }),
    );
  });

  // Ember canvas `.btn.primary`: accent fill, onAccent label (never white), 56 pt, radius 18.
  it('draws the Ember primary button in both schemes', async () => {
    for (const colors of [lightColors, darkColors]) {
      expect(primaryButtonStyle(colors, false, true)).toEqual(
        expect.objectContaining({
          backgroundColor: colors.accent,
          minHeight: 56,
          borderRadius: 18,
        }),
      );
      expect(primaryButtonLabelColor(colors, true)).toBe(colors.onAccent);
      expect(primaryButtonLabelColor(colors, true)).not.toBe(colors.card);
      expect(primaryButtonLabelColor(colors, false)).toBe(colors.text2);
    }
    expect(size.btn).toBe(56);
    expect(radius.button).toBe(18);
    await render(<PrimaryButton title="Save entry" />);
    expect(screen.getByRole('button')).toHaveStyle({
      backgroundColor: lightColors.accent,
      minHeight: 56,
      borderRadius: 18,
    });
    expect(screen.getByText('Save entry')).toHaveStyle({ color: lightColors.onAccent });
  });
});
