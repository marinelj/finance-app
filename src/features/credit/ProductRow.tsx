import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { DueBadge } from '@/components/DueBadge';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { useStyles } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import type { CreditProductRow } from '@/db/schema';
import type { DueInfo } from '@/domain/creditStatus';
import { formatDate, formatMoneyLabel } from '@/lib/format';
import { usePreferences } from '@/state/preferences';

import { ProductEditButton } from './ProductEditButton';
import { ProductEmoji } from './ProductEmoji';

type ProductRowProps = {
  product: CreditProductRow;
  due: DueInfo | null;
  typeLabel: string;
  today: string;
  onPress: () => void;
  onEdit: () => void;
};

/** One product in the "by due date" list: icon, name, due date, amount and countdown badge. */
export function ProductRow({ product, due, typeLabel, today, onPress, onEdit }: ProductRowProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { prefs, language } = usePreferences();

  const subtitle = !product.isActive
    ? t('credit.closed')
    : due
      ? t('product.dueOn', { date: formatDate(due.dueDate, language, { today }) })
      : t('credit.nothingDue');
  const amount = due ? due.amount : product.balance;
  const amountLabel = formatMoneyLabel(amount, product.currency, language, prefs.hideAmounts, t);

  return (
    <View style={[styles.row, !product.isActive && styles.closed]}>
      <PressableScale
        onPress={onPress}
        haptic="light"
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={[product.name, typeLabel, subtitle, amountLabel].join(', ')}
        style={styles.details}>
        <ProductEmoji emoji={product.emoji} color={product.color} />
        <View style={styles.text}>
          <Text variant="body" weight="700" numberOfLines={1}>
            {product.name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {typeLabel} · {subtitle}
          </Text>
        </View>
        <View style={styles.trailing}>
          <View style={styles.amount}>
            {due?.amountIsEstimate ? (
              <Text variant="callout" tone="muted">
                ≈
              </Text>
            ) : null}
            <AmountText value={amount} currency={product.currency} variant="callout" />
          </View>
          {due && product.isActive ? <DueBadge daysLeft={due.daysLeft} size="sm" /> : null}
        </View>
      </PressableScale>
      <ProductEditButton name={product.name} onPress={onEdit} />
    </View>
  );
}

const makeStyles = ({ space }: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      minHeight: 64,
      paddingVertical: space.sm,
    },
    details: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md },
    closed: { opacity: 0.55 },
    text: { flex: 1, gap: 2 },
    trailing: { alignItems: 'flex-end', gap: space.xs, maxWidth: '45%' },
    amount: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  });
