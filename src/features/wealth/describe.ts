import type { TFunction } from 'i18next';

import type {
  BondRow,
  CashRow,
  ExpenseRow,
  HousingRow,
  IncomeRow,
  InsuranceRow,
  StockRow,
} from '@/db/schema';
import { annualCouponIncome, couponDates } from '@/domain/bonds';
import { monthlyHousingCost } from '@/domain/cashflow';
import type { LocalDate } from '@/domain/dates';
import { formatMoney, formatPercent, roundTo, type CurrencyCode } from '@/domain/money';
import { asBond, asStock, bondPrice, bondYields } from '@/domain/portfolio';
import {
  annualDividendIncome,
  dividendYield,
  stockMarketValue,
  unrealizedReturn,
} from '@/domain/stocks';
import type { WealthKind } from '@/domain/wealthForms';
import type { AppLanguage } from '@/i18n';
import { formatDate } from '@/lib/format';
import type { WealthRow } from '@/state/wealthData';

import { tKey } from './meta';

export type ItemSummary = {
  title: string;
  subtitle: string;
  amount: number;
  currency: CurrencyCode;
  /** How to read the amount: per month, per period, or a balance/value. */
  amountSuffix: string | null;
  details: string[];
};

type Context = { t: TFunction; language: AppLanguage; today: LocalDate; hidden: boolean };

/** Title, headline amount and supporting lines for one portfolio item in a list. */
export function describeItem(kind: WealthKind, row: WealthRow, context: Context): ItemSummary {
  const { t, language, today, hidden } = context;
  const money = (amount: number, currency: CurrencyCode) =>
    hidden ? '••••' : formatMoney(amount, currency, { locale: language });
  const option = (set: string, value: string | number) => tKey(t, `wealth.options.${set}.${value}`);
  const date = (value: string) => formatDate(value, language, { today, year: true });

  switch (kind) {
    case 'income': {
      const item = row as IncomeRow;
      return {
        title: item.name,
        subtitle: option('incomeKind', item.kind),
        amount: item.amount,
        currency: item.currency,
        amountSuffix: option('period', item.period),
        details: [],
      };
    }
    case 'housing': {
      const item = row as HousingRow;
      const monthly = monthlyHousingCost(item);
      const estimated =
        item.kind === 'mortgage' && !(item.monthlyPayment != null && item.monthlyPayment > 0);
      const details = [
        item.kind === 'mortgage' && item.balance != null
          ? t('wealth.detail.owed', { amount: money(item.balance, item.currency) })
          : null,
        item.propertyValue != null && item.kind !== 'rent'
          ? t('wealth.detail.worth', { amount: money(item.propertyValue, item.currency) })
          : null,
        estimated && monthly > 0
          ? t('wealth.detail.estimated', { amount: money(monthly, item.currency) })
          : null,
      ].filter((line): line is string => line != null);
      return {
        title: item.name,
        subtitle: option('housingKind', item.kind),
        amount: monthly,
        currency: item.currency,
        amountSuffix: item.kind === 'owned' ? null : option('period', 'monthly'),
        details,
      };
    }
    case 'insurance': {
      const item = row as InsuranceRow;
      return {
        title: item.name,
        subtitle: [option('insuranceType', item.type), item.insurer].filter(Boolean).join(' · '),
        amount: item.premium,
        currency: item.currency,
        amountSuffix: option('period', item.premiumPeriod),
        details: item.coverage
          ? [t('wealth.detail.coverage', { amount: money(item.coverage, item.currency) })]
          : [],
      };
    }
    case 'expense': {
      const item = row as ExpenseRow;
      const category = option('expenseCategory', item.category);
      return {
        title: item.label || category,
        subtitle: [
          item.label ? category : null,
          item.essential ? t('wealth.detail.essential') : null,
        ]
          .filter(Boolean)
          .join(' · '),
        amount: item.amount,
        currency: item.currency,
        amountSuffix: option('period', 'monthly'),
        details: [],
      };
    }
    case 'cash': {
      const item = row as CashRow;
      return {
        title: item.name,
        subtitle: [
          option('cashKind', item.kind),
          item.ratePercent != null ? `${roundTo(item.ratePercent, 2)}%` : null,
          item.isEmergencyFund ? t('wealth.detail.emergency') : null,
        ]
          .filter(Boolean)
          .join(' · '),
        amount: item.balance,
        currency: item.currency,
        amountSuffix: null,
        details: [],
      };
    }
    case 'bond': {
      const item = row as BondRow;
      const bond = asBond(item);
      const price = bondPrice(item);
      const yields = bondYields(item, today);
      const next = couponDates(bond, today).find((day) => day > today);
      return {
        title: item.name || item.issuer,
        subtitle: [
          item.name ? item.issuer : null,
          `${roundTo(item.couponRate, 3)}%`,
          t('wealth.detail.matures', { date: date(item.maturityDate) }),
        ]
          .filter(Boolean)
          .join(' · '),
        amount: (item.faceValue * price) / 100,
        currency: item.currency,
        amountSuffix: null,
        details: [
          yields.atPurchase != null
            ? t('wealth.detail.ytmBought', { value: roundTo(yields.atPurchase, 2) })
            : null,
          yields.atCurrentPrice != null
            ? t('wealth.detail.ytmNow', { value: roundTo(yields.atCurrentPrice, 2) })
            : null,
          bond.couponFrequency > 0
            ? t('wealth.detail.couponsPerYear', {
                amount: money(annualCouponIncome(bond), item.currency),
              })
            : null,
          next ? t('wealth.detail.nextCoupon', { date: date(next) }) : null,
        ].filter((line): line is string => line != null),
      };
    }
    case 'stock': {
      const item = row as StockRow;
      const holding = asStock(item);
      const income = annualDividendIncome(holding);
      const dividendRate = dividendYield(holding);
      const change = unrealizedReturn(holding);
      return {
        title: item.ticker,
        subtitle: [item.name, t('wealth.detail.shares', { count: roundTo(item.shares, 4) })]
          .filter(Boolean)
          .join(' · '),
        amount: stockMarketValue(holding),
        currency: item.currency,
        amountSuffix: null,
        details: [
          income > 0
            ? t('wealth.detail.dividendsPerYear', { amount: money(income, item.currency) })
            : null,
          dividendRate != null && dividendRate > 0
            ? t('wealth.detail.yield', { value: formatPercent(dividendRate, { decimals: 2 }) })
            : null,
          change != null
            ? t('wealth.detail.gain', { value: formatPercent(change, { sign: 'always' }) })
            : null,
        ].filter((line): line is string => line != null),
      };
    }
  }
}

/** The name to confirm a delete with. */
export function itemName(kind: WealthKind, row: WealthRow, t: TFunction): string {
  if (kind === 'expense') {
    const item = row as ExpenseRow;
    return item.label || tKey(t, `wealth.options.expenseCategory.${item.category}`);
  }
  if (kind === 'bond') return (row as BondRow).name || (row as BondRow).issuer;
  if (kind === 'stock') return (row as StockRow).ticker;
  return (row as IncomeRow).name;
}
