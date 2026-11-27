/**
 * `Color.opacity(_)` for a `#RRGGBB` token or an `rgba(r,g,b,a)` token (the new alpha replaces the
 * old one). Lives apart from `tokens.ts` so that file holds no color syntax at all.
 */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgb')) {
    const [r, g, b] = color
      .slice(color.indexOf('(') + 1, color.indexOf(')'))
      .split(',')
      .map((part) => Number.parseFloat(part));
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const value = Number.parseInt(color.slice(1), 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}
