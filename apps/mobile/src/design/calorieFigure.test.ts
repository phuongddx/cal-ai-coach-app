import { carriesCalorieFigure } from './calorieFigure';

/** The table of the U-71f brief: fifteen texts hidden under ED-safe, ten shown. */
const HIDDEN = [
  'Calories today: 1,850',
  '640 kcal',
  'kJ',
  '220 cals',
  '5 kilojoules',
  '640kJs',
  '220cals',
  '1,850 Calories',
  '6CAL',
  'Cal 640',
  '640kcal',
  'kcal.',
  'calories,',
  'kilojoule',
  'About 300 cal',
];
const SHOWN = [
  'Changes saved',
  'Chicken · 180 g',
  'Edited',
  'Calm bowl',
  'calcium 220 mg',
  'December',
  'escalate',
  'scalable',
  'Calzone',
  '150 g · 2 pieces',
];

describe('carriesCalorieFigure', () => {
  it.each(HIDDEN)('is true for %j', (text) => {
    expect(carriesCalorieFigure(text)).toBe(true);
  });

  it.each(SHOWN)('is false for %j', (text) => {
    expect(carriesCalorieFigure(text)).toBe(false);
  });

  it('reads every calorie word without case, as a word, glued to a number or followed by punctuation', () => {
    for (const word of ['kcal', 'kcals', 'cal', 'cals', 'calorie', 'calories', 'kJ', 'kJs', 'kilojoule', 'kilojoules']) {
      for (const form of [
        word,
        word.toUpperCase(),
        `640 ${word}`,
        `640${word}`,
        `${word} 640`,
        `${word}640`,
        `${word}.`,
        `${word},`,
        `(${word})`,
        `Total ${word}: 1,850`,
      ]) {
        expect(carriesCalorieFigure(form)).toBe(true);
      }
    }
  });

  it('shows a calorie word only when its letters are part of a longer word', () => {
    for (const text of ['Calcium', 'Calendar', 'Calm', 'Calzone', 'escalate', 'scalable', 'Vocal', 'Local', 'Kjell', 'Decal chips']) {
      expect(carriesCalorieFigure(text)).toBe(false);
    }
  });

  it('accepts the false positive of the brief: a text that is only a name such as "Cal"', () => {
    expect(carriesCalorieFigure('Cal')).toBe(true);
  });

  it('hides across lines and tabs, and treats an empty text as shown', () => {
    expect(carriesCalorieFigure('Lunch\n640 kcal')).toBe(true);
    expect(carriesCalorieFigure('Lunch\t220 cals')).toBe(true);
    expect(carriesCalorieFigure('')).toBe(false);
  });
});
