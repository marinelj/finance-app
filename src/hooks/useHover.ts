import { useState } from 'react';

/**
 * Hover state for pressables. Fires for mouse and trackpad pointers (browser, iPad with a
 * pointer); touch never hovers, so phones are unaffected.
 */
export function useHover() {
  const [hovered, setHovered] = useState(false);
  return {
    hovered,
    hoverProps: {
      onHoverIn: () => setHovered(true),
      onHoverOut: () => setHovered(false),
    },
  };
}

/**
 * Reads the hover flag that react-native-web adds to a Pressable's style callback state. Handy
 * inside `.map()` where a hook cannot be used; always false on native.
 */
export function isHovered(state: { pressed: boolean }): boolean {
  return (state as { hovered?: boolean }).hovered === true;
}
