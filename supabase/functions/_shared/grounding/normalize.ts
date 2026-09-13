/**
 * Pure barcode/cache-key normalization — no I/O. The UPC-A rule is the
 * GTIN-correct one: EAN-13 with a leading 0 loses that 0, because FDC
 * Branded gtinUpc values are stored in US UPC-A form.
 */

function assertDigits(barcode: string): void {
  if (!/^\d+$/.test(barcode)) throw new Error('barcode must contain only digits');
}

export function toUpca(barcode: string): string {
  assertDigits(barcode);
  if (barcode.length === 11) return `0${barcode}`;
  if (barcode.length === 12) return barcode;
  if (barcode.length === 13 && barcode[0] === '0') return barcode.slice(1);
  if (barcode.length === 14 && barcode[0] === '0') return barcode.slice(1, 13);
  throw new Error(`no UPC-A form for a ${barcode.length}-digit barcode`);
}

export function toEan13(barcode: string): string {
  assertDigits(barcode);
  if (barcode.length === 13) return barcode;
  if (barcode.length === 14 && barcode[0] === '0') return barcode.slice(1);
  if (barcode.length === 12 || barcode.length === 8) {
    // Zero-padding on the left preserves the GTIN check digit, so the
    // check is computed over the zero-prefixed body — never appended to a
    // complete GTIN, which would reinterpret its check digit as data.
    const body = barcode.length === 8
      ? `00000${barcode.slice(0, 7)}`
      : `0${barcode.slice(0, 11)}`;
    return `${body}${gtinCheckDigit(body)}`;
  }
  throw new Error(`no EAN-13 form for a ${barcode.length}-digit barcode`);
}

function gtinCheckDigit(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

export function searchCacheKey(label: string): string {
  return `search:${label.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

export function barcodeCacheKey(normalized: string): string {
  return `barcode:${normalized}`;
}
