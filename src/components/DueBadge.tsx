import { useTranslation } from 'react-i18next';

import type { StatusTone } from '@/design/tokens';
import { dueLevel, type DueLevel } from '@/domain/dueStatus';

import type { IconName } from './Icon';
import { StatusPill } from './StatusPill';

const TONE: Record<DueLevel, StatusTone> = {
  overdue: 'danger',
  urgent: 'danger',
  soon: 'caution',
  safe: 'good',
};

const ICON: Record<DueLevel, IconName> = {
  overdue: 'alert-circle',
  urgent: 'flame',
  soon: 'time',
  safe: 'checkmark-circle',
};

type DueBadgeProps = {
  /** Days until the due date; negative when overdue. */
  daysLeft: number;
  size?: 'sm' | 'md';
};

/** Countdown badge: red at 3 days or fewer (and overdue), amber at 7 or fewer, green otherwise. */
export function DueBadge({ daysLeft, size = 'md' }: DueBadgeProps) {
  const { t } = useTranslation();
  const level = dueLevel(daysLeft);
  const label =
    level === 'overdue'
      ? t('due.overdue', { count: -daysLeft })
      : daysLeft === 0
        ? t('due.today')
        : t('due.daysLeft', { count: daysLeft });
  return <StatusPill tone={TONE[level]} icon={ICON[level]} label={label} size={size} />;
}
