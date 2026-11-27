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

import { fitWidthMinimumFontScale, ScaledNumber } from './ScaledNumber';

describe('ScaledNumber', () => {
  it('renders the hero size', async () => {
    await render(<ScaledNumber text="1607" role="hero" />);
    const number = screen.getByText('1607');
    expect(number).toBeOnTheScreen();
    expect(number).toHaveStyle({ fontSize: 56, fontWeight: '700' });
  });

  it('renders the plan-number size', async () => {
    await render(<ScaledNumber text="2400" role="planNumber" />);
    expect(screen.getByText('2400')).toHaveStyle({ fontSize: 64, fontWeight: '700' });
  });

  it('scales with Dynamic Type and aligns digits', async () => {
    await render(<ScaledNumber text="1607" role="hero" />);
    const number = screen.getByText('1607');
    expect(number).toHaveProp('allowFontScaling', true);
    expect(number).toHaveStyle({ fontVariant: ['tabular-nums'] });
  });

  // U-71 acceptance: a four-digit remaining number stays on one line and shrinks to fit.
  // Jest cannot measure wrapping: the Simulator unit U-76 verifies it on a device.
  it('keeps a four-digit number on one line and shrinks it with fitWidth', async () => {
    await render(<ScaledNumber text="1607" role="hero" fitWidth />);
    const number = screen.getByText('1607');
    expect(number).toHaveProp('numberOfLines', 1);
    expect(number).toHaveProp('adjustsFontSizeToFit', true);
    expect(number).toHaveProp('minimumFontScale', 0.5);
    expect(fitWidthMinimumFontScale).toBe(0.5);
    expect(number).toHaveStyle({ fontSize: 56 });
  });

  it('leaves the text free to wrap without fitWidth', async () => {
    await render(<ScaledNumber text="1607" role="hero" />);
    const number = screen.getByText('1607');
    expect(number.props.numberOfLines).toBeUndefined();
    expect(number.props.adjustsFontSizeToFit).toBeUndefined();
  });
});
