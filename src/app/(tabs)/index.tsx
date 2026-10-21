import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { Appear } from '@/components/Appear';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { SectionHeader } from '@/components/SectionHeader';
import { Screen } from '@/components/Screen';
import { StatTile } from '@/components/StatTile';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { dayPart, formatLongDate } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/state/preferences';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { prefs, language, setPreference } = usePreferences();
  const now = new Date();
  const currency = prefs.homeCurrency;

  const privacyToggle = (
    <Pressable
      onPress={() => {
        haptics.selection();
        setPreference('hideAmounts', !prefs.hideAmounts);
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={prefs.hideAmounts ? t('home.showAmounts') : t('home.hideAmounts')}
      style={styles.iconButton}>
      <Icon
        name={prefs.hideAmounts ? 'eye-off-outline' : 'eye-outline'}
        size={22}
        color={colors.textSecondary}
      />
    </Pressable>
  );

  return (
    <Screen
      withTabBar
      eyebrow={formatLongDate(now, language)}
      title={t(`greeting.${dayPart(now.getHours())}`)}
      right={privacyToggle}>
      <Appear index={0}>
        <Card variant="gradient" padding="xxl" style={styles.hero}>
          <Text variant="callout" tone="onPrimary" style={styles.heroLabel}>
            {t('home.totalOwed')}
          </Text>
          <AmountText value={0} currency={currency} variant="hero" tone="onPrimary" animate />
          <Text variant="caption" tone="onPrimary" style={styles.heroLabel}>
            {t('home.noProducts')}
          </Text>
        </Card>
      </Appear>

      <Appear index={1} style={styles.row}>
        <StatTile
          style={styles.tile}
          emoji="🗓️"
          tone="sun"
          label={t('home.dueThisMonth')}
          value={<AmountText value={0} currency={currency} variant="title" animate />}
        />
        <StatTile
          style={styles.tile}
          emoji="⏰"
          tone="pink"
          label={t('home.nextDue')}
          value="—"
          caption={t('home.nothingDue')}
        />
      </Appear>

      <Appear index={2}>
        <Card style={styles.gap}>
          <SectionHeader title={t('home.bestCardToday')} />
          <Text tone="secondary">{t('home.bestCardEmpty')}</Text>
        </Card>
      </Appear>

      <Appear index={3}>
        <Card>
          <EmptyState emoji="🧭" title={t('home.emptyTitle')} message={t('home.emptyMessage')} />
        </Card>
      </Appear>
    </Screen>
  );
}

const makeStyles = ({ colors, radius, space, shadow }: Theme) =>
  StyleSheet.create({
    hero: { gap: space.xs },
    heroLabel: { opacity: 0.9 },
    row: { flexDirection: 'row', gap: space.md },
    tile: { flex: 1 },
    gap: { gap: space.sm },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      boxShadow: shadow.card,
    },
  });
