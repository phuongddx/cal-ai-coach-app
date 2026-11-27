/**
 * `inTransaction` on one handle (unit U-23, section C): writers are serialized, so overlapping
 * calls neither fail on a second BEGIN nor roll each other back.
 */
import { sql } from 'drizzle-orm';

import { inTransaction } from './sqlDb';
import { createRepoFixture } from './testing/fixtures';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function probeRows(fixture: Awaited<ReturnType<typeof createRepoFixture>>): Promise<string[]> {
  const result = fixture.client.exec('SELECT tag FROM tx_probe ORDER BY rowid');
  return (result[0]?.values ?? []).map((row) => String(row[0]));
}

async function newFixture() {
  const fixture = await createRepoFixture();
  fixture.client.exec('CREATE TABLE tx_probe (tag TEXT NOT NULL)');
  return fixture;
}

async function insert(tx: Parameters<Parameters<typeof inTransaction>[1]>[0], tag: string) {
  await tx.run(sql`INSERT INTO tx_probe (tag) VALUES (${tag})`);
}

describe('inTransaction', () => {
  it('two overlapping calls on one handle both complete whole', async () => {
    const fixture = await newFixture();
    const writer = (name: string) =>
      inTransaction(fixture.db, async (tx) => {
        await insert(tx, `${name}-1`);
        await tick(); // the other writer starts while this body is suspended
        await insert(tx, `${name}-2`);
        return name;
      });

    const results = await Promise.all([writer('a'), writer('b')]);

    expect(results).toEqual(['a', 'b']);
    // Serialized in call order: each writer's rows are contiguous, none was lost.
    expect(await probeRows(fixture)).toEqual(['a-1', 'a-2', 'b-1', 'b-2']);
  });

  it('a throw inside one call leaves nothing of that one and the other completes whole', async () => {
    const fixture = await newFixture();
    const failing = inTransaction(fixture.db, async (tx) => {
      await insert(tx, 'bad-1');
      await tick();
      await insert(tx, 'bad-2');
      throw new Error('boom');
    });
    const healthy = inTransaction(fixture.db, async (tx) => {
      await insert(tx, 'ok-1');
      await tick();
      await insert(tx, 'ok-2');
    });

    await expect(failing).rejects.toThrow('boom');
    await healthy;

    expect(await probeRows(fixture)).toEqual(['ok-1', 'ok-2']);
  });

  it('the next call still runs after a failed one', async () => {
    const fixture = await newFixture();
    await expect(
      inTransaction(fixture.db, async () => {
        throw new Error('first');
      }),
    ).rejects.toThrow('first');
    await inTransaction(fixture.db, (tx) => insert(tx, 'after'));
    expect(await probeRows(fixture)).toEqual(['after']);
  });

  it('a different handle has its own queue', async () => {
    const one = await newFixture();
    const two = await newFixture();
    let releaseOne: () => void = () => undefined;
    const held = inTransaction(one.db, async (tx) => {
      await insert(tx, 'one');
      await new Promise<void>((resolve) => {
        releaseOne = resolve;
      });
    });
    await tick();
    await inTransaction(two.db, (tx) => insert(tx, 'two')); // not blocked by the open one
    releaseOne();
    await held;
    expect(await probeRows(one)).toEqual(['one']);
    expect(await probeRows(two)).toEqual(['two']);
  });
});
