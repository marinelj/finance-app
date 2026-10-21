import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useMotion } from '@/design/motion';
import { springs } from '@/design/tokens';
import { haptics, type HapticKind } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. */
  scaleTo?: number;
  haptic?: HapticKind | false;
};

/** Pressable that springs down slightly while touched. Static under Reduce Motion. */
export function PressableScale({
  scaleTo = 0.97,
  haptic = false,
  onPressIn,
  onPressOut,
  onPress,
  style,
  ...rest
}: PressableScaleProps) {
  const { reduceMotion } = useMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

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
      onPress={(event) => {
        if (haptic) haptics[haptic]();
        onPress?.(event);
      }}
      style={[style, animatedStyle]}
    />
  );
}
