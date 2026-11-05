import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Appear } from '@/components/Appear';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DatePickerSheet } from '@/components/DatePickerSheet';
import { DayPickerSheet } from '@/components/DayPickerSheet';
import { ChipGroup } from '@/components/form/ChipGroup';
import { FormSection } from '@/components/form/FormSection';
import { SelectField } from '@/components/form/SelectField';
import { SwitchRow } from '@/components/form/SwitchRow';
import { TextField } from '@/components/form/TextField';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Text } from '@/components/Text';
import { useStyles } from '@/design/theme';
import { space, type Theme } from '@/design/tokens';
import { saveProduct } from '@/db/credit';
import {
  aprPercent,
  dailyRatePercent,
  REPAYMENT_METHODS,
  type Installment,
  type RateUnit,
} from '@/domain/credit';
import { nextDue } from '@/domain/creditStatus';
import type { LocalDate } from '@/domain/dates';
import { totalInterest } from '@/domain/loans';
import { CURRENCIES, CURRENCY_CODES, formatMoney, roundTo } from '@/domain/money';
import { parseDecimal } from '@/domain/numberInput';
import {
  isLoanKind,
  previewSchedule,
  toProductFields,
  validateProductForm,
  type ProductFields,
  type ProductFormField,
  type ProductFormValues,
} from '@/domain/productForm';
import { useForm } from '@/hooks/useForm';
import type { Translation } from '@/i18n/locales/en';
import { formatDate } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/state/preferences';
import { CONTENT_MAX_WIDTH, useCenteredGutter } from '@/lib/platform';

import { ColorPicker, EmojiPicker } from './AppearancePickers';
import { dayValueLabel } from './labels';
import { ProductCard } from './ProductCard';

type ErrorKey = keyof Translation['form']['errors'];

export type ExistingProduct = {
  id: string;
  product: ProductFields;
  installments: Installment[];
};

type ProductFormProps = {
  initialValues: ProductFormValues;
  existing?: ExistingProduct;
  typeLabel: string;
  today: LocalDate;
  onSaved: (id: string) => void;
};

type DayField = 'statementDay' | 'dueDay' | 'repaymentDay';

