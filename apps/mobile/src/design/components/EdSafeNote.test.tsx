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

import { render, screen } from '@testing-library/react-native';

import { setEdSafeMode } from '../edSafe';
import { lightColors } from '../tokens';

import { EdSafeNote } from './EdSafeNote';

beforeEach(() => setEdSafeMode(false));
afterEach(() => setEdSafeMode(false));

const note = {
  title: 'No numbers needed.',
  body: "We'll estimate the energy from the name and amount and keep it hidden.",
};

describe('EdSafeNote', () => {
  it('renders the title, the body and the eye-off glyph while ED-safe mode is on', async () => {
    setEdSafeMode(true);
    await render(<EdSafeNote {...note} testID="note" />);
    expect(screen.getByTestId('note')).toBeOnTheScreen();
    expect(screen.getByText(note.title)).toBeOnTheScreen();
    expect(screen.getByText(note.body)).toBeOnTheScreen();
    expect(screen.getByTestId('note')).toHaveStyle({ backgroundColor: lightColors.accentTint });
    expect(screen.getByTestId('note.icon')).toHaveProp('stroke', lightColors.accentInk);
  });

  it('renders nothing while ED-safe mode is off', async () => {
    await render(<EdSafeNote {...note} testID="note" />);
    expect(screen.queryByTestId('note')).toBeNull();
    expect(screen.queryByText(note.title)).toBeNull();
  });

  it('appears and disappears when the mode flips, with no feature branch', async () => {
    const { rerender } = await render(<EdSafeNote {...note} testID="note" />);
    expect(screen.queryByTestId('note')).toBeNull();
    setEdSafeMode(true);
    await rerender(<EdSafeNote {...note} testID="note" />);
    expect(screen.getByTestId('note')).toBeOnTheScreen();
    setEdSafeMode(false);
    await rerender(<EdSafeNote {...note} testID="note" />);
    expect(screen.queryByTestId('note')).toBeNull();
  });

  it('reads as one element: title then body', async () => {
    setEdSafeMode(true);
    await render(<EdSafeNote {...note} testID="note" />);
    expect(screen.getByTestId('note')).toHaveProp('accessible', true);
    expect(screen.getByTestId('note')).toHaveProp('accessibilityLabel', `${note.title}. ${note.body}`);
  });

  it('takes another icon in place of the eye-off glyph', async () => {
    setEdSafeMode(true);
    await render(<EdSafeNote {...note} icon="leaf" testID="note" />);
    expect(screen.getByTestId('note.icon')).toBeOnTheScreen();
  });
});
