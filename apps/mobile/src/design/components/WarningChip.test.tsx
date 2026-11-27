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

import { act, render, screen } from '@testing-library/react-native';

import { warningChipText, WarningChip } from './WarningChip';
import { setEdSafeMode } from '../edSafe';

beforeEach(() => setEdSafeMode(false));

// Port of ComponentContractTests.testWarningChipEDSafeDropsKcalClause.
describe('WarningChip ED-safe text rule', () => {
  it('keeps the kcal clause with the mode off', () => {
    expect(warningChipText('Dressing not visible', 160, false)).toBe(
      'Dressing not visible — +160 kcal added (editable)',
    );
  });

  it('drops the kcal clause with the mode on', () => {
    expect(warningChipText('Dressing not visible', 160, true)).toBe(
      'Dressing not visible — review portion',
    );
  });

  it('renders only the reason without an added kcal', () => {
    expect(warningChipText('Dressing not visible', undefined, false)).toBe(
      'Dressing not visible',
    );
  });
});

// Port of ComponentContractTests.testWarningChipRendersFullStringByDefault.
describe('WarningChip rendering', () => {
  it('renders the full string with the kcal clause by default', async () => {
    await render(<WarningChip reason="Dressing not visible" addedKcal={160} />);
    expect(screen.getByTestId('warning-chip')).toHaveProp(
      'accessibilityLabel',
      'Dressing not visible — +160 kcal added (editable)',
    );
    expect(
      screen.getByText('Dressing not visible — +160 kcal added (editable)', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
  });

  it('drops the kcal clause while ED-safe mode is on', async () => {
    await render(<WarningChip reason="Dressing not visible" addedKcal={160} />);
    await act(async () => {
      setEdSafeMode(true);
    });
    expect(
      screen.queryByText('+160 kcal', { includeHiddenElements: true }),
    ).toBeNull();
    expect(
      screen.getByText('Dressing not visible — review portion', {
        includeHiddenElements: true,
      }),
    ).toBeOnTheScreen();
  });
});
