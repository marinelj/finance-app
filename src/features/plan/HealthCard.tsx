import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Meter } from '@/components/charts/Meter';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { useStyles } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { roundTo } from '@/domain/money';
import { RATIO_THRESHOLDS, type Ratio, type RatioKey } from '@/domain/portfolioPlanner';
import { useMoney } from '@/hooks/useMoney';

type HealthCardProps = { ratios: Ratio[]; emergencyTargetMonths: number };

/** Where each meter's track ends, and where the healthy limit sits on it. */
function scaleFor(key: RatioKey, targetMonths: number): { max: number; limit: number } {
  switch (key) {
    case 'debtToIncome':
      return { max: 0.6, limit: RATIO_THRESHOLDS.debtToIncome.good };
    case 'housingCost':
      return { max: 0.6, limit: RATIO_THRESHOLDS.housingCost.good };
    case 'insuranceCost':
      return { max: 0.25, limit: RATIO_THRESHOLDS.insuranceCost.good };
    case 'emergencyMonths':
      return { max: Math.max(12, targetMonths * 1.5), limit: targetMonths };
    case 'creditUtilization':
      return { max: 1, limit: RATIO_THRESHOLDS.creditUtilization.good };
  }
}

/** The five health ratios as meters with a traffic-light status (icon + word, never colour alone). */
export function HealthCard({ ratios, emergencyTargetMonths }: HealthCardProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { percent } = useMoney();

  return (
    <View style={styles.list}>
      {ratios.map((ratio) => {
        const scale = scaleFor(ratio.key, emergencyTargetMonths);
        const missing =
          ratio.key === 'creditUtilization'
            ? t('plan.noLimit')
            : ratio.key === 'emergencyMonths'
              ? t('plan.noEssentials')
              : t('plan.noIncome');
        const value =
          ratio.value == null
            ? missing
            : ratio.key === 'emergencyMonths'
              ? t('plan.monthsValue', { value: roundTo(ratio.value, 1) })
              : percent(ratio.value, 0);
        const name = t(`plan.ratioNames.${ratio.key}`);
        const hint = t(`plan.ratioHints.${ratio.key}`, {
          target: t('plan.monthsOption', { count: emergencyTargetMonths }),
        });
        return (
          <View
            key={ratio.key}
            accessible
            accessibilityLabel={[
              name,
              value,
              ratio.tone ? t(`plan.tones.${ratio.tone}`) : null,
              hint,
            ]
              .filter(Boolean)
              .join(', ')}
            style={styles.item}>
            <View style={styles.header}>
              <Text variant="body" weight="600" style={styles.name}>
                {name}
              </Text>
              <Text variant="body" weight="700" tabular>
                {value}
              </Text>
              {ratio.tone ? (
                <StatusPill tone={ratio.tone} label={t(`plan.tones.${ratio.tone}`)} size="sm" />
              ) : null}
            </View>
            {ratio.value != null && ratio.tone ? (
              <Meter
                value={ratio.value / scale.max}
                tone={ratio.tone}
                marker={scale.limit / scale.max}
              />
            ) : null}
            <Text variant="caption" tone="muted">
              {hint}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.lg },
    item: { gap: space.sm },
    header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    name: { flex: 1 },
  });
