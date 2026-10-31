import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useMotion } from '@/design/motion';
import { useStyles, useTheme } from '@/design/theme';
import { springs, type Theme } from '@/design/tokens';
import { useHover } from '@/hooks/useHover';
import { haptics } from '@/lib/haptics';
import { useIsWide } from '@/lib/platform';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export const TAB_BAR_HEIGHT = 64;
const INSET = 6;

const ICONS: Record<string, { idle: IconName; active: IconName }> = {
  index: { idle: 'home-outline', active: 'home' },
  credit: { idle: 'card-outline', active: 'card' },
  wealth: { idle: 'pie-chart-outline', active: 'pie-chart' },
  settings: { idle: 'person-circle-outline', active: 'person-circle' },
};

/** Floating pill tab bar with a sliding highlight (Monzo / Revolut style). */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { reduceMotion } = useMotion();
  const wide = useIsWide();
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const itemWidth = width > 0 ? (width - INSET * 2) / count : 0;

  const x = useSharedValue(state.index * itemWidth);
  useEffect(() => {
    const target = state.index * itemWidth;
    x.set(reduceMotion ? target : withSpring(target, springs.snappy));
  }, [x, state.index, itemWidth, reduceMotion]);
  const highlightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View
        role="tablist"
        style={[styles.bar, wide && styles.barWide]}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {itemWidth > 0 ? (
          <Animated.View style={[styles.highlight, { width: itemWidth }, highlightStyle]} />
        ) : null}
        {state.routes.map((route, index) => {
          const focused = index === state.index;
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          const icon = ICONS[route.name] ?? { idle: 'ellipse-outline', active: 'ellipse' };

          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              haptics.selection();
              navigateToTab(route.key);
            } else if (focused) {
              // Screens scroll back to the top on a second tap (see Screen's useScrollToTop).
              haptics.light();
            }
          };

          return (
            <TabItem
              key={route.key}
              focused={focused}
              label={label}
              icon={icon}
              accessibilityLabel={t('a11y.tabPosition', { label, index: index + 1, count })}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </View>
    </View>
  );
}

type TabItemProps = {
  focused: boolean;
  label: string;
  icon: { idle: IconName; active: IconName };
  accessibilityLabel: string;
  onPress: () => void;
  onLongPress: () => void;
};

/** One tab: the icon pops when the tab becomes active and the label brightens on hover. */
function TabItem({ focused, label, icon, accessibilityLabel, onPress, onLongPress }: TabItemProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { reduceMotion } = useMotion();
  const { hovered, hoverProps } = useHover();
  const pop = useSharedValue(1);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!focused || reduceMotion) return;
    pop.set(withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, springs.bouncy)));
  }, [focused, reduceMotion, pop]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  const color = focused || hovered ? colors.primaryText : colors.textMuted;
  return (
    <Pressable
      role="tab"
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      {...hoverProps}
      style={styles.item}>
      <Animated.View style={iconStyle}>
        <Icon name={focused ? icon.active : icon.idle} size={22} color={color} />
      </Animated.View>
      <Text variant="micro" maxFontSizeMultiplier={1.3} numberOfLines={1} style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = ({ colors, radius, space, shadow }: Theme) =>
  StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: space.lg,
    },
    bar: {
      flexDirection: 'row',
      height: TAB_BAR_HEIGHT,
      padding: INSET,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      boxShadow: shadow.raised,
    },
    // Browsers on wide screens: a compact bar centred under the content.
    barWide: { alignSelf: 'center', width: '100%', maxWidth: 480 },
    highlight: {
      position: 'absolute',
      top: INSET,
      bottom: INSET,
      left: INSET,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
    },
    item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  });
