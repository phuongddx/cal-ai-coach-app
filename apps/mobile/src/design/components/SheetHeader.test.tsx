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

import { SheetHeader } from './SheetHeader';

describe('SheetHeader', () => {
  it('shows the title as a header', async () => {
    await render(<SheetHeader title="Add to Dinner" testID="header" />);
    const title = screen.getByTestId('header.title');
    expect(title).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByText('Add to Dinner')).toBeOnTheScreen();
  });

  it('draws a back button with its label and calls onBack', async () => {
    const onBack = jest.fn();
    await render(
      <SheetHeader title="Review" onBack={onBack} backAccessibilityLabel="Back to camera" testID="header" />,
    );
    const back = screen.getByTestId('header.back');
    expect(back).toHaveProp('accessibilityRole', 'button');
    expect(back).toHaveProp('accessibilityLabel', 'Back to camera');
    expect(back).toHaveStyle({ width: 44, height: 44 });
    await userEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('header.close')).toBeNull();
  });

  it('draws a close button with its label and calls onClose', async () => {
    const onClose = jest.fn();
    await render(
      <SheetHeader title="Review" onClose={onClose} closeAccessibilityLabel="Close review" testID="header" />,
    );
    const close = screen.getByTestId('header.close');
    expect(close).toHaveProp('accessibilityLabel', 'Close review');
    await userEvent.press(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('header.back')).toBeNull();
  });

  it('draws both buttons around the title', async () => {
    await render(
      <SheetHeader
        title="Review"
        onBack={() => {}}
        backAccessibilityLabel="Back"
        onClose={() => {}}
        closeAccessibilityLabel="Close"
        testID="header"
      />,
    );
    expect(screen.getByTestId('header.back')).toBeOnTheScreen();
    expect(screen.getByTestId('header.close')).toBeOnTheScreen();
    expect(screen.getByTestId('header')).toBeOnTheScreen();
  });

  it('lets a screen name its own back, title and close identifiers', async () => {
    const onBack = jest.fn();
    const onClose = jest.fn();
    await render(
      <SheetHeader
        title="Review"
        onBack={onBack}
        onClose={onClose}
        backTestID="scan.retake"
        titleTestID="scan.review"
        closeTestID="scan.close"
      />,
    );
    expect(screen.getByTestId('scan.review')).toHaveProp('accessibilityRole', 'header');
    await userEvent.press(screen.getByTestId('scan.retake'));
    await userEvent.press(screen.getByTestId('scan.close'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('sheet-header.back')).toBeNull();
  });
});
