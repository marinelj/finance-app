import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { Appear } from '@/components/Appear';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { IconChip } from '@/components/IconChip';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { AccentTone, Theme } from '@/design/tokens';
import type { CurrencyCode } from '@/domain/money';
import { scoreRisk } from '@/domain/riskProfile';
import { WEALTH_KINDS, type WealthKind } from '@/domain/wealthForms';
import { AllocationCard } from '@/features/plan/AllocationCard';
import { CashFlowCard } from '@/features/plan/CashFlowCard';
import { HealthCard } from '@/features/plan/HealthCard';
import { NetWorthTrend } from '@/features/plan/NetWorthTrend';
import { NextSteps } from '@/features/plan/NextSteps';
import { PassiveIncomeCard } from '@/features/plan/PassiveIncomeCard';
import { SECTION_META, tKey } from '@/features/wealth/meta';
import { useCreditData } from '@/state/creditData';
import { usePlan } from '@/state/plan';
import { usePreferences } from '@/state/preferences';
import { rowsOf, useWealthData } from '@/state/wealthData';

/** The portfolio dashboard: net worth, the plan, health ratios, charts, then every input. */
export default function WealthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const data = useWealthData();
  const plan = usePlan();
  const { summary: credit, fx } = useCreditData();
  const { prefs } = usePreferences();
  const home = prefs.homeCurrency;
  const risk = data.risk ? scoreRisk(data.risk.answers) : null;
  const { overview, netWorth } = plan;
  const hasInputs = WEALTH_KINDS.some((kind) => rowsOf(data, kind).length > 0);

  const sectionValue: Record<WealthKind, { amount: number; monthly: boolean }> = {
    income: { amount: overview.income, monthly: true },
    housing: { amount: overview.housing, monthly: true },
    insurance: { amount: overview.insurance, monthly: true },
    expense: { amount: overview.expenses, monthly: true },
    cash: { amount: overview.cash, monthly: false },
    bond: { amount: overview.bonds, monthly: false },
    stock: { amount: overview.stocks, monthly: false },
  };

  let block = 0;
  return (
    <Screen withTabBar title={t('wealth.title')}>
      <Appear index={block++}>
        <Card variant="gradient" padding="xxl" style={styles.hero}>
          <Text variant="callout" tone="onPrimary" style={styles.soft}>
            {t('plan.netWorth')}
          </Text>
          <AmountText
            value={netWorth.netWorth}
            currency={home}
            variant="hero"
            tone="onPrimary"
            animate
          />
          <View style={styles.heroStats}>
            <HeroStat label={t('plan.assets')} value={netWorth.assets} currency={home} />
            <HeroStat label={t('plan.liabilities')} value={netWorth.liabilities} currency={home} />
          </View>
        </Card>
      </Appear>

      {hasInputs ? (
        <>
          <Appear index={block++}>
            <Card style={styles.section}>
              <SectionHeader
                title={t('plan.nextSteps')}
                action={{ label: t('plan.seePlan'), onPress: () => router.push('/plan') }}
              />
              <NextSteps actions={plan.actions} limit={3} />
            </Card>
          </Appear>

          <Appear index={block++}>
            <Card style={styles.section}>
              <SectionHeader title={t('plan.health')} />
              <HealthCard
                ratios={plan.ratios}
                emergencyTargetMonths={plan.settings.emergencyMonths}
              />
            </Card>
          </Appear>

          <Appear index={block++}>
            <Card style={styles.section}>
              <SectionHeader title={t('plan.cashFlow')} />
              <CashFlowCard cashFlow={plan.cashFlow} />
            </Card>
          </Appear>

          <Appear index={block++}>
            <Card style={styles.section}>
              <SectionHeader title={t('plan.trend')} />
              <NetWorthTrend snapshots={data.snapshots} fx={fx} />
            </Card>
          </Appear>

          <Appear index={block++}>
            <Card style={styles.section}>
              <SectionHeader title={t('plan.passive')} />
              <PassiveIncomeCard passive={plan.passive} />
            </Card>
          </Appear>

          <Appear index={block++}>
            <Card style={styles.section}>
              <SectionHeader
                title={t('plan.allocation')}
                action={{ label: t('plan.seePlan'), onPress: () => router.push('/plan') }}
              />
              <AllocationCard allocation={plan.allocation} />
            </Card>
          </Appear>
        </>
      ) : (
        <Appear index={block++}>
          <Card>
            <EmptyState
              emoji="🌱"
              tone="mint"
              title={t('plan.emptyTitle')}
              message={t('plan.emptyMessage')}
            />
          </Card>
        </Appear>
      )}

      <Appear index={block++}>
        <PressableScale
          onPress={() => router.push('/wealth/risk')}
          haptic="light"
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel={
            risk
              ? `${t('wealth.riskProfile')}, ${t(`risk.profiles.${risk.profile}`)}`
              : t('wealth.riskTake')
          }>
          <Card variant="tinted" tone="sky" style={styles.riskCard}>
            <IconChip icon="speedometer" tone="sky" size={44} />
            <View style={styles.flex}>
              <Text variant="caption" tone="muted">
                {t('wealth.riskProfile')}
              </Text>
              <Text variant="headline">
                {risk ? t(`risk.profiles.${risk.profile}`) : t('wealth.riskTake')}
              </Text>
              {risk ? (
                <Text variant="caption" tone="secondary" numberOfLines={2}>
                  {t(`risk.profileHints.${risk.profile}`)}
                </Text>
              ) : null}
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textMuted} />
          </Card>
        </PressableScale>
      </Appear>

      <Appear index={block++}>
        <Card style={styles.list}>
          <SectionHeader title={t('wealth.inputsTitle')} />
          <Text variant="caption" tone="muted">
            {t('wealth.inputsHint')}
          </Text>
          {WEALTH_KINDS.map((kind) => {
            const count = rowsOf(data, kind).length;
            const { amount, monthly } = sectionValue[kind];
            return (
              <SectionRow
                key={kind}
                emoji={SECTION_META[kind].emoji}
                tone={SECTION_META[kind].tone}
                title={tKey(t, `wealth.sections.${kind}`)}
                subtitle={count > 0 ? t('wealth.items', { count }) : t('wealth.notSet')}
                amount={count > 0 ? amount : null}
                currency={home}
                suffix={monthly ? t('wealth.monthShort') : null}
                onPress={() => router.push({ pathname: '/wealth/[kind]', params: { kind } })}
              />
            );
          })}
          <SectionRow
            emoji="💳"
            tone="pink"
            title={t('wealth.creditDebt')}
            subtitle={t('wealth.creditDebtHint')}
            amount={credit.activeCount > 0 ? credit.totalOwed : null}
            currency={home}
            suffix={null}
            onPress={() => router.navigate('/credit')}
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

