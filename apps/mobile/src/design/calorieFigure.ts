/**
 * The ED-safe screen for free text (U-71f). One rule for the message of a Toast and the chip of a FoodRow, and for any text a
 * user may have typed ("220 cals" as the name of a custom food).
 *
 * A text carries a calorie figure when, read without case, it holds one of kcal, kcals, cal, cals, calorie, calories, kilocalorie, kilocalories, kJ, kJs,
 * kilojoule, kilojoules as a word: not preceded and not followed by another letter. A digit, a space, punctuation, a
 * bracket or the edge of the text next to the word is fine ("640kcal", "6CAL", "Cal 640", "kcal.", "calories,").
 * The same letters inside a longer word do not count (calcium, December, escalate, Calzone).
 *
 * "Letter" means a Latin letter a-z: the regex avoids lookbehind and \p{L} so Hermes runs it unchanged, and a letter outside
 * a-z next to the word ("éCal") reads as a word break, so the screen fails toward hiding. The false positive accepted
 * by the brief: a text that is only a name such as "Cal" is hidden.
 */
const CALORIE_WORD = /(?:^|[^a-z])(?:kcals?|cals?|calories|calorie|kilocalories|kilocalorie|kjs?|kilojoules?)(?![a-z])/i;

export function carriesCalorieFigure(text: string): boolean {
  return CALORIE_WORD.test(text);
}
