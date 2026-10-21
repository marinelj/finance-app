import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import type { CreditProductRow } from '@/db/schema';
import { formatMoney } from '@/domain/money';
import type { FloatOption } from '@/domain/paymentOptimizer';
import { formatDate } from '@/lib/format';
import { usePreferences } from '@/state/preferences';

import { ProductEmoji } from '../credit/ProductEmoji';

type FloatRowProps = {
  option: FloatOption;
  product: CreditProductRow;
  /** 1-based position; omitted for cards set aside. */
  rank?: number;
  /** Longest float on screen, for the bar's scale. */
  maxDays: number;
  today: string;
};

/** A card's interest-free float for one purchase date: days, due date, flags and limit. */
export function FloatRow({ option, product, rank, maxDays, today }: FloatRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { language, prefs } = usePreferences();
  const excluded = option.limit === 'insufficient';
  const money = (amount: number) =>
    prefs.hideAmounts
      ? t('a11y.amountHidden')
      : formatMoney(amount, product.currency, { locale: language });
  const due = formatDate(option.dueDate, language, { weekday: true, today });
  const days = t('optimizer.days', { count: option.floatDays });
  const { weekend, holiday } = option.dueFlags;

  const limitNote =
    option.limit === 'insufficient' && option.available != null
      ? {
          tone: 'danger' as const,
          text: t('optimizer.notEnoughDetail', { amount: money(option.available) }),
        }
      : option.limit === 'tight' && option.available != null
        ? {
            tone: 'caution' as const,
            text: t('optimizer.limitTight', { amount: money(option.available) }),
          }
        : option.limit === 'unknown'
          ? { tone: 'muted' as const, text: t('optimizer.limitUnknown') }
          : option.available != null
            ? {
                tone: 'muted' as const,
                text: t('optimizer.creditLeft', { amount: money(option.available) }),
              }
            : null;

  return (
    <View
      accessible
      accessibilityLabel={[
        rank ? t('optimizer.rank', { rank }) : t('optimizer.notEnough'),
        product.name,
        `${days} ${t('optimizer.interestFree')}`,
        t('optimizer.dueOn', { date: due }),
        weekend ? t('optimizer.weekend') : null,
        holiday ? t(`holidays.${holiday}`) : null,
        limitNote?.text,
      ]
        .filter(Boolean)
        .join(', ')}
      style={[styles.row, excluded && styles.excluded]}>
      <View style={styles.leading}>
        {rank ? (
          <View style={[styles.rank, rank === 1 && { backgroundColor: colors.primary }]}>
            <Text variant="micro" tone={rank === 1 ? 'onPrimary' : 'secondary'}>
              {rank}
            </Text>
          </View>
        ) : null}
        <ProductEmoji emoji={product.emoji} color={product.color} size={40} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="body" weight="700" numberOfLines={1} style={styles.flex}>
            {product.name}
          </Text>
          <Text variant="headline" weight="800" tone={excluded ? 'muted' : 'default'}>
            {days}
          </Text>
        </View>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {t('optimizer.dueOn', { date: due })} ·{' '}
          {t('optimizer.statement', {
            date: formatDate(option.statementDate, language, { today }),
          })}
        </Text>
        <View style={styles.bar}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.max(4, (option.floatDays / Math.max(1, maxDays)) * 100)}%`,
                backgroundColor: excluded ? colors.hairline : product.color,
              },
            ]}
          />
        </View>
        {weekend || holiday || limitNote ? (
          <View style={styles.notes}>
            {holiday ? (
              <StatusPill
                tone="caution"
                icon="calendar"
                label={t(`holidays.${holiday}`)}
                size="sm"
              />
            ) : weekend ? (
              <StatusPill tone="caution" icon="calendar" label={t('optimizer.weekend')} size="sm" />
            ) : null}
            {limitNote ? (
              limitNote.tone === 'muted' ? (
                <Text variant="caption" tone="muted">
                  {limitNote.text}
                </Text>
              ) : (
                <StatusPill
                  tone={limitNote.tone}
                  icon={limitNote.tone === 'danger' ? 'close-circle' : 'alert-circle'}
                  label={limitNote.text}
                  size="sm"
                />
              )
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = ({ colors, radius, space }: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm },
    excluded: { opacity: 0.7 },
    leading: { alignItems: 'center', gap: space.xs },
    rank: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    body: { flex: 1, gap: space.xs },
    titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
    flex: { flex: 1 },
    bar: {
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
      marginTop: 2,
    },
    fill: { height: '100%', borderRadius: radius.pill },
    notes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  });
