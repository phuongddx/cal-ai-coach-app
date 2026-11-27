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

import { SecondaryButton, secondaryButtonStyle, secondaryDisabledOpacity } from './SecondaryButton';
import { lightColors } from '../tokens';

describe('SecondaryButton', () => {
  it('passes testID to the Pressable', async () => {
    await render(<SecondaryButton title="Skip" testID="scan.skip" action={() => undefined} />);
    expect(screen.getByTestId('scan.skip')).toBe(screen.getByRole('button'));
  });

  it('renders its title and fires its action', async () => {
    const action = jest.fn();
    await render(<SecondaryButton title="Skip" action={action} />);
    await userEvent.press(screen.getByRole('button'));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('shows a border only in the bordered variant', async () => {
    const { rerender } = await render(<SecondaryButton title="Skip" bordered action={() => undefined} />);
    expect(screen.getByRole('button')).toHaveStyle({
      borderColor: lightColors.border,
    });
    await rerender(<SecondaryButton title="Skip" action={() => undefined} />);
    expect(screen.getByRole('button')).toHaveStyle({
      borderColor: 'transparent',
    });
  });

  it('maps the pressed visual state like CCSecondaryButtonStyle', () => {
    expect(secondaryButtonStyle(true, lightColors, false)).toEqual(
      expect.objectContaining({
        borderWidth: 1,
        borderColor: lightColors.border,
        opacity: 1,
      }),
    );
    expect(secondaryButtonStyle(true, lightColors, true)).toEqual(
      expect.objectContaining({ opacity: 0.7 }),
    );
    expect(secondaryButtonStyle(false, lightColors, false)).toEqual(
      expect.objectContaining({ borderColor: 'transparent' }),
    );
  });

  // Ember canvas `.btn.secondary`: fill background, text label, 56 pt, radius 18.
  it('draws the Ember secondary button', async () => {
    await render(<SecondaryButton title="Skip" action={() => undefined} />);
    expect(screen.getByRole('button')).toHaveStyle({
      backgroundColor: lightColors.fill,
      minHeight: 56,
      borderRadius: 18,
    });
    expect(screen.getByText('Skip')).toHaveStyle({ color: lightColors.text });
  });

  it('is enabled by default and says so to assistive tech', async () => {
    await render(<SecondaryButton title="Skip" action={() => undefined} />);
    expect(screen.getByRole('button').props.accessibilityState).toEqual({ disabled: false });
  });

  // design-system.md audit #52: a button that cannot act says so instead of looking pressable.
  it('disabled: dimmed, ignores presses and reports accessibilityState.disabled', async () => {
    const action = jest.fn();
    await render(<SecondaryButton title="Change plan" action={action} disabled />);
    const button = screen.getByRole('button');
    expect(button.props.accessibilityState).toEqual({ disabled: true });
    expect(button).toHaveStyle({ opacity: secondaryDisabledOpacity });
    await userEvent.press(button);
    expect(action).not.toHaveBeenCalled();
  });

  it('maps the disabled visual state: dimmed, and a press does not change it', () => {
    expect(secondaryButtonStyle(false, lightColors, false, true)).toEqual(
      expect.objectContaining({ opacity: secondaryDisabledOpacity }),
    );
    expect(secondaryButtonStyle(false, lightColors, true, true)).toEqual(
      expect.objectContaining({ opacity: secondaryDisabledOpacity }),
    );
  });
});
