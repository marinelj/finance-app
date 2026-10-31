import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Appear } from '@/components/Appear';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DatePickerSheet } from '@/components/DatePickerSheet';
import { ChipGroup } from '@/components/form/ChipGroup';
import { FormSection } from '@/components/form/FormSection';
import { SelectField } from '@/components/form/SelectField';
import { SwitchRow } from '@/components/form/SwitchRow';
import { TextField } from '@/components/form/TextField';
import { Text } from '@/components/Text';
import { useStyles } from '@/design/theme';
import { space, type Theme } from '@/design/tokens';
import { saveWealthItem } from '@/db/wealth';
import { annualCouponIncome, couponDates } from '@/domain/bonds';
import { isLocalDate, type LocalDate } from '@/domain/dates';
import {
  CURRENCIES,
  CURRENCY_CODES,
  formatMoney,
  formatPercent,
  isCurrencyCode,
  roundTo,
  type CurrencyCode,
} from '@/domain/money';
import { asBond, asStock, bondYields, type BondInput, type StockInput } from '@/domain/portfolio';
import { annualDividendIncome, dividendYield, stockMarketValue } from '@/domain/stocks';
import {
  isVisible,
  toWealthRecord,
  validateWealthForm,
  WEALTH_FIELDS,
  type FieldSpec,
  type WealthFormValues,
  type WealthKind,
} from '@/domain/wealthForms';
import { useForm } from '@/hooks/useForm';
import { formatDate, formatMonthShort } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/state/preferences';
import { CONTENT_MAX_WIDTH, useCenteredGutter } from '@/lib/platform';

import { tKey } from './meta';

type WealthFormProps = {
  kind: WealthKind;
  initialValues: WealthFormValues;
  itemId: string | null;
  today: LocalDate;
  onSaved: () => void;
  onDelete?: () => void;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** One form for every kind of portfolio input, rendered from the kind's field specs. */
export function WealthForm({
  kind,
  initialValues,
  itemId,
  today,
  onSaved,
  onDelete,
}: WealthFormProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const gutter = useCenteredGutter(space.xl);
  const { language } = usePreferences();
  const form = useForm(initialValues, (values) => validateWealthForm(kind, values, today));
  const { values, set, errors } = form;
  const [dateField, setDateField] = useState<FieldSpec | null>(null);

  const currency: CurrencyCode = isCurrencyCode(String(values.currency))
    ? (values.currency as CurrencyCode)
    : 'CNY';
  const label = (spec: FieldSpec) => tKey(t, `wealth.fields.${spec.key}`);
  const hint = (spec: FieldSpec) => (spec.hint ? tKey(t, `wealth.hints.${spec.key}`) : undefined);
  const error = (spec: FieldSpec) =>
    errors[spec.key] ? tKey(t, `form.errors.${errors[spec.key]}`) : undefined;
  const text = (spec: FieldSpec) => String(values[spec.key] ?? '');
  const optional = (spec: FieldSpec) =>
    spec.required === true ? {} : { optional: true, optionalLabel: t('common.optional') };

  const renderField = (spec: FieldSpec) => {
    const common = { label: label(spec), error: error(spec), hint: hint(spec) };
    switch (spec.type) {
      case 'text':
      case 'notes':
        return (
          <TextField
            {...common}
            {...optional(spec)}
            value={text(spec)}
            onChangeText={(value) => set(spec.key, value)}
            placeholder={
              spec.placeholder ? tKey(t, `wealth.placeholders.${kind}.${spec.key}`) : undefined
            }
            maxLength={spec.maxLength}
            multiline={spec.type === 'notes'}
          />
        );
      case 'amount':
      case 'percent':
      case 'price':
      case 'number':
      case 'integer':
        return (
          <TextField
            {...common}
            {...optional(spec)}
            value={text(spec)}
            onChangeText={(value) => set(spec.key, value)}
            keyboardType={spec.type === 'integer' ? 'number-pad' : 'decimal-pad'}
            prefix={spec.type === 'amount' ? CURRENCIES[currency].symbol : undefined}
            suffix={spec.type === 'percent' || spec.type === 'price' ? '%' : undefined}
            placeholder={spec.type === 'price' ? '100' : '0'}
          />
        );
      case 'date':
        return (
          <SelectField
            {...common}
            value={isLocalDate(text(spec)) ? formatDate(text(spec), language, { year: true }) : ''}
            placeholder={t('form.notSet')}
            icon="calendar-outline"
            onPress={() => setDateField(spec)}
          />
        );
      case 'month':
        return (
          <View style={styles.group}>
            <Text variant="caption" tone="muted">
              {label(spec)}
            </Text>
            <ChipGroup
              accessibilityLabel={label(spec)}
              value={text(spec)}
              onChange={(value) => set(spec.key, value)}
              options={[
                { value: '', label: '—' },
                ...MONTHS.map((month) => ({
                  value: String(month),
                  label: formatMonthShort(month, language),
                })),
              ]}
            />
            {common.error || common.hint ? (
              <Text variant="caption" tone={common.error ? 'danger' : 'muted'}>
                {common.error ?? common.hint}
              </Text>
            ) : null}
          </View>
        );
      case 'select':
        return (
          <View style={styles.group}>
            <Text variant="caption" tone="muted">
              {label(spec)}
            </Text>
            <ChipGroup
              accessibilityLabel={label(spec)}
              value={text(spec)}
              onChange={(value) => set(spec.key, value)}
              options={(spec.options ?? []).map((value) => ({
                value,
                label: tKey(t, `wealth.options.${spec.optionSet}.${value}`),
              }))}
            />
          </View>
        );
      case 'switch':
        return (
          <SwitchRow
            label={label(spec)}
            hint={hint(spec)}
            value={values[spec.key] === true}
            onChange={(value) => set(spec.key, value)}
          />
        );
      case 'currency':
        return (
          <View style={styles.group}>
            <Text variant="caption" tone="muted">
              {label(spec)}
            </Text>
            <ChipGroup
              accessibilityLabel={label(spec)}
              value={currency}
              onChange={(code) => set(spec.key, code)}
              options={CURRENCY_CODES.map((code) => ({ value: code, label: code }))}
            />
          </View>
        );
    }
  };

  const preview = previewLines(kind, values, today, {
    t,
    money: (amount) => formatMoney(amount, currency, { locale: language }),
    date: (value) => formatDate(value, language, { today, year: true }),
  });

  const save = () => {
    form.submit((valid) => {
      saveWealthItem(kind, itemId, toWealthRecord(kind, valid));
      haptics.success();
      onSaved();
    });
  };

  const specs = WEALTH_FIELDS[kind].filter((spec) => isVisible(spec, values));
  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={process.env.EXPO_OS === 'ios' ? 64 : 0}
      style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        {preview.length > 0 ? (
          <Appear index={0}>
            <Card variant="tinted" tone="mint" padding="lg" style={styles.group}>
              {preview.map((line) => (
                <Text key={line} variant="callout" weight="600">
                  {line}
                </Text>
              ))}
            </Card>
          </Appear>
        ) : null}
        <Appear index={1}>
          <FormSection title={tKey(t, `wealth.sections.${kind}`)}>
            {specs.map((spec) => (
              <View key={spec.key}>{renderField(spec)}</View>
            ))}
          </FormSection>
        </Appear>
        {onDelete ? (
          <Button
            label={t('common.delete')}
            icon="trash-outline"
            variant="danger"
            fullWidth
            onPress={onDelete}
          />
        ) : null}
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + 12, paddingHorizontal: gutter }]}>
        {form.submitted && !form.isValid ? (
          <Text variant="caption" tone="danger" align="center" accessibilityLiveRegion="polite">
            {t('form.fixErrors')}
          </Text>
        ) : null}
        <Button label={t('common.save')} size="lg" fullWidth onPress={save} haptic={false} />
      </View>

      <DatePickerSheet
        visible={dateField != null}
        title={dateField ? label(dateField) : ''}
        value={dateField && isLocalDate(text(dateField)) ? text(dateField) : null}
        today={today}
        onChange={(date) => {
          if (dateField) set(dateField.key, date);
        }}
        onClear={
          dateField && dateField.required !== true ? () => set(dateField.key, '') : undefined
        }
        onClose={() => setDateField(null)}
      />
    </KeyboardAvoidingView>
  );
}

