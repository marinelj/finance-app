import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { ColumnChart } from '@/components/charts/ColumnChart';
import { Legend } from '@/components/charts/Legend';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import type { Plan } from '@/domain/portfolioPlanner';
import { useMoney } from '@/hooks/useMoney';
import { formatMonthShort } from '@/lib/format';
import { usePreferences } from '@/state/preferences';

/** Coupons and dividends over the next 12 months, as stacked monthly columns. */
export function PassiveIncomeCard({ passive }: { passive: Plan['passive'] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { language } = usePreferences();
  const { home, format, tick } = useMoney();

  if (passive.annual <= 0) {
    return (
      <Text variant="callout" tone="secondary">
        {t('plan.passiveEmpty')}
      </Text>
    );
  }

  const coupons = passive.months.reduce((sum, item) => sum + item.coupons, 0);
  const dividends = passive.months.reduce((sum, item) => sum + item.dividends, 0);
  const series = [
    { key: 'coupons', label: t('plan.coupons'), color: colors.chart.series[0] },
    { key: 'dividends', label: t('plan.dividends'), color: colors.chart.series[1] },
  ];

  return (
    <View style={styles.body}>
      <View>
        <AmountText value={passive.annual} currency={home} variant="title" />
        <Text variant="caption" tone="muted">
          {t('plan.passivePerMonth', { amount: format(passive.monthlyAverage) })}
        </Text>
      </View>
      <ColumnChart
        columns={passive.months.map((item) => ({
          label: formatMonthShort(Number(item.month.slice(5, 7)), language),
          values: [item.coupons, item.dividends],
        }))}
        series={series}
        formatValue={format}
        formatTick={tick}
        accessibilityLabel={t('plan.passiveA11y', { amount: format(passive.annual) })}
      />
      <Legend
        items={[
          { ...series[0], value: format(coupons) },
          { ...series[1], value: format(dividends) },
        ]}
      />
    </View>
  );
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    body: { gap: space.md },
  });
