import { kcalFromMacros } from './index';

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
