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

import { darkColors, lightColors } from '../tokens';

import { CodeField, codeFieldDigits } from './CodeField';

const cellIds = [0, 1, 2, 3, 4, 5].map((index) => `code.cell.${index}`);

describe('CodeField structure (frames 112 and 113)', () => {
  it('draws six cells in two groups of three, with a wider gap between the groups', async () => {
    await render(<CodeField value="" onChangeText={() => {}} testID="code" />);
    for (const id of cellIds) expect(screen.getByTestId(id, { includeHiddenElements: true })).toBeOnTheScreen();
    const first = screen.getByTestId('code.group.0', { includeHiddenElements: true });
    const second = screen.getByTestId('code.group.1', { includeHiddenElements: true });
    expect(first.children).toHaveLength(3);
    expect(second.children).toHaveLength(3);
    expect(first).toHaveStyle({ flexDirection: 'row', gap: 8 });
    expect(screen.getByTestId('code.cells', { includeHiddenElements: true })).toHaveStyle({
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 20,
    });
  });

  it('draws each cell as a 48 by 58 fill box with the radius of the fields', async () => {
    await render(<CodeField value="" onChangeText={() => {}} testID="code" />);
    expect(screen.getByTestId('code.cell.0', { includeHiddenElements: true })).toHaveStyle({
      width: 48,
      height: 58,
      borderRadius: 14,
      backgroundColor: lightColors.fill,
    });
  });

  it('writes one digit per cell, in text ink, and leaves the rest empty', async () => {
    await render(<CodeField value="4829" onChangeText={() => {}} testID="code" />);
    expect(screen.getByTestId('code.cell.0', { includeHiddenElements: true })).toHaveTextContent('4');
    expect(screen.getByTestId('code.cell.3', { includeHiddenElements: true })).toHaveTextContent('9');
    expect(screen.getByTestId('code.cell.4', { includeHiddenElements: true })).toHaveTextContent('');
    expect(screen.getByTestId('code.digit.0', { includeHiddenElements: true })).toHaveStyle({ color: lightColors.text, fontSize: 28 });
  });
});

describe('CodeField input (one hidden one-time-code field)', () => {
  it('is one text input with the number pad, the one-time-code hint and the label "6-digit code"', async () => {
    await render(<CodeField value="" onChangeText={() => {}} testID="code" />);
    const input = screen.getByTestId('code');
    expect(input).toHaveProp('keyboardType', 'number-pad');
    expect(input).toHaveProp('textContentType', 'oneTimeCode');
    expect(input).toHaveProp('autoComplete', 'one-time-code');
    expect(input).toHaveProp('accessibilityLabel', '6-digit code');
    expect(screen.getAllByLabelText('6-digit code', { includeHiddenElements: true })).toHaveLength(1);
  });

  it('takes the label of the caller', async () => {
    await render(<CodeField value="" onChangeText={() => {}} testID="code" accessibilityLabel="Code from the e-mail" />);
    expect(screen.getByTestId('code')).toHaveProp('accessibilityLabel', 'Code from the e-mail');
  });

  it('hides the input under the cells and keeps it focusable', async () => {
    await render(<CodeField value="" onChangeText={() => {}} testID="code" />);
    const input = screen.getByTestId('code', { includeHiddenElements: true });
    expect(input).toHaveStyle({ opacity: 0, position: 'absolute' });
    expect(input).toHaveProp('caretHidden', true);
    expect(input).not.toHaveProp('editable', false);
  });

  it('makes the cells invisible to assistive technology', async () => {
    await render(<CodeField value="48" onChangeText={() => {}} testID="code" />);
    const cells = screen.getByTestId('code.cells', { includeHiddenElements: true });
    expect(cells).toHaveProp('accessible', false);
    expect(cells).toHaveProp('accessibilityElementsHidden', true);
    expect(cells).toHaveProp('importantForAccessibility', 'no-hide-descendants');
  });

  it('fills all six cells at once from a paste or the keyboard suggestion', async () => {
    const onChangeText = jest.fn();
    await render(<CodeField value="" onChangeText={onChangeText} testID="code" />);
    await fireEvent.changeText(screen.getByTestId('code'), '482917');
    expect(onChangeText).toHaveBeenCalledWith('482917');
  });

  it('keeps digits only and at most six', async () => {
    expect(codeFieldDigits('482 917')).toBe('482917');
    expect(codeFieldDigits('482-917')).toBe('482917');
    expect(codeFieldDigits('4829171')).toBe('482917');
    expect(codeFieldDigits('ab')).toBe('');
    expect(codeFieldDigits('')).toBe('');
    const onChangeText = jest.fn();
    await render(<CodeField value="" onChangeText={onChangeText} testID="code" />);
    await fireEvent.changeText(screen.getByTestId('code'), '482 917 5');
    expect(onChangeText).toHaveBeenLastCalledWith('482917');
  });
});

