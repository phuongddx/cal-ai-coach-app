import { kcalFromMacros, roundKcal, roundMacro } from './index';

import { KcalArithmetic } from './kcal';

describe('KcalArithmetic', () => {
  it('golden parity case matches fixture', () => {
    expect(KcalArithmetic.mealKcal(145, 320)).toBe(464);
    expect(KcalArithmetic.macroGrams(27, 320)).toBe(86.4);
  });

  it('zero grams yield zero', () => {
    expect(KcalArithmetic.mealKcal(145, 0)).toBe(0);
    expect(KcalArithmetic.macroGrams(27, 0)).toBe(0);
  });

  it('meal kcal is monotonic in grams', () => {
    let previous = -1;
    for (let grams = 0; grams <= 1000; grams += 50) {
      const kcal = KcalArithmetic.mealKcal(145, grams);
      expect(kcal).toBeGreaterThanOrEqual(previous);
      previous = kcal;
    }
  });

  it('meal kcal rounds to nearest whole', () => {
    expect(KcalArithmetic.mealKcal(150, 333)).toBe(500);
    expect(KcalArithmetic.mealKcal(150, 334)).toBe(501);
    expect(KcalArithmetic.mealKcal(100, 100)).toBe(100);
  });

  it('macro grams rounds to one decimal', () => {
    expect(KcalArithmetic.macroGrams(4, 320)).toBe(12.8);
    expect(KcalArithmetic.macroGrams(3.3, 55)).toBe(1.8);
    expect(KcalArithmetic.macroGrams(2, 100)).toBe(2);
  });

  it('kcalFromMacros agrees with the server rule on the Swift vectors', () => {
    // Swift golden vector: 145 kcal/100 g over 320 g → 464 kcal; protein 27/100 g → 86.4 g.
    expect(KcalArithmetic.mealKcal(145, 320)).toBe(roundKcal(145, 320));
    expect(KcalArithmetic.macroGrams(27, 320)).toBe(roundMacro(27, 320));
    // The same food decomposed into per-100 g macros (20 P + 10 C + 25 fat kcal = 145):
    // at 320 g the client rule over the current grams lands on the server figure exactly.
    const grams320 = {
      proteinG: KcalArithmetic.macroGrams(20, 320),
      carbsG: KcalArithmetic.macroGrams(10, 320),
      fatG: KcalArithmetic.macroGrams(25 / 9, 320),
    };
    expect(grams320).toEqual({ proteinG: 64, carbsG: 32, fatG: 8.9 });
    expect(kcalFromMacros(grams320)).toBe(464);
    expect(kcalFromMacros({ proteinG: 0, carbsG: 0, fatG: 0 })).toBe(KcalArithmetic.mealKcal(145, 0));
  });
});
