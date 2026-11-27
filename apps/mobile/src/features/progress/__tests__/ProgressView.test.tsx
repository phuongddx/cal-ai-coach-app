/**
 * RNTL screen test of ProgressView (PG-01 + the U-75 range segment): the tab
 * stack — title, range segment, weight trend, weekly energy, badges — the
 * range windows the weight chart reads, and the ED-safe backstop from
 * ProgressSnapshotTests.progressEdSafeHidesWeeklyEnergy: the weekly-energy
 * card vanishes entirely from the stack while the rest stays.
 */
import { render, screen, userEvent } from '@testing-library/react-native';

import { setEdSafeMode } from '../../../design';
import { createEngagementRepository } from '../../../data/repos/engagementRepository';
import { createRepoFixture } from '../../../data/repos/testing/fixtures';
import { createSeedDataManager, DEMO_USER_ID } from '../../../data/repos/seedDataManager';
import { createTargetRepository } from '../../../data/repos/targetRepository';
import { createTrackingRepository } from '../../../data/repos/trackingRepository';

import { createProgressModel } from '../progressModel';
import { ProgressView } from '../screens/ProgressView';
import type { ProgressDeps } from '../progressModel';

const USER_ID = DEMO_USER_ID;

async function makeSeededModel() {
  const fixture = await createRepoFixture();
  const seeder = createSeedDataManager(fixture.db, { now: fixture.clock, newId: fixture.newId });
  await seeder.ensureSeeded();
  const deps: ProgressDeps = {
    db: fixture.db,
    targets: createTargetRepository(fixture.db),
    tracking: createTrackingRepository(fixture.db, { newId: fixture.newId }),
    engagement: createEngagementRepository(fixture.db),
    ownerId: USER_ID,
    notify: () => undefined,
    subscribe: () => () => undefined,
    now: fixture.clock,
    newId: fixture.newId,
  };
  const model = createProgressModel(deps);
  await model.refresh();
  return model;
}

describe('ProgressView screen', () => {
  beforeEach(() => {
    setEdSafeMode(false);
  });

  it('the stack shows the title, the range segment and the three sections over the seed', async () => {
    const model = await makeSeededModel();
    await render(<ProgressView model={model} />);

    expect(screen.getByText('Progress')).toBeOnTheScreen();
    // The range segment with Month selected by default (frame 11).
    expect(screen.getByTestId('progress.range')).toBeOnTheScreen();
    expect(screen.getByTestId('progress.range.month')).toBeOnTheScreen();
    expect(screen.getByTestId('progress.range.week')).toBeOnTheScreen();
    // Weight trend section.
    expect(screen.getByText('Weight trend')).toBeOnTheScreen();
    expect(screen.getByTestId('chart-card')).toBeOnTheScreen();
    // Weekly energy section.
    expect(screen.getByText('Weekly energy')).toBeOnTheScreen();
    expect(screen.getByText('avg 429 kcal')).toBeOnTheScreen(); // the seeded days' average
    // Badges section.
    expect(screen.getByText('Badges')).toBeOnTheScreen();
    expect(screen.getByLabelText('Progress photos, coming later')).toBeOnTheScreen();
  });

  it('the range segment reads the weight series over the selected window', async () => {
    const model = await makeSeededModel();
    const user = userEvent.setup();
    await render(<ProgressView model={model} />);

    // Month (default): the chart's summary sentence reads the 30-day window.
    expect(screen.getByLabelText(/over 30 days/)).toBeOnTheScreen();

    await user.press(screen.getByTestId('progress.range.week'));
    expect(screen.getByLabelText(/over 7 days/)).toBeOnTheScreen();

    await user.press(screen.getByTestId('progress.range.3m'));
    expect(screen.getByLabelText(/over 90 days/)).toBeOnTheScreen();

    await user.press(screen.getByTestId('progress.range.year'));
    expect(screen.getByLabelText(/over 365 days/)).toBeOnTheScreen();
  });

  it('the weekly-energy card vanishes in the ED-safe mode while the rest stays', async () => {
    const model = await makeSeededModel();
    setEdSafeMode(true);
    await render(<ProgressView model={model} />);

    expect(screen.queryByText('Weekly energy')).toBeNull();
    expect(screen.queryByText('avg 429 kcal')).toBeNull();
    // The weight trend and badges remain, as the Swift ED-safe snapshot shows.
    expect(screen.getByText('Weight trend')).toBeOnTheScreen();
    expect(screen.getByText('Badges')).toBeOnTheScreen();
    expect(screen.getByLabelText('Progress photos, coming later')).toBeOnTheScreen();
  });
});
