import { contrastRatio } from './contrast';
import { lightColors } from './tokens';

/** Linear mix of two `#RRGGBB` colours; `t` = 0 gives `a`, 1 gives `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(((x >> shift) & 0xff) * (1 - t) + ((y >> shift) & 0xff) * t);
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`;
}

export type CardPalette = {
  gradient: readonly [string, string];
  /** Text and icons on the card. */
  text: string;
  textSoft: string;
  /** Translucent fill for chips on the card. */
  chip: string;
};

const WHITE = '#FFFFFF';
const INK = lightColors.text;

/**
 * Colours for a product's card art. Saturated colours get white text on a gradient darkened
 * just enough for 4.5:1; light ones (amber, teal, mint) get ink text instead, keeping them bright.
 */
export function cardPalette(color: string): CardPalette {
  const deep = mixHex(color, INK, 0.2);
  if (contrastRatio(WHITE, deep) >= 4.5) {
    return {
      gradient: [deep, mixHex(color, INK, 0.42)],
      text: WHITE,
      textSoft: 'rgba(255, 255, 255, 0.85)',
      chip: 'rgba(255, 255, 255, 0.2)',
    };
  }
  return {
    gradient: [mixHex(color, WHITE, 0.12), color],
    text: INK,
    textSoft: 'rgba(20, 20, 43, 0.78)',
    chip: 'rgba(255, 255, 255, 0.4)',
  };
}
