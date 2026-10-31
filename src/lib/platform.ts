import { useWindowDimensions } from 'react-native';

export const isWeb = process.env.EXPO_OS === 'web';

/** Width above which the browser version centres its content instead of stretching it. */
export const WIDE_BREAKPOINT = 768;
/** Readable width for page content on wide screens. */
export const CONTENT_MAX_WIDTH = 760;

/** True on wide windows (desktop browsers, tablets in landscape). */
export function useIsWide(): boolean {
  const { width } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT;
}

/**
 * Side padding for full-bleed bars (sticky form footers) so what they hold lines up with the
 * centred page content on wide screens, while the bar's background still spans the window.
 */
export function useCenteredGutter(gutter: number): number {
  const { width } = useWindowDimensions();
  return Math.max(gutter, (width - CONTENT_MAX_WIDTH) / 2 + gutter);
}
