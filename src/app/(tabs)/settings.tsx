import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Appear } from '@/components/Appear';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ChipGroup } from '@/components/form/ChipGroup';
import { Icon } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { hasDemoData, loadDemoData, removeDemoData } from '@/db/demo';
import { CURRENCY_CODES, CURRENCIES, type CurrencyCode } from '@/domain/money';
import { notifyPermissionChanged } from '@/features/credit/ReminderSync';
import type { LanguagePreference } from '@/i18n';
import { formatHour } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import {
  getNotificationPermission,
  requestNotificationPermission,
  type PermissionState,
} from '@/lib/notifications';
import { useCreditData } from '@/state/creditData';
import { REMINDER_DAY_CHOICES, usePreferences } from '@/state/preferences';
import { useToast } from '@/state/toast';

const REMINDER_HOURS = [8, 9, 12, 18, 20];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { prefs, setPreference } = usePreferences();
  const { customTypes, today } = useCreditData();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [demoLoaded, setDemoLoaded] = useState(hasDemoData);

  useEffect(() => {
    void getNotificationPermission().then(setPermission);
  }, []);

  const switchColors = { false: colors.hairline, true: colors.primary };
  const reminders = prefs.reminders;

  const chooseCurrency = (code: CurrencyCode) => {
    haptics.selection();
    setPreference('homeCurrency', code);
    setCurrencyOpen(false);
  };

  const toggleReminders = async (enabled: boolean) => {
    setPreference('reminders', { ...reminders, enabled });
    if (!enabled) return;
    const granted = await requestNotificationPermission(t('reminders.channel'));
    setPermission(await getNotificationPermission());
    if (granted) notifyPermissionChanged();
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
            {t('settings.reminders')}
          </Text>
          <ListRow
            icon="notifications-outline"
            tone="sun"
            title={t('settings.remindersEnabled')}
            subtitle={t('settings.remindersHint')}
            trailing={
              <Switch
                accessibilityLabel={t('settings.remindersEnabled')}
                value={reminders.enabled}
                onValueChange={(value) => void toggleReminders(value)}
                trackColor={switchColors}
                ios_backgroundColor={colors.hairline}
                thumbColor={colors.surface}
              />
            }
          />
          {reminders.enabled ? (
            <>
              <View style={styles.field}>
                <Text variant="caption" tone="muted">
                  {t('settings.remindWhen')}
                </Text>
                <ChipGroup
                  multiple
                  accessibilityLabel={t('settings.remindWhen')}
                  value={reminders.daysBefore}
                  onChange={(daysBefore) =>
                    setPreference('reminders', {
                      ...reminders,
                      daysBefore: [...daysBefore].sort((a, b) => b - a),
                    })
                  }
                  options={REMINDER_DAY_CHOICES.map((days) => ({
                    value: days,
                    label:
                      days === 0
                        ? t('settings.onTheDay')
                        : t('settings.daysBefore', { count: days }),
                  }))}
                />
              </View>
              <View style={styles.field}>
                <Text variant="caption" tone="muted">
                  {t('settings.reminderTime')}
                </Text>
                <ChipGroup
                  accessibilityLabel={t('settings.reminderTime')}
                  value={reminders.hour}
                  onChange={(hour) => setPreference('reminders', { ...reminders, hour })}
                  options={REMINDER_HOURS.map((hour) => ({ value: hour, label: formatHour(hour) }))}
                />
              </View>
              {permission === 'denied' ? (
                <View style={styles.warning}>
                  <Icon name="alert-circle" size={18} color={colors.status.caution.text} />
                  <View style={styles.flex}>
                    <Text variant="caption" tone="caution">
                      {t('settings.permissionDenied')}
                    </Text>
                    <Pressable
                      onPress={() => void Linking.openSettings()}
                      accessibilityRole="button"
                      hitSlop={8}>
                      <Text variant="caption" tone="primary" weight="700">
                        {t('settings.openSystemSettings')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : permission === 'unsupported' ? (
                <Text variant="caption" tone="muted">
                  {t('settings.remindersUnsupported')}
                </Text>
              ) : null}
            </>
          ) : null}
        </Card>
      </Appear>

      <Appear index={2}>
        <Card style={styles.group}>
          <Text variant="micro" tone="muted">
            {t('settings.money')}
          </Text>
          <ListRow
            icon="cash-outline"
            tone="mint"
            title={t('settings.homeCurrency')}
            value={prefs.homeCurrency}
            onPress={() => setCurrencyOpen(true)}
          />
          <ListRow
            icon="swap-horizontal-outline"
            tone="sky"
            title={t('settings.exchangeRates')}
            subtitle={t('settings.exchangeRatesHint', { currency: prefs.homeCurrency })}
            onPress={() => router.push('/settings/fx')}
          />
          <ListRow
            icon="pricetags-outline"
            tone="pink"
            title={t('settings.productTypes')}
            subtitle={t('settings.productTypesHint')}
            value={customTypes.length > 0 ? String(customTypes.length) : undefined}
            onPress={() => router.push('/settings/types')}
          />
        </Card>
      </Appear>

      <Appear index={3}>
        <Card style={styles.group}>
          <Text variant="micro" tone="muted">
            {t('settings.data')}
          </Text>
          <ListRow
            icon="sparkles-outline"
            tone="violet"
            title={t('settings.loadDemo')}
            subtitle={t('settings.loadDemoHint')}
            onPress={() => {
              loadDemoData(today, prefs.homeCurrency);
              setDemoLoaded(true);
              haptics.success();
              toast({ message: t('settings.demoLoaded'), aboveTabBar: true });
            }}
          />
          {demoLoaded ? (
            <ListRow
              icon="trash-outline"
              tone="pink"
              title={t('settings.removeDemo')}
              subtitle={t('settings.removeDemoHint')}
              onPress={() => {
                removeDemoData();
                setDemoLoaded(false);
                haptics.warning();
                toast({ message: t('settings.demoRemoved'), aboveTabBar: true });
              }}
            />
          ) : null}
        </Card>
      </Appear>

      <Appear index={4}>
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
            <Text variant="caption" tone="muted" style={styles.flex}>
              {t('settings.privacyNote')}
            </Text>
          </View>
          <View style={styles.note}>
            <Icon name="information-circle-outline" size={16} color={colors.textMuted} />
            <Text variant="caption" tone="muted" style={styles.flex}>
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
        title={t('settings.homeCurrency')}
        footer={
          <Button
            label={t('settings.exchangeRates')}
            variant="ghost"
            fullWidth
            onPress={() => {
              setCurrencyOpen(false);
              router.push('/settings/fx');
            }}
          />
        }>
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
    flex: { flex: 1, gap: space.xs },
    warning: {
      flexDirection: 'row',
      gap: space.sm,
      alignItems: 'flex-start',
      padding: space.md,
      borderRadius: radius.sm,
      backgroundColor: colors.status.caution.soft,
    },
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
