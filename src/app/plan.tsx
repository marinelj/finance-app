import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Appear } from '@/components/Appear';
import { Card } from '@/components/Card';
import { ChipGroup } from '@/components/form/ChipGroup';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { savePlannerSettings } from '@/db/planner';
import { AllocationCard } from '@/features/plan/AllocationCard';
import { NextSteps } from '@/features/plan/NextSteps';
import { WhatIfCard } from '@/features/plan/WhatIfCard';
import { usePlan } from '@/state/plan';

const APR_THRESHOLDS = [4, 6, 8, 10];
const EMERGENCY_MONTHS = [3, 6, 9, 12];

/** The full plan: every step with its reasoning, the target allocation, the what-if projection. */
export default function PlanScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const plan = usePlan();
  const { settings } = plan;

  return (
    <Screen hasHeader>
      <Appear index={0}>
        <Card style={styles.section}>
          <SectionHeader title={t('plan.nextSteps')} />
          <NextSteps actions={plan.actions} />
        </Card>
      </Appear>

      <Appear index={1}>
        <Card style={styles.section}>
          <SectionHeader title={t('plan.allocation')} />
          <AllocationCard allocation={plan.allocation} showSplit />
        </Card>
      </Appear>

      <Appear index={2}>
        <Card style={styles.section}>
          <SectionHeader title={t('plan.whatIf')} />
          <WhatIfCard plan={plan} />
        </Card>
      </Appear>

      <Appear index={3}>
        <Card style={styles.section}>
          <SectionHeader title={t('plan.settings')} />
          <Text variant="caption" tone="muted">
            {t('plan.aprThreshold')}
          </Text>
          <ChipGroup
            accessibilityLabel={t('plan.aprThreshold')}
            value={settings.highInterestApr}
            onChange={(highInterestApr) => savePlannerSettings({ ...settings, highInterestApr })}
            options={APR_THRESHOLDS.map((value) => ({ value, label: `${value}%` }))}
          />
          <Text variant="caption" tone="muted">
            {t('plan.emergencyTarget')}
          </Text>
          <ChipGroup
            accessibilityLabel={t('plan.emergencyTarget')}
            value={settings.emergencyMonths}
            onChange={(emergencyMonths) => savePlannerSettings({ ...settings, emergencyMonths })}
            options={EMERGENCY_MONTHS.map((value) => ({
              value,
              label: t('plan.monthsOption', { count: value }),
            }))}
          />
        </Card>
      </Appear>

      <View style={styles.note}>
        <Icon name="information-circle-outline" size={16} color={colors.textMuted} />
        <Text variant="caption" tone="muted" style={styles.flex}>
          {t('plan.disclaimer')}
        </Text>
      </View>
    </Screen>
  );
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    section: { gap: space.md },
    note: {
      flexDirection: 'row',
      gap: space.sm,
      alignItems: 'flex-start',
      paddingHorizontal: space.xs,
    },
    flex: { flex: 1 },
  });
