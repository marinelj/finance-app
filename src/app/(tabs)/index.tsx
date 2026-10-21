import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { Appear } from '@/components/Appear';
import { Card } from '@/components/Card';
import { DueBadge } from '@/components/DueBadge';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { SectionHeader } from '@/components/SectionHeader';
import { Screen } from '@/components/Screen';
import { StatTile } from '@/components/StatTile';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { productTypeLabel } from '@/features/credit/labels';
import { ProductRow } from '@/features/credit/ProductRow';
import { dayPart, formatDate, formatLongDate } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useCreditData } from '@/state/creditData';
import { usePreferences } from '@/state/preferences';

const UPCOMING = 3;

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { prefs, language, setPreference } = usePreferences();
  const { statuses, summary, customTypes, today } = useCreditData();
  const now = new Date();
  const currency = prefs.homeCurrency;
  const nextStatus = summary.next
    ? statuses.find((status) => status.product.id === summary.next?.productId)
    : undefined;
  const upcoming = statuses
    .filter((status) => status.due && status.product.isActive)
    .slice(0, UPCOMING);
  const openProduct = (id: string) => router.push({ pathname: '/product/[id]', params: { id } });

  const privacyToggle = (
    <Pressable
      onPress={() => {
        haptics.selection();
        setPreference('hideAmounts', !prefs.hideAmounts);
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={prefs.hideAmounts ? t('home.showAmounts') : t('home.hideAmounts')}
      style={styles.iconButton}>
      <Icon
        name={prefs.hideAmounts ? 'eye-off-outline' : 'eye-outline'}
        size={22}
        color={colors.textSecondary}
      />
    </Pressable>
  );

  return (
    <Screen
      withTabBar
      eyebrow={formatLongDate(now, language)}
      title={t(`greeting.${dayPart(now.getHours())}`)}
      right={privacyToggle}>
      <Appear index={0}>
        <Card
          variant="gradient"
          padding="xxl"
          style={styles.hero}
          onPress={summary.activeCount > 0 ? () => router.navigate('/credit') : undefined}
          accessibilityLabel={t('home.totalOwed')}>
          <Text variant="callout" tone="onPrimary" style={styles.heroLabel}>
            {t('home.totalOwed')}
          </Text>
          <AmountText
            value={summary.totalOwed}
            currency={currency}
            variant="hero"
            tone="onPrimary"
            animate
          />
          <Text variant="caption" tone="onPrimary" style={styles.heroLabel}>
            {summary.activeCount > 0
              ? t('home.acrossProducts', { count: summary.activeCount })
              : t('home.noProducts')}
          </Text>
        </Card>
      </Appear>

      <Appear index={1} style={styles.row}>
        <StatTile
          style={styles.tile}
          emoji="🗓️"
          tone="sun"
          label={t('home.dueThisMonth')}
          value={
            <AmountText value={summary.dueThisMonth} currency={currency} variant="title" animate />
          }
          caption={
            summary.dueThisMonthCount > 0
              ? t('credit.bills', { count: summary.dueThisMonthCount })
              : undefined
          }
        />
        <StatTile
          style={styles.tile}
          emoji="⏰"
          tone="pink"
          label={t('home.nextDue')}
          onPress={nextStatus ? () => openProduct(nextStatus.product.id) : undefined}
          value={
            nextStatus && summary.next ? (
              <Text variant="title" numberOfLines={1}>
                {nextStatus.product.name}
              </Text>
            ) : (
              '—'
            )
          }
          caption={
            summary.next
              ? formatDate(summary.next.due.dueDate, language, { weekday: true, today })
              : t('home.nothingDue')
          }
          footer={
            summary.next ? <DueBadge daysLeft={summary.next.due.daysLeft} size="sm" /> : undefined
          }
        />
      </Appear>

      {upcoming.length > 0 ? (
        <Appear index={2}>
          <Card style={styles.list}>
            <SectionHeader
              title={t('home.upcoming')}
              action={{ label: t('common.seeAll'), onPress: () => router.navigate('/credit') }}
            />
            {upcoming.map((status, index) => (
              <View key={status.product.id}>
                {index > 0 ? <View style={styles.separator} /> : null}
                <ProductRow
                  product={status.product}
                  due={status.due}
                  typeLabel={productTypeLabel(status.product, customTypes, t)}
                  today={today}
                  onPress={() => openProduct(status.product.id)}
                />
              </View>
            ))}
          </Card>
        </Appear>
      ) : null}

      <Appear index={3}>
        <Card style={styles.gap}>
          <SectionHeader title={t('home.bestCardToday')} />
          <Text tone="secondary">{t('home.bestCardEmpty')}</Text>
        </Card>
      </Appear>

      {statuses.length === 0 ? (
        <Appear index={4}>
          <Card>
            <EmptyState
              emoji="🧭"
              title={t('home.emptyTitle')}
              message={t('home.emptyMessage')}
              action={{ label: t('home.addFirst'), onPress: () => router.push('/product/new') }}
            />
          </Card>
        </Appear>
      ) : null}
    </Screen>
  );
}

const makeStyles = ({ colors, radius, space, shadow }: Theme) =>
  StyleSheet.create({
    hero: { gap: space.xs },
    heroLabel: { opacity: 0.9 },
    row: { flexDirection: 'row', gap: space.md },
    tile: { flex: 1 },
    gap: { gap: space.sm },
    list: { gap: space.xs },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      boxShadow: shadow.card,
    },
  });
