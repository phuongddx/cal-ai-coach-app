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

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { WheelField } from './WheelField';

const GRAMS = [100, 150, 200, 250, 300] as const;

function momentumEvent(offsetRows: number) {
  return {
    nativeEvent: {
      contentOffset: { y: offsetRows * 36 },
      layoutMeasurement: { height: 108 },
      contentSize: { height: 36 * GRAMS.length },
    },
  };
}

describe('WheelField', () => {
  it('shows label, selected value and the wheel rows', async () => {
    await render(
      <WheelField
        label="Portion"
        items={[...GRAMS]}
        selection={200}
        onSelectionChange={() => {}}
        displayText={(item) => `${item} g`}
      />,
    );
    expect(screen.getByText('Portion')).toBeOnTheScreen();
    expect(screen.getByTestId('wheel-value:Portion')).toHaveTextContent('200 g');
    expect(screen.getByText('300 g', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('reports the picked row as the new selection', async () => {
    const onSelectionChange = jest.fn();
    await render(
      <WheelField
        label="Portion"
        items={[...GRAMS]}
        selection={200}
        onSelectionChange={onSelectionChange}
        displayText={(item) => `${item} g`}
      />,
    );
    const scroll = screen.getByTestId('wheel-scroll:Portion');
    await act(async () => {
      fireEvent(scroll, 'momentumScrollEnd', momentumEvent(2));
    });
    expect(onSelectionChange).not.toHaveBeenCalled(); // same row as the selection
    await act(async () => {
      fireEvent(scroll, 'momentumScrollEnd', momentumEvent(3));
    });
    expect(onSelectionChange).toHaveBeenCalledWith(250);
  });

  it('clamps the picked row into range', async () => {
    const onSelectionChange = jest.fn();
    await render(
      <WheelField
        label="Portion"
        items={[...GRAMS]}
        selection={300}
        onSelectionChange={onSelectionChange}
        displayText={(item) => `${item} g`}
      />,
    );
    const scroll = screen.getByTestId('wheel-scroll:Portion');
    await act(async () => {
      fireEvent(scroll, 'momentumScrollEnd', momentumEvent(99));
    });
    expect(onSelectionChange).not.toHaveBeenCalled(); // 300 is already selected
    await act(async () => {
      fireEvent(scroll, 'momentumScrollEnd', momentumEvent(0));
    });
    expect(onSelectionChange).toHaveBeenCalledWith(100);
  });
});
