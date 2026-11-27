/**
 * en-US comma grouping without Intl (Hermes-safe), matching the Swift screens'
 * pinned-locale NumberFormatter: 2150 → "2,150".
 */
export function grouped(value: number): string {
  const digits = Math.round(Math.max(value, 0)).toString();
  let groupedText = '';
  for (let index = 0; index < digits.length; index += 1) {
    if (index > 0 && (digits.length - index) % 3 === 0) groupedText += ',';
    groupedText += digits[index];
  }
  return groupedText;
}
