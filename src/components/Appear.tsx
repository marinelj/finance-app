import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { useMotion } from '@/design/motion';

type AppearProps = {
  /** Position in the screen's cascade; each step adds a short delay. */
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Fades and springs a block into place when a screen mounts. Static under Reduce Motion. */
export function Appear({ index = 0, children, style }: AppearProps) {
  const { enter } = useMotion();
  return (
    <Animated.View entering={enter(index)} style={style}>
      {children}
    </Animated.View>
  );
}
