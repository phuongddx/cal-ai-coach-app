import { assertEquals } from 'jsr:@std/assert';
import { roundKcal, roundMacro, sumItemKcal } from '../_shared/arithmetic.ts';

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

Deno.test('roundKcal matches the canonical half-up rule over 200 seeded pairs', () => {
  const next = mulberry32(20260914);
  for (let i = 0; i < 200; i++) {
    const per100g = next() * 1000;
    const grams = next() * 2000 + Number.EPSILON;
    assertEquals(roundKcal(per100g, grams), Math.round((per100g * grams) / 100));
  }
});

Deno.test('roundKcal rounds exact .5 upward (the Swift-parity spec)', () => {
  assertEquals(roundKcal(165, 150), 248);
});

Deno.test('roundKcal guards zero and negative grams', () => {
  assertEquals(roundKcal(165, 0), 0);
  assertEquals(roundKcal(165, -50), 0);
});

Deno.test('roundMacro keeps 0.1 g precision over 200 seeded pairs', () => {
  const next = mulberry32(20260914);
  for (let i = 0; i < 200; i++) {
    const per100g = next() * 100;
    const grams = next() * 500 + Number.EPSILON;
    const macro = roundMacro(per100g, grams);
    assertEquals(macro, Math.round((per100g * grams) / 10) / 10);
    assertEquals(Math.round(macro * 10), macro * 10);
  }
});

Deno.test('roundMacro guards zero and negative grams', () => {
  assertEquals(roundMacro(31, 0), 0);
  assertEquals(roundMacro(31, -10), 0);
});

Deno.test('sumItemKcal sums per-item integer kcal with no re-rounding', () => {
  const items = [{ kcal: 100 }, { kcal: 248 }, { kcal: 37 }];
  assertEquals(sumItemKcal(items), 385);
});

Deno.test('sumItemKcal equals the plain integer sum over 200 seeded arrays', () => {
  const next = mulberry32(20260914);
  for (let i = 0; i < 200; i++) {
    const items = Array.from({ length: 1 + Math.floor(next() * 5) }, () => ({
      kcal: Math.floor(next() * 900),
    }));
    const plain = items.reduce((total, item) => total + item.kcal, 0);
    assertEquals(sumItemKcal(items), plain);
  }
});

Deno.test('sumItemKcal over an empty meal is zero', () => {
  assertEquals(sumItemKcal([]), 0);
});
