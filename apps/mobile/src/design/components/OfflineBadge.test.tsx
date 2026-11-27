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

import { OfflineBadge } from './OfflineBadge';

describe('OfflineBadge', () => {
  it('carries the fixed label', async () => {
    await render(<OfflineBadge />);
    expect(screen.getByTestId('offline-badge')).toHaveProp(
      'accessibilityLabel',
      'Offline — syncs later',
    );
    expect(screen.getByText('Offline — syncs later', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
