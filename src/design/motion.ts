import { FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { springs } from './tokens';

/**
 * Motion helpers. Everything here honours the OS "reduce motion" setting: when it is on,
 * entrance animations are skipped and springs collapse to instant changes.
 */
export function useMotion() {
  const reduceMotion = useReducedMotion();
  return {
    reduceMotion,
    /** Staggered entrance for the n-th block on a screen. */
    enter(index = 0) {
      if (reduceMotion) return undefined;
      return FadeInDown.delay(Math.min(index, 8) * 40)
        .springify(springs.bouncy.duration)
        .dampingRatio(0.8);
    },
    exit: reduceMotion ? undefined : FadeOut.duration(150),
  };
}