function HeroStat({
  label,
  value,
  currency,
}: {
  label: string;
  value: number;
  currency: CurrencyCode;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.flex}>
      <Text variant="caption" tone="onPrimary" style={styles.soft}>
        {label}
      </Text>
      <AmountText value={value} currency={currency} variant="headline" tone="onPrimary" compact />
    </View>
  );
}

type SectionRowProps = {
  emoji: string;
  tone: AccentTone;
  title: string;
  subtitle: string;
  amount: number | null;
  currency: CurrencyCode;
  suffix: string | null;
  onPress: () => void;
};

function SectionRow({
  emoji,
  tone,
  title,
  subtitle,
  amount,
  currency,
  suffix,
  onPress,
}: SectionRowProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <PressableScale
      onPress={onPress}
      haptic="light"
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      style={styles.row}>
      <IconChip emoji={emoji} tone={tone} size={40} />
      <View style={styles.flex}>
        <Text variant="body" weight="700">
          {title}
        </Text>
        <Text variant="caption" tone="muted">
          {subtitle}
        </Text>
      </View>
      {amount != null ? (
        <View style={styles.amount}>
          <AmountText value={amount} currency={currency} variant="callout" />
          {suffix ? (
            <Text variant="micro" tone="muted">
              {suffix}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Icon name="chevron-forward" size={18} color={colors.textMuted} />
    </PressableScale>
  );
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    hero: { gap: space.xs },
    soft: { opacity: 0.9 },
    heroStats: {
      flexDirection: 'row',
      gap: space.lg,
      marginTop: space.md,
      paddingTop: space.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255, 255, 255, 0.35)',
    },
    section: { gap: space.md },
    flex: { flex: 1, gap: 2 },
    riskCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    list: { gap: space.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60 },
    amount: { alignItems: 'flex-end' },
    note: {
      flexDirection: 'row',
      gap: space.sm,
      alignItems: 'flex-start',
      paddingHorizontal: space.xs,
    },
  });
