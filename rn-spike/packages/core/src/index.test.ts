import { clamp, dayKey, kcalFromMacros, kcalLeft, ringProgress, sumMacros } from './index';

describe('kcalFromMacros', () => {
  it('uses 4 kcal/g for protein and carbs and 9 kcal/g for fat, rounded half-up', () => {
    expect(kcalFromMacros({ proteinG: 10, carbsG: 20, fatG: 5 })).toBe(165);
    expect(kcalFromMacros({ proteinG: 0, carbsG: 0, fatG: 0 })).toBe(0);
  });

  it('clamps unsafe input to 0 instead of throwing (pure-core rule)', () => {
    expect(kcalFromMacros({ proteinG: Number.NaN, carbsG: 1, fatG: 1 })).toBe(0);
    expect(kcalFromMacros({ proteinG: -1, carbsG: 1, fatG: 1 })).toBe(0);
  });
});

describe('clamp', () => {
  it('keeps a value inside the range and collapses non-finite input to the minimum', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
    expect(clamp(Number.NaN, 0, 10)).toBe(0);
    expect(clamp(Number.POSITIVE_INFINITY, 0, 10)).toBe(0);
  });
});

describe('dayKey', () => {
  it('formats the local calendar day as YYYY-MM-DD, not the UTC day', () => {
    expect(dayKey(new Date(2026, 10, 27, 23, 59))).toBe('2026-11-27');
    expect(dayKey(new Date(2026, 0, 3, 0, 1))).toBe('2026-01-03');
  });

  it('returns an empty string for an invalid date instead of throwing', () => {
    expect(dayKey(new Date('nope'))).toBe('');
  });
});

describe('sumMacros', () => {
  it('adds kcal and every macro across meals', () => {
    const totals = sumMacros([
      { kcal: 410, proteinG: 24, carbsG: 48, fatG: 12, fiberG: 7 },
      { kcal: 624, proteinG: 38, carbsG: 70, fatG: 18, fiberG: 5 },
    ]);
    expect(totals).toEqual({ kcal: 1034, proteinG: 62, carbsG: 118, fatG: 30, fiberG: 12 });
  });

  it('is all zeros for no meals and ignores unsafe numbers', () => {
    expect(sumMacros([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 });
    expect(sumMacros([{ kcal: Number.NaN, proteinG: -4, carbsG: 10, fatG: 0, fiberG: 0 }]).kcal).toBe(0);
    expect(sumMacros([{ kcal: 1, proteinG: -4, carbsG: 10, fatG: 0, fiberG: 0 }]).proteinG).toBe(0);
  });
});

describe('ringProgress', () => {
  it('is consumed over goal, clamped between 0 and 1', () => {
    expect(ringProgress(1050, 2100)).toBe(0.5);
    expect(ringProgress(3000, 2100)).toBe(1);
    expect(ringProgress(-5, 2100)).toBe(0);
  });

  it('is 0 when the goal is missing or not positive', () => {
    expect(ringProgress(100, 0)).toBe(0);
    expect(ringProgress(100, Number.NaN)).toBe(0);
  });
});

describe('kcalLeft', () => {
  it('is goal minus consumed and never negative', () => {
    expect(kcalLeft(2100, 1284)).toBe(816);
    expect(kcalLeft(2100, 2500)).toBe(0);
  });
});
