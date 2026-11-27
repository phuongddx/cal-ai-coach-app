import { roundKcal, roundMacro, sumItemKcal } from '@coachcal/core';

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

it('roundKcal matches the canonical half-up rule over 200 seeded pairs', () => {
  const next = mulberry32(20260914);
  for (let i = 0; i < 200; i++) {
    const per100g = next() * 1000;
    const grams = next() * 2000 + Number.EPSILON;
    expect(roundKcal(per100g, grams)).toEqual(Math.round((per100g * grams) / 100));
  }
});

it('roundKcal rounds exact .5 upward (the Swift-parity spec)', () => {
  expect(roundKcal(165, 150)).toEqual(248);
});

it('roundKcal guards zero and negative grams', () => {
  expect(roundKcal(165, 0)).toEqual(0);
  expect(roundKcal(165, -50)).toEqual(0);
});

it('roundMacro keeps 0.1 g precision over 200 seeded pairs', () => {
  const next = mulberry32(20260914);
  for (let i = 0; i < 200; i++) {
    const per100g = next() * 100;
    const grams = next() * 500 + Number.EPSILON;
    const macro = roundMacro(per100g, grams);
    expect(macro).toEqual(Math.round((per100g * grams) / 10) / 10);
    expect(Math.round(macro * 10)).toEqual(macro * 10);
  }
});

it('roundMacro guards zero and negative grams', () => {
  expect(roundMacro(31, 0)).toEqual(0);
  expect(roundMacro(31, -10)).toEqual(0);
});

it('sumItemKcal sums per-item integer kcal with no re-rounding', () => {
  const items = [{ kcal: 100 }, { kcal: 248 }, { kcal: 37 }];
  expect(sumItemKcal(items)).toEqual(385);
});

it('sumItemKcal equals the plain integer sum over 200 seeded arrays', () => {
  const next = mulberry32(20260914);
  for (let i = 0; i < 200; i++) {
    const items = Array.from({ length: 1 + Math.floor(next() * 5) }, () => ({
      kcal: Math.floor(next() * 900),
    }));
    const plain = items.reduce((total, item) => total + item.kcal, 0);
    expect(sumItemKcal(items)).toEqual(plain);
  }
});

it('sumItemKcal over an empty meal is zero', () => {
  expect(sumItemKcal([])).toEqual(0);
});
