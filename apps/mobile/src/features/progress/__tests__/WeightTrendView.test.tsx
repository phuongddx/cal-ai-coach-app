/**
 * RNTL screen test of WeightTrendView (PG-02): the Ember trend card — the
 * label, the big value, the windowed direction row, the log chip — the
 * trend-empty copy, and the log-weight sheet hand-over.
 */
import { render, screen, userEvent, waitFor, within } from '@testing-library/react-native';

import { createEngagementRepository } from '../../../data/repos/engagementRepository';
import { createRepoFixture, type RepoFixture } from '../../../data/repos/testing/fixtures';
import { createSeedDataManager, DEMO_USER_ID } from '../../../data/repos/seedDataManager';
import { createTargetRepository } from '../../../data/repos/targetRepository';
import { createTrackingRepository } from '../../../data/repos/trackingRepository';

import { createProgressModel } from '../progressModel';
import { trendCopy, WeightTrendView } from '../screens/WeightTrendView';
import type { ProgressDeps } from '../progressModel';

const USER_ID = DEMO_USER_ID;

async function makeModel(fixture: RepoFixture, seed: boolean) {
  if (seed) {
    const seeder = createSeedDataManager(fixture.db, { now: fixture.clock, newId: fixture.newId });
    await seeder.ensureSeeded();
  }
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

describe('WeightTrendView screen', () => {
  it('the card shows the trend value, the direction row and the log button over the seeded series', async () => {
    const fixture = await createRepoFixture();
    const model = await makeModel(fixture, true);
    await render(<WeightTrendView model={model} />);

    expect(screen.getByText('Weight trend')).toBeOnTheScreen();
    expect(screen.getByText('82.4')).toBeOnTheScreen(); // the newest seeded log, the big value
    expect(screen.getByText(/in 30 days/)).toBeOnTheScreen(); // the Month window's direction row
    expect(screen.getByTestId('progress.logWeight')).toBeOnTheScreen();
    expect(screen.getByTestId('chart-card')).toBeOnTheScreen(); // the Month window keeps 5 of the 8 seeded logs
  });

  it('an empty series renders the backstop copy without a chart', async () => {
    const fixture = await createRepoFixture();
    const model = await makeModel(fixture, false);
    await render(<WeightTrendView model={model} />);

    expect(screen.getByText('Log your weight to start the trend')).toBeOnTheScreen();
    expect(screen.queryByTestId('chart-card')).toBeNull();
    expect(screen.getByText('holding steady')).toBeOnTheScreen();
  });

  it('Log weight opens the sheet; saving writes the log and dismisses', async () => {
    const fixture = await createRepoFixture();
    const model = await makeModel(fixture, true);
    const user = userEvent.setup();
    await render(<WeightTrendView model={model} />);

    await user.press(within(screen.getByTestId('progress.logWeight')).getByRole('button'));

    expect(await screen.findByTestId('progress.closeWeightSheet')).toBeOnTheScreen(); // the sheet presented
    expect(screen.getByTestId('progress.saveWeight')).toBeOnTheScreen();
    expect(screen.getAllByText('Log weight')).toHaveLength(2); // the card chip and the sheet heading

    await user.press(within(screen.getByTestId('progress.saveWeight')).getByRole('button'));

    await waitFor(() => expect(model.getSnapshot().weights).toHaveLength(9));
    expect(model.getSnapshot().weights.some((log) => log.kg === 82.4)).toBe(true); // the initial wheel selection saved
    await waitFor(() => expect(screen.queryByTestId('progress.saveWeight')).toBeNull()); // the sheet dismissed
  });
});

describe('trendCopy', () => {
  it('buckets the three directions', () => {
    expect(trendCopy(1.0, 30).text).toBe('−1.0 kg in 30 days');
    expect(trendCopy(1.0, 30).symbol).toBe('arrow.down');
    expect(trendCopy(-1.0, 30).text).toBe('+1.0 kg in 30 days');
    expect(trendCopy(-1.0, 30).symbol).toBe('arrow.up');
    expect(trendCopy(0, 30).text).toBe('holding steady');
    expect(trendCopy(0, 30).symbol).toBe('arrow.right');
  });
});
