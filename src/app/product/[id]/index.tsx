import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/AmountText';
import { Appear } from '@/components/Appear';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DueBadge } from '@/components/DueBadge';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { ProgressRing } from '@/components/ProgressRing';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { StatTile } from '@/components/StatTile';
import { StatusPill } from '@/components/StatusPill';
import { Text } from '@/components/Text';
import { useStyles, useTheme } from '@/design/theme';
import type { Theme } from '@/design/tokens';
import { deleteProduct, setProductActive, undoPayment } from '@/db/credit';
import { dailyRatePercent } from '@/domain/credit';
import { isWeekend } from '@/domain/dates';
import { dailyInterestCost } from '@/domain/loans';
import { formatMoney, formatPercent } from '@/domain/money';
import { floatForPurchase } from '@/domain/paymentOptimizer';
import { productTypeLabel, utilizationTone } from '@/features/credit/labels';
import { PaymentSheet } from '@/features/credit/PaymentSheet';
import { ProductForm } from '@/features/credit/ProductForm';
import { formValuesFromProduct } from '@/domain/productForm';
import { confirm } from '@/lib/confirm';
import { formatDate } from '@/lib/format';
import { useGoBack } from '@/lib/goBack';
import { haptics } from '@/lib/haptics';
import { useCreditData, useProduct } from '@/state/creditData';
import { usePreferences } from '@/state/preferences';
import { useToast } from '@/state/toast';

const INSTALLMENTS_PREVIEW = 3;

