import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Text } from '@/components/Text';
import { mixHex } from '@/design/color';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { PRODUCT_COLORS, PRODUCT_EMOJIS } from '@/domain/credit';
import { haptics } from '@/lib/haptics';

type PickerProps = { label: string; value: string; onChange: (value: string) => void };

/** Row of colour dots; the selected one gets a check. */
export function ColorPicker({ label, value, onChange }: PickerProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.field}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.wrap}>
        {PRODUCT_COLORS.map((color, index) => {
          const selected = color.toLowerCase() === value.toLowerCase();
          return (
            <Pressable
              key={color}
              onPress={() => {
                haptics.selection();
                onChange(color);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t('a11y.colorOption', { index: index + 1 })}
              hitSlop={4}
              style={[styles.dot, { backgroundColor: color }, selected && styles.dotSelected]}>
              {selected ? <Icon name="checkmark" size={18} color="#FFFFFF" /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Row of emoji tiles tinted with the product colour. */
export function EmojiPicker({ label, value, onChange, color }: PickerProps & { color: string }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.field}>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.wrap}>
        {PRODUCT_EMOJIS.map((emoji) => {
          const selected = emoji === value;
          return (
            <Pressable
              key={emoji}
              onPress={() => {
                haptics.selection();
                onChange(emoji);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={emoji}
              hitSlop={4}
              style={[
                styles.emoji,
                {
                  backgroundColor: selected ? mixHex(color, '#FFFFFF', 0.75) : colors.surfaceMuted,
                },
                selected && { borderColor: color },
              ]}>
              <RNText allowFontScaling={false} style={styles.emojiText}>
                {emoji}
              </RNText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = ({ colors, radius, space }: Theme) =>
  StyleSheet.create({
    field: { gap: space.sm },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    dot: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotSelected: {
      borderWidth: 3,
      borderColor: colors.surface,
      outlineWidth: 2,
      outlineColor: colors.text,
      outlineStyle: 'solid',
    },
    emoji: {
      width: 44,
      height: 44,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    emojiText: { fontSize: 22 },
  });
