import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { DatePickerSheet } from '@/components/DatePickerSheet';
import { SelectField } from '@/components/form/SelectField';
import { SwitchRow } from '@/components/form/SwitchRow';
import { TextField } from '@/components/form/TextField';
import { Text } from '@/components/Text';
import { recordPayment } from '@/db/credit';
import type { CreditProductRow, InstallmentRow } from '@/db/schema';
import type { DueInfo } from '@/domain/creditStatus';
import type { LocalDate } from '@/domain/dates';
import { CURRENCIES, formatMoney, roundMoney } from '@/domain/money';
import { parseDecimal, toInputText } from '@/domain/numberInput';
import { suggestedPayment } from '@/domain/payments';
import { formatDate } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { usePreferences } from '@/state/preferences';

type PaymentSheetProps = {
  visible: boolean;
  onClose: () => void;
  product: CreditProductRow;
  due: DueInfo | null;
  installment: InstallmentRow | null;
  installmentCount: number;
  today: LocalDate;
  /** Called with the new payment's id after it is saved. */
  onPaid: (paymentId: string) => void;
};

/** "Mark as paid": amount (prefilled with what is due), date, and whether it settles the bill. */
export function PaymentSheet(props: PaymentSheetProps) {
  // A fresh form each time the sheet opens, so the fields start from the current due; the key
  // stays put while closing so the exit animation still plays.
  const [session, setSession] = useState(0);
  const [wasVisible, setWasVisible] = useState(props.visible);
  if (props.visible !== wasVisible) {
    setWasVisible(props.visible);
    if (props.visible) setSession((value) => value + 1);
  }
  return <PaymentSheetContent key={session} {...props} />;
}

function PaymentSheetContent({
  visible,
  onClose,
  product,
  due,
  installment,
  installmentCount,
  today,
  onPaid,
}: PaymentSheetProps) {
  const { t } = useTranslation();
  const { language } = usePreferences();
  const suggested = suggestedPayment(product, due);
  const [amountText, setAmountText] = useState(toInputText(suggested, 2));
  const [date, setDate] = useState<LocalDate>(today);
  const [settles, setSettles] = useState(true);
  const [note, setNote] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const amount = parseDecimal(amountText);
  const dueAmount = due ? roundMoney(due.amount, product.currency) : null;

  const onAmountChange = (text: string) => {
    setAmountText(text);
    setError(undefined);
    const value = parseDecimal(text);
    if (dueAmount != null && value != null && !Number.isNaN(value)) setSettles(value >= dueAmount);
  };

  const confirm = () => {
    if (amount == null || Number.isNaN(amount) || amount <= 0) {
      haptics.error();
      setError(amount == null ? t('form.errors.required') : t('form.errors.positive'));
      return;
    }
    const id = recordPayment(product, due, installment, {
      amount,
      date,
      settlesDue: settles,
      note,
    });
    haptics.success();
    onPaid(id);
    onClose();
  };

  const title = installment
    ? t('payment.installmentTitle', { seq: installment.seq })
    : t('payment.title');

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={<Button label={t('payment.confirm')} fullWidth size="lg" onPress={confirm} />}>
      <View style={styles.summary}>
        <Text variant="callout" weight="700">
          {product.name}
        </Text>
        {due ? (
          <Text variant="caption" tone="muted">
            {[
              t('product.dueOn', { date: formatDate(due.dueDate, language, { today }) }),
              installment
                ? t('product.installmentN', { seq: installment.seq, total: installmentCount })
                : null,
              formatMoney(due.amount, product.currency, { locale: language }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
      </View>
      <TextField
        label={t('payment.amount')}
        value={amountText}
        onChangeText={onAmountChange}
        keyboardType="decimal-pad"
        prefix={CURRENCIES[product.currency].symbol}
        error={error}
      />
      <SelectField
        label={t('payment.date')}
        value={formatDate(date, language, { weekday: true, today })}
        icon="calendar-outline"
        onPress={() => setDateOpen(true)}
      />
      {due ? (
        <SwitchRow
          label={t('payment.settles')}
          hint={t('payment.settlesHint')}
          value={settles}
          onChange={setSettles}
        />
      ) : null}
      <TextField
        label={t('payment.note')}
        value={note}
        onChangeText={setNote}
        optional
        optionalLabel={t('common.optional')}
        maxLength={120}
      />
      <DatePickerSheet
        visible={dateOpen}
        title={t('payment.date')}
        value={date}
        today={today}
        max={today}
        onChange={setDate}
        onClose={() => setDateOpen(false)}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 2 },
});
