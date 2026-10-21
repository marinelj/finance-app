import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
} from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useMotion } from '@/design/motion';
import { useStyles, useTheme } from '@/design/theme';
import { springs, type Theme } from '@/design/tokens';

import { Icon } from './Icon';
import { Text } from './Text';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Sticky actions under the scrollable content. */
  footer?: ReactNode;
};

const DISMISS_DISTANCE = 140;
const DISMISS_VELOCITY = 900;

/**
 * Modal sheet that springs up from the bottom. Drag the handle down, tap the backdrop, press the
 * close button, use Android back or the VoiceOver escape gesture to dismiss.
 */
export function BottomSheet({ visible, onClose, title, children, footer }: BottomSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { reduceMotion } = useMotion();

  // Stay mounted while the closing animation runs.
  const [rendered, setRendered] = useState(visible);
  if (visible && !rendered) setRendered(true);

  const offset = useSharedValue(height);
  const sheetHeight = useSharedValue(height);

  useEffect(() => {
    if (!rendered) return;
    if (visible) {
      offset.set(reduceMotion ? withTiming(0, { duration: 0 }) : withSpring(0, springs.gentle));
      return;
    }
    const unmount = () => setRendered(false);
    offset.set(
      withTiming(height, { duration: reduceMotion ? 0 : 220 }, (finished) => {
        if (finished) scheduleOnRN(unmount);
      })
    );
  }, [visible, rendered, reduceMotion, height, offset]);

  const pan = usePanGesture({
    activeOffsetY: 8,
    onUpdate: (event) => {
      'worklet';
      offset.set(Math.max(0, event.translationY));
    },
    onDeactivate: (event) => {
      'worklet';
      const far = event.translationY > Math.min(DISMISS_DISTANCE, sheetHeight.get() * 0.35);
      if (far || event.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(onClose);
      } else {
        offset.set(withSpring(0, springs.snappy));
      }
    },
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      offset.get(),
      [0, Math.max(1, sheetHeight.get())],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));

  if (!rendered) return null;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
          style={styles.avoider}
          pointerEvents="box-none">
          <Animated.View
            accessibilityViewIsModal
            onAccessibilityEscape={onClose}
            onLayout={(event) => sheetHeight.set(event.nativeEvent.layout.height)}
            style={[
              styles.sheet,
              { maxHeight: height - insets.top - 24, paddingBottom: insets.bottom + 16 },
              sheetStyle,
            ]}>
            <GestureDetector gesture={pan}>
              <View style={styles.header}>
                <View style={styles.grabber} />
                {title ? (
                  <View style={styles.titleRow}>
                    <Text variant="title" accessibilityRole="header" style={styles.title}>
                      {title}
                    </Text>
                    <Pressable
                      onPress={onClose}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.close')}
                      style={styles.close}>
                      <Icon name="close" size={18} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </GestureDetector>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const makeStyles = ({ colors, radius, space, shadow }: Theme) =>
  StyleSheet.create({
    root: { flex: 1 },
    backdrop: { backgroundColor: colors.overlay },
    avoider: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      boxShadow: shadow.raised,
    },
    header: { paddingTop: space.sm, paddingHorizontal: space.xxl },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.hairline,
      marginBottom: space.md,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
    title: { flex: 1 },
    close: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    scroll: { flexGrow: 0 },
    content: { paddingHorizontal: space.xxl, paddingVertical: space.md, gap: space.md },
    footer: { paddingHorizontal: space.xxl, paddingTop: space.md, gap: space.sm },
  });
