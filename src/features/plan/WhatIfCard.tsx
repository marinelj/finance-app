import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { LineChart } from '@/components/charts/LineChart';
import { niceStep } from '@/components/charts/scale';
import { Slider } from '@/components/Slider';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { roundTo } from '@/domain/money';
import { projectNetWorth, type Plan } from '@/domain/portfolioPlanner';
import { useMoney } from '@/hooks/useMoney';

const YEARS = 20;
const MILESTONES = [5, 10, 20];

/** Move the monthly investment or the expected return and see net worth in 5, 10 and 20 years. */
export function WhatIfCard({ plan }: { plan: Plan }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { home, format, tick } = useMoney();

  const surplus = Math.max(0, plan.cashFlow.surplus);
  const maxMonthly = Math.max(1000, Math.ceil((surplus * 2) / 1000) * 1000);
  const step = niceStep(maxMonthly, 40);
  const [monthly, setMonthly] = useState(() => Math.round(surplus / step) * step);
  const [rate, setRate] = useState(() => roundTo(Math.round(plan.expectedReturn * 2) / 2, 1));

  const points = projectNetWorth({
    invested: plan.invested,
    other: plan.netWorth.netWorth - plan.invested,
    monthly,
    annualReturnPercent: rate,
    years: YEARS,
  });
  const at = (year: number) => points[year]?.netWorth ?? 0;

  return (
    <View style={styles.body}>
      <Text variant="caption" tone="muted">
        {t('plan.whatIfHint')}
      </Text>
      <Slider
        label={t('plan.monthlyInvestment')}
        value={monthly}
        min={0}
        max={maxMonthly}
        step={step}
        onChange={setMonthly}
        formatValue={(value) => format(value)}
      />
      <Slider
        label={t('plan.expectedReturn')}
        value={rate}
        min={0}
        max={12}
        step={0.5}
        onChange={setRate}
        formatValue={(value) => `${value}%`}
      />
      <LineChart
        points={points.map((point) => ({
          label: point.year === 0 ? t('plan.now') : t('plan.yearLabel', { count: point.year }),
          value: point.netWorth,
        }))}
        color={colors.primary}
        formatValue={format}
        formatTick={tick}
        labelIndexes={[YEARS]}
        xLabelIndexes={[0, 10, 20]}
        accessibilityLabel={t('plan.projectionA11y', {
          five: format(at(5)),
          ten: format(at(10)),
          twenty: format(at(20)),
        })}
      />
      <View style={styles.milestones}>
        {MILESTONES.map((year, i) => (
          <View key={year} style={[styles.milestone, i > 0 && styles.divider]}>
            <Text variant="callout" tone="secondary" style={styles.flex}>
              {t('plan.inYears', { count: year })}
            </Text>
            <AmountText value={at(year)} currency={home} variant="headline" />
          </View>
        ))}
      </View>
      <Text variant="caption" tone="muted">
        {t('plan.assumptions')}
      </Text>
    </View>
  );
}

const makeStyles = ({ colors, radius, space }: Theme) =>
  StyleSheet.create({
    body: { gap: space.md },
    milestones: {
      paddingHorizontal: space.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    milestone: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
    flex: { flex: 1 },
  });