describe('CodeField focus and caret (frame 112)', () => {
  it('draws the caret and the accent ring in the next empty cell while focused', async () => {
    await render(<CodeField value="48291" onChangeText={() => {}} testID="code" />);
    expect(screen.queryByTestId('code.caret', { includeHiddenElements: true })).toBeNull();
    await fireEvent(screen.getByTestId('code'), 'focus');
    expect(screen.getByTestId('code.caret', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('code.cell.5', { includeHiddenElements: true })).toHaveStyle({ borderWidth: 2, borderColor: lightColors.accent });
    expect(screen.getByTestId('code.cell.4', { includeHiddenElements: true })).toHaveStyle({ borderColor: 'transparent' });
    expect(screen.getByTestId('code.caret', { includeHiddenElements: true })).toHaveStyle({ backgroundColor: lightColors.accent });
  });

  it('puts the caret in the first cell of an empty field and removes ring and caret on blur', async () => {
    await render(<CodeField value="" onChangeText={() => {}} testID="code" />);
    await fireEvent(screen.getByTestId('code'), 'focus');
    expect(screen.getByTestId('code.cell.0', { includeHiddenElements: true })).toHaveStyle({ borderColor: lightColors.accent });
    await fireEvent(screen.getByTestId('code'), 'blur');
    expect(screen.queryByTestId('code.caret', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('code.cell.0', { includeHiddenElements: true })).toHaveStyle({ borderColor: 'transparent' });
  });

  it('keeps the ring on the last cell and no caret when the code is complete', async () => {
    await render(<CodeField value="482917" onChangeText={() => {}} testID="code" />);
    await fireEvent(screen.getByTestId('code'), 'focus');
    expect(screen.queryByTestId('code.caret', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('code.cell.5', { includeHiddenElements: true })).toHaveStyle({ borderColor: lightColors.accent });
  });
});

describe('CodeField error (frames 114 and 115)', () => {
  it('turns the six borders to the error color, whatever the focus', async () => {
    await render(<CodeField value="482917" onChangeText={() => {}} testID="code" error />);
    for (const id of cellIds) {
      expect(screen.getByTestId(id, { includeHiddenElements: true })).toHaveStyle({ borderWidth: 2, borderColor: lightColors.error });
    }
    await fireEvent(screen.getByTestId('code'), 'focus');
    for (const id of cellIds) {
      expect(screen.getByTestId(id, { includeHiddenElements: true })).toHaveStyle({ borderColor: lightColors.error });
    }
    expect(lightColors.error).not.toBe(darkColors.error);
  });

  it('has no colored border without error and without focus', async () => {
    await render(<CodeField value="482917" onChangeText={() => {}} testID="code" />);
    for (const id of cellIds) {
      expect(screen.getByTestId(id, { includeHiddenElements: true })).toHaveStyle({ borderColor: 'transparent' });
    }
  });
});
