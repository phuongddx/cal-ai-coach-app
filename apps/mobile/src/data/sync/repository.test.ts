import { createInMemorySyncStore } from './inMemorySyncStore';
import { createMealRepository } from './repository';

let clock = 1_764_200_000_000;
let idCounter = 0;

const tick = () => {
  clock += 5_000;
  return clock;
};

const nextId = () => {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
};

const mealInput = {
  name: 'Chicken rice bowl',
  kcal: 624,
  proteinG: 38,
  carbsG: 70,
  fatG: 18,
  fiberG: 4,
};

describe('meal repository', () => {
  beforeEach(() => {
    clock = 1_764_200_000_000;
    idCounter = 0;
  });

  it('a local write is one unit: the meal row exists and exactly one outbox operation', async () => {
    const store = createInMemorySyncStore();
    const writes: number[] = [];
    const repository = createMealRepository({ store, now: tick, newId: nextId, onLocalWrite: () => writes.push(1) });

    const meal = await repository.addMeal(mealInput);
    expect(await store.getMeal(meal.id)).toMatchObject({ name: 'Chicken rice bowl', serverVersion: 0 });
    expect(await store.hasPendingIntent(meal.id)).toBe(true);
    expect(await store.outboxCount()).toBe(1);
    const entry = (await store.pendingOperations(1))[0];
    expect(entry?.op.kind).toBe('upsert');
    if (entry?.op.kind !== 'upsert') throw new Error('expected an upsert operation');
    expect(entry.op.meal.name).toBe('Chicken rice bowl');
    expect(writes).toHaveLength(1);
  });

  it('editMeal bumps the LWW clock, queues a second operation and keeps the row', async () => {
    const store = createInMemorySyncStore();
    const repository = createMealRepository({ store, now: tick, newId: nextId });

    const meal = await repository.addMeal(mealInput);
    const firstUpdatedAt = (await store.getMeal(meal.id))?.updatedAt;
    const edited = await repository.editMeal(meal.id, { kcal: 700, name: 'Big bowl' });

    const stored = await store.getMeal(meal.id);
    expect(stored?.kcal).toBe(700);
    expect(stored?.name).toBe('Big bowl');
    expect(stored?.updatedAt).toBeGreaterThan(firstUpdatedAt ?? 0);
    expect(edited.updatedAt).toBe(stored?.updatedAt);
    expect(await store.outboxCount()).toBe(2);
  });

  it('deleteMeal removes the row at once and queues a tombstone', async () => {
    const store = createInMemorySyncStore();
    const repository = createMealRepository({ store, now: tick, newId: nextId });

    const meal = await repository.addMeal(mealInput);
    await repository.deleteMeal(meal.id);

    expect(await store.getMeal(meal.id)).toBeNull();
    expect(await store.hasPendingIntent(meal.id)).toBe(true);
    const pending = await store.pendingOperations(10);
    expect(pending).toHaveLength(2);
    const tombstoneEntry = pending[1];
    expect(tombstoneEntry?.op.kind).toBe('tombstone');
    if (tombstoneEntry?.op.kind !== 'tombstone') throw new Error('expected a tombstone operation');
    expect('meal' in tombstoneEntry.op).toBe(false);
  });

  it('unknown meals refuse an edit', async () => {
    const store = createInMemorySyncStore();
    const repository = createMealRepository({ store, now: tick, newId: nextId });
    await expect(repository.editMeal('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { kcal: 1 })).rejects.toThrow('unknown meal');
  });
});
