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

import { SettingsRow, settingsA11yLabel } from './SettingsRow';

describe('SettingsRow', () => {
  it('renders label and chevron without a value', async () => {
    await render(<SettingsRow icon="heart" label="Health" />);
    expect(screen.getByTestId('settings-row:Health')).toHaveTextContent('Health');
    expect(screen.getByTestId('settings-row:Health')).toHaveProp(
      'accessibilityLabel',
      'Health',
    );
  });

  it('renders a trailing value', async () => {
    await render(<SettingsRow icon="gauge" label="Daily target" value="2,150" />);
    expect(screen.getByText('2,150', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId('settings-row:Daily target')).toHaveProp(
      'accessibilityLabel',
      'Daily target, 2,150',
    );
    expect(settingsA11yLabel('Daily target', '2,150')).toBe('Daily target, 2,150');
  });
});
