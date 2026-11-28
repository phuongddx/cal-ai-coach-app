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
import { StyleSheet, Text } from 'react-native';

import { FoldGroup, foldGroupA11yHint } from './FoldGroup';

describe('FoldGroup', () => {
  it('hides the body and announces collapsed while folded', async () => {
    await render(
      <FoldGroup label="Advanced" expanded={false} onToggle={jest.fn()} testID="food.advanced">
        <Text>Fiber</Text>
      </FoldGroup>,
    );
    const header = screen.getByTestId('food.advanced');
    expect(header).toHaveProp('accessibilityRole', 'button');
    expect(header).toHaveProp('accessibilityLabel', 'Advanced');
    expect(header).toHaveProp('accessibilityState', { expanded: false });
    expect(header).toHaveProp('accessibilityHint', 'Expands the group');
    expect(screen.queryByText('Fiber')).toBeNull();
    expect(screen.queryByTestId('food.advanced:content')).toBeNull();
  });

  it('shows the body and announces expanded while open', async () => {
    await render(
      <FoldGroup label="Advanced" expanded onToggle={jest.fn()} testID="food.advanced">
        <Text>Fiber</Text>
      </FoldGroup>,
    );
    expect(screen.getByTestId('food.advanced')).toHaveProp('accessibilityState', { expanded: true });
    expect(screen.getByText('Fiber')).toBeOnTheScreen();
    expect(screen.getByTestId('food.advanced:content')).toBeOnTheScreen();
    expect(foldGroupA11yHint(true)).toBe('Collapses the group');
  });

  it('has a header of at least 44 pt and calls onToggle on press', async () => {
    const onToggle = jest.fn();
    await render(<FoldGroup label="Advanced" expanded={false} onToggle={onToggle} testID="food.advanced" />);
    const header = screen.getByTestId('food.advanced');
    expect(StyleSheet.flatten(header.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await userEvent.press(header);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
