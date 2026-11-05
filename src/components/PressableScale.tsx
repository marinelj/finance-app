import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useMotion } from '@/design/motion';
import { springs } from '@/design/tokens';
import { haptics, type HapticKind } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** How far a pressable rises under a mouse pointer. */
const HOVER_LIFT = 2;

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. */
  scaleTo?: number;
  haptic?: HapticKind | false;
  /** Rise slightly under a mouse pointer (browser, iPad with a trackpad). */
  hoverLift?: boolean;
};

/**
 * Pressable that springs down slightly while touched and lifts under a mouse pointer.
 * Static under Reduce Motion.
 */
export function PressableScale({
  scaleTo = 0.97,
  haptic = false,
  hoverLift = true,
  onPressIn,
  onPressOut,
  onPress,
  onHoverIn,
  onHoverOut,
  style,
  ...rest
}: PressableScaleProps) {
  const { reduceMotion } = useMotion();
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.get() }, { scale: scale.get() }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        if (!reduceMotion) scale.set(withSpring(scaleTo, springs.snappy));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reduceMotion) scale.set(withSpring(1, springs.snappy));
        onPressOut?.(event);
      }}
      onHoverIn={(event) => {
        if (hoverLift && !reduceMotion && !rest.disabled) {
          lift.set(withSpring(HOVER_LIFT, springs.snappy));
        }
        onHoverIn?.(event);
      }}
      onHoverOut={(event) => {
        if (!reduceMotion) lift.set(withSpring(0, springs.snappy));
        onHoverOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) haptics[haptic]();
        onPress?.(event);
      }}
      style={[style, animatedStyle]}
    />
  );
}
