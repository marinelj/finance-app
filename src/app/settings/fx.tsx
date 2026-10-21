import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/form/TextField';
import { Text } from '@/components/Text';
import { useStyles } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { resetFxTable, saveFxTable } from '@/db/fx';
import { rate, withRateToHome, type FxTable } from '@/domain/fx';
import { CURRENCIES, CURRENCY_CODES, roundTo, type CurrencyCode } from '@/domain/money';
import { parseDecimal, toInputText } from '@/domain/numberInput';
import { haptics } from '@/lib/haptics';
import { useCreditData } from '@/state/creditData';
import { usePreferences } from '@/state/preferences';
import { useToast } from '@/state/toast';

/** Hand-entered exchange rates, shown as "1 USD in CNY" against the home currency. */
export default function ExchangeRatesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { prefs } = usePreferences();
  const { fx } = useCreditData();
  const home = prefs.homeCurrency;
  const others = CURRENCY_CODES.filter((code) => code !== home);

  const initial = () =>
    Object.fromEntries(
      others.map((code) => [code, toInputText(roundTo(rate(code, home, fx), 4))])
    ) as Record<CurrencyCode, string>;
  const [texts, setTexts] = useState(initial);
  const [submitted, setSubmitted] = useState(false);

  const invalid = others.filter((code) => {
    const value = parseDecimal(texts[code] ?? '');
    return value == null || Number.isNaN(value) || value <= 0;
  });

  const save = () => {
    setSubmitted(true);
    if (invalid.length > 0) {
      haptics.error();
      return;
    }
    let table: FxTable = { ...fx };
    for (const code of others) {
      const before = roundTo(rate(code, home, fx), 4);
      const value = parseDecimal(texts[code]) as number;
      if (value !== before) table = withRateToHome(table, code, home, value);
    }
    // Pin the home currency's own entry so later edits stay relative to the same base.
    if (table[home] == null) table = { ...table, [home]: rate('USD', home, fx) };
    saveFxTable(table);
    haptics.success();
    toast({ message: t('form.saved') });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={process.env.EXPO_OS === 'ios' ? 64 : 0}
      style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="callout" tone="secondary">
          {t('fx.intro', { currency: home })}
        </Text>
        <Card style={styles.card}>
          {others.map((code) => (
            <TextField
              key={code}
              label={t('fx.perUnit', { code, home })}
              value={texts[code] ?? ''}
              onChangeText={(text) => setTexts((current) => ({ ...current, [code]: text }))}
              keyboardType="decimal-pad"
              prefix={CURRENCIES[home].symbol}
              optional={fx[code] == null}
              optionalLabel={t('fx.isDefault')}
              error={submitted && invalid.includes(code) ? t('fx.invalid') : undefined}
            />
          ))}
        </Card>
        <Button
          label={t('fx.reset')}
          variant="ghost"
          icon="refresh"
          onPress={() => {
            resetFxTable();
            haptics.success();
            toast({ message: t('fx.resetDone') });
            router.back();
          }}
          style={styles.center}
        />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button label={t('common.save')} size="lg" fullWidth onPress={save} haptic={false} />
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = ({ colors, space }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { padding: space.xl, gap: space.lg },
    card: { gap: space.md },
    center: { alignSelf: 'center' },
    footer: {
      paddingTop: space.md,
      paddingHorizontal: space.xl,
      backgroundColor: colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
    },
  });
