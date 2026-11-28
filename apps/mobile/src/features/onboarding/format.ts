/** en-US comma grouping without Intl (Hermes-safe, as in the Swift en_US
 * NumberFormatter): 11900 → "11,900". Shared by the generating step's formula
 * lines and the plan reveal's weekly range. */
export function grouped(value: number): string {
  const digits = Math.round(Math.max(value, 0)).toString();
  let groupedText = '';
  for (let index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 === 0) groupedText += ',';
    groupedText += digits[index];
  }
  return groupedText;
}