/** Add/edit form for every kind of credit product, with a live preview of the card. */
export function ProductForm({
  initialValues,
  existing,
  typeLabel,
  today,
  onSaved,
}: ProductFormProps) {
  const { t } = useTranslation();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const gutter = useCenteredGutter(space.xl);
  const { language } = usePreferences();
  const form = useForm(initialValues, validateProductForm);
  const { values, set, errors } = form;
  const [dayField, setDayField] = useState<DayField | null>(null);
  const [startDateOpen, setStartDateOpen] = useState(false);

  const loan = isLoanKind(values.kind);
  const scheduled = loan && values.useSchedule;
  const symbol = CURRENCIES[values.currency].symbol;
  const money = (amount: number) => formatMoney(amount, values.currency, { locale: language });
  const error = (field: ProductFormField) => {
    const key = errors[field] as ErrorKey | undefined;
    return key ? t(`form.errors.${key}`) : undefined;
  };
  const optional = { optional: true, optionalLabel: t('common.optional') };

  // Live preview: the due date the saved product would show.
  const preview = (() => {
    try {
      const { fields, schedule } = toProductFields(values, today, existing);
      const items: Installment[] = schedule
        ? schedule.installments.map((item, i) => ({ ...item, id: `p${i}`, productId: 'preview' }))
        : (existing?.installments ?? []);
      return { fields, due: nextDue({ id: 'preview', ...fields }, items, today) };
    } catch {
      return null;
    }
  })();

  const schedule = previewSchedule(values);
  const scheduleOwed = schedule
    ? (schedule.filter((item) => item.dueDate < today).at(-1)?.remaining ??
      parseDecimal(values.loanPrincipal) ??
      0)
    : null;

  const rate = parseDecimal(values.interestRate);
  const rateHint =
    rate != null && !Number.isNaN(rate) && rate > 0
      ? values.interestRateUnit === 'daily'
        ? t('form.rateAsApr', {
            apr: roundTo(aprPercent(rate, 'daily') ?? 0, 2),
          })
        : t('form.rateAsDaily', {
            daily: roundTo(dailyRatePercent(rate, 'apr') ?? 0, 4),
          })
      : undefined;

  const save = () => {
    form.submit((valid) => {
      const result = toProductFields(valid, today, existing);
      const id = saveProduct(existing?.id ?? null, result);
      haptics.success();
      onSaved(id);
    });
  };

  const amountField = (
    field: 'creditLimit' | 'balance' | 'statementBalance' | 'minimumPayment' | 'annualFee',
    label: string,
    extra: { hint?: string; optional?: boolean } = {}
  ) => (
    <TextField
      label={label}
      value={values[field]}
      onChangeText={(text) => set(field, text)}
      keyboardType="decimal-pad"
      prefix={symbol}
      placeholder="0"
      error={error(field)}
      hint={extra.hint}
      {...(extra.optional ? optional : {})}
    />
  );

  const rateFields = (
    <View style={styles.group}>
      <TextField
        label={t('form.interestRate')}
        value={values.interestRate}
        onChangeText={(text) => set('interestRate', text)}
        keyboardType="decimal-pad"
        suffix="%"
        placeholder={values.interestRateUnit === 'daily' ? '0.05' : '18'}
        error={error('interestRate')}
        hint={rateHint}
        {...(scheduled ? {} : optional)}
      />
      <SegmentedControl<RateUnit>
        accessibilityLabel={t('form.interestRate')}
        value={values.interestRateUnit}
        onChange={(unit) => set('interestRateUnit', unit)}
        options={[
          { value: 'apr', label: t('rateUnits.apr') },
          { value: 'daily', label: t('rateUnits.daily') },
        ]}
      />
    </View>
  );

  let section = 0;
  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={process.env.EXPO_OS === 'ios' ? 64 : 0}
      style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        <Appear index={section++}>
          <ProductCard
            name={values.name.trim() || typeLabel}
            issuer={values.issuer.trim()}
            typeLabel={typeLabel}
            emoji={values.emoji}
            color={values.color}
            currency={values.currency}
            balance={preview?.fields.balance ?? 0}
            due={preview?.due ?? null}
            isActive={values.isActive}
            today={today}
          />
        </Appear>

        <Appear index={section++}>
          <FormSection title={t('form.basics')}>
            <TextField
              label={t('form.name')}
              value={values.name}
              onChangeText={(text) => set('name', text)}
              placeholder={t('form.namePlaceholder')}
              error={error('name')}
              maxLength={40}
            />
            <TextField
              label={t('form.issuer')}
              value={values.issuer}
              onChangeText={(text) => set('issuer', text)}
              placeholder={t('form.issuerPlaceholder')}
              maxLength={40}
              {...optional}
            />
            <Text variant="caption" tone="muted">
              {t('form.currency')}
            </Text>
            <ChipGroup
              accessibilityLabel={t('form.currency')}
              value={values.currency}
              onChange={(code) => set('currency', code)}
              options={CURRENCY_CODES.map((code) => ({ value: code, label: code }))}
            />
            <EmojiPicker
              label={t('form.icon')}
              value={values.emoji}
              onChange={(emoji) => set('emoji', emoji)}
              color={values.color}
            />
            <ColorPicker
              label={t('form.color')}
              value={values.color}
              onChange={(color) => set('color', color)}
            />
          </FormSection>
        </Appear>

        {loan ? (
          <Appear index={section++}>
            <FormSection title={t('form.loan')}>
              <SwitchRow
                label={t('form.useSchedule')}
                hint={t('form.useScheduleHint')}
                value={values.useSchedule}
                onChange={(on) => set('useSchedule', on)}
              />
              {scheduled ? (
                <>
                  <TextField
                    label={t('form.loanPrincipal')}
                    value={values.loanPrincipal}
                    onChangeText={(text) => set('loanPrincipal', text)}
                    keyboardType="decimal-pad"
                    prefix={symbol}
                    placeholder="0"
                    error={error('loanPrincipal')}
                  />
                  <SelectField
                    label={t('form.loanStartDate')}
                    value={formatDate(values.loanStartDate, language, { year: true })}
                    icon="calendar-outline"
                    onPress={() => setStartDateOpen(true)}
                    error={error('loanStartDate')}
                  />
                  <TextField
                    label={t('form.loanTermMonths')}
                    value={values.loanTermMonths}
                    onChangeText={(text) => set('loanTermMonths', text)}
                    keyboardType="number-pad"
                    placeholder="12"
                    error={error('loanTermMonths')}
                  />
                  {rateFields}
                  <Text variant="caption" tone="muted">
                    {t('form.repaymentMethod')}
                  </Text>
                  <ChipGroup
                    accessibilityLabel={t('form.repaymentMethod')}
                    value={values.repaymentMethod}
                    onChange={(method) => set('repaymentMethod', method)}
                    options={REPAYMENT_METHODS.map((method) => ({
                      value: method,
                      label: t(`repaymentMethods.${method}`),
                    }))}
                  />
                  <SelectField
                    label={t('form.repaymentDay')}
                    value={dayValueLabel(values.repaymentDay, t)}
                    placeholder={t('form.notSet')}
                    hint={t('form.repaymentDayHint')}
                    onPress={() => setDayField('repaymentDay')}
                  />
                  {schedule && schedule.length > 0 ? (
                    <Card variant="tinted" tone="mint" padding="lg" style={styles.group}>
                      <Text variant="callout" weight="600">
                        {t('form.scheduleSummary', {
                          count: schedule.length,
                          first: money(schedule[0].amount),
                          interest: money(totalInterest(schedule)),
                        })}
                      </Text>
                      <Text variant="caption" tone="secondary">
                        {t('form.scheduleBalance', { amount: money(scheduleOwed ?? 0) })}
                      </Text>
                    </Card>
                  ) : null}
                </>
              ) : (
                <>
                  {amountField('balance', t('form.balance'), { hint: t('form.balanceHint') })}
                  {amountField('minimumPayment', t('form.monthlyPayment'), { optional: true })}
                  <SelectField
                    label={t('form.repaymentDay')}
                    value={dayValueLabel(values.repaymentDay, t)}
                    placeholder={t('form.notSet')}
                    onPress={() => setDayField('repaymentDay')}
                  />
                  {rateFields}
                </>
              )}
              {amountField('creditLimit', t('form.creditLimit'), { optional: true })}
            </FormSection>
          </Appear>
        ) : (
          <>
            <Appear index={section++}>
              <FormSection title={t('form.amounts')}>
                {amountField('creditLimit', t('form.creditLimit'), { optional: true })}
                {amountField('balance', t('form.balance'), { hint: t('form.balanceHint') })}
                {amountField('statementBalance', t('form.statementBalance'), {
                  hint: t('form.statementBalanceHint'),
                  optional: true,
                })}
                {amountField('minimumPayment', t('form.minimumPayment'), { optional: true })}
              </FormSection>
            </Appear>

            <Appear index={section++}>
              <FormSection
                title={values.kind === 'other' ? t('form.cycleOptional') : t('form.cycle')}>
                <SelectField
                  label={t('form.statementDay')}
                  value={dayValueLabel(values.statementDay, t)}
                  placeholder={t('form.notSet')}
                  onPress={() => setDayField('statementDay')}
                  error={error('statementDay')}
                />
                <Text variant="caption" tone="muted">
                  {t('form.dueRule')}
                </Text>
                <SegmentedControl
                  accessibilityLabel={t('form.dueRule')}
                  value={values.dueRule}
                  onChange={(rule) => set('dueRule', rule)}
                  options={[
                    { value: 'fixed_day', label: t('dueRules.fixed_day') },
                    { value: 'days_after_statement', label: t('dueRules.days_after_statement') },
                  ]}
                />
                {values.dueRule === 'fixed_day' ? (
                  <SelectField
                    label={t('form.dueDay')}
                    value={dayValueLabel(values.dueDay, t)}
                    placeholder={t('form.notSet')}
                    onPress={() => setDayField('dueDay')}
                    error={error('dueDay')}
                  />
                ) : (
                  <TextField
                    label={t('form.dueDaysAfterStatement')}
                    value={values.dueDaysAfterStatement}
                    onChangeText={(text) => set('dueDaysAfterStatement', text)}
                    keyboardType="number-pad"
                    placeholder="25"
                    error={error('dueDaysAfterStatement')}
                  />
                )}
              </FormSection>
            </Appear>

            <Appear index={section++}>
              <FormSection title={t('form.interest')}>
                <SwitchRow
                  label={t('form.hasGracePeriod')}
                  hint={t('form.hasGracePeriodHint')}
                  value={values.hasGracePeriod}
                  onChange={(on) => set('hasGracePeriod', on)}
                />
                {values.hasGracePeriod ? (
                  <TextField
                    label={t('form.graceNote')}
                    value={values.graceNote}
                    onChangeText={(text) => set('graceNote', text)}
                    placeholder={t('form.graceNotePlaceholder')}
                    maxLength={60}
                    {...optional}
                  />
                ) : null}
                {rateFields}
                {amountField('annualFee', t('form.annualFee'), { optional: true })}
                <TextField
                  label={t('form.feeWaiver')}
                  value={values.feeWaiver}
                  onChangeText={(text) => set('feeWaiver', text)}
                  placeholder={t('form.feeWaiverPlaceholder')}
                  maxLength={80}
                  {...optional}
                />
              </FormSection>
            </Appear>
          </>
        )}

        <Appear index={section++}>
          <FormSection title={t('form.more')}>
            <TextField
              label={t('form.notes')}
              value={values.notes}
              onChangeText={(text) => set('notes', text)}
              multiline
              maxLength={500}
              {...optional}
            />
            {existing ? (
              <SwitchRow
                label={t('form.active')}
                hint={t('form.activeHint')}
                value={values.isActive}
                onChange={(on) => set('isActive', on)}
              />
            ) : null}
          </FormSection>
        </Appear>
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

      <DayPickerSheet
        visible={dayField != null}
        title={dayField ? t(`form.${dayField}`) : ''}
        value={dayField ? values[dayField] : null}
        allowClear={dayField !== 'statementDay' || values.kind === 'other'}
        onChange={(day) => {
          if (dayField) set(dayField, day);
        }}
        onClose={() => setDayField(null)}
      />
      <DatePickerSheet
        visible={startDateOpen}
        title={t('form.loanStartDate')}
        value={values.loanStartDate}
        today={today}
        onChange={(date) => set('loanStartDate', date)}
        onClose={() => setStartDateOpen(false)}
      />
    </KeyboardAvoidingView>
  );
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
