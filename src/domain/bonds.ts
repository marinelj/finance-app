import { addMonths, daysBetween, isLocalDate, parseLocalDate, type LocalDate } from './dates';
import { roundMoney, type CurrencyCode } from './money';

/**
 * Individual bonds, as shown by brokers such as Schwab: prices are quoted in percent of face
 * value (98.75 means $987.50 per $1,000), coupons are a yearly percentage of face value paid in
 * equal parts 1, 2, 4 or 12 times a year on dates counted back from maturity, and accrual uses
 * the 30/360 day count of US corporate bonds.
 */

export const COUPON_FREQUENCIES = [0, 1, 2, 4, 12] as const;
/** Coupons per year; 0 is a zero-coupon bond. */
export type CouponFrequency = (typeof COUPON_FREQUENCIES)[number];

export type Bond = {
  /** Total face (par) value held, e.g. 10000 for ten $1,000 bonds. */
  faceValue: number;
  /** Coupon rate in percent of face per year. */
  couponRate: number;
  couponFrequency: CouponFrequency;
  maturityDate: LocalDate;
  currency: CurrencyCode;
};

export type CouponPayment = {
  date: LocalDate;
  amount: number;
  /** The final payment also returns the face value. */
  principal: number;
};

/** Every coupon date from `from` (inclusive) to maturity, counted back from the maturity date. */
export function couponDates(bond: Bond, from: LocalDate): LocalDate[] {
  if (!isLocalDate(bond.maturityDate) || bond.maturityDate < from) return [];
  if (bond.couponFrequency === 0) return [bond.maturityDate];
  const step = 12 / bond.couponFrequency;
  const maturityDay = parseLocalDate(bond.maturityDate).day;
  const dates: LocalDate[] = [];
  for (let i = 0; i < 2000; i++) {
    const date = addMonths(bond.maturityDate, -step * i, maturityDay);
    if (date < from) break;
    dates.push(date);
  }
  return dates.reverse();
}

/** The coupon date on or before `date` (the start of the current coupon period). */
export function previousCouponDate(bond: Bond, date: LocalDate): LocalDate | null {
  if (bond.couponFrequency === 0) return null;
  const step = 12 / bond.couponFrequency;
  const maturityDay = parseLocalDate(bond.maturityDate).day;
  for (let i = 0; i < 2000; i++) {
    const candidate = addMonths(bond.maturityDate, -step * i, maturityDay);
    if (candidate <= date) return candidate;
  }
  return null;
}

/** Each coupon is face × rate / frequency; the last one also pays back the face value. */
export function couponSchedule(bond: Bond, from: LocalDate, to?: LocalDate): CouponPayment[] {
  const coupon =
    bond.couponFrequency === 0
      ? 0
      : roundMoney((bond.faceValue * bond.couponRate) / 100 / bond.couponFrequency, bond.currency);
  return couponDates(bond, from)
    .filter((date) => to == null || date <= to)
    .map((date) => {
      const principal = date === bond.maturityDate ? bond.faceValue : 0;
      return { date, amount: roundMoney(coupon + principal, bond.currency), principal };
    });
}

/** Coupon income over a year (excluding the face value repaid at maturity). */
export function annualCouponIncome(bond: Bond): number {
  return (bond.faceValue * bond.couponRate) / 100;
}

/** Days between two dates under the 30/360 (US bond basis) convention. */
export function days30360(from: LocalDate, to: LocalDate): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  const d1 = Math.min(a.day, 30);
  const d2 = b.day === 31 && d1 === 30 ? 30 : b.day;
  return 360 * (b.year - a.year) + 30 * (b.month - a.month) + (d2 - d1);
}

/** Interest earned since the last coupon, per 100 of face, on `settlement`. */
export function accruedInterest(bond: Bond, settlement: LocalDate): number {
  if (bond.couponFrequency === 0) return 0;
  const last = previousCouponDate(bond, settlement);
  if (!last) return 0;
  const periodDays = 360 / bond.couponFrequency;
  const elapsed = Math.min(days30360(last, settlement), periodDays);
  return (bond.couponRate / bond.couponFrequency) * (elapsed / periodDays);
}

/**
 * Price per 100 of face (clean, without accrued interest) for a yield in percent, discounting
 * every remaining cash flow at yield / frequency per period, with a fractional first period.
 */
export function priceFromYield(bond: Bond, settlement: LocalDate, yieldPercent: number): number {
  const remaining = couponDates(bond, settlement).filter((date) => date > settlement);
  if (remaining.length === 0) return 100;
  const y = yieldPercent / 100;

  if (bond.couponFrequency === 0) {
    const years = daysBetween(settlement, bond.maturityDate) / 365;
    return 100 / (1 + y) ** years;
  }

  const f = bond.couponFrequency;
  const periodDays = 360 / f;
  const toNext = days30360(settlement, remaining[0]) / periodDays;
  const coupon = bond.couponRate / f;
  let dirty = 0;
  remaining.forEach((date, k) => {
    const cash = coupon + (date === bond.maturityDate ? 100 : 0);
    dirty += cash / (1 + y / f) ** (toNext + k);
  });
  return dirty - accruedInterest(bond, settlement);
}

/**
 * Yield to maturity in percent for a clean price per 100 of face, by bisection (the price falls
 * steadily as the yield rises). Returns null when the bond has matured or the price is not
 * positive.
 */
export function yieldToMaturity(
  bond: Bond,
  settlement: LocalDate,
  cleanPrice: number
): number | null {
  if (!(cleanPrice > 0) || bond.maturityDate <= settlement) return null;
  let low = -50;
  let high = 200;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    if (priceFromYield(bond, settlement, mid) > cleanPrice) low = mid;
    else high = mid;
    if (high - low < 1e-9) break;
  }
  return (low + high) / 2;
}

/** Annual coupon divided by the price paid (ignores the pull to par). */
export function currentYield(bond: Bond, cleanPrice: number): number | null {
  if (!(cleanPrice > 0) || bond.couponFrequency === 0) return null;
  return (bond.couponRate / cleanPrice) * 100;
}

/** What the holding is worth at a clean price per 100, plus the interest accrued so far. */
export function bondMarketValue(bond: Bond, cleanPrice: number, settlement: LocalDate): number {
  const perHundred = cleanPrice + accruedInterest(bond, settlement);
  return roundMoney((bond.faceValue * perHundred) / 100, bond.currency);
}

/** Whole years until maturity, to one decimal. */
export function yearsToMaturity(bond: Bond, from: LocalDate): number {
  return Math.max(0, Math.round((daysBetween(from, bond.maturityDate) / 365.25) * 10) / 10);
}
