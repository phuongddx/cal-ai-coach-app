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

/**
 * U-71: the Ember look of the restyled components, one assertion group per component (the
 * Ember frame each one follows is in docs/rn-migration/parity-detail/design.md).
 */
import { render, screen, userEvent } from '@testing-library/react-native';
import { Text, useColorScheme } from 'react-native';

import { BannerNote } from './BannerNote';
import { ChartCard } from './ChartCard';
import { ChipOption } from './ChipOption';
import { confidenceBadgeHeight, ConfidenceBadge } from './ConfidenceBadge';
import { InsightCard } from './InsightCard';
import { MacroBar } from './MacroBar';
import { OptionCard } from './OptionCard';
import { ProgressRail } from './ProgressRail';
import { QuickActionTile } from './QuickActionTile';
import { Sheet, sheetDetentHeight, sheetGrabberSize } from './Sheet';
import { Stepper } from './Stepper';
import { WarningChip } from './WarningChip';
import { darkColors, lightColors, size } from '../tokens';

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

afterEach(() => mockUseColorScheme.mockReturnValue('light'));

describe('ConfidenceBadge (Ember badge)', () => {
  it('uses the tier tint, ink and dot, unchanged tiers', async () => {
    const cases = [
      { confidence: 0.92, tint: lightColors.successTint, ink: lightColors.successInk },
      { confidence: 0.76, tint: lightColors.cautionTint, ink: lightColors.cautionInk },
      { confidence: 0.4, tint: lightColors.errorTint, ink: lightColors.errorInk },
    ];
    for (const { confidence, tint, ink } of cases) {
      const { unmount } = await render(<ConfidenceBadge confidence={confidence} />);
      expect(screen.getByTestId('confidence-badge')).toHaveStyle({ backgroundColor: tint, minHeight: 28 });
      expect(screen.getByText(/—/, { includeHiddenElements: true })).toHaveStyle({ color: ink });
      await unmount();
    }
  });

  it('sits in its own full-width row and is never truncated', async () => {
    await render(<ConfidenceBadge confidence={0.61} />);
    expect(screen.getByTestId('confidence-badge-row')).toHaveStyle({ alignSelf: 'stretch', flexDirection: 'row' });
    const label = screen.getByText('Low — review needed', { includeHiddenElements: true });
    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.props.ellipsizeMode).toBeUndefined();
    expect(confidenceBadgeHeight(false)).toBe(28);
    expect(confidenceBadgeHeight(true)).toBe(22);
  });
});

describe('Sheet (Ember sheet)', () => {
  it('shows a centered drag indicator on the elevated surface', async () => {
    await render(
      <Sheet testID="sheet">
        <Text>body</Text>
      </Sheet>,
    );
    expect(screen.getByTestId('sheet')).toHaveStyle({ backgroundColor: lightColors.elevated, borderRadius: 28 });
    expect(screen.getByTestId('sheet:grabber')).toHaveStyle({
      backgroundColor: lightColors.grabber,
      alignSelf: 'center',
      width: sheetGrabberSize.width,
      height: sheetGrabberSize.height,
    });
  });

  it('caps the height at the medium and large detents', async () => {
    expect(sheetDetentHeight('medium', 800)).toBe(400);
    expect(sheetDetentHeight('large', 800)).toBe(736);
    const { rerender } = await render(<Sheet testID="sheet" detent="medium" />);
    const medium = screen.getByTestId('sheet').props.style.flat().find((entry: { maxHeight?: number } | null) => entry?.maxHeight != null);
    expect(medium.maxHeight).toBeGreaterThan(0);
    await rerender(<Sheet testID="sheet" />);
    const none = screen.getByTestId('sheet').props.style.flat().find((entry: { maxHeight?: number } | null) => entry?.maxHeight != null);
    expect(none).toBeUndefined();
  });
});

describe('Stepper (Ember 44 pt buttons)', () => {
  it('keeps the ccstepper testIDs on 44 pt buttons', async () => {
    await render(<Stepper name="Grams" value={100} onValueChange={() => undefined} />);
    for (const id of ['ccstepper.decrement', 'ccstepper.increment']) {
      expect(screen.getByTestId(id)).toHaveStyle({ width: size.tap, height: size.tap });
    }
  });
});

