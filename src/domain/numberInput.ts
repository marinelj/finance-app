/**
 * Parses what people type into amount and rate fields. Accepts thousands separators, a leading
 * "+", full-width digits and punctuation from Chinese keyboards (１２３．５), and a trailing dot
 * while typing ("12."). Returns null for an empty field and NaN for anything else that is not a
 * number.
 */
export function parseDecimal(text: string): number | null {
  const normalized = text
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/．|。/g, '.')
    .replace(/[\s,， ]/g, '')
    .replace(/^\+/, '');
  if (normalized === '') return null;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

/** Like `parseDecimal`, but only whole numbers count. */
export function parseInteger(text: string): number | null {
  const value = parseDecimal(text);
  if (value === null || Number.isNaN(value)) return value;
  return Number.isInteger(value) ? value : Number.NaN;
}

/** Formats a stored number back into an editable field: no grouping, no trailing zeros. */
export function toInputText(value: number | null | undefined, maxDecimals = 6): string {
  if (value == null || !Number.isFinite(value)) return '';
  return String(Number(value.toFixed(maxDecimals)));
}
