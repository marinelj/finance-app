import { useEffect, useRef, useState } from 'react';

import { durations } from '@/design/tokens';

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

type CountUpOptions = {
  enabled?: boolean;
  /** Count up from zero on first mount instead of starting at the value. */
  fromZero?: boolean;
  duration?: number;
};

/**
 * Animates a number towards `target`, starting from the previously shown value.
 * When disabled (for example under Reduce Motion) it simply returns `target`.
 */
export function useCountUp(
  target: number,
  { enabled = true, fromZero = true, duration = durations.countUp }: CountUpOptions = {}
): number {
  const [value, setValue] = useState(() => (enabled && fromZero ? 0 : target));
  const shown = useRef(enabled && fromZero ? 0 : target);

  useEffect(() => {
    if (!enabled) {
      shown.current = target;
      return;
    }
    const from = shown.current;
    if (from === target) return;

    const start = Date.now();
    let frame = requestAnimationFrame(function step() {
      const t = Math.min(1, (Date.now() - start) / duration);
      const next = t >= 1 ? target : from + (target - from) * easeOutCubic(t);
      shown.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, enabled, duration]);

  return enabled ? value : target;
}
