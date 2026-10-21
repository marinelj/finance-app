import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { Appear } from '@/components/Appear';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { IconChip } from '@/components/IconChip';
import { PressableScale } from '@/components/PressableScale';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { AccentTone, Theme } from '@/design/tokens';
import type { CurrencyCode } from '@/domain/money';
import { summarizeInputs } from '@/domain/portfolio';
import { scoreRisk } from '@/domain/riskProfile';
import { WEALTH_KINDS, type WealthKind } from '@/domain/wealthForms';
import { SECTION_META, tKey } from '@/features/wealth/meta';
import { useCreditData } from '@/state/creditData';
import { usePreferences } from '@/state/preferences';
import { rowsOf, useWealthData } from '@/state/wealthData';

export default function WealthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const data = useWealthData();
  const { summary: credit, today, fx } = useCreditData();
  const { prefs } = usePreferences();
  const home = prefs.homeCurrency;
  const overview = summarizeInputs(
    {
      incomes: data.incomes,
      housing: data.housing,
      insurance: data.insurance,
      expenses: data.expenses,
      cash: data.cash,
      bonds: data.bonds,
      stocks: data.stocks,
    },
    today,
    home,
    fx
  );
  const owned = overview.cash + overview.bonds + overview.stocks + overview.property;
  const risk = data.risk ? scoreRisk(data.risk.answers) : null;

  const sectionValue: Record<WealthKind, { amount: number; monthly: boolean }> = {
    income: { amount: overview.income, monthly: true },
    housing: { amount: overview.housing, monthly: true },
    insurance: { amount: overview.insurance, monthly: true },
    expense: { amount: overview.expenses, monthly: true },
    cash: { amount: overview.cash, monthly: false },
    bond: { amount: overview.bonds, monthly: false },
    stock: { amount: overview.stocks, monthly: false },
  };

  return (
    <Screen withTabBar title={t('wealth.title')}>
      <Appear index={0}>
        <Card variant="gradient" padding="xxl" style={styles.hero}>
          <Text variant="callout" tone="onPrimary" style={styles.soft}>
            {t('wealth.ownTitle')}
          </Text>
          <AmountText value={owned} currency={home} variant="hero" tone="onPrimary" animate />
          <View style={styles.heroStats}>
            <HeroStat
              label={t('wealth.sections.income')}
              value={overview.income}
              currency={home}
              suffix={t('wealth.monthShort')}
            />
            <HeroStat
              label={t('wealth.passiveIncome')}
              value={(overview.coupons + overview.dividends) / 12}
              currency={home}
              suffix={t('wealth.monthShort')}
            />
          </View>
        </Card>
      </Appear>

      <Appear index={1}>
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

      <Appear index={2}>
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
    </Screen>
  );
}

function HeroStat({
  label,
  value,
  currency,
  suffix,
}: {
  label: string;
  value: number;
  currency: CurrencyCode;
  suffix: string;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.flex}>
      <Text variant="caption" tone="onPrimary" style={styles.soft}>
        {label}
      </Text>
      <View style={styles.inline}>
        <AmountText value={value} currency={currency} variant="headline" tone="onPrimary" />
        <Text variant="caption" tone="onPrimary" style={styles.soft}>
          {suffix}
        </Text>
      </View>
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
    inline: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
    flex: { flex: 1, gap: 2 },
    riskCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    list: { gap: space.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60 },
    amount: { alignItems: 'flex-end' },
  });
