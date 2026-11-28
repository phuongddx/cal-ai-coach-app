/**
 * CoachView over the REAL CoachModel on the sql.js database the suites use, with the model changing
 * while the view is mounted (U-84 B). The app compiles with the React Compiler, which treats a value
 * that keeps its identity as unchanged: a view that subscribes, throws the snapshot away and reads
 * `model.getSnapshot()` in render keeps drawing the old week and the old insights after the model
 * moves. Jest does not compile, so these cases only go red under `npm run test:compiler`.
 */
import { act, render, screen } from '@testing-library/react-native';
import { isNull } from 'drizzle-orm';

import { insights as insightsTable, diaryEntries } from '../../../data/db/schema';
import { createEngagementRepository, insightToRow } from '../../../data/repos/engagementRepository';
import { createRepoFixture } from '../../../data/repos/testing/fixtures';
import { createSeedDataManager, DEMO_USER_ID } from '../../../data/repos/seedDataManager';
import { createTargetRepository } from '../../../data/repos/targetRepository';
import { dayString } from '../../progress/progressMath';

import { createCoachModel } from '../coachModel';
import { CoachView } from '../screens/CoachView';
import type { CoachDeps } from '../coachModel';

async function makeWorld() {
  const fixture = await createRepoFixture();
  await createSeedDataManager(fixture.db, { now: fixture.clock, newId: fixture.newId }).ensureSeeded();
  const deps: CoachDeps = {
    db: fixture.db,
    targets: createTargetRepository(fixture.db),
    engagement: createEngagementRepository(fixture.db),
    ownerId: DEMO_USER_ID,
    subscribe: () => () => undefined,
    now: fixture.clock,
  };
  const model = createCoachModel(deps);
  await model.refresh();
  return { fixture, deps, model };
}

describe('CoachView over the real model, model changing while mounted', () => {
  it('a new insight of the day appears in the list', async () => {
    const { fixture, deps, model } = await makeWorld();
    await render(<CoachView model={model} greeting="Good afternoon" />);
    expect(screen.queryByText('Fibre is up this week')).toBeNull();

    await act(async () => {
      await fixture.db.insert(insightsTable).values(
        insightToRow({
          id: 'u84b-insight-1',
          userId: DEMO_USER_ID,
          day: dayString(deps.now()),
          kind: 'protein',
          title: 'Fibre is up this week',
          body: 'Three days above your usual.',
          createdAt: deps.now(),
        }),
      );
      await model.refresh();
    });

    expect(screen.getByText('Fibre is up this week')).toBeOnTheScreen();
  });

  it('the THIS WEEK card follows the week when the logged days change', async () => {
    const { fixture, model } = await makeWorld();
    await render(<CoachView model={model} greeting="Good afternoon" />);
    expect(screen.getByText('You logged every day this week — great consistency!')).toBeOnTheScreen();

    await act(async () => {
      await fixture.db.update(diaryEntries).set({ deletedAt: new Date(0).toISOString() }).where(isNull(diaryEntries.deletedAt));
      await model.refresh();
    });

    expect(model.getSnapshot().weekStats.daysLogged).toBeLessThan(7);
    const daysLogged = model.getSnapshot().weekStats.daysLogged;
    expect(screen.getByText(`You logged ${daysLogged} of 7 days this week — keep it up!`)).toBeOnTheScreen();
  });
});
