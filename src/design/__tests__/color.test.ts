import { PRODUCT_COLORS } from '@/domain/credit';

import { cardPalette, mixHex } from '../color';
import { contrastRatio } from '../contrast';

describe('mixHex', () => {
  it('mixes channel by channel', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#ffffff');
    expect(mixHex('#FF0000', '#0000FF', 0.5)).toBe('#800080');
  });
});

describe('cardPalette', () => {
  it.each(PRODUCT_COLORS)('keeps card text at 4.5:1 or better on %s', (color) => {
    const palette = cardPalette(color);
    for (const stop of palette.gradient) {
      expect(contrastRatio(palette.text, stop)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
