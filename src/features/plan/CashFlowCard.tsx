import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { Legend } from '@/components/charts/Legend';
import { StackedBar } from '@/components/charts/StackedBar';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import type { CashFlow } from '@/domain/portfolioPlanner';
import { useMoney } from '@/hooks/useMoney';

/**
 * Income as one bar, filled by where it goes each month; the part left empty is the surplus to
 * invest. The legend lists every figure, so nothing depends on reading colours.
 */
export function CashFlowCard({ cashFlow }: { cashFlow: CashFlow }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { format, home, percent } = useMoney();
  const series = colors.chart.series;
  const share = (value: number) =>
    cashFlow.income > 0 ? percent(value / cashFlow.income) : undefined;

  const outflows = [
    { key: 'housing', label: t('plan.housing'), value: cashFlow.housing, color: series[0] },
    { key: 'debt', label: t('plan.debtPayments'), value: cashFlow.debtPayments, color: series[1] },
    { key: 'insurance', label: t('plan.insurance'), value: cashFlow.insurance, color: series[2] },
    { key: 'expenses', label: t('plan.expenses'), value: cashFlow.expenses, color: series[3] },
  ];
  const short = cashFlow.surplus < 0;

  return (
    <View style={styles.body}>
      <View style={styles.headline}>
        <View style={styles.flex}>
          <Text variant="caption" tone="muted">
            {short ? t('plan.shortfall') : t('plan.surplus')}
          </Text>
          <AmountText
            value={Math.abs(cashFlow.surplus)}
            currency={home}
            variant="title"
            tone={short ? 'danger' : 'default'}
          />
        </View>
        <View style={styles.right}>
          <Text variant="caption" tone="muted">
            {t('plan.income')}
          </Text>
          <AmountText value={cashFlow.income} currency={home} variant="headline" />
        </View>
      </View>
      <StackedBar
        segments={outflows}
        total={Math.max(cashFlow.income, cashFlow.outflows)}
        accessibilityLabel={t('plan.cashFlowA11y', {
          income: format(cashFlow.income),
          outflows: format(cashFlow.outflows),
          surplus: format(cashFlow.surplus),
        })}
      />
      <Legend
        items={[
          ...outflows
            .filter((item) => item.value > 0)
            .map((item) => ({
              key: item.key,
              label: item.label,
              color: item.color,
              value: format(item.value),
              detail: share(item.value),
            })),
          {
            key: 'surplus',
            label: short ? t('plan.shortfall') : t('plan.surplus'),
            color: colors.chart.grid,
            value: format(cashFlow.surplus),
            detail: share(Math.max(0, cashFlow.surplus)),
          },
        ]}
      />
      <Text variant="caption" tone="muted">
        {t('plan.cardsNote')}
      </Text>
    </View>
  );
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    body: { gap: space.md },
    headline: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
    flex: { flex: 1 },
    right: { alignItems: 'flex-end' },
  });
