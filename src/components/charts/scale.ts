/** Shared chart maths: nice axis bounds and linear scales. */

/** A round step for about `count` intervals over `span` (1, 2, 2.5 or 5 × 10ⁿ). */
export function niceStep(span: number, count: number): number {
  if (!(span > 0)) return 1;
  const raw = span / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * Axis bounds that contain [min, max] on round numbers, with `ticks` evenly spaced values.
 * Includes zero when the data starts at or near it.
 */
export function niceBounds(
  min: number,
  max: number,
  count = 3
): { min: number; max: number; ticks: number[] } {
  let low = Math.min(min, max);
  let high = Math.max(min, max);
  if (low === high) {
    const pad = Math.abs(low) * 0.1 || 1;
    low -= pad;
    high += pad;
  }
  if (low > 0 && low < (high - low) * 0.5) low = 0;
  const step = niceStep(high - low, count);
  const start = Math.floor(low / step) * step;
  const end = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step)
    ticks.push(Number(value.toFixed(10)));
  return { min: start, max: end, ticks };
}

export function linear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}

/**
 * Rough width of a short label in the 12pt micro style, for sizing the y-axis gutter:
 * CJK characters are about twice as wide as Latin ones.
 */
export function estimateLabelWidth(text: string): number {
  let width = 0;
  for (const char of text) width += /[\u3000-\u9fff\uff00-\uffef]/.test(char) ? 13.5 : 8.4;
  return Math.ceil(width);
}

/** Gutter wide enough for every tick label, within sensible limits. */
export function gutterFor(labels: string[]): number {
  return Math.min(84, Math.max(28, ...labels.map(estimateLabelWidth)) + 10);
}
