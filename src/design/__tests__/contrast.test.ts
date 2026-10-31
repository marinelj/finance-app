import { contrastRatio } from '../contrast';
import { lightColors as c } from '../tokens';

const TEXT = 4.5; // WCAG AA, normal text
const GRAPHIC = 3; // WCAG AA, icons and large text

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });

  it('rejects malformed colours', () => {
    expect(() => contrastRatio('red', '#FFFFFF')).toThrow();
  });
});

describe('light theme contrast', () => {
  const pages = [c.background, c.surface];

  it.each([
    ['text', c.text],
    ['textSecondary', c.textSecondary],
    ['textMuted', c.textMuted],
    ['primaryText', c.primaryText],
  ])('%s is readable on page and card backgrounds', (_name, fg) => {
    for (const bg of pages) expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(TEXT);
  });

  it('keeps muted text readable on muted surfaces', () => {
    expect(contrastRatio(c.textMuted, c.surfaceMuted)).toBeGreaterThanOrEqual(TEXT);
  });

  it('keeps white text readable on the primary colour and both gradient stops', () => {
    for (const bg of [c.primary, c.primaryPressed, ...c.heroGradient]) {
      expect(contrastRatio(c.textOnPrimary, bg)).toBeGreaterThanOrEqual(TEXT);
    }
  });

  it('keeps primary text readable on the primary tint', () => {
    expect(contrastRatio(c.primaryText, c.primarySoft)).toBeGreaterThanOrEqual(TEXT);
    expect(contrastRatio(c.primaryText, c.primarySoftHover)).toBeGreaterThanOrEqual(TEXT);
  });

  it('keeps button text readable in the hover colours', () => {
    expect(contrastRatio(c.surface, c.textSecondary)).toBeGreaterThanOrEqual(TEXT);
  });

  it.each(Object.entries(c.status))(
    'status %s text is readable on its tint and on cards',
    (_tone, s) => {
      expect(contrastRatio(s.text, s.soft)).toBeGreaterThanOrEqual(TEXT);
      expect(contrastRatio(s.text, s.softHover)).toBeGreaterThanOrEqual(TEXT);
      expect(contrastRatio(s.text, c.surface)).toBeGreaterThanOrEqual(TEXT);
    }
  );

  it.each(Object.keys(c.accentStrong) as (keyof typeof c.accentStrong)[])(
    'accent %s icons stand out on their chip',
    (tone) => {
      expect(contrastRatio(c.accentStrong[tone], c.accentSoft[tone])).toBeGreaterThanOrEqual(
        GRAPHIC
      );
    }
  );

  it('keeps the good and danger status marks visible on cards', () => {
    // Caution (amber) sits below 3:1 by design and always ships with an icon and a label.
    expect(contrastRatio(c.status.good.mark, c.surface)).toBeGreaterThanOrEqual(GRAPHIC);
    expect(contrastRatio(c.status.danger.mark, c.surface)).toBeGreaterThanOrEqual(GRAPHIC);
  });
});
