import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { haptics } from '@/lib/haptics';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Text } from './Text';

type DayPickerSheetProps = {
  visible: boolean;
  title: string;
  value: number | null;
  onChange: (day: number | null) => void;
  onClose: () => void;
  /** Offer a "clear" button for optional fields. */
  allowClear?: boolean;
};

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Day-of-month grid (1–31) for statement, due and repayment days. */
export function DayPickerSheet({
  visible,
  title,
  value,
  onChange,
  onClose,
  allowClear,
}: DayPickerSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const choose = (day: number | null) => {
    haptics.selection();
    onChange(day);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        allowClear && value != null ? (
          <Button
            label={t('common.clear')}
            variant="ghost"
            fullWidth
            onPress={() => choose(null)}
          />
        ) : undefined
      }>
      <View accessibilityRole="radiogroup" style={styles.grid}>
        {DAYS.map((day) => {
          const selected = day === value;
          return (
            <Pressable
              key={day}
              onPress={() => choose(day)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={day === 31 ? `31, ${t('form.lastDay')}` : String(day)}
              style={({ pressed }) => [
                styles.cell,
                selected && { backgroundColor: colors.primary },
                pressed && !selected && styles.pressed,
              ]}>
              <Text
                variant="headline"
                tone={selected ? 'onPrimary' : 'default'}
                maxFontSizeMultiplier={1.4}>
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text variant="caption" tone="muted">
        {t('form.day31Hint')}
      </Text>
    </BottomSheet>
  );
}

const makeStyles = ({ colors, radius, space }: Theme) =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
    cell: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    pressed: { backgroundColor: colors.hairline },
  });
