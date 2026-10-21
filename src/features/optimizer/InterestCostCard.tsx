import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import type { CreditProductRow } from '@/db/schema';
import { formatMoney, roundTo, type CurrencyCode } from '@/domain/money';
import type { InterestCost, Spend } from '@/domain/paymentOptimizer';
import { usePreferences } from '@/state/preferences';

import { ProductEmoji } from '../credit/ProductEmoji';

type InterestCostCardProps = {
  costs: InterestCost[];
  products: CreditProductRow[];
  spend: Spend | null;
};

/**
 * Loans with no interest-free period: what they actually cost (amount × daily rate × days),
 * listed highest rate first, which is also the order to repay them in.
 */
export function InterestCostCard({ costs, products, spend }: InterestCostCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { language, prefs } = usePreferences();
  const money = (amount: number, currency: CurrencyCode) =>
    prefs.hideAmounts
      ? t('a11y.amountHidden')
      : formatMoney(amount, currency, { locale: language });
  const productById = new Map(products.map((product) => [product.id, product]));

  return (
    <Card variant="tinted" tone="sun" style={styles.card}>
      <View style={styles.header}>
        <Icon name="trending-up" size={20} color={colors.status.caution.text} />
        <Text variant="headline" accessibilityRole="header" style={styles.flex}>
          {t('optimizer.loansTitle')}
        </Text>
      </View>
      <Text variant="callout" tone="secondary">
        {t('optimizer.loansIntro')}
      </Text>
      {costs.length > 1 ? (
        <Text variant="micro" tone="muted">
          {t('optimizer.highestFirst')}
        </Text>
      ) : null}
      {costs.map((cost, index) => {
        const product = productById.get(cost.productId);
        if (!product) return null;
        return (
          <View key={cost.productId} style={styles.row}>
            <ProductEmoji emoji={product.emoji} color={product.color} size={36} />
            <View style={styles.flex}>
              <Text variant="body" weight="700">
                {costs.length > 1 ? `${index + 1}. ` : ''}
                {product.name}
              </Text>
              <Text variant="caption" tone="secondary">
                {t('optimizer.loanRate', {
                  daily: roundTo(cost.dailyRatePercent, 4),
                  apr: roundTo(cost.aprPercent, 2),
                })}
              </Text>
              {product.balance > 0 ? (
                <Text variant="caption" tone="caution" weight="600">
                  {t('optimizer.loanDailyCost', {
                    amount: money(cost.dailyCostOfBalance, product.currency),
                  })}
                </Text>
              ) : null}
              {spend && cost.costOfSpend != null ? (
                <Text variant="caption" tone="secondary">
                  {t('optimizer.loanSpendCost', {
                    spend: money(spend.amount, spend.currency),
                    amount: money(cost.costOfSpend, product.currency),
                  })}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
      <Text variant="callout" weight="600">
        {t('optimizer.repayEarly')}
      </Text>
    </Card>
  );
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    card: { gap: space.md },
    header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    flex: { flex: 1, gap: 2 },
    row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  });
