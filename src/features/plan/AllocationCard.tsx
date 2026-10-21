import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Donut } from '@/components/charts/Donut';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { BUCKETS, type Allocation } from '@/domain/portfolioPlanner';
import { useMoney } from '@/hooks/useMoney';

type AllocationCardProps = {
  allocation: Allocation;
  /** Also list where the monthly investment goes (plan screen). */
  showSplit?: boolean;
};

/**
 * Target allocation as a donut (with the profile in the middle), then a row per asset class:
 * its share now against the target (a bar and a target tick) and the amount invested.
 */
export function AllocationCard({ allocation, showSplit }: AllocationCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { format, percent } = useMoney();
  const color = (i: number) => colors.chart.series[i];
  const total = allocation.total;
  const parts = BUCKETS.map(
    (bucket) => `${t(`plan.buckets.${bucket}`)} ${percent(allocation.target[bucket])}`
  ).join(', ');
  const splitTotal = BUCKETS.reduce((sum, bucket) => sum + allocation.split[bucket], 0);

  return (
    <View style={styles.body}>
      <Text variant="caption" tone="muted">
        {t('plan.allocationHint', { profile: t(`risk.profiles.${allocation.profile}`) })}
      </Text>
      <View style={styles.center}>
        <Donut
          segments={BUCKETS.map((bucket, i) => ({
            key: bucket,
            value: allocation.target[bucket],
            color: color(i),
          }))}
          accessibilityLabel={t('plan.allocationA11y', { parts })}>
          <Text variant="headline" align="center" numberOfLines={2}>
            {t(`risk.profiles.${allocation.profile}`)}
          </Text>
          <Text variant="caption" tone="muted">
            {t('plan.target')}
          </Text>
        </Donut>
      </View>

      <View style={styles.columns}>
        <View style={styles.flex} />
        <Text variant="micro" tone="muted" style={styles.col}>
          {t('plan.now')}
        </Text>
        <Text variant="micro" tone="muted" style={styles.col}>
          {t('plan.target')}
        </Text>
      </View>
      {BUCKETS.map((bucket, i) => {
        const current = total > 0 ? allocation.current[bucket] / total : 0;
        const target = allocation.target[bucket];
        const name = t(`plan.buckets.${bucket}`);
        return (
          <View
            key={bucket}
            accessible
            accessibilityLabel={`${name}: ${t('plan.now')} ${percent(current)}, ${t('plan.target')} ${percent(target)}, ${format(allocation.current[bucket])}`}
            style={styles.row}>
            <View style={styles.rowTop}>
              <View style={[styles.swatch, { backgroundColor: color(i) }]} />
              <Text variant="callout" tone="secondary" style={styles.flex} numberOfLines={1}>
                {name}
              </Text>
              <Text variant="callout" weight="600" tabular style={styles.col}>
                {percent(current)}
              </Text>
              <Text variant="callout" tone="muted" tabular style={styles.col}>
                {percent(target)}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.chart.grid }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.min(1, current) * 100}%`, backgroundColor: color(i) },
                ]}
              />
              <View
                style={[styles.tick, { left: `${target * 100}%`, backgroundColor: colors.text }]}
              />
            </View>
          </View>
        );
      })}
      <View style={styles.totalRow}>
        <Text variant="callout" tone="muted" style={styles.flex}>
          {t('plan.invested')}
        </Text>
        <Text variant="callout" weight="700">
          {format(total)}
        </Text>
      </View>

      {showSplit && splitTotal > 0 ? (
        <View style={styles.split}>
          <Text variant="micro" tone="muted">
            {t('plan.newMoney')}
          </Text>
          {BUCKETS.filter((bucket) => allocation.split[bucket] >= 1).map((bucket) => (
            <View key={bucket} style={styles.rowTop}>
              <View style={[styles.swatch, { backgroundColor: color(BUCKETS.indexOf(bucket)) }]} />
              <Text variant="callout" tone="secondary" style={styles.flex}>
                {t(`plan.buckets.${bucket}`)}
              </Text>
              <Text variant="callout" weight="600" tabular>
                {format(allocation.split[bucket])}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = ({ radius, space }: Theme) =>
  StyleSheet.create({
    body: { gap: space.md },
    center: { alignItems: 'center', paddingVertical: space.sm },
    columns: { flexDirection: 'row', gap: space.sm },
    row: { gap: space.xs },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    swatch: { width: 10, height: 10, borderRadius: 2 },
    flex: { flex: 1 },
    col: { width: 52, textAlign: 'right' },
    track: { height: 6, borderRadius: radius.pill, justifyContent: 'center' },
    fill: { height: 6, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
    tick: { position: 'absolute', width: 2, height: 12, borderRadius: 1, marginLeft: -1 },
    totalRow: { flexDirection: 'row', alignItems: 'center', paddingTop: space.xs },
    split: { gap: space.sm, marginTop: space.sm },
  });
