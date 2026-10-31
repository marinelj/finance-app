import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon, type IconName } from '@/components/Icon';
import { TAB_BAR_HEIGHT } from '@/components/TabBar';
import { Text } from '@/components/Text';
import { useMotion } from '@/design/motion';
import { useStyles, useTheme } from '@/design/theme';
import { springs, type Theme } from '@/design/tokens';
import { haptics } from '@/lib/haptics';

export type ToastOptions = {
  message: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
  /** Lift the toast above the floating tab bar. */
  aboveTabBar?: boolean;
};

type ToastState = ToastOptions & { id: number };

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

const DURATION_MS = 4500;

/** One short-lived message at a time, with an optional action such as Undo. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(0);

  const show = (options: ToastOptions) => {
    nextId.current += 1;
    setToast({ ...options, id: nextId.current });
    AccessibilityInfo.announceForAccessibility(options.message);
  };

  // The timer pauses while a mouse pointer rests on the toast, so it can be read and acted on.
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!toast || paused) return;
    const timer = setTimeout(() => setToast(null), DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, paused]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <ToastView
          key={toast.id}
          toast={toast}
          onDismiss={() => {
            setPaused(false);
            setToast(null);
          }}
          onHoverChange={setPaused}
        />
      ) : null}
    </ToastContext.Provider>
  );
}

type ToastViewProps = {
  toast: ToastState;
  onDismiss: () => void;
  onHoverChange: (hovered: boolean) => void;
};

/** Flick distance (down or sideways) that dismisses the toast. */
const DISMISS_DISTANCE = 48;

function ToastView({ toast, onDismiss, onHoverChange }: ToastViewProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useMotion();
  const bottom = insets.bottom + 16 + (toast.aboveTabBar ? TAB_BAR_HEIGHT + 12 : 0);

  // Swipe the toast down or sideways to dismiss it early.
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const pan = usePanGesture({
    onUpdate: (event) => {
      'worklet';
      dragX.set(event.translationX);
      // Resist upward drags; the toast only leaves downwards or sideways.
      dragY.set(event.translationY > 0 ? event.translationY : event.translationY * 0.2);
    },
    onDeactivate: (event) => {
      'worklet';
      const sideways = Math.abs(event.translationX) > DISMISS_DISTANCE;
      const down = event.translationY > DISMISS_DISTANCE || event.velocityY > 600;
      if (sideways || down) {
        scheduleOnRN(onDismiss);
      } else {
        dragX.set(withSpring(0, springs.snappy));
        dragY.set(withSpring(0, springs.snappy));
      }
    },
  });
  const dragStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(0.6, (Math.abs(dragX.get()) + Math.max(0, dragY.get())) / 160),
    transform: [{ translateX: dragX.get() }, { translateY: dragY.get() }],
  }));

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.layer]}>
      <GestureDetector gesture={pan}>
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.springify(springs.snappy.duration)}
          exiting={reduceMotion ? undefined : FadeOutDown.duration(150)}
          accessibilityLiveRegion="polite"
          style={[styles.toastSlot, { marginBottom: bottom }]}>
          <Pressable
            onHoverIn={() => onHoverChange(true)}
            onHoverOut={() => onHoverChange(false)}
            accessible={false}
            style={styles.hoverArea}>
            <Animated.View style={[styles.toast, dragStyle]}>
              <Icon name={toast.icon ?? 'checkmark-circle'} size={20} color={colors.accent.mint} />
              <Text variant="callout" style={styles.message} numberOfLines={2}>
                {toast.message}
              </Text>
              {toast.action ? (
                <Pressable
                  onPress={() => {
                    haptics.light();
                    toast.action?.onPress();
                    onDismiss();
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  style={styles.action}>
                  <Text variant="callout" weight="700" style={styles.actionText}>
                    {toast.action.label}
                  </Text>
                </Pressable>
              ) : null}
            </Animated.View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export function useToast(): (options: ToastOptions) => void {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside <ToastProvider>');
  return value;
}

const makeStyles = ({ colors, radius, space, shadow }: Theme) =>
  StyleSheet.create({
    layer: { justifyContent: 'flex-end', paddingHorizontal: space.lg },
    // Centred and kept narrow on wide screens (desktop browsers).
    toastSlot: { width: '100%', maxWidth: 480, alignSelf: 'center' },
    hoverArea: { cursor: 'auto' },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      minHeight: 52,
      paddingLeft: space.lg,
      paddingRight: space.sm,
      paddingVertical: space.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.text,
      boxShadow: shadow.raised,
    },
    message: { flex: 1, color: colors.surface },
    action: {
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255, 255, 255, 0.14)',
    },
    actionText: { color: colors.surface },
  });
