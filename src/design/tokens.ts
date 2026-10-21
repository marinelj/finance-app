import type { TextStyle } from 'react-native';

/**
 * Design tokens. The values, and the contrast ratios they were picked for, are documented in
 * docs/design.md; src/design/__tests__/contrast.test.ts keeps them honest.
 */

export type StatusTone = 'good' | 'caution' | 'danger';
export type AccentTone = 'violet' | 'pink' | 'mint' | 'sun' | 'sky';

type StatusColors = {
  /** Fill for marks: rings, bars, dots. Never used for text. */
  mark: string;
  /** Text and icons on top of `soft`. */
  text: string;
  /** Tinted background for badges and banners. */
  soft: string;
};

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  hairline: string;
  overlay: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  /** Primary hue when it is used as text or an icon on a light surface. */
  primaryText: string;
  heroGradient: readonly [string, string];
  /** Saturated accents for decoration (gradients, glows). Never text. */
  accent: Record<AccentTone, string>;
  /** Pale accent backgrounds for icon chips. */
  accentSoft: Record<AccentTone, string>;
  /** Accent icons on top of `accentSoft` (>= 3:1). */
  accentStrong: Record<AccentTone, string>;
  status: Record<StatusTone, StatusColors>;
  chart: {
    /** Categorical series in fixed order; validated with the dataviz validator. */
    series: readonly string[];
    grid: string;
    axis: string;
  };
};

export const lightColors: ThemeColors = {
  background: '#F6F6FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EFF0F6',
  border: 'rgba(20, 20, 43, 0.08)',
  hairline: '#E4E5EE',
  overlay: 'rgba(20, 20, 43, 0.45)',
  text: '#14142B',
  textSecondary: '#4E5070',
  textMuted: '#62657F',
  textOnPrimary: '#FFFFFF',
  primary: '#6C4DFF',
  primaryPressed: '#5A3BEE',
  primarySoft: '#EEEAFF',
  primaryText: '#5A3BEE',
  heroGradient: ['#5B3DF5', '#D6247F'],
  accent: {
    violet: '#6C4DFF',
    pink: '#FF4F9A',
    mint: '#13C39C',
    sun: '#FFC53D',
    sky: '#2D9CFF',
  },
  accentSoft: {
    violet: '#EEEAFF',
    pink: '#FFE4F0',
    mint: '#DDF7F0',
    sun: '#FFF4D6',
    sky: '#E1F0FF',
  },
  accentStrong: {
    violet: '#5A3BEE',
    pink: '#C4136B',
    mint: '#0A7A61',
    sun: '#8A5A00',
    sky: '#1565C0',
  },
  status: {
    good: { mark: '#0CA30C', text: '#006300', soft: '#E6F6E6' },
    caution: { mark: '#FAB219', text: '#8A5200', soft: '#FFF4DB' },
    danger: { mark: '#D03B3B', text: '#B42318', soft: '#FCE8E8' },
  },
  chart: {
    series: ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4'],
    grid: '#ECECF3',
    axis: '#D3D4E0',
  },
};

export const typography = {
  hero: { fontSize: 48, lineHeight: 56, fontWeight: '800', letterSpacing: -1 },
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.2 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4 },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/** Largest OS font scale each variant follows, so big numbers stay inside their cards. */
export const maxFontScale: Record<TypographyVariant, number> = {
  hero: 1.6,
  display: 1.6,
  title: 2,
  headline: 2,
  body: 2.4,
  callout: 2.4,
  caption: 2.4,
  micro: 2,
};

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const shadow = {
  card: '0px 6px 20px rgba(42, 30, 120, 0.08)',
  raised: '0px 12px 32px rgba(42, 30, 120, 0.14)',
} as const;

/** Spring configs in Reanimated 4's perceptual form (duration + damping ratio). */
export const springs = {
  snappy: { duration: 350, dampingRatio: 0.85 },
  bouncy: { duration: 500, dampingRatio: 0.6 },
  gentle: { duration: 550, dampingRatio: 1 },
} as const;

export const durations = {
  fast: 150,
  base: 250,
  countUp: 600,
} as const;

export type Theme = {
  colors: ThemeColors;
  typography: typeof typography;
  space: typeof space;
  radius: typeof radius;
  shadow: typeof shadow;
};

export const lightTheme: Theme = {
  colors: lightColors,
  typography,
  space,
  radius,
  shadow,
};
