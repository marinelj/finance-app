import * as Haptics from 'expo-haptics';

/**
 * Thin wrapper over expo-haptics so the user's "haptic feedback" preference is honoured
 * everywhere, including from gesture callbacks outside React.
 */
let enabled = true;

function run(effect: () => Promise<void>) {
  if (!enabled || process.env.EXPO_OS === 'web') return;
  effect().catch(() => {
    // Haptics are best effort; some devices have no engine.
  });
}

export const haptics = {
  setEnabled(value: boolean) {
    enabled = value;
  },
  /** Tab switches, chips, pickers. */
  selection: () => run(() => Haptics.selectionAsync()),
  /** Button presses, card swipes. */
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Saved, marked as paid. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

export type HapticKind = Exclude<keyof typeof haptics, 'setEnabled'>;
