/**
 * Server-side hidden-fat heuristic (LOG-09) — the belt to the fixture/VLM
 * flag's braces: either source firing sets the signal, and the signal never
 * suppresses or alters the computed kcal. Pure, no I/O.
 */

export const HIDDEN_FAT_KEYWORDS: readonly string[] = Object.freeze([
  'oil',
  'olive oil',
  'vegetable oil',
  'dressing',
  'vinaigrette',
  'mayonnaise',
  'aioli',
  'butter',
  'margarine',
  'cream',
  'heavy cream',
  'sour cream',
  'cream sauce',
  'cheese sauce',
  'pesto',
  'hollandaise',
  'béarnaise',
  'sautéed',
  'fried',
  'pan-fried',
  'deep-fried',
  'drizzled',
  'glazed',
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whole-word boundaries via non-letter/non-digit guards (unicode-aware, so
// accented keywords like 'sautéed' behave): 'oil' must not match 'coin'.
const KEYWORD_PATTERNS = HIDDEN_FAT_KEYWORDS.map(
  (keyword) =>
    new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(keyword)}($|[^\\p{L}\\p{N}])`, 'iu'),
);

export function flagHiddenFat(labels: readonly string[]): boolean {
  return labels.some((label) => KEYWORD_PATTERNS.some((pattern) => pattern.test(label)));
}
