import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { agendaDate, calendarEvents, type CalendarEvent } from '@/domain/calendar';
import { addMonths, clampedDate, monthKey, parseLocalDate, shiftMonth } from '@/domain/dates';
import { rankByFloat } from '@/domain/paymentOptimizer';
import { MonthGrid, markerColor } from '@/features/calendar/MonthGrid';
import { PaymentSheet } from '@/features/credit/PaymentSheet';
import { BestCardPreview } from '@/features/optimizer/BestCardPreview';
import { formatDate } from '@/lib/format';
import { useCreditData } from '@/state/creditData';
import { usePreferences } from '@/state/preferences';
import { useWealthData } from '@/state/wealthData';

const ICONS: Record<CalendarEvent['kind'], IconName> = {
  bill: 'card-outline',
  statement: 'receipt-outline',
  installment: 'calendar-outline',
  income: 'cash-outline',
  housing: 'home-outline',
  insurance: 'shield-checkmark-outline',
};

export default function CalendarScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { prefs, language, setPreference } = usePreferences();
  const credit = useCreditData();
  const wealth = useWealthData();
  const { today, products, installments, billStatements, summary, fx } = credit;
  const desktop = useWindowDimensions().width >= 1024;
  const [month, setMonth] = useState(() => {
    const { year, month } = parseLocalDate(today);
    return { year, month };
  });
  const [selected, setSelected] = useState(today);
  const [paying, setPaying] = useState<CalendarEvent | null>(null);
  const changeMonth = useCallback(
    (delta: number) => {
      const next = shiftMonth(month.year, month.month, delta);
      setMonth(next);
      setSelected(clampedDate(next.year, next.month, 1));
    },
    [month]
  );
  const viewStart = clampedDate(month.year, month.month, 1);
  const todayStart = `${monthKey(today)}-01`;
  const start = viewStart < todayStart ? viewStart : todayStart;
  const end = addMonths(viewStart > todayStart ? viewStart : todayStart, 12);
  const events = useMemo(
    () =>
      calendarEvents({
        products,
        installments,
        insurance: wealth.insurance,
        incomes: wealth.incomes,
        bills: billStatements,
        today,
        start,
        end,
      }),
    [products, installments, wealth.insurance, wealth.incomes, billStatements, today, start, end]
  );
  const date = agendaDate(events, selected, today);
  const agenda = events.filter((event) => event.date === date);
  const best = rankByFloat(products, today).ranked.slice(0, 3);
  const bestProduct = products.find((product) => product.id === best[0]?.productId);
  const openProduct = (id: string) => router.push({ pathname: '/product/[id]', params: { id } });
  const openEvent = (event: CalendarEvent) => {
    if (event.kind === 'bill' || event.kind === 'statement' || event.kind === 'installment')
      openProduct(event.itemId);
    else
      router.push({
        pathname: '/wealth/[kind]/edit',
        params: {
          kind:
            event.kind === 'insurance'
              ? 'insurance'
              : event.kind === 'housing'
                ? 'housing'
                : 'income',
          id: event.itemId,
        },
      });
  };
  const paymentProduct = products.find((product) => product.id === paying?.itemId);
  const summaryStrip = (
    <Card padding="md" style={styles.summary}>
      <Pressable
        style={styles.stat}
        onPress={() => router.navigate('/credit')}
        accessibilityRole="button">
        <Text variant="micro" tone="muted">
          {t('home.totalOwed')}
        </Text>
        <AmountText
          value={summary.totalOwed}
          currency={prefs.homeCurrency}
          variant="headline"
          numberOfLines={1}
        />
      </Pressable>
      <View style={styles.divider} />
      <View style={styles.stat}>
        <Text variant="micro" tone="muted">
          {t('home.dueThisMonth')}
        </Text>
        <AmountText
          value={summary.dueThisMonth}
          currency={prefs.homeCurrency}
          variant="headline"
          numberOfLines={1}
        />
      </View>
      <View style={styles.divider} />
      <Pressable
        style={styles.stat}
        accessibilityRole="button"
        disabled={!summary.next}
        onPress={() => summary.next && openProduct(summary.next.productId)}>
        <Text variant="micro" tone="muted">
          {t('home.nextDue')}
        </Text>
        <Text variant="callout" weight="700" numberOfLines={1}>
          {products.find((p) => p.id === summary.next?.productId)?.name ?? '—'}
        </Text>
        <Text variant="micro" tone="secondary">
          {summary.next
            ? t('calendar.daysLeft', { count: summary.next.due.daysLeft })
            : t('home.nothingDue')}
        </Text>
      </Pressable>
    </Card>
  );
  const agendaPanel = (
    <Card style={styles.gap}>
      <SectionHeader title={formatDate(date, language, { weekday: true, today })} />
      {date !== selected ? (
        <Text variant="caption" tone="muted">
          {t('calendar.nextAgenda')}
        </Text>
      ) : null}
      {!agenda.length ? (
        <Text tone="muted">{t('calendar.noEvents')}</Text>
      ) : (
        agenda.map((event) => (
          <View key={event.id} style={styles.agendaItem}>
            <Pressable
              style={styles.agendaRow}
              accessibilityRole="button"
              onPress={() => openEvent(event)}>
              <Icon name={ICONS[event.kind]} size={22} color={markerColor(event.marker, colors)} />
              <View style={styles.grow}>
                <Text variant="callout" weight="700">
                  {event.name}
                </Text>
                <Text variant="caption" tone="secondary">
                  {t(`calendar.kinds.${event.kind}`)} ·{' '}
                  {event.paid
                    ? t('product.paid')
                    : event.due
                      ? t('calendar.unpaid')
                      : t('calendar.scheduled')}
                </Text>
              </View>
              {event.amount != null ? (
                <AmountText value={event.amount} currency={event.currency} variant="callout" />
              ) : null}
            </Pressable>
            {event.due && !event.paid && (event.amount ?? 0) > 0 ? (
              <Button
                label={t('product.markPaid')}
                variant="secondary"
                size="sm"
                onPress={() => setPaying(event)}
                style={styles.payButton}
              />
            ) : null}
          </View>
        ))
      )}
    </Card>
  );
  const bestCard = desktop ? (
    <Card style={styles.gap}>
      <SectionHeader
        title={t('home.bestCardToday')}
        action={{ label: t('home.bestCardMore'), onPress: () => router.push('/optimizer') }}
      />
      {best.length ? (
        <BestCardPreview options={best} products={products} today={today} />
      ) : (
        <Text tone="muted">{t('home.bestCardEmpty')}</Text>
      )}
    </Card>
  ) : (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/optimizer')}
      style={styles.bestLine}>
      <Icon name="sparkles-outline" size={16} color={colors.primaryText} />
      <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.grow}>
        {bestProduct
          ? t('calendar.bestLine', { name: bestProduct.name, count: best[0].floatDays })
          : t('home.bestCardEmpty')}
      </Text>
      <Icon name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
  return (
    <Screen
      withTabBar
      title={t('tabs.home')}
      contentStyle={desktop ? styles.wide : undefined}
      right={
        <Pressable
          style={styles.privacy}
          accessibilityRole="button"
          accessibilityLabel={prefs.hideAmounts ? t('home.showAmounts') : t('home.hideAmounts')}
          onPress={() => setPreference('hideAmounts', !prefs.hideAmounts)}>
          <Icon
            name={prefs.hideAmounts ? 'eye-off-outline' : 'eye-outline'}
            size={22}
            color={colors.textSecondary}
          />
        </Pressable>
      }>
      {!desktop ? summaryStrip : null}
      <View style={[styles.layout, desktop && styles.panes]}>
        <Card style={desktop ? styles.calendarPane : undefined} padding="md">
          <MonthGrid
            {...month}
            today={today}
            selected={selected}
            events={events}
            desktop={desktop}
            home={prefs.homeCurrency}
            fx={fx}
            onMonth={changeMonth}
            onSelect={setSelected}
            onToday={() => {
              const { year, month } = parseLocalDate(today);
              setMonth({ year, month });
              setSelected(today);
            }}
          />
        </Card>
        <View style={[styles.right, desktop && styles.agendaPane]}>
          {desktop ? summaryStrip : null}
          {agendaPanel}
          {bestCard}
        </View>
      </View>
      {!products.length ? (
        <Card>
          <EmptyState
            emoji="🧭"
            title={t('home.emptyTitle')}
            message={t('home.emptyMessage')}
            action={{ label: t('home.addFirst'), onPress: () => router.push('/product/new') }}
          />
        </Card>
      ) : null}
      {paymentProduct && paying ? (
        <PaymentSheet
          visible
          onClose={() => setPaying(null)}
          product={paymentProduct}
          due={paying.due}
          installment={installments.find((item) => item.id === paying.due?.installmentId) ?? null}
          installmentCount={
            installments.filter((item) => item.productId === paymentProduct.id).length
          }
          today={today}
          onPaid={() => {}}
        />
      ) : null}
    </Screen>
  );
}
const makeStyles = ({ colors, space }: Theme) =>
  StyleSheet.create({
    privacy: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    wide: { maxWidth: 1280 },
    layout: { gap: space.lg },
    panes: { flexDirection: 'row', alignItems: 'flex-start' },
    calendarPane: { flex: 3, minWidth: 0 },
    agendaPane: { flex: 2, minWidth: 0 },
    right: { gap: space.lg },
    summary: { flexDirection: 'row', gap: space.sm, alignItems: 'stretch' },
    stat: { flex: 1, minWidth: 0, gap: 4 },
    divider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
    grow: { flex: 1, minWidth: 0 },
    gap: { gap: space.md },
    agendaItem: {
      gap: space.sm,
      paddingVertical: space.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.hairline,
    },
    agendaRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.md },
    payButton: { alignSelf: 'flex-end' },
    bestLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  });
