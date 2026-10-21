import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';

import { Text } from '@/components/Text';
import { mixHex } from '@/design/color';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import type { CreditProductRow } from '@/db/schema';
import { parseLocalDate, weekday } from '@/domain/dates';
import type { CalendarDay } from '@/domain/paymentOptimizer';
import { formatDate, weekdayInitials } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/state/preferences';

type FloatCalendarGridProps = {
  days: CalendarDay[];
  products: CreditProductRow[];
  today: string;
  onSelect: (day: CalendarDay) => void;
};

/**
 * Month-style grid of the coming days. Each cell shows the best card for a purchase on that day
 * (its emoji on a tint of its colour) and how many interest-free days it gives.
 */
export function FloatCalendarGrid({ days, products, today, onSelect }: FloatCalendarGridProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { language } = usePreferences();
  if (days.length === 0) return null;

  const leading = weekday(days[0].date);
  const cells: (CalendarDay | null)[] = [...Array.from({ length: leading }, () => null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const productById = new Map(products.map((product) => [product.id, product]));

  return (
    <View>
      <View style={styles.week} importantForAccessibility="no-hide-descendants">
        {weekdayInitials(language).map((label, i) => (
          <Text key={i} variant="caption" tone="muted" align="center" style={styles.weekCell}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`blank-${i}`} style={styles.cell} />;
          const product = day.best ? productById.get(day.best.productId) : undefined;
          const date = formatDate(day.date, language, { weekday: true, today });
          const { day: dayOfMonth } = parseLocalDate(day.date);
          return (
            <View key={day.date} style={styles.cell}>
              <Pressable
                onPress={() => {
                  haptics.selection();
                  onSelect(day);
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  product && day.best
                    ? t('optimizer.calendarA11y', {
                        date,
                        name: product.name,
                        days: day.best.floatDays,
                      })
                    : t('optimizer.calendarNone', { date })
                }
                style={({ pressed }) => [
                  styles.tile,
                  {
                    backgroundColor: product
                      ? mixHex(product.color, '#FFFFFF', 0.84)
                      : colors.surfaceMuted,
                  },
                  day.date === today && { borderColor: colors.primary },
                  pressed && styles.pressed,
                ]}>
                <Text variant="micro" tone="secondary" maxFontSizeMultiplier={1.2}>
                  {dayOfMonth}
                </Text>
                <RNText allowFontScaling={false} style={styles.emoji}>
                  {product?.emoji ?? '·'}
                </RNText>
                <Text variant="micro" weight="800" maxFontSizeMultiplier={1.2}>
                  {day.best ? day.best.floatDays : '–'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = ({ colors, radius }: Theme) =>
  StyleSheet.create({
    week: { flexDirection: 'row', marginBottom: 4 },
    weekCell: { flex: 1 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, padding: 2 },
    tile: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: 'transparent',
      gap: 1,
    },
    pressed: { opacity: 0.7 },
    emoji: { fontSize: 18, lineHeight: 22, color: colors.textMuted },
  });