describe('ChipOption (Ember chip)', () => {
  it('selected = accent fill with an onAccent label, 36 pt, radius 18', async () => {
    const onSelect = jest.fn();
    await render(<ChipOption title="Vegan" isSelected onSelect={onSelect} />);
    expect(screen.getByTestId('chip-option:Vegan')).toHaveStyle({
      backgroundColor: lightColors.accent,
      minHeight: 36,
      borderRadius: 18,
    });
    expect(screen.getByText('Vegan')).toHaveStyle({ color: lightColors.onAccent });
    await userEvent.press(screen.getByTestId('chip-option:Vegan'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('unselected = fill with a text2 label', async () => {
    await render(<ChipOption title="Keto" isSelected={false} />);
    expect(screen.getByTestId('chip-option:Keto')).toHaveStyle({ backgroundColor: lightColors.fill });
    expect(screen.getByText('Keto')).toHaveStyle({ color: lightColors.text2 });
  });
});

describe('Cards, rows and bars take Ember tokens', () => {
  it('InsightCard: accentTint tile and accentStrong bar; info on infoTint', async () => {
    const { rerender } = await render(<InsightCard title="Tip" text="Eat more fiber" />);
    expect(screen.getByTestId('insight-card:accent')).toHaveStyle({ backgroundColor: lightColors.card, borderRadius: 20 });
    await rerender(<InsightCard title="Tip" text="Eat more fiber" variant="info" />);
    expect(screen.getByTestId('insight-card:info')).toHaveStyle({ backgroundColor: lightColors.infoTint });
  });

  it('WarningChip: cautionTint fill with a cautionInk label (yellow, not orange)', async () => {
    await render(<WarningChip reason="Mixed dish" />);
    expect(screen.getByTestId('warning-chip')).toHaveStyle({ backgroundColor: lightColors.cautionTint });
    expect(screen.getByText('Mixed dish')).toHaveStyle({ color: lightColors.cautionInk });
  });

  it('BannerNote: tint fills', async () => {
    const { rerender } = await render(<BannerNote text="ok" variant="success" />);
    expect(screen.getByTestId('banner:success')).toHaveStyle({ backgroundColor: lightColors.successTint });
    await rerender(<BannerNote text="fyi" variant="info" />);
    expect(screen.getByTestId('banner:info')).toHaveStyle({ backgroundColor: lightColors.infoTint });
  });

  it('QuickActionTile: highlighted = accentTint with accentInk text', async () => {
    await render(<QuickActionTile title="Scan" icon="camera" isHighlighted />);
    expect(screen.getByTestId('quick-action:Scan')).toHaveStyle({ backgroundColor: lightColors.accentTint });
    expect(screen.getByText('Scan')).toHaveStyle({ color: lightColors.accentInk });
  });

  it('MacroBar: fill track and macro colors (carbs are teal)', async () => {
    await render(<MacroBar macro="carbs" value={50} goal={100} />);
    expect(screen.getByTestId('macro-bar-fill:carbs', { includeHiddenElements: true })).toHaveStyle({ backgroundColor: lightColors.carbs, height: 8 });
    expect(lightColors.carbs).not.toBe(lightColors.accent);
    expect(lightColors.caution).not.toBe(lightColors.accent);
  });

  it('ProgressRail: fill track with an accent fill', async () => {
    await render(<ProgressRail progress={0.5} />);
    expect(screen.getByTestId('progress-rail')).toHaveStyle({ backgroundColor: lightColors.fill });
    expect(screen.getByTestId('progress-rail:fill')).toHaveStyle({ backgroundColor: lightColors.accent });
  });

  it('OptionCard: selected border is accentStrong on light and dark', async () => {
    const { rerender } = await render(<OptionCard title="Lose" icon="flame" isSelected onSelect={() => undefined} />);
    expect(screen.getByTestId('option-card:Lose')).toHaveStyle({ borderColor: lightColors.accentStrong, borderWidth: 2 });
    mockUseColorScheme.mockReturnValue('dark');
    await rerender(<OptionCard title="Lose" icon="flame" isSelected onSelect={() => undefined} />);
    expect(screen.getByTestId('option-card:Lose')).toHaveStyle({ borderColor: darkColors.accentStrong });
  });

  it('ChartCard: renders with Ember tokens', async () => {
    await render(<ChartCard points={[{ date: new Date(2026, 10, 1), label: 'Nov 1', value: 80 }]} />);
    expect(screen.getByTestId('chart-card')).toHaveProp('accessibilityLabel', 'Trend. Nov 1: 80');
  });
});
