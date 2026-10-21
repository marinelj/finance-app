import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { Appear } from '@/components/Appear';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { formatPercent } from '@/domain/money';
import { CardDeck } from '@/features/credit/CardDeck';
import { productTypeLabel } from '@/features/credit/labels';
import { ProductCard } from '@/features/credit/ProductCard';
import { ProductRow } from '@/features/credit/ProductRow';
import { haptics } from '@/lib/haptics';
import { useCreditData } from '@/state/creditData';
import { usePreferences } from '@/state/preferences';

export default function CreditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { prefs } = usePreferences();
  const { statuses, summary, customTypes, today } = useCreditData();
  const home = prefs.homeCurrency;
  const active = statuses.filter((status) => status.product.isActive);

  const openProduct = (id: string) => router.push({ pathname: '/product/[id]', params: { id } });
  const add = () => {
    haptics.light();
    router.push('/product/new');
  };

  const addButton = (
    <Pressable
      onPress={add}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('credit.add')}
      style={styles.addButton}>
      <Icon name="add" size={26} color={colors.textOnPrimary} />
    </Pressable>
  );

  if (statuses.length === 0) {
    return (
      <Screen withTabBar title={t('credit.title')} right={addButton}>
        <Appear index={0}>
          <Card>
            <EmptyState
              emoji="💳"
              tone="pink"
              title={t('credit.emptyTitle')}
              message={t('credit.emptyMessage')}
              action={{ label: t('credit.emptyAction'), onPress: add }}
            />
          </Card>
        </Appear>
      </Screen>
    );
  }

  return (
    <Screen withTabBar title={t('credit.title')} right={addButton}>
      <Appear index={0}>
        <Card variant="gradient" padding="xxl" style={styles.hero}>
          <Text variant="callout" tone="onPrimary" style={styles.soft}>
            {t('credit.dueThisMonth')}
          </Text>
          <AmountText
            value={summary.dueThisMonth}
            currency={home}
            variant="hero"
            tone="onPrimary"
            animate
          />
          <Text variant="caption" tone="onPrimary" style={styles.soft}>
            {t('credit.bills', { count: summary.dueThisMonthCount })}
          </Text>
          <View style={styles.heroStats}>
            <View>
              <Text variant="caption" tone="onPrimary" style={styles.soft}>
                {t('credit.totalOwed')}
              </Text>
              <AmountText
                value={summary.totalOwed}
                currency={home}
                variant="headline"
                tone="onPrimary"
              />
            </View>
            {summary.utilization != null ? (
              <View>
                <Text variant="caption" tone="onPrimary" style={styles.soft}>
                  {t('credit.utilization')}
                </Text>
                <Text variant="headline" tone="onPrimary">
                  {formatPercent(summary.utilization, { decimals: 0 })}
                </Text>
              </View>
            ) : null}
          </View>
        </Card>
      </Appear>

      {active.length > 0 ? (
        <Appear index={1} style={styles.deck}>
          <CardDeck
            items={active}
            keyOf={(status) => status.product.id}
            labelOf={(status) => status.product.name}
            onPress={(status) => openProduct(status.product.id)}
            renderCard={(status) => (
              <ProductCard
                name={status.product.name}
                issuer={status.product.issuer}
                typeLabel={productTypeLabel(status.product, customTypes, t)}
                emoji={status.product.emoji}
                color={status.product.color}
                currency={status.product.currency}
                balance={status.product.balance}
                due={status.due}
                today={today}
              />
            )}
          />
          {active.length > 1 ? (
            <Text variant="caption" tone="muted" align="center">
              {t('credit.deckHint')}
            </Text>
          ) : null}
        </Appear>
      ) : null}

      <Appear index={2}>
        <Card style={styles.list}>
          <SectionHeader title={t('credit.byDueDate')} />
          {statuses.map((status, index) => (
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
    </Screen>
  );
}

const makeStyles = ({ colors, radius, space, shadow }: Theme) =>
  StyleSheet.create({
    addButton: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      boxShadow: shadow.card,
    },
    hero: { gap: space.xs },
    soft: { opacity: 0.9 },
    heroStats: {
      flexDirection: 'row',
      gap: space.xxl,
      marginTop: space.md,
      paddingTop: space.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(255, 255, 255, 0.35)',
    },
    deck: { gap: space.sm, paddingTop: space.xs },
    list: { gap: space.xs },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  });
