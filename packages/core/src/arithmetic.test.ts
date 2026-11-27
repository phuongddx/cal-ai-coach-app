import { roundKcal, roundMacro, sumItemKcal } from './arithmetic';

describe('canonical scan arithmetic (server rule, shared with the client)', () => {
  it('regenerates every number of the golden scan response from per100g x grams', () => {
    const per100g = { kcal: 145, proteinG: 27, carbsG: 40, fatG: 4, fiberG: 2 };
    const grams = 320;
    expect(roundKcal(per100g.kcal, grams)).toBe(464);
    expect(roundMacro(per100g.proteinG, grams)).toBe(86.4);
    expect(roundMacro(per100g.carbsG, grams)).toBe(128);
    expect(roundMacro(per100g.fatG, grams)).toBe(12.8);
    expect(roundMacro(per100g.fiberG, grams)).toBe(6.4);
  });

  it('rounds half-up and never below zero for non-positive grams', () => {
    expect(roundKcal(1.5, 100)).toBe(2);
    expect(roundKcal(2.5, 100)).toBe(3);
    expect(roundKcal(100, 0)).toBe(0);
    expect(roundKcal(100, -5)).toBe(0);
    expect(roundMacro(25, 0)).toBe(0);
    expect(roundMacro(1, 50)).toBe(0.5);
    expect(roundMacro(1, 26)).toBe(0.3);
  });

  it('sums item kcal into the meal total', () => {
    expect(sumItemKcal([{ kcal: 464 }, { kcal: 0 }, { kcal: 36 }])).toBe(500);
    expect(sumItemKcal([])).toBe(0);
  });
});
