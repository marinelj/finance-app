import { useTranslation } from 'react-i18next';

import { LineChart } from '@/components/charts/LineChart';
import { Text } from '@/components/Text';
import { useTheme } from '@/design/theme';
import type { NetWorthSnapshotRow } from '@/db/schema';
import { convert, type FxTable } from '@/domain/fx';
import { useMoney } from '@/hooks/useMoney';
import { formatMonthShort } from '@/lib/format';
import { usePreferences } from '@/state/preferences';

type NetWorthTrendProps = {
  snapshots: NetWorthSnapshotRow[];
  fx: FxTable;
};

/** Net worth per month from the saved snapshots, converted into today's home currency. */
export function NetWorthTrend({ snapshots, fx }: NetWorthTrendProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { language } = usePreferences();
  const { home, format, tick } = useMoney();

  if (snapshots.length < 2) {
    return (
      <Text variant="callout" tone="secondary">
        {t('plan.trendEmpty')}
      </Text>
    );
  }

  const label = (month: string, withYear: boolean) => {
    const year = Number(month.slice(0, 4));
    const short = formatMonthShort(Number(month.slice(5, 7)), language);
    if (!withYear) return short;
    return language === 'zh-Hans' ? `${year}年${short}` : `${short} ${year}`;
  };
  const points = snapshots.map((snapshot, i) => ({
    label: label(snapshot.month, i === 0 || i === snapshots.length - 1),
    value: convert(snapshot.netWorth, snapshot.currency, home, fx),
  }));
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <LineChart
      points={points}
      color={colors.primary}
      formatValue={format}
      formatTick={tick}
      accessibilityLabel={t('plan.trendA11y', {
        from: first.label,
        to: last.label,
        start: format(first.value),
        end: format(last.value),
      })}
    />
  );
}
