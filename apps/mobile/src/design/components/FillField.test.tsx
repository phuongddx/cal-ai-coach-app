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

import { lightColors } from '../tokens';

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