/** Live numbers for bonds and stocks while their form is filled in. */
function previewLines(
  kind: WealthKind,
  values: WealthFormValues,
  today: LocalDate,
  format: {
    t: TFunction;
    money: (amount: number) => string;
    date: (value: LocalDate) => string;
  }
): string[] {
  const { t, money, date } = format;
  if (kind !== 'bond' && kind !== 'stock') return [];
  if (Object.keys(validateWealthForm(kind, values, today)).length > 0) return [];
  const record = toWealthRecord(kind, values);
  if (kind === 'bond') {
    const input = record as unknown as BondInput;
    const bond = asBond(input);
    const yields = bondYields(input, today);
    const next = couponDates(bond, today).find((day) => day > today);
    return [
      yields.atPurchase != null
        ? t('wealth.detail.ytmBought', { value: roundTo(yields.atPurchase, 2) })
        : null,
      yields.atCurrentPrice != null
        ? t('wealth.detail.ytmNow', { value: roundTo(yields.atCurrentPrice, 2) })
        : null,
      bond.couponFrequency > 0
        ? t('wealth.detail.couponsPerYear', { amount: money(annualCouponIncome(bond)) })
        : null,
      next ? t('wealth.detail.nextCoupon', { date: date(next) }) : null,
    ].filter((line): line is string => line != null);
  }
  const holding = asStock(record as unknown as StockInput);
  const income = annualDividendIncome(holding);
  const rate = dividendYield(holding);
  return [
    t('wealth.detail.worth', { amount: money(stockMarketValue(holding)) }),
    income > 0 ? t('wealth.detail.dividendsPerYear', { amount: money(income) }) : null,
    rate != null && rate > 0
      ? t('wealth.detail.yield', { value: formatPercent(rate, { decimals: 2 }) })
      : null,
  ].filter((line): line is string => line != null);
}

const makeStyles = ({ colors, space }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: space.xl,
      gap: space.lg,
      paddingBottom: space.huge,
      width: '100%',
      maxWidth: CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    group: { gap: space.sm },
    footer: {
      gap: space.sm,
      paddingTop: space.md,
      paddingHorizontal: space.xl,
      backgroundColor: colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
    },
  });
