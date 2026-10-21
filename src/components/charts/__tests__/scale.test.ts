import { estimateLabelWidth, gutterFor, linear, niceBounds, niceStep } from '../scale';

describe('chart scales', () => {
  it('picks round steps', () => {
    expect(niceStep(100, 4)).toBe(25);
    expect(niceStep(1_000_000, 3)).toBe(500000);
    expect(niceStep(7, 3)).toBe(2.5);
    expect(niceStep(0, 3)).toBe(1);
  });

  it('wraps the data in round bounds, starting at zero when the data is close to it', () => {
    expect(niceBounds(1_850_000, 2_070_000, 3)).toEqual({
      min: 1_800_000,
      max: 2_100_000,
      ticks: [1_800_000, 1_900_000, 2_000_000, 2_100_000],
    });
    expect(niceBounds(120, 980, 3)).toEqual({ min: 0, max: 1000, ticks: [0, 500, 1000] });
    expect(niceBounds(5, 5, 3).min).toBeLessThan(5);
  });

  it('maps a domain onto a range', () => {
    const y = linear([0, 100], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(50)).toBe(100);
    expect(y(100)).toBe(0);
  });
});

describe('label widths', () => {
  it('counts CJK characters as wider', () => {
    expect(estimateLabelWidth('$440K')).toBe(42);
    expect(estimateLabelWidth('¥40万')).toBeGreaterThan(estimateLabelWidth('¥40K'));
  });

  it('sizes the gutter to the longest label', () => {
    expect(gutterFor(['$0', '$440K'])).toBe(52);
    expect(gutterFor(['$0'])).toBe(38);
  });
});