export default function ProductDetailScreen() {
  const { t } = useTranslation();
  const goBack = useGoBack('/credit');
  const toast = useToast();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { language } = usePreferences();
  const { id, section } = useLocalSearchParams<{ id: string; section?: string }>();
  const { customTypes, today } = useCreditData();
  const data = useProduct(id);
  const [paying, setPaying] = useState(false);
  const [showAllInstallments, setShowAllInstallments] = useState(false);
  const [utilizationInfo, setUtilizationInfo] = useState(false);

  if (!data) {
    return (
      <Screen hasHeader>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState emoji="🔍" title={t('product.notFound')} />
      </Screen>
    );
  }

  const { product, due, utilization, available, installments, payments, latestBill } = data;
  const typeLabel = productTypeLabel(product, customTypes, t);
  const money = (amount: number) => formatMoney(amount, product.currency, { locale: language });
  const date = (value: string, weekday = false) => formatDate(value, language, { today, weekday });
  const dueInstallment = due?.installmentId
    ? (installments.find((item) => item.id === due.installmentId) ?? null)
    : null;
  const unpaidInstallments = installments.filter((item) => item.paidAt == null);
  const shownInstallments = showAllInstallments
    ? installments
    : unpaidInstallments.slice(0, INSTALLMENTS_PREVIEW);
  const latestPaymentId = payments.reduce<{ id: string; createdAt: string } | null>(
    (latest, item) => (!latest || item.createdAt > latest.createdAt ? item : latest),
    null
  )?.id;

  const onPaid = (paymentId: string) => {
    toast({
      message: t('payment.toast', { name: product.name }),
      action: {
        label: t('common.undo'),
        onPress: () => {
          if (undoPayment(paymentId)) toast({ message: t('payment.undone'), icon: 'arrow-undo' });
        },
      },
    });
  };

  const undoLatest = (paymentId: string) => {
    haptics.light();
    if (undoPayment(paymentId)) toast({ message: t('payment.undone'), icon: 'arrow-undo' });
    else toast({ message: t('payment.cannotUndo'), icon: 'information-circle' });
  };

  const remove = async () => {
    const ok = await confirm({
      title: t('product.deleteTitle', { name: product.name }),
      message: t('product.deleteMessage'),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!ok) return;
    haptics.warning();
    goBack();
    deleteProduct(product.id);
  };

  const daily = dailyRatePercent(product.interestRate, product.interestRateUnit);
  const dailyCost =
    !product.hasGracePeriod && daily != null && product.balance > 0
      ? dailyInterestCost(product.balance, daily, 1)
      : null;

  const floatToday = floatForPurchase(product, today);

  let block = 0;
  return (
    <>
      <Stack.Screen options={{ title: product.name }} />
      <ProductForm
        key={product.id}
        initialSection={section === 'billing' ? 'billing' : undefined}
        initialValues={formValuesFromProduct(product, installments.length > 0, today)}
        existing={{ id: product.id, product, installments }}
        typeLabel={typeLabel}
        today={today}
        onSaved={() => toast({ message: t('form.saved') })}>
        {latestBill ? (
          <Card style={styles.section}>
            <SectionHeader
              title={t('product.latestEmailBill', {
                date: date(latestBill.statementDate ?? latestBill.receivedAt.slice(0, 10)),
              })}
            />
            <AmountText
              value={latestBill.statementBalance}
              currency={latestBill.currency}
              variant="title"
            />
            <Text tone="secondary">
              {t('product.dueOn', { date: date(latestBill.dueDate, true) })}
            </Text>
          </Card>
        ) : null}

        {!product.isActive ? (
          <Card variant="outline" padding="lg" style={styles.banner}>
            <Icon name="archive-outline" size={18} color={colors.textMuted} />
            <Text variant="callout" tone="secondary" style={styles.flex}>
              {t('product.closedBanner')}
            </Text>
          </Card>
        ) : null}

        {product.isActive ? (
          <Appear index={block++}>
            <Card style={styles.section}>
              <View style={styles.rowBetween}>
                <Text variant="micro" tone="muted">
                  {t('product.nextPayment')}
                </Text>
                {due ? <DueBadge daysLeft={due.daysLeft} /> : null}
              </View>
              {due ? (
                <>
                  <View style={styles.amountRow}>
                    {due.amountIsEstimate ? (
                      <Text variant="title" tone="muted">
                        ≈
                      </Text>
                    ) : null}
                    <AmountText
                      value={due.amount}
                      currency={product.currency}
                      variant="display"
                      animate
                    />
                  </View>
                  <Text variant="callout" tone="secondary">
                    {[
                      t('product.dueOn', { date: date(due.dueDate, true) }),
                      dueInstallment
                        ? t('product.installmentN', {
                            seq: dueInstallment.seq,
                            total: installments.length,
                          })
                        : due.statementDate
                          ? t('product.statementOn', { date: date(due.statementDate) })
                          : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {due.amountIsEstimate ? (
                    <Note icon="information-circle-outline" text={t('product.amountEstimate')} />
                  ) : null}
                  {isWeekend(due.dueDate) ? (
                    <Note icon="calendar-outline" text={t('product.weekendDue')} />
                  ) : null}
                </>
              ) : (
                <Text variant="body" tone="secondary">
                  {t('product.nothingDue')}
                </Text>
              )}
              <Button
                label={t('product.markPaid')}
                icon="checkmark-circle"
                size="lg"
                fullWidth
                variant={due ? 'primary' : 'secondary'}
                haptic={false}
                onPress={() => setPaying(true)}
              />
            </Card>
          </Appear>
        ) : null}

        {available != null ? (
          <Appear index={block++} style={styles.tiles}>
            <StatTile
              style={styles.flex}
              emoji="🪙"
              tone="mint"
              label={t('product.available')}
              value={<AmountText value={available} currency={product.currency} variant="title" />}
              caption={`${t('product.limit')} ${money(product.creditLimit)}`}
            />
          </Appear>
        ) : null}

        {utilization != null ? (
          <Appear index={block++}>
            <Card
              onPress={() => setUtilizationInfo(true)}
              accessibilityLabel={t('product.utilizationA11y', {
                percent: Math.round(utilization * 100),
              })}
              style={styles.utilization}>
              <ProgressRing
                progress={utilization}
                size={88}
                color={colors.status[utilizationTone(utilization)].mark}
                trackColor={colors.status[utilizationTone(utilization)].soft}
                accessibilityLabel={t('product.utilizationA11y', {
                  percent: Math.round(utilization * 100),
                })}>
                <Text variant="headline">{formatPercent(utilization, { decimals: 0 })}</Text>
              </ProgressRing>
              <View style={[styles.flex, styles.gapSm]}>
                <Text variant="headline">{t('product.utilization')}</Text>
                <StatusPill
                  tone={utilizationTone(utilization)}
                  label={t(
                    utilizationTone(utilization) === 'good'
                      ? 'product.utilizationGood'
                      : utilizationTone(utilization) === 'caution'
                        ? 'product.utilizationCaution'
                        : 'product.utilizationDanger'
                  )}
                />
              </View>
              <Icon name="information-circle-outline" size={20} color={colors.textMuted} />
            </Card>
          </Appear>
        ) : null}

        {installments.length > 0 ? (
          <Appear index={block++}>
            <Card style={styles.section}>
              <SectionHeader
                title={t('product.installments')}
                action={
                  installments.length > INSTALLMENTS_PREVIEW
                    ? {
                        label: showAllInstallments
                          ? t('product.showLess')
                          : t('product.showAll', { count: installments.length }),
                        onPress: () => setShowAllInstallments((value) => !value),
                      }
                    : undefined
                }
              />
              <Text variant="caption" tone="muted">
                {t('product.installmentsLeft', { count: unpaidInstallments.length })}
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${((installments.length - unpaidInstallments.length) / installments.length) * 100}%`,
                      backgroundColor: product.color,
                    },
                  ]}
                />
              </View>
              {shownInstallments.map((item) => (
                <View key={item.id} style={styles.listRow}>
                  <View style={styles.flex}>
                    <Text variant="callout" weight="600">
                      {date(item.dueDate)} ·{' '}
                      {t('product.installmentN', { seq: item.seq, total: installments.length })}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {t('product.principalInterest', {
                        principal: money(item.principal),
                        interest: money(item.interest),
                      })}
                    </Text>
                  </View>
                  {item.paidAt ? (
                    <StatusPill tone="good" label={t('product.paid')} size="sm" />
                  ) : (
                    <AmountText value={item.amount} currency={product.currency} variant="callout" />
                  )}
                </View>
              ))}
            </Card>
          </Appear>
        ) : null}

        <Appear index={block++}>
          <Card style={styles.section}>
            <SectionHeader title={t('product.paymentHistory')} />
            {payments.length === 0 ? (
              <Text variant="callout" tone="muted">
                {t('product.noPayments')}
              </Text>
            ) : (
              payments.map((payment) => (
                <View key={payment.id} style={styles.listRow}>
                  <View style={styles.flex}>
                    <Text variant="callout" weight="600">
                      {date(payment.date)}
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={2}>
                      {[
                        payment.forDueDate
                          ? t('product.settledDue', { date: date(payment.forDueDate) })
                          : t('product.partialPayment'),
                        payment.note,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <View style={styles.trailing}>
                    <AmountText
                      value={payment.amount}
                      currency={product.currency}
                      variant="callout"
                    />
                    {payment.id === latestPaymentId ? (
                      <Pressable
                        onPress={() => undoLatest(payment.id)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`${t('common.undo')}, ${date(payment.date)}`}>
                        <Text variant="caption" tone="primary" weight="700">
                          {t('common.undo')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </Card>
        </Appear>

        {floatToday || (dailyCost != null && dailyCost > 0) ? (
          <Appear index={block++}>
            <Card style={styles.section}>
              {floatToday ? (
                <Note
                  icon="sparkles-outline"
                  text={t('product.floatToday', {
                    count: floatToday.floatDays,
                    date: date(floatToday.dueDate, true),
                  })}
                />
              ) : null}
              {dailyCost != null && dailyCost > 0 ? (
                <Note
                  icon="trending-up-outline"
                  text={t('product.dailyCost', { amount: money(dailyCost) })}
                  tone="caution"
                />
              ) : null}
            </Card>
          </Appear>
        ) : null}

        <Appear index={block++} style={styles.actions}>
          <Button
            label={product.isActive ? t('product.closeAccount') : t('product.reopen')}
            icon={product.isActive ? 'archive-outline' : 'refresh'}
            variant="secondary"
            fullWidth
            onPress={() => setProductActive(product.id, !product.isActive)}
          />
          <Button
            label={t('common.delete')}
            icon="trash-outline"
            variant="danger"
            fullWidth
            onPress={() => void remove()}
          />
        </Appear>

        <PaymentSheet
          visible={paying}
          onClose={() => setPaying(false)}
          product={product}
          due={due}
          installment={dueInstallment}
          installmentCount={installments.length}
          today={today}
          onPaid={onPaid}
        />
        <BottomSheet
          visible={utilizationInfo}
          onClose={() => setUtilizationInfo(false)}
          title={t('product.utilization')}>
          <Text variant="body" tone="secondary">
            {t('product.utilizationExplain')}
          </Text>
        </BottomSheet>
      </ProductForm>
    </>
  );
}

function Note({
  icon,
  text,
  tone,
}: {
  icon:
    'information-circle-outline' | 'calendar-outline' | 'trending-up-outline' | 'sparkles-outline';
  text: string;
  tone?: 'caution';
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const color = tone === 'caution' ? colors.status.caution.text : colors.textMuted;
  return (
    <View style={styles.note}>
      <Icon name={icon} size={16} color={color} />
      <Text variant="caption" tone={tone ?? 'muted'} style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

const makeStyles = ({ colors, radius, space }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    gapSm: { gap: space.sm },
    section: { gap: space.md },
    banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
    tiles: { flexDirection: 'row', gap: space.md },
    utilization: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
    progressTrack: {
      height: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: radius.pill },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.xs,
    },
    trailing: { alignItems: 'flex-end', gap: 2 },
    detailRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
    detailLabel: { width: '38%' },
    detailValue: { flex: 1, textAlign: 'right' },
    note: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
    actions: { gap: space.sm },
  });
