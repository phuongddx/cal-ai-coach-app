/** Dual-react preamble — see docs/rn-migration/findings/U-22.md. */
jest.mock('react', () => {
  const rnPath: string = require.resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react`);
});
jest.mock('react/jsx-runtime', () => {
  const rnPath: string = require.resolve('react-native');
  const root = rnPath.slice(0, rnPath.indexOf('/react-native/'));
  return jest.requireActual(`${root}/react/jsx-runtime`);
});

import { render, screen } from '@testing-library/react-native';

import { ScaledNumber } from './ScaledNumber';

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
});
