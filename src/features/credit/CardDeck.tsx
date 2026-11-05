import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { useMotion } from '@/design/motion';
import { useStyles, useTheme } from '@/design/theme';
import { springs, type Theme } from '@/design/tokens';
import { haptics } from '@/lib/haptics';
import { isWeb } from '@/lib/platform';

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
/** More cards than this and the dots give way to a "3 / 12" counter. */
const MAX_DOTS = 8;

type Direction = 1 | -1;

/**
 * Stack of cards (Monzo / Wallet style). Flick the front card sideways and it flies off and
 * rejoins at the back; the cards behind rise as you drag, and a tick tells you when letting go
 * will flip. Dots under the deck show where you are. In a browser the deck also has previous /
 * next buttons and answers the arrow keys. VoiceOver/TalkBack get a "next card" action; under
 * Reduce Motion the deck switches without the fly-off.
 */
export function CardDeck<T>({ items, keyOf, labelOf, renderCard, onPress }: CardDeckProps<T>) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { reduceMotion } = useMotion();
  const [front, setFront] = useState(0);
  /** A flick started by a button or key rather than a finger. */
  const [flick, setFlick] = useState<Direction | null>(null);
  const count = items.length;
  const start = count > 0 ? front % count : 0;
  /** 0 → 1 as the front card is dragged towards the flip point; the cards behind follow it. */
  const progress = useSharedValue(0);

  useEffect(() => {
    // Cards have taken their new places (see DeckCard), so the drag is over.
    progress.set(0);
  }, [start, progress]);

  const advance = () => {
    haptics.light();
    setFlick(null);
    setFront((value) => (value + 1) % Math.max(1, count));
  };
  const goBack = () => {
    haptics.light();
    setFront((value) => (value - 1 + count) % Math.max(1, count));
  };
  const next = () => {
    if (count < 2 || flick) return;
    if (reduceMotion) advance();
    else setFlick(1);
  };

  const stack = Array.from({ length: Math.min(VISIBLE, count) }, (_, position) => {
    const index = (start + position) % count;
    return { item: items[index], index, position };
  });

  return (
    <View
      style={styles.deck}
      onKeyDown={
        isWeb && count > 1
          ? (event) => {
              const key = (event.nativeEvent as { key?: string }).key;
              if (key === 'ArrowRight') next();
              else if (key === 'ArrowLeft') goBack();
            }
          : undefined
      }>
      <View style={{ height: PRODUCT_CARD_HEIGHT + PEEK * (Math.min(VISIBLE, count) - 1) }}>
        {stack
          .slice()
          .reverse()
          .map(({ item, index, position }) => (
            <DeckCard
              key={keyOf(item)}
              position={position}
              progress={progress}
              draggable={position === 0 && count > 1}
              flick={position === 0 ? flick : null}
              onSwiped={advance}
              onPress={() => onPress(item)}
              accessibilityLabel={t('credit.deckA11y', {
                name: labelOf(item),
                index: index + 1,
                count,
              })}
              accessibilityHint={
                count > 1 ? (isWeb ? t('credit.deckHintKeys') : t('credit.deckHint')) : undefined
              }>
              {renderCard(item)}
            </DeckCard>
          ))}
      </View>
      {count > 1 ? (
        <View style={styles.footer}>
          {isWeb ? (
            <DeckArrow icon="chevron-back" label={t('credit.deckPrevious')} onPress={goBack} />
          ) : null}
          <View
            style={styles.dots}
            accessible
            accessibilityLabel={t('credit.deckA11y', {
              name: labelOf(items[start]),
              index: start + 1,
              count,
            })}>
            {count <= MAX_DOTS ? (
              items.map((item, index) => <Dot key={keyOf(item)} active={index === start} />)
            ) : (
              <Text variant="caption" tone="muted" weight="700">
                {start + 1} / {count}
              </Text>
            )}
          </View>
          {isWeb ? (
            <DeckArrow icon="chevron-forward" label={t('credit.deckNext')} onPress={next} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

type DeckCardProps = {
  position: number;
  progress: SharedValue<number>;
  draggable: boolean;
  flick: Direction | null;
  onSwiped: () => void;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  children: ReactNode;
};

function DeckCard({
  position,
  progress,
  draggable,
  flick,
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
  /** Past the flip point during the current drag (for the one-off haptic tick). */
  const armed = useSharedValue(false);

  useEffect(() => {
    // A card that was flicked away comes back behind the others once it has moved to the back.
    // Cards that rose while the front one was dragged continue from where they are drawn.
    x.set(0);
    const shown = Math.max(0, depth.get() - progress.get());
    depth.set(reduceMotion ? position : shown);
    if (!reduceMotion) depth.set(withSpring(position, springs.bouncy));
  }, [x, depth, progress, position, reduceMotion]);

  const flyOff = (direction: Direction) => {
    'worklet';
    progress.set(withTiming(1, { duration: 220 }));
    x.set(
      withTiming(direction * width * 1.2, { duration: 220 }, (finished) => {
        if (finished) scheduleOnRN(onSwiped);
      })
    );
  };

  useEffect(() => {
    if (flick) flyOff(flick);
    // flyOff only reads stable shared values and props captured for this flick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flick]);

  const pan = usePanGesture({
    enabled: draggable,
    activeOffsetX: [-12, 12],
    failOffsetY: [-10, 10],
    onUpdate: (event) => {
      'worklet';
      x.set(event.translationX);
      const distance = Math.abs(event.translationX);
      progress.set(Math.min(1, distance / SWIPE_DISTANCE));
      const past = distance > SWIPE_DISTANCE;
      if (past !== armed.get()) {
        armed.set(past);
        if (past) scheduleOnRN(haptics.selection);
      }
    },
    onDeactivate: (event) => {
      'worklet';
      armed.set(false);
      const far = Math.abs(event.translationX) > SWIPE_DISTANCE;
      const fast = Math.abs(event.velocityX) > SWIPE_VELOCITY;
      if (far || fast) {
        flyOff(event.translationX + event.velocityX * 0.1 > 0 ? 1 : -1);
      } else {
        x.set(withSpring(0, springs.snappy));
        progress.set(withSpring(0, springs.snappy));
      }
    },
  });

  const style = useAnimatedStyle(() => {
    // The front card has depth 0 and is unaffected; each card behind moves up one place as the
    // front card is dragged towards the flip point.
    const d = Math.max(0, depth.get() - progress.get());
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
      <Animated.View style={[cardStyles.card, { zIndex: 10 - position }, style]}>
        <Pressable
          onPress={onPress}
          disabled={position !== 0}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityElementsHidden={position !== 0}
          importantForAccessibility={position === 0 ? 'auto' : 'no-hide-descendants'}
          focusable={position === 0}
          style={cardStyles.pressable}
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

/** Position dot; the active one stretches into a pill. */
function Dot({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const { reduceMotion } = useMotion();
  const grow = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    grow.set(reduceMotion ? (active ? 1 : 0) : withSpring(active ? 1 : 0, springs.snappy));
  }, [active, grow, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    width: 6 + grow.get() * 12,
    opacity: 0.35 + grow.get() * 0.65,
  }));
  return (
    <Animated.View
      style={[
        dotStyles.dot,
        { backgroundColor: active ? colors.primary : colors.textMuted },
        style,
      ]}
    />
  );
}

function DeckArrow({
  icon,
  label,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={0.9}
      style={styles.arrow}>
      <Icon name={icon} size={18} color={colors.primaryText} />
    </PressableScale>
  );
}

const cardStyles = StyleSheet.create({
  // Matches ProductCard's corners so the keyboard focus ring follows the card.
  pressable: { borderRadius: 28 },
  card: { position: 'absolute', left: 0, right: 0, bottom: 0, height: PRODUCT_CARD_HEIGHT },
});

const dotStyles = StyleSheet.create({
  dot: { height: 6, borderRadius: 3 },
});

const makeStyles = ({ colors, radius, space, shadow }: Theme) =>
  StyleSheet.create({
    deck: { gap: space.md },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.lg,
      minHeight: 12,
    },
    dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    arrow: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      boxShadow: shadow.card,
    },
  });
