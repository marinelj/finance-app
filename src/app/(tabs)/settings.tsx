import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Appear } from '@/components/Appear';
import { BottomSheet } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { CURRENCY_CODES, CURRENCIES, type CurrencyCode } from '@/domain/money';
import type { LanguagePreference } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/state/preferences';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { prefs, setPreference } = usePreferences();
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const switchColors = { false: colors.hairline, true: colors.primary };

  const chooseCurrency = (code: CurrencyCode) => {
    haptics.selection();
    setPreference('homeCurrency', code);
    setCurrencyOpen(false);
  };

  return (
    <Screen withTabBar title={t('settings.title')}>
      <Appear index={0}>
        <Card style={styles.group}>
          <Text variant="micro" tone="muted">
            {t('settings.preferences')}
          </Text>
          <View style={styles.field}>
            <Text variant="body" weight="600">
              {t('settings.language')}
            </Text>
            <SegmentedControl<LanguagePreference>
              accessibilityLabel={t('settings.language')}
              value={prefs.language}
              onChange={(value) => setPreference('language', value)}
              options={[
                { value: 'system', label: t('settings.languageSystem') },
                { value: 'en', label: 'English' },
                { value: 'zh-Hans', label: '简体中文' },
              ]}
            />
          </View>
          <ListRow
            icon="cash-outline"
            tone="mint"
            title={t('settings.homeCurrency')}
            value={prefs.homeCurrency}
            onPress={() => setCurrencyOpen(true)}
          />
          <ListRow
            icon="eye-off-outline"
            tone="violet"
            title={t('settings.hideAmounts')}
            subtitle={t('settings.hideAmountsHint')}
            trailing={
              <Switch
                accessibilityLabel={t('settings.hideAmounts')}
                value={prefs.hideAmounts}
                onValueChange={(value) => setPreference('hideAmounts', value)}
                trackColor={switchColors}
                ios_backgroundColor={colors.hairline}
                thumbColor={colors.surface}
              />
            }
          />
          <ListRow
            icon="pulse-outline"
            tone="pink"
            title={t('settings.haptics')}
            trailing={
              <Switch
                accessibilityLabel={t('settings.haptics')}
                value={prefs.haptics}
                onValueChange={(value) => setPreference('haptics', value)}
                trackColor={switchColors}
                ios_backgroundColor={colors.hairline}
                thumbColor={colors.surface}
              />
            }
          />
        </Card>
      </Appear>

      <Appear index={1}>
        <Card style={styles.group}>
          <Text variant="micro" tone="muted">
            {t('settings.about')}
          </Text>
          <ListRow
            icon="color-palette-outline"
            tone="sun"
            title={t('settings.designSystem')}
            subtitle={t('settings.designSystemHint')}
            onPress={() => router.push('/design-system')}
          />
          <View style={styles.note}>
            <Icon name="lock-closed-outline" size={16} color={colors.textMuted} />
            <Text variant="caption" tone="muted" style={styles.noteText}>
              {t('settings.privacyNote')}
            </Text>
          </View>
          <View style={styles.note}>
            <Icon name="information-circle-outline" size={16} color={colors.textMuted} />
            <Text variant="caption" tone="muted" style={styles.noteText}>
              {t('settings.disclaimer')}
            </Text>
          </View>
          <Text variant="caption" tone="muted">
            {t('settings.version', { version: Constants.expoConfig?.version ?? '—' })}
          </Text>
        </Card>
      </Appear>

      <BottomSheet
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
        title={t('settings.homeCurrency')}>
        <View accessibilityRole="radiogroup">
          {CURRENCY_CODES.map((code) => {
            const selected = code === prefs.homeCurrency;
            return (
              <Pressable
                key={code}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={code}
                onPress={() => chooseCurrency(code)}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
                <Text variant="body" weight="600" style={styles.optionCode}>
                  {code}
                </Text>
                <Text variant="callout" tone="muted" style={styles.optionSymbol}>
                  {CURRENCIES[code].symbol}
                </Text>
                {selected ? (
                  <Icon name="checkmark-circle" size={22} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </Screen>
  );
}

const makeStyles = ({ colors, radius, space }: Theme) =>
  StyleSheet.create({
    group: { gap: space.sm },
    field: { gap: space.sm, paddingVertical: space.sm },
    note: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
    noteText: { flex: 1 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 52,
      paddingHorizontal: space.md,
      borderRadius: radius.sm,
      gap: space.md,
    },
    optionPressed: { backgroundColor: colors.surfaceMuted },
    optionCode: { width: 56 },
    optionSymbol: { flex: 1 },
  });
