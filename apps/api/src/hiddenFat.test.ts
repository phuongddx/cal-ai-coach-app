import { ScanResponseSchema } from '@coachcal/api-contract';

import { flagHiddenFat, HIDDEN_FAT_KEYWORDS } from './hiddenFat';
import { describeSql } from './testing/sqlHarness';

const CAESAR_KEY = 'search:caesar salad';
const TEXT_KEYS = [
  'search:grilled chicken',
  'search:greek salad',
  'search:banana',
  'search:greek yogurt',
];

describe('hiddenFat (logic)', () => {
  it('flagHiddenFat fires on hidden-fat keywords across labels', () => {
    expect(flagHiddenFat(['caesar dressing'])).toBe(true);
    expect(flagHiddenFat(['coconut oil'])).toBe(true);
    expect(flagHiddenFat(['Grilled Chicken with Olive Oil'])).toBe(true); // case-insensitive
    expect(flagHiddenFat(['pasta with heavy cream sauce'])).toBe(true); // multi-word keyword
    expect(flagHiddenFat(['sautéed spinach'])).toBe(true); // unicode keyword
    expect(flagHiddenFat(['deep-fried chicken'])).toBe(true); // hyphenated keyword
    expect(flagHiddenFat(['plain rice', 'butter naan'])).toBe(true); // any label firing is enough
  });

  it('flagHiddenFat stays silent without whole-word keyword matches', () => {
    expect(flagHiddenFat(['grilled chicken'])).toBe(false);
    expect(flagHiddenFat(['coin'])).toBe(false); // 'oil' must not match inside 'coin'
    expect(flagHiddenFat(['boiled eggs'])).toBe(false); // 'oil' must not match inside 'boiled'
    expect(flagHiddenFat(['plain rice', 'steamed broccoli'])).toBe(false);
    expect(flagHiddenFat([])).toBe(false);
  });

  it('HIDDEN_FAT_KEYWORDS is a frozen vocabulary including the core fats', () => {
    expect(Object.isFrozen(HIDDEN_FAT_KEYWORDS)).toBe(true);
    for (const keyword of ['oil', 'olive oil', 'dressing', 'mayonnaise', 'butter', 'heavy cream', 'fried']) {
      expect(HIDDEN_FAT_KEYWORDS).toContain(keyword); // vocabulary must include the keyword
    }
  });
});

describeSql('hiddenFat (scan route, SQL-backed)', (harness) => {
  it('caesar sentinel scan carries the fixture hidden-fat flag alongside editable kcal', async () => {
    const h = harness();
    await h.seedPositive(CAESAR_KEY, { kcal: 190, proteinG: 8, carbsG: 11, fatG: 14, fiberG: 2 });
    const { userId, token } = await h.newUser({ entitled: true });
    const scanId = crypto.randomUUID();
    try {
      const res = await h.post(
        '/v1/scan',
        { scanId, kind: 'photo', imageBase64: 'fixture:caesar-salad', mealType: 'lunch' },
        token,
      );
      expect(res.status).toBe(200);
      const parsed = ScanResponseSchema.parse(await res.json());
      expect(parsed.items.length).toBe(1);
      const item = parsed.items[0]!;
      expect(item.label).toBe('caesar salad');
      expect(item.hiddenFatLikely).toBe(true); // fixture flag must reach the response
      expect(item.kcal).toBe(Math.round((190 * 250) / 100)); // computed kcal rides alongside the signal
      expect(item.kcal).toBe(475);
      expect(Number.isInteger(item.kcal)).toBe(true);
      expect(item.unresolved).toBe(false);

      const persisted = await h.scanItems(scanId);
      expect(persisted[0]?.hidden_fat_likely).toBe(true); // signal must persist
    } finally {
      await h.deleteScan(scanId, userId);
      await h.deleteCacheKey(CAESAR_KEY);
    }
  });

  it('server-side heuristic fires the signal from the text description alone', async () => {
    const h = harness();
    await h.seedPositive('search:grilled chicken', { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0 });
    await h.seedPositive('search:greek salad', { kcal: 90, proteinG: 3, carbsG: 6, fatG: 6, fiberG: 2 });
    await h.seedPositive('search:banana', { kcal: 89, proteinG: 1.1, carbsG: 22.8, fatG: 0.3, fiberG: 2.6 });
    await h.seedPositive('search:greek yogurt', { kcal: 59, proteinG: 10, carbsG: 3.6, fatG: 0.4, fiberG: 0 });
    const { userId, token } = await h.newUser({ entitled: true });
    const scanId = crypto.randomUUID();
    try {
      const res = await h.post(
        '/v1/scan',
        {
          scanId,
          kind: 'text',
          textDescription: 'banana and greek yogurt drizzled with honey',
          mealType: 'breakfast',
        },
        token,
      );
      expect(res.status).toBe(200);
      const parsed = ScanResponseSchema.parse(await res.json());
      expect(parsed.items.length).toBeGreaterThan(0);
      const item = parsed.items[0]!;
      expect(item.hiddenFatLikely).toBe(true); // heuristic on the description must fire the signal
      expect(item.kcal).toBeGreaterThan(0); // signal must not suppress the computed kcal
      expect(item.unresolved).toBe(false);
    } finally {
      await h.deleteScan(scanId, userId);
      for (const key of TEXT_KEYS) await h.deleteCacheKey(key);
    }
  });

  it('hidden-fat suite cleanup removes the test user, entitlement, and seeds', async () => {
    const h = harness();
    await h.cleanupData();
    const [usage] = await h.owner<{ n: number }[]>`SELECT count(*)::int AS n FROM public.scan_usage`;
    expect(usage?.n).toBe(0);
  });
});
