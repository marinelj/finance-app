import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text as RNText, View, type StyleProp, type ViewStyle } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { DueBadge } from '@/components/DueBadge';
import { Text } from '@/components/Text';
import { cardPalette } from '@/design/color';
import { useStyles } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import type { DueInfo } from '@/domain/creditStatus';
import type { CurrencyCode } from '@/domain/money';
import { formatDate } from '@/lib/format';
import { usePreferences } from '@/state/preferences';

export const PRODUCT_CARD_HEIGHT = 196;

export type ProductCardProps = {
  name: string;
  issuer: string;
  typeLabel: string;
  emoji: string;
  color: string;
  currency: CurrencyCode;
  balance: number;
  due: DueInfo | null;
  isActive?: boolean;
  today: string;
  style?: StyleProp<ViewStyle>;
};

/** Card art: the product's colour as a gradient, its name, and what is due next. */
export function ProductCard({
  name,
  issuer,
  typeLabel,
  emoji,
  color,
  currency,
  balance,
  due,
  isActive = true,
  today,
  style,
}: ProductCardProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const { language } = usePreferences();
  const palette = cardPalette(color);
  const textColor = { color: palette.text };
  const softColor = { color: palette.textSoft };

  return (
    <LinearGradient
      colors={palette.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, !isActive && styles.closed, style]}>
      <View style={styles.top}>
        <View style={[styles.emoji, { backgroundColor: palette.chip }]}>
          <RNText allowFontScaling={false} style={styles.emojiText}>
            {emoji}
          </RNText>
        </View>
        <Text variant="caption" weight="700" numberOfLines={1} style={[styles.type, softColor]}>
          {typeLabel}
        </Text>
        {due && isActive ? <DueBadge daysLeft={due.daysLeft} size="sm" /> : null}
      </View>

      <View style={styles.names}>
        <Text variant="title" numberOfLines={1} style={textColor}>
          {name}
        </Text>
        {issuer ? (
          <Text variant="caption" numberOfLines={1} style={softColor}>
            {issuer}
          </Text>
        ) : null}
      </View>

      <View style={styles.bottom}>
        <Text variant="caption" weight="600" numberOfLines={1} style={[styles.dueText, softColor]}>
          {!isActive
            ? t('credit.closed')
            : due
              ? t('product.dueOn', { date: formatDate(due.dueDate, language, { today }) })
              : t('credit.nothingDue')}
        </Text>
        <AmountText
          value={due && isActive ? due.amount : balance}
          currency={currency}
          variant="title"
          style={textColor}
        />
      </View>
    </LinearGradient>
  );
}

const makeStyles = ({ radius, space, shadow }: Theme) =>
  StyleSheet.create({
    card: {
      height: PRODUCT_CARD_HEIGHT,
      borderRadius: radius.xl,
      padding: space.xl,
      justifyContent: 'space-between',
      overflow: 'hidden',
      boxShadow: shadow.raised,
    },
    closed: { opacity: 0.6 },
    top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    emoji: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiText: { fontSize: 20 },
    type: { flex: 1 },
    names: { gap: 2 },
    bottom: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
    dueText: { flex: 1, paddingBottom: 4 },
  });
