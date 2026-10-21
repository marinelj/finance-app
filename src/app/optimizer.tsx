import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Appear } from '@/components/Appear';
import { BottomSheet } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { TextField } from '@/components/form/TextField';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { CURRENCIES } from '@/domain/money';
import { parseDecimal } from '@/domain/numberInput';
import {
  floatCalendar,
  interestCosts,
  rankByFloat,
  type CalendarDay,
  type FloatOption,
  type Spend,
} from '@/domain/paymentOptimizer';
import { FloatCalendarGrid } from '@/features/optimizer/FloatCalendarGrid';
import { FloatRow } from '@/features/optimizer/FloatRow';
import { InterestCostCard } from '@/features/optimizer/InterestCostCard';
import { formatDate } from '@/lib/format';
import { useCreditData } from '@/state/creditData';
import { usePreferences } from '@/state/preferences';

const CALENDAR_DAYS = 30;

/** "Which card gives me the longest payment days?" for today and the next 30 days. */
export default function OptimizerScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { prefs, language } = usePreferences();
  const { products, fx, today } = useCreditData();
  const [amountText, setAmountText] = useState('');
  const [selected, setSelected] = useState<CalendarDay | null>(null);

  const home = prefs.homeCurrency;
  const amount = parseDecimal(amountText);
  const spend: Spend | null =
    amount != null && !Number.isNaN(amount) && amount > 0 ? { amount, currency: home } : null;

  const { ranked, excluded } = rankByFloat(products, today, spend, fx);
  const calendar = floatCalendar(products, today, CALENDAR_DAYS, spend, fx);
  const costs = interestCosts(products, spend, 30, fx);
  const productById = new Map(products.map((product) => [product.id, product]));
  const maxDays = Math.max(
    1,
    ...calendar.flatMap((day) => day.ranked.map((option) => option.floatDays))
  );
  const anyFlagged = [...ranked, ...excluded].some(
    (option) => option.dueFlags.weekend || option.dueFlags.holiday != null
  );
  const eligible = ranked.length + excluded.length > 0;

  const rows = (options: FloatOption[], ranks: boolean) =>
    options.map((option, index) => {
      const product = productById.get(option.productId);
      if (!product) return null;
      return (
        <View key={option.productId}>
          {index > 0 ? <View style={styles.separator} /> : null}
          <FloatRow
            option={option}
            product={product}
            rank={ranks ? index + 1 : undefined}
            maxDays={maxDays}
            today={today}
          />
        </View>
      );
    });

  return (
    <Screen hasHeader>
      <Appear index={0}>
        <Card style={styles.section}>
          <TextField
            label={t('optimizer.spendLabel')}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            prefix={CURRENCIES[home].symbol}
            placeholder="0"
            hint={t('optimizer.spendHint')}
          />
        </Card>
      </Appear>

      <Appear index={1}>
        <Card style={styles.section}>
          <SectionHeader title={t('optimizer.today')} />
          {!eligible ? (
            <EmptyState
              emoji="💳"
              tone="sky"
              title={t('optimizer.noCards')}
              message={t('optimizer.noCardsHint')}
            />
          ) : (
            <>
              {ranked.length === 0 ? (
                <Text variant="callout" tone="danger">
                  {t('optimizer.noneFits')}
                </Text>
              ) : (
                rows(ranked, true)
              )}
              {excluded.length > 0 ? (
                <>
                  <Text variant="micro" tone="muted" style={styles.aside}>
                    {t('optimizer.setAside')}
                  </Text>
                  {rows(excluded, false)}
                </>
              ) : null}
              {anyFlagged ? (
                <View style={styles.note}>
                  <Icon name="calendar-outline" size={16} color={colors.textMuted} />
                  <Text variant="caption" tone="muted" style={styles.flex}>
                    {t('optimizer.flagHint')}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </Card>
      </Appear>

      {eligible ? (
        <Appear index={2}>
          <Card style={styles.section}>
            <SectionHeader title={t('optimizer.calendar')} />
            <Text variant="caption" tone="muted">
              {t('optimizer.calendarHint')}
            </Text>
            <FloatCalendarGrid
              days={calendar}
              products={products}
              today={today}
              onSelect={setSelected}
            />
          </Card>
        </Appear>
      ) : null}

      {costs.length > 0 ? (
        <Appear index={3}>
          <InterestCostCard costs={costs} products={products} spend={spend} />
        </Appear>
      ) : null}

      <BottomSheet
        visible={selected != null}
        onClose={() => setSelected(null)}
        title={
          selected
            ? t('optimizer.dayTitle', {
                date: formatDate(selected.date, language, { weekday: true, today }),
              })
            : undefined
        }>
        {selected && selected.ranked.length > 0 ? (
          rows(selected.ranked, true)
        ) : (
          <Text variant="callout" tone="secondary">
            {t('optimizer.noneFits')}
          </Text>
        )}
      </BottomSheet>
    </Screen>
  );
}

const makeStyles = ({ colors, space }: Theme) =>
  StyleSheet.create({
    section: { gap: space.sm },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
    aside: { marginTop: space.md },
    note: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', marginTop: space.xs },
    flex: { flex: 1 },
  });
