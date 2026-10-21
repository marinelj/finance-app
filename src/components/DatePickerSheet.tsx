import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import {
  daysInMonth,
  isLocalDate,
  makeLocalDate,
  parseLocalDate,
  shiftMonth,
  weekday,
  type LocalDate,
} from '@/domain/dates';
import { formatDate, formatMonth, weekdayInitials } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/state/preferences';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

type DatePickerSheetProps = {
  visible: boolean;
  title: string;
  value: LocalDate | null;
  today: LocalDate;
  onChange: (date: LocalDate) => void;
  onClose: () => void;
  min?: LocalDate;
  max?: LocalDate;
  /** Offer a "clear" button for optional dates. */
  onClear?: () => void;
};

/** Month calendar in a sheet. Dates are local calendar days, never instants. */
export function DatePickerSheet({
  visible,
  title,
  value,
  today,
  onChange,
  onClose,
  min,
  max,
  onClear,
}: DatePickerSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { language } = usePreferences();
  const start = parseLocalDate(value && isLocalDate(value) ? value : today);
  const [month, setMonth] = useState({ year: start.year, month: start.month });

  const first = makeLocalDate(month.year, month.month, 1);
  const leading = weekday(first);
  const count = daysInMonth(month.year, month.month);
  const cells: (LocalDate | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: count }, (_, i) => makeLocalDate(month.year, month.month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const move = (delta: number) => {
    haptics.selection();
    setMonth(shiftMonth(month.year, month.month, delta));
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        onClear && value ? (
          <Button
            label={t('common.clear')}
            variant="ghost"
            fullWidth
            onPress={() => {
              onClear();
              onClose();
            }}
          />
        ) : undefined
      }>
      <View style={styles.header}>
        <Pressable
          onPress={() => move(-1)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('form.previousMonth')}
          style={styles.arrow}>
          <Icon name="chevron-back" size={20} color={colors.primaryText} />
        </Pressable>
        <Text variant="headline" align="center" style={styles.month} accessibilityRole="header">
          {formatMonth(month.year, month.month, language)}
        </Text>
        <Pressable
          onPress={() => move(1)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('form.nextMonth')}
          style={styles.arrow}>
          <Icon name="chevron-forward" size={20} color={colors.primaryText} />
        </Pressable>
      </View>
      <View style={styles.week} importantForAccessibility="no-hide-descendants">
        {weekdayInitials(language).map((label, i) => (
          <Text key={i} variant="caption" tone="muted" align="center" style={styles.weekCell}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={`blank-${i}`} style={styles.cell} />;
          const selected = date === value;
          const isToday = date === today;
          const disabled = (min != null && date < min) || (max != null && date > max);
          return (
            <Pressable
              key={date}
              disabled={disabled}
              onPress={() => {
                haptics.selection();
                onChange(date);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={formatDate(date, language, { weekday: true, year: true })}
              style={styles.cell}>
              <View
                style={[
                  styles.dayDot,
                  isToday && { borderColor: colors.primary },
                  selected && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}>
                <Text
                  variant="callout"
                  weight={selected || isToday ? '700' : '500'}
                  tone={selected ? 'onPrimary' : disabled ? 'muted' : 'default'}
                  maxFontSizeMultiplier={1.3}>
                  {parseLocalDate(date).day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={() => {
          setMonth({ year: parseLocalDate(today).year, month: parseLocalDate(today).month });
        }}
        accessibilityRole="button"
        hitSlop={8}
        style={styles.todayButton}>
        <Text variant="callout" tone="primary" weight="600">
          {t('common.today')}
        </Text>
      </Pressable>
    </BottomSheet>
  );
}

const makeStyles = ({ colors, radius, space }: Theme) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    month: { flex: 1 },
    arrow: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    week: { flexDirection: 'row' },
    weekCell: { flex: 1 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    dayDot: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    todayButton: { alignSelf: 'center', paddingVertical: space.xs },
  });
