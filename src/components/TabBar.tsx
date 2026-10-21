import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useMotion } from '@/design/motion';
import { useStyles, useTheme } from '@/design/theme';
import { springs, type Theme } from '@/design/tokens';
import { haptics } from '@/lib/haptics';

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
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { reduceMotion } = useMotion();
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
        style={styles.bar}
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
            }
          };

          return (
            <Pressable
              key={route.key}
              role="tab"
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={t('a11y.tabPosition', { label, index: index + 1, count })}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              style={styles.item}>
              <Icon
                name={focused ? icon.active : icon.idle}
                size={22}
                color={focused ? colors.primaryText : colors.textMuted}
              />
              <Text
                variant="micro"
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
                style={{ color: focused ? colors.primaryText : colors.textMuted }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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
