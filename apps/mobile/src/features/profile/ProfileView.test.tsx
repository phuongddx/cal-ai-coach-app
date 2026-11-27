/**
 * RNTL screen test of ProfileView.swift (PR-01): the copy, the identifiers and
 * the ED-safe collapse of the daily-target framing. The plan line comes from
 * the injected plan name (display-only entitlement state).
 *
 * Dual-react preamble: jest-expo pins `react-native` but not `react`; app-side
 * requests are re-pointed onto the renderer's copy. See findings/U-22.md.
 */
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
import { setEdSafeMode } from '../../design';

import { DEMO_USER_ID } from '../../data/repos/seedDataManager';
import type { UserTarget } from '../../data/repos/targetRepository';

import { ProfileView } from './ProfileView';
import type { ProfileStats } from './profileModel';

const FIXED_NOW = new Date('2026-09-12T09:00:00Z');

function makeTarget(): UserTarget {
  return {
    id: '22222222-3333-4444-8555-666666666666',
    userId: DEMO_USER_ID,
    dailyKcal: 2150,
    proteinG: 161,
    carbsG: 215,
    fatG: 72,
    fiberGoalG: 30,
    waterGlasses: 8,
    sex: 'female',
    heightCm: 165,
    weightKg: 70,
    goalWeightKg: 65,
    paceKgPerWeek: 0.5,
    activity: 'moderate',
    goal: 'lose',
    updatedAt: FIXED_NOW,
  };
}

function makeStats(target: UserTarget | null = makeTarget()): ProfileStats {
  return { target, latestKg: 80.0, daysLogged: 21, memberSince: FIXED_NOW };
}

describe('profile screen', () => {
  afterEach(() => setEdSafeMode(false));

  it('renders the user card, the stats, the goals values and the locked copy', async () => {
    await render(
      <ProfileView
        stats={makeStats()}
        planName="Free"
        onEditTargets={() => undefined}
        onOpenSettings={() => undefined}
      />,
    );

    expect(screen.getByText('Alex')).toBeOnTheScreen();
    expect(screen.getByText('Free · Since Sep 2026')).toBeOnTheScreen();
    expect(screen.getByLabelText('Alex, Free · Since Sep 2026')).toBeOnTheScreen();

    // Quick stats: grouped kcal, days, weight, with the caption-first labels.
    expect(screen.getByText('2,150')).toBeOnTheScreen();
    expect(screen.getByLabelText('kcal / day 2,150')).toBeOnTheScreen();
    expect(screen.getByText('21')).toBeOnTheScreen();
    expect(screen.getByLabelText('Days logged 21')).toBeOnTheScreen();
    expect(screen.getByText('80.0')).toBeOnTheScreen();
    expect(screen.getByLabelText('Weight, kg 80.0')).toBeOnTheScreen();

    // Goals group: the macro ratios and the goal weight as SettingsRow values.
    expect(screen.getByText('161P · 215C · 72F')).toBeOnTheScreen();
    expect(screen.getByText('65 kg')).toBeOnTheScreen();
    expect(screen.getByText('2,150 kcal')).toBeOnTheScreen();

    expect(screen.getByText('Apple Health')).toBeOnTheScreen();
    expect(screen.getByText('Not connected')).toBeOnTheScreen();
    expect(screen.getByText('Reminders')).toBeOnTheScreen();
    expect(screen.getByText('System')).toBeOnTheScreen();
    expect(screen.getByText('Metric')).toBeOnTheScreen();

    // Identifiers.
    expect(screen.getByTestId('profile.userCard')).toBeOnTheScreen();
    expect(screen.getByTestId('profile.stat.dailyTarget')).toBeOnTheScreen();
    expect(screen.getByTestId('profile.stat.daysLogged')).toBeOnTheScreen();
    expect(screen.getByTestId('profile.stat.weight')).toBeOnTheScreen();
    expect(screen.getByTestId('profile.row.dailyTarget')).toBeOnTheScreen();
    expect(screen.getByTestId('profile.row.macroRatios')).toBeOnTheScreen();
    expect(screen.getByTestId('profile.row.goalWeight')).toBeOnTheScreen();
    expect(screen.getByTestId('profile.row.appleHealth')).toBeOnTheScreen();
    expect(screen.getByTestId('profile.row.settings')).toBeOnTheScreen();
  });

  it('opens settings from the row and the target edit from a goal row', async () => {
    const onOpenSettings = jest.fn();
    const onEditTargets = jest.fn();
    await render(
      <ProfileView stats={makeStats()} planName="Free" onEditTargets={onEditTargets} onOpenSettings={onOpenSettings} />,
    );

    await userEvent.press(screen.getByTestId('profile.row.settings'));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    await userEvent.press(screen.getByTestId('profile.row.macroRatios'));
    expect(onEditTargets).toHaveBeenCalledTimes(1);
  });

  it('disables the goals rows while no target exists', async () => {
    await render(
      <ProfileView stats={makeStats(null)} planName="Free" onEditTargets={null} onOpenSettings={() => undefined} />,
    );
    expect(screen.getByTestId('profile.row.dailyTarget').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByTestId('profile.row.macroRatios').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByTestId('profile.row.goalWeight').props.accessibilityState?.disabled).toBe(true);
  });

  it('reveals the health footnote only after the Apple Health row is pressed', async () => {
    await render(<ProfileView stats={makeStats(null)} planName="Free" onOpenSettings={() => undefined} />);
    expect(screen.queryByTestId('profile.healthNote')).toBeNull();

    await userEvent.press(screen.getByTestId('profile.row.appleHealth'));
    expect(screen.getByTestId('profile.healthNote')).toBeOnTheScreen();
    expect(screen.getByText('Apple Health connects in a later update.')).toBeOnTheScreen();
  });

  it('collapses the daily-target stat and goal row under ED-safe mode', async () => {
    setEdSafeMode(true);
    await render(
      <ProfileView stats={makeStats()} planName="Free" onEditTargets={() => undefined} onOpenSettings={() => undefined} />,
    );

    expect(screen.queryByTestId('profile.stat.dailyTarget')).toBeNull();
    expect(screen.queryByTestId('profile.row.dailyTarget')).toBeNull();
    expect(screen.queryByText('2,150')).toBeNull();
    // The non-kcal framing stays: days, weight, macros, goal weight.
    expect(screen.getByTestId('profile.stat.daysLogged')).toBeOnTheScreen();
    expect(screen.getByTestId('profile.stat.weight')).toBeOnTheScreen();
    expect(screen.getByText('161P · 215C · 72F')).toBeOnTheScreen();
    expect(screen.getByText('65 kg')).toBeOnTheScreen();
  });
});
