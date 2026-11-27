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

import { StyleSheet } from 'react-native';

import { lightColors } from '../tokens';

import { SettingsRow, settingsA11yLabel, settingsValueColor } from './SettingsRow';

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

  it('draws the chevron by default and drops it with chevron={false}', async () => {
    await render(
      <>
        <SettingsRow icon="heart" label="Health" />
        <SettingsRow icon="ruler" label="Units" value="Metric" chevron={false} />
      </>,
    );
    const chevrons = (JSON.stringify(screen.toJSON()).match(/chevron\.right/g) ?? []).length;
    // Two rows rendered, only the default one draws a chevron.
    expect(chevrons).toBe(1);
    expect(screen.getByTestId('settings-row:Units')).toHaveProp('accessibilityLabel', 'Units, Metric');
  });

  it('tints the value with a semantic ink and keeps text2 without a tint', async () => {
    await render(
      <>
        <SettingsRow icon="heart" label="Health" value="Connected" tint="success" />
        <SettingsRow icon="ruler" label="Units" value="Metric" />
      </>,
    );
    const color = (text: string) =>
      (StyleSheet.flatten(screen.getByText(text, { includeHiddenElements: true }).props.style) as { color: string }).color;
    expect(color('Connected')).toBe(lightColors.successInk);
    expect(color('Metric')).toBe(lightColors.text2);
    expect(settingsValueColor(lightColors, 'error')).toBe(lightColors.errorInk);
    expect(settingsValueColor(lightColors, 'caution')).toBe(lightColors.cautionInk);
    expect(settingsValueColor(lightColors, 'info')).toBe(lightColors.infoInk);
    expect(settingsValueColor(lightColors, 'accent')).toBe(lightColors.accentInk);
  });
});
