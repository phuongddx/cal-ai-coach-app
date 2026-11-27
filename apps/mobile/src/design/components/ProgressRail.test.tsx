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

import { clampToUnitInterval, ProgressRail, progressA11yLabel } from './ProgressRail';

describe('ProgressRail', () => {
  it('sizes the fill to the clamped progress', async () => {
    await render(<ProgressRail progress={0.4} />);
    expect(screen.getByTestId('progress-rail:fill', { includeHiddenElements: true })).toHaveStyle({
      width: '40%',
    });
  });

  it('clamps out-of-range progress', async () => {
    await render(<ProgressRail progress={1.4} />);
    expect(screen.getByTestId('progress-rail:fill', { includeHiddenElements: true })).toHaveStyle({
      width: '100%',
    });
    expect(clampToUnitInterval(-0.2)).toBe(0);
  });

  it('announces the percent complete', async () => {
    await render(<ProgressRail progress={0.583} />);
    expect(screen.getByTestId('progress-rail')).toHaveProp(
      'accessibilityLabel',
      '58 percent complete',
    );
    expect(progressA11yLabel(1)).toBe('100 percent complete');
  });
});
