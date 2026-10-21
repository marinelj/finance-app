import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useMotion } from '@/design/motion';
import { springs } from '@/design/tokens';
import { haptics } from '@/lib/haptics';

import { PRODUCT_CARD_HEIGHT } from './ProductCard';

type CardDeckProps<T> = {
  items: T[];
  keyOf: (item: T) => string;
  labelOf: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onPress: (item: T) => void;
};

/** How far each card behind the front one peeks out above it. */
const PEEK = 14;
const VISIBLE = 3;
const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 800;
/** Scale lost per step back in the stack. */
const SHRINK = 0.05;

/**
 * Stack of cards (Monzo / Wallet style). Flick the front card sideways and it flies off and
 * rejoins at the back. VoiceOver/TalkBack get a "next card" action; under Reduce Motion the
 * deck switches without the fly-off.
 */
export function CardDeck<T>({ items, keyOf, labelOf, renderCard, onPress }: CardDeckProps<T>) {
  const { t } = useTranslation();
  const [front, setFront] = useState(0);
  const count = items.length;
  const start = count > 0 ? front % count : 0;
  const advance = () => {
    haptics.light();
    setFront((value) => (value + 1) % Math.max(1, count));
  };

  const stack = Array.from({ length: Math.min(VISIBLE, count) }, (_, position) => {
    const index = (start + position) % count;
    return { item: items[index], index, position };
  });

  return (
    <View style={{ height: PRODUCT_CARD_HEIGHT + PEEK * (Math.min(VISIBLE, count) - 1) }}>
      {stack
        .slice()
        .reverse()
        .map(({ item, index, position }) => (
          <DeckCard
            key={keyOf(item)}
            position={position}
            draggable={position === 0 && count > 1}
            onSwiped={advance}
            onPress={() => onPress(item)}
            accessibilityLabel={t('credit.deckA11y', {
              name: labelOf(item),
              index: index + 1,
              count,
            })}
            accessibilityHint={count > 1 ? t('credit.deckHint') : undefined}>
            {renderCard(item)}
          </DeckCard>
        ))}
    </View>
  );
}

type DeckCardProps = {
  position: number;
  draggable: boolean;
  onSwiped: () => void;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  children: ReactNode;
};

function DeckCard({
  position,
  draggable,
  onSwiped,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  children,
}: DeckCardProps) {
  const { width } = useWindowDimensions();
  const { reduceMotion } = useMotion();
  const x = useSharedValue(0);
  const depth = useSharedValue(position);

  useEffect(() => {
    // A card that was flicked away comes back behind the others once it has moved to the back.
    x.set(0);
    depth.set(reduceMotion ? position : withSpring(position, springs.bouncy));
  }, [x, depth, position, reduceMotion]);

  const pan = usePanGesture({
    enabled: draggable,
    activeOffsetX: [-12, 12],
    failOffsetY: [-10, 10],
    onUpdate: (event) => {
      'worklet';
      x.set(event.translationX);
    },
    onDeactivate: (event) => {
      'worklet';
      const far = Math.abs(event.translationX) > SWIPE_DISTANCE;
      const fast = Math.abs(event.velocityX) > SWIPE_VELOCITY;
      if (far || fast) {
        const direction = event.translationX + event.velocityX * 0.1 > 0 ? 1 : -1;
        x.set(
          withTiming(direction * width * 1.2, { duration: 220 }, (finished) => {
            if (finished) scheduleOnRN(onSwiped);
          })
        );
      } else {
        x.set(withSpring(0, springs.snappy));
      }
    },
  });

  const style = useAnimatedStyle(() => {
    const d = depth.get();
    // Cards sit on the bottom edge; each one behind is lifted so PEEK points of it show above
    // the card in front, after accounting for the top edge moving down as it scales.
    return {
      transform: [
        { translateY: -d * (PEEK + PRODUCT_CARD_HEIGHT * SHRINK * 0.5) },
        { translateX: x.get() },
        { rotate: `${x.get() / 24}deg` },
        { scale: 1 - d * SHRINK },
      ],
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, { zIndex: 10 - position }, style]}>
        <Pressable
          onPress={onPress}
          disabled={position !== 0}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityElementsHidden={position !== 0}
          importantForAccessibility={position === 0 ? 'auto' : 'no-hide-descendants'}
          accessibilityActions={
            draggable ? [{ name: 'next', label: accessibilityHint }] : undefined
          }
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'next') onSwiped();
          }}>
          {children}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', left: 0, right: 0, bottom: 0, height: PRODUCT_CARD_HEIGHT },
});
