/** Copy helpers of the Today screen that U-76 adds: the frames' header date, the ED-Safe guidance and the grid values. */
import {
  edSafeGuidance,
  freezeLineText,
  groupedNumber,
  headerSubtitleText,
  macroValueText,
  mealMeta,
  nextMealName,
  pendingMealMeta,
  streakTitleText,
} from '../todayFormat';

const at = (hour: number, minute = 0) => new Date(2026, 10, 24, hour, minute, 0, 0);

describe('todayFormat (U-76)', () => {
  it('writes the header subtitle as the frame does: weekday, day, abbreviated month', () => {
    expect(headerSubtitleText(new Date(2026, 10, 24))).toBe('Tuesday, 24 Nov');
    expect(headerSubtitleText(new Date(2026, 8, 5))).toBe('Saturday, 5 Sep');
  });

  it('groups thousands in en_US whatever the device locale', () => {
    expect(groupedNumber(1284)).toBe('1,284');
    expect(groupedNumber(2100)).toBe('2,100');
    expect(groupedNumber(816)).toBe('816');
    expect(groupedNumber(0)).toBe('0');
  });

  it('writes a macro as "82 / 130 g" with the values rounded', () => {
    expect(macroValueText(82, 130)).toBe('82 / 130 g');
    expect(macroValueText(81.6, 129.5)).toBe('82 / 130 g');
    expect(macroValueText(0, 0)).toBe('0 / 0 g');
  });

  it('names the next meal by the clock, on the boundaries of the app meal slots', () => {
    expect(nextMealName(at(6))).toBe('Breakfast');
    expect(nextMealName(at(10, 59))).toBe('Breakfast');
    expect(nextMealName(at(11))).toBe('Lunch');
    expect(nextMealName(at(14, 59))).toBe('Lunch');
    expect(nextMealName(at(15))).toBe('Dinner');
    expect(nextMealName(at(20, 59))).toBe('Dinner');
    expect(nextMealName(at(21))).toBe('Breakfast'); // after dinner the next meal is tomorrow's breakfast
    expect(nextMealName(at(0))).toBe('Breakfast');
  });

  it('builds the ED-Safe guidance sentence: a steady lead, then the next meal', () => {
    expect(edSafeGuidance(at(16))).toEqual({ lead: 'Steady meals keep energy even.', next: 'Dinner is next.' });
    expect(edSafeGuidance(at(9)).next).toBe('Breakfast is next.');
  });

  it('carries no number, no goal and no calorie word in the guidance', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const { lead, next } = edSafeGuidance(at(hour));
      expect(`${lead} ${next}`).not.toMatch(/\d|kcal|calor|goal|left|over/i);
    }
  });

  it('adds the "syncs later" suffix to the meta of a meal that waits for the sync', () => {
    const meta = mealMeta('lunch', at(12, 40));
    expect(pendingMealMeta(meta, true)).toBe('Lunch · 12:40 PM · syncs later');
    expect(pendingMealMeta(meta, false)).toBe('Lunch · 12:40 PM');
  });

  it('writes the streak title and the freeze line of the frame', () => {
    expect(streakTitleText(12)).toBe('12-day streak');
    expect(streakTitleText(1)).toBe('1-day streak');
    expect(streakTitleText(0)).toBe('No streak yet');
    expect(freezeLineText(1)).toBe('1 freeze available');
    expect(freezeLineText(2)).toBe('2 freezes available');
    expect(freezeLineText(0)).toBe('No freezes available');
  });
});
