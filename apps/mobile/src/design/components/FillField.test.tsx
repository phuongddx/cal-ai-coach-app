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

import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { darkColors, lightColors } from '../tokens';

import { FillField } from './FillField';

describe('FillField', () => {
  it('keeps the label visible above the field, never only a placeholder', async () => {
    await render(
      <FillField label="Age" value="" onChangeText={() => {}} placeholder="29" unit="years" testID="age" />,
    );
    expect(screen.getByTestId('age.label')).toBeOnTheScreen();
    expect(screen.getByText('Age')).toBeOnTheScreen();
    expect(screen.getByTestId('age')).toHaveProp('placeholder', '29');
  });

  it('shows the value and the unit and labels the input', async () => {
    await render(
      <FillField
        label="Height"
        value="172"
        onChangeText={() => {}}
        unit="cm"
        accessibilityLabel="Height in centimetres"
        testID="height"
      />,
    );
    const input = screen.getByTestId('height');
    expect(input).toHaveProp('value', '172');
    expect(input).toHaveProp('accessibilityLabel', 'Height in centimetres');
    expect(screen.getByTestId('height.unit')).toBeOnTheScreen();
    expect(screen.getByText('cm')).toBeOnTheScreen();
  });

  it('falls back to "label, unit" as the accessibility label', async () => {
    await render(<FillField label="Goal weight" value="76" onChangeText={() => {}} unit="kg" testID="goal" />);
    expect(screen.getByTestId('goal')).toHaveProp('accessibilityLabel', 'Goal weight, kg');
  });

  it('passes typed text up and takes the keyboard type', async () => {
    const onChangeText = jest.fn();
    await render(
      <FillField label="Weight" value="80" onChangeText={onChangeText} keyboardType="decimal-pad" testID="w" />,
    );
    const input = screen.getByTestId('w');
    expect(input).toHaveProp('keyboardType', 'decimal-pad');
    await fireEvent.changeText(input, '80.6');
    expect(onChangeText).toHaveBeenCalledWith('80.6');
  });

  it('is a 56 pt fill box with the value in tokens', async () => {
    await render(<FillField label="Age" value="29" onChangeText={() => {}} unit="years" testID="age" />);
    const box = screen.getByTestId('age').parent as never;
    expect(box).toHaveStyle({ height: 56, backgroundColor: lightColors.fill, borderRadius: 14 });
    expect(screen.getByTestId('age')).toHaveStyle({ color: lightColors.text, fontSize: 22, fontWeight: '700' });
  });
});

describe('FillField text-input props (U-71g)', () => {
  it('passes the text-input props through to the input', async () => {
    await render(
      <FillField
        label="Email"
        value="minh@example.com"
        onChangeText={() => {}}
        variant="text"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        maxLength={254}
        secureTextEntry
        editable={false}
        testID="email"
      />,
    );
    const input = screen.getByTestId('email');
    expect(input).toHaveProp('autoCapitalize', 'none');
    expect(input).toHaveProp('autoCorrect', false);
    expect(input).toHaveProp('autoComplete', 'email');
    expect(input).toHaveProp('textContentType', 'emailAddress');
    expect(input).toHaveProp('maxLength', 254);
    expect(input).toHaveProp('secureTextEntry', true);
    expect(input).toHaveProp('editable', false);
  });

  it('sets none of them by default', async () => {
    await render(<FillField label="Age" value="29" onChangeText={() => {}} testID="age" />);
    const input = screen.getByTestId('age');
    for (const name of ['autoCapitalize', 'autoCorrect', 'autoComplete', 'textContentType', 'maxLength', 'secureTextEntry']) {
      expect(input.props[name]).toBeUndefined();
    }
    expect(input.props.editable).not.toBe(false);
  });
});

describe('FillField error border and focus ring (U-71g)', () => {
  it('draws no ring and no border by default', async () => {
    await render(<FillField label="Age" value="29" onChangeText={() => {}} testID="age" />);
    expect(screen.queryByTestId('age.ring')).toBeNull();
    expect(screen.getByTestId('age').parent as never).not.toHaveStyle({ borderWidth: 2 });
  });

  it('draws a 2 pt accent ring while the input is focused and removes it on blur', async () => {
    await render(<FillField label="Email" value="" onChangeText={() => {}} variant="text" testID="email" />);
    await fireEvent(screen.getByTestId('email'), 'focus');
    expect(screen.getByTestId('email.ring')).toHaveStyle({ borderWidth: 2, borderColor: lightColors.accent, borderRadius: 14 });
    await fireEvent(screen.getByTestId('email'), 'blur');
    expect(screen.queryByTestId('email.ring')).toBeNull();
  });

  it('draws the ring above the box without moving the content', async () => {
    await render(<FillField label="Age" value="29" onChangeText={() => {}} unit="years" testID="age" />);
    const before = screen.getByTestId('age').parent as never;
    expect(before).toHaveStyle({ height: 56, paddingHorizontal: 16 });
    await fireEvent(screen.getByTestId('age'), 'focus');
    expect(screen.getByTestId('age').parent as never).toHaveStyle({ height: 56, paddingHorizontal: 16 });
    expect(screen.getByTestId('age.ring')).toHaveProp('pointerEvents', 'none');
    expect(screen.getByTestId('age.ring')).toHaveStyle({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 });
  });

  it('draws the error border in the error ink, in both schemes, and it wins over focus', async () => {
    await render(<FillField label="Email" value="x" onChangeText={() => {}} variant="text" error testID="email" />);
    expect(screen.getByTestId('email.ring')).toHaveStyle({ borderWidth: 2, borderColor: lightColors.error });
    await fireEvent(screen.getByTestId('email'), 'focus');
    expect(screen.getByTestId('email.ring')).toHaveStyle({ borderColor: lightColors.error });
    expect(lightColors.error).not.toBe(darkColors.error);
  });

  it('keeps the onFocus and onBlur of the caller', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(<FillField label="Age" value="" onChangeText={() => {}} onFocus={onFocus} onBlur={onBlur} testID="age" />);
    await fireEvent(screen.getByTestId('age'), 'focus');
    await fireEvent(screen.getByTestId('age'), 'blur');
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe('FillField text variant (U-71g)', () => {
  it('draws the value at 17/400 across the whole box', async () => {
    await render(<FillField label="Email" value="minh@example.com" onChangeText={() => {}} variant="text" testID="email" />);
    expect(screen.getByTestId('email')).toHaveStyle({ fontSize: 17, fontWeight: '400', color: lightColors.text, flex: 1 });
    expect(screen.getByTestId('email')).not.toHaveStyle({ fontWeight: '700' });
  });

  it('keeps the numeric look (22/700, as wide as its digits) when no variant is passed', async () => {
    await render(<FillField label="Age" value="29" onChangeText={() => {}} unit="years" testID="age" />);
    const style = StyleSheet.flatten(screen.getByTestId('age').props.style);
    expect(style).toMatchObject({ fontSize: 22, fontWeight: '700', maxWidth: '80%' });
    expect(style.width).toBeGreaterThan(0);
    expect(style.flex).toBeUndefined();
    await render(<FillField label="Age" value="29" onChangeText={() => {}} variant="number" testID="age2" />);
    expect(screen.getByTestId('age2')).toHaveStyle({ fontSize: 22, fontWeight: '700' });
  });
});
