import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onDismiss={() => setToast(null)} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useMotion();
  const bottom = insets.bottom + 16 + (toast.aboveTabBar ? TAB_BAR_HEIGHT + 12 : 0);

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.layer]}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.springify(springs.snappy.duration)}
        exiting={reduceMotion ? undefined : FadeOutDown.duration(150)}
        accessibilityLiveRegion="polite"
        style={[styles.toast, { marginBottom: bottom }]}>
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
