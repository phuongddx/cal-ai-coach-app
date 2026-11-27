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

import { confidenceLabel, confidenceTier, ConfidenceBadge } from './ConfidenceBadge';

// Port of ComponentContractTests.testConfidenceBadgeMapsTiersWithExactLabels.
describe('ConfidenceBadge tiers', () => {
  it('maps tiers with the UI-SPEC thresholds', () => {
    expect(confidenceTier(0.92)).toBe('high');
    expect(confidenceTier(0.76)).toBe('medium');
    expect(confidenceTier(0.61)).toBe('low');
    expect(confidenceTier(0.85)).toBe('high');
    expect(confidenceTier(0.7)).toBe('medium');
    expect(confidenceTier(0.6999)).toBe('low');
  });

  it('uses the exact label strings', () => {
    expect(confidenceLabel('high')).toBe('High — single item');
    expect(confidenceLabel('medium')).toBe('Medium — mixed dish');
    expect(confidenceLabel('low')).toBe('Low — review needed');
  });
});

// Port of ComponentContractTests.testConfidenceBadgeRendersItsLabel.
describe('ConfidenceBadge rendering', () => {
  it('renders its label for a low confidence', async () => {
    await render(<ConfidenceBadge confidence={0.61} />);
    const badge = screen.getByTestId('confidence-badge');
    expect(badge).toHaveProp('accessibilityLabel', 'Confidence Low — review needed');
    expect(screen.getByText('Low — review needed', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('renders the compact variant', async () => {
    await render(<ConfidenceBadge confidence={0.92} compact />);
    expect(screen.getByTestId('confidence-badge:compact')).toBeOnTheScreen();
    expect(screen.getByTestId('confidence-badge:compact')).toHaveStyle({
      paddingVertical: 4,
      paddingHorizontal: 8,
    });
    expect(screen.getByText('High — single item', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
