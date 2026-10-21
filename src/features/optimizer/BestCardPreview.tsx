import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { useStyles } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import type { CreditProductRow } from '@/db/schema';
import type { FloatOption } from '@/domain/paymentOptimizer';
import { formatDate } from '@/lib/format';
import { usePreferences } from '@/state/preferences';

import { ProductEmoji } from '../credit/ProductEmoji';

type BestCardPreviewProps = {
  options: FloatOption[];
  products: CreditProductRow[];
  today: string;
};

/** The top few cards for a purchase today, as compact rows for the Home screen. */
export function BestCardPreview({ options, products, today }: BestCardPreviewProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { language } = usePreferences();
  const productById = new Map(products.map((product) => [product.id, product]));

  return (
    <View style={styles.list}>
      {options.map((option, index) => {
        const product = productById.get(option.productId);
        if (!product) return null;
        const due = formatDate(option.dueDate, language, { weekday: true, today });
        const days = t('optimizer.days', { count: option.floatDays });
        const { holiday, weekend } = option.dueFlags;
        const flag = holiday ? t(`holidays.${holiday}`) : weekend ? t('optimizer.weekend') : null;
        return (
          <View
            key={option.productId}
            accessible
            accessibilityLabel={[
              t('optimizer.rank', { rank: index + 1 }),
              product.name,
              `${days} ${t('optimizer.interestFree')}`,
              t('optimizer.dueOn', { date: due }),
            ].join(', ')}
            style={[styles.row, index === 0 && styles.first]}>
            <ProductEmoji
              emoji={product.emoji}
              color={product.color}
              size={index === 0 ? 44 : 36}
            />
            <View style={styles.text}>
              <Text variant={index === 0 ? 'headline' : 'body'} weight="700" numberOfLines={1}>
                {product.name}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {[t('optimizer.dueOn', { date: due }), flag].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <View style={styles.days}>
              <Text
                variant={index === 0 ? 'title' : 'headline'}
                weight="800"
                tone={index === 0 ? 'primary' : 'default'}>
                {days}
              </Text>
              <Text variant="micro" tone="muted">
                {t('optimizer.interestFree')}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = ({ colors, radius, space }: Theme) =>
  StyleSheet.create({
    list: { gap: space.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
    first: {
      backgroundColor: colors.primarySoft,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      paddingVertical: space.md,
      marginHorizontal: -space.xs,
    },
    text: { flex: 1, gap: 2 },
    days: { alignItems: 'flex-end' },
  });
