import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

/**
 * Local due-date reminders. Only local notifications are used (no push token, no server), so
 * they also work in Expo Go. Scheduling exists on iOS and Android only.
 */

export const REMINDER_CHANNEL_ID = 'due-reminders';

export const notificationsSupported =
  process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android';

export type ScheduledReminder = {
  id: string;
  productId: string;
  title: string;
  body: string;
  date: Date;
};

export function configureNotifications(): void {
  if (!notificationsSupported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Android needs a channel before it shows anything (and before it asks for permission). */
export async function ensureReminderChannel(name: string): Promise<void> {
  if (process.env.EXPO_OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name,
    importance: AndroidImportance.HIGH,
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getNotificationPermission(): Promise<PermissionState> {
  if (!notificationsSupported) return 'unsupported';
  const status = await Notifications.getPermissionsAsync();
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

/** Asks once; returns whether reminders can be shown. */
export async function requestNotificationPermission(channelName: string): Promise<boolean> {
  if (!notificationsSupported) return false;
  await ensureReminderChannel(channelName);
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

/** Replaces every scheduled reminder with `reminders`. The app schedules nothing else. */
export async function replaceScheduledReminders(
  reminders: ScheduledReminder[],
  channelName: string
): Promise<void> {
  if (!notificationsSupported) return;
  await ensureReminderChannel(channelName);
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const reminder of reminders) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: reminder.title,
        body: reminder.body,
        data: { productId: reminder.productId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.date,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (!notificationsSupported) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
