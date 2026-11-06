import { useCalendars } from 'expo-localization';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme, ThemeColors } from '@/design/tokens';
import { monthCells, type CalendarEvent, type CalendarMarker } from '@/domain/calendar';
import { convert, type FxTable } from '@/domain/fx';
import type { CurrencyCode } from '@/domain/money';
import { formatDate, formatMonth, weekdayInitials } from '@/lib/format';
import { usePreferences } from '@/state/preferences';

export function markerColor(marker: CalendarMarker, colors: ThemeColors) {
  return {
    danger: colors.status.danger.text,
    amber: colors.status.caution.text,
    paid: colors.textMuted,
    grey: colors.textMuted,
    green: colors.accentStrong.mint,
    blue: colors.accentStrong.sky,
    purple: colors.accentStrong.violet,
  }[marker];
}

type Props = {
  year: number;
  month: number;
  today: string;
  selected: string;
  events: CalendarEvent[];
  desktop: boolean;
  home: CurrencyCode;
  fx: FxTable;
  onSelect: (date: string) => void;
  onMonth: (delta: number) => void;
  onToday: () => void;
};
/** Month cells reuse the optimizer calendar's seven-column layout and accessible date labels. */
export function MonthGrid({
  year,
  month,
  today,
  selected,
  events,
  desktop,
  home,
  fx,
  onSelect,
  onMonth,
  onToday,
}: Props) {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const calendars = useCalendars();
  const first = language === 'zh-Hans' ? 1 : (calendars[0].firstWeekday ?? 1) - 1;
  const cells = monthCells(year, month, first);
  const labels = weekdayInitials(language);
  const weekdays = [...labels.slice(first), ...labels.slice(0, first)];
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) map.set(event.date, [...(map.get(event.date) ?? []), event]);
    return map;
  }, [events]);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dx) > 45) onMonth(g.dx < 0 ? 1 : -1);
        },
      }),
    [onMonth]
  );
  return (
    <View {...pan.panHandlers}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('calendar.previousMonth')}
          onPress={() => onMonth(-1)}
          style={styles.arrow}>
          <Icon name="chevron-back" size={22} color={colors.primaryText} />
        </Pressable>
        <Text variant="headline" align="center" style={styles.grow} accessibilityRole="header">
          {formatMonth(year, month, language)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('calendar.nextMonth')}
          onPress={() => onMonth(1)}
          style={styles.arrow}>
          <Icon name="chevron-forward" size={22} color={colors.primaryText} />
        </Pressable>
      </View>
      <Button
        label={t('calendar.today')}
        size="sm"
        variant="ghost"
        onPress={onToday}
        style={styles.todayButton}
      />
      <View style={styles.week}>
        {weekdays.map((label, i) => (
          <Text key={i} variant="caption" tone="muted" align="center" style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={`blank-${i}`} style={styles.cell} />;
          const items = byDate.get(date) ?? [];
          const active = date === selected;
          const due = items
            .filter((e) => (e.kind === 'bill' || e.kind === 'installment') && !e.paid)
            .reduce((sum, e) => sum + convert(e.amount ?? 0, e.currency, home, fx), 0);
          return (
            <View key={date} style={styles.cell}>
              <Pressable
                onPress={() => onSelect(date)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t('calendar.dayLabel', {
                  date: formatDate(date, language, { weekday: true, year: true }),
                  count: items.length,
                })}
                style={[
                  styles.tile,
                  desktop && styles.tileDesktop,
                  active && { backgroundColor: colors.primarySoft },
                  date === today && { borderColor: colors.primary },
                ]}>
                <View style={[styles.number, active && { backgroundColor: colors.primary }]}>
                  <Text variant="callout" tone={active ? 'onPrimary' : 'default'}>
                    {Number(date.slice(8))}
                  </Text>
                </View>
                <View style={styles.markers}>
                  {items.slice(0, 3).map((event) => (
                    <View key={event.id}>
                      {event.paid ? (
                        <Icon
                          name="checkmark"
                          size={12}
                          color={markerColor(event.marker, colors)}
                        />
                      ) : (
                        <View
                          style={[
                            styles.dot,
                            { backgroundColor: markerColor(event.marker, colors) },
                          ]}
                        />
                      )}
                    </View>
                  ))}
                  {items.length > 3 ? (
                    <Text variant="micro" tone="muted">
                      +{items.length - 3}
                    </Text>
                  ) : null}
                </View>
                {desktop && due > 0 ? (
                  <AmountText value={due} currency={home} variant="micro" numberOfLines={1} />
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
const makeStyles = ({ colors, space, radius }: Theme) =>
  StyleSheet.create({
    arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    grow: { flex: 1 },
    todayButton: { alignSelf: 'center', marginBottom: space.sm },
    week: { flexDirection: 'row', marginBottom: space.sm },
    weekday: { flex: 1 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, padding: 2 },
    tile: {
      minHeight: 68,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderWidth: 1.5,
      borderColor: 'transparent',
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    tileDesktop: { minHeight: 92 },
    number: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markers: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      minHeight: 12,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
  });
