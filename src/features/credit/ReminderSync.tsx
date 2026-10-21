import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { upcomingDueDates } from '@/domain/creditStatus';
import { formatMoney } from '@/domain/money';
import { remindersToSchedule } from '@/domain/reminders';
import { formatDate } from '@/lib/format';
import {
  cancelAllReminders,
  getNotificationPermission,
  notificationsSupported,
  replaceScheduledReminders,
  type ScheduledReminder,
} from '@/lib/notifications';
import { useCreditData } from '@/state/creditData';
import { usePreferences } from '@/state/preferences';

/** Due dates per product to look ahead; two cycles keep reminders flowing between app opens. */
const CYCLES_AHEAD = 2;

let appliedSignature: string | null = null;
const permissionListeners = new Set<() => void>();

/** Call after the notification permission may have changed so reminders get (re)scheduled. */
export function notifyPermissionChanged(): void {
  appliedSignature = null;
  permissionListeners.forEach((listener) => listener());
}

/**
 * Keeps the OS's scheduled reminders in step with the data: whenever a due date, amount, the
 * reminder settings or the language change, every reminder is rescheduled. Renders nothing.
 */
export function ReminderSync() {
  const { t } = useTranslation();
  const { prefs, language } = usePreferences();
  const { products, installments, statuses, today } = useCreditData();
  const { enabled, daysBefore, hour } = prefs.reminders;

  // Re-check after a permission prompt, and when returning from the system Settings app.
  const [check, setCheck] = useState(0);
  useEffect(() => {
    const bump = () => setCheck((value) => value + 1);
    permissionListeners.add(bump);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        appliedSignature = null;
        bump();
      }
    });
    return () => {
      permissionListeners.delete(bump);
      subscription.remove();
    };
  }, []);

  const sources = products
    .filter((product) => product.isActive)
    .map((product) => ({
      productId: product.id,
      dueDates: upcomingDueDates(product, installments, today, CYCLES_AHEAD),
    }));

  const reminders: ScheduledReminder[] = remindersToSchedule(
    sources,
    today,
    daysBefore,
    hour,
    new Date()
  ).flatMap((item) => {
    const status = statuses.find((entry) => entry.product.id === item.productId);
    if (!status) return [];
    const { product, due } = status;
    const name = product.name;
    const date = formatDate(item.dueDate, language, { weekday: true, today });
    const title =
      item.daysBefore === 0
        ? t('reminders.titleToday', { name })
        : item.daysBefore === 1
          ? t('reminders.titleTomorrow', { name })
          : t('reminders.titleDays', { name, count: item.daysBefore });
    const amount =
      due && due.dueDate === item.dueDate
        ? formatMoney(due.amount, product.currency, { locale: language })
        : null;
    return [
      {
        id: `due-${item.productId}-${item.dueDate}-${item.daysBefore}`,
        productId: item.productId,
        title,
        body: amount ? t('reminders.bodyAmount', { amount, date }) : t('reminders.body', { date }),
        date: item.fireAt,
      },
    ];
  });

  const signature = JSON.stringify([
    check,
    enabled,
    reminders.map((item) => [item.id, item.date.getTime(), item.title, item.body]),
  ]);
  const channelName = t('reminders.channel');

  useEffect(() => {
    if (!notificationsSupported || signature === appliedSignature) return;
    let cancelled = false;
    // Debounced: a burst of edits reschedules once.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (!enabled) {
            await cancelAllReminders();
          } else {
            if ((await getNotificationPermission()) !== 'granted' || cancelled) return;
            await replaceScheduledReminders(reminders, channelName);
          }
          if (!cancelled) appliedSignature = signature;
        } catch {
          // Reminders are best effort; the in-app countdown is always right.
        }
      })();
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [signature, enabled, reminders, channelName]);

  return null;
}

const handledResponses = new Set<string>();

/** Opens the product a reminder is about when the user taps the notification. */
export function NotificationResponder() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!response) return;
    const id = response.notification.request.identifier;
    const productId = response.notification.request.content.data?.productId;
    if (handledResponses.has(id) || typeof productId !== 'string') return;
    handledResponses.add(id);
    router.push({ pathname: '/product/[id]', params: { id: productId } });
  }, [response, router]);

  return null;
}
