import { couponSchedule } from './bonds';
import {
  isRevolving,
  aprPercent,
  type CreditProduct,
  type Installment,
  type ProductKind,
} from './credit';
import { monthlyHousingCost } from './cashflow';
import { addMonths, monthKey, parseLocalDate, type LocalDate } from './dates';
import { convert, type FxTable } from './fx';
import type { CurrencyCode } from './money';
import {
  asBond,
  asStock,
  summarizeInputs,
  type InputsOverview,
  type PortfolioInputs,
} from './portfolio';
import type { RiskProfileKey, RiskResult } from './riskProfile';
import { dividendMonths, stockMarketValue, type AssetClass } from './stocks';

/**
 * The portfolio planner: a transparent rules engine. Every number comes from a pure function
 * below, and every recommendation carries the figures that justify it so the UI can explain it
 * in plain language. It is a planning tool, not licensed financial advice.
 */

export const BUCKETS = [
  'cash',
  'bonds',
  'domestic_equity',
  'international_equity',
  'other',
] as const satisfies readonly AssetClass[];
export type Bucket = (typeof BUCKETS)[number];
export type BucketAmounts = Record<Bucket, number>;

export type PlannerSettings = {
  /** Debts above this APR (percent) are paid off before investing. */
  highInterestApr: number;
  /** Months of essential outgoings to keep as an emergency fund. */
  emergencyMonths: number;
};

export const DEFAULT_PLANNER_SETTINGS: PlannerSettings = { highInterestApr: 6, emergencyMonths: 6 };

/**
 * Target allocation of invested money per risk profile, as shares that add up to 1. Cash here is
 * money invested in cash-like products on top of the emergency fund.
 */
export const TARGET_ALLOCATIONS: Record<RiskProfileKey, BucketAmounts> = {
  conservative: {
    cash: 0.2,
    bonds: 0.6,
    domestic_equity: 0.1,
    international_equity: 0.05,
    other: 0.05,
  },
  cautious: {
    cash: 0.1,
    bonds: 0.5,
    domestic_equity: 0.2,
    international_equity: 0.15,
    other: 0.05,
  },
  balanced: {
    cash: 0.05,
    bonds: 0.35,
    domestic_equity: 0.3,
    international_equity: 0.25,
    other: 0.05,
  },
  growth: { cash: 0.05, bonds: 0.2, domestic_equity: 0.4, international_equity: 0.3, other: 0.05 },
  aggressive: {
    cash: 0,
    bonds: 0.1,
    domestic_equity: 0.5,
    international_equity: 0.35,
    other: 0.05,
  },
};

/** Long-run nominal return assumptions per year, in percent. Assumptions, not forecasts. */
export const RETURN_ASSUMPTIONS: BucketAmounts = {
  cash: 1.5,
  bonds: 3.5,
  domestic_equity: 6.5,
  international_equity: 6.5,
  other: 4,
};

/** A credit product as the planner sees it, in the home currency. */
export type DebtInput = {
  id: string;
  name: string;
  kind: ProductKind;
  hasGracePeriod: boolean;
  balance: number;
  creditLimit: number;
  aprPercent: number | null;
  /** Required monthly payment for loans (installment or fixed payment); 0 for cards. */
  monthlyPayment: number;
};

/**
 * Credit products as debts. Loans pay their next installment, or the monthly payment entered;
 * card and BNPL bills are treated as spending already covered by expenses, so they add no
 * monthly payment here, only a balance.
 */
export function debtsFromCredit(
  products: CreditProduct[],
  installments: Installment[],
  today: LocalDate,
  home: CurrencyCode,
  fx: FxTable
): DebtInput[] {
  return products
    .filter((product) => product.isActive)
    .map((product) => {
      const toHome = (amount: number) => convert(amount, product.currency, home, fx);
      let monthly = 0;
      if (!isRevolving(product.kind)) {
        const next = installments
          .filter(
            (item) => item.productId === product.id && item.paidAt == null && item.dueDate >= today
          )
          .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0];
        monthly = next ? next.amount : (product.minimumPayment ?? 0);
        if (product.balance <= 0) monthly = 0;
      }
      return {
        id: product.id,
        name: product.name,
        kind: product.kind,
        hasGracePeriod: product.hasGracePeriod,
        balance: toHome(Math.max(0, product.balance)),
        creditLimit: toHome(Math.max(0, product.creditLimit)),
        aprPercent: aprPercent(product.interestRate, product.interestRateUnit),
        monthlyPayment: toHome(monthly),
      };
    });
}

export type NetWorth = {
  assets: number;
  liabilities: number;
  netWorth: number;
  cash: number;
  bonds: number;
  stocks: number;
  property: number;
  creditDebt: number;
  mortgage: number;
};

export function netWorthOf(overview: InputsOverview, debts: DebtInput[]): NetWorth {
  const creditDebt = debts.reduce((sum, debt) => sum + debt.balance, 0);
  const assets = overview.cash + overview.bonds + overview.stocks + overview.property;
  const liabilities = creditDebt + overview.mortgage;
  return {
    assets,
    liabilities,
    netWorth: assets - liabilities,
    cash: overview.cash,
    bonds: overview.bonds,
    stocks: overview.stocks,
    property: overview.property,
    creditDebt,
    mortgage: overview.mortgage,
  };
}

export type CashFlow = {
  income: number;
  debtPayments: number;
  housing: number;
  insurance: number;
  expenses: number;
  outflows: number;
  /** Income minus outflows: what is left to invest (negative when spending exceeds income). */
  surplus: number;
};

/** income − (debt payments + housing + insurance + expenses), per month. */
export function cashFlowOf(overview: InputsOverview, debts: DebtInput[]): CashFlow {
  const debtPayments = debts.reduce((sum, debt) => sum + debt.monthlyPayment, 0);
  const outflows = debtPayments + overview.housing + overview.insurance + overview.expenses;
  return {
    income: overview.income,
    debtPayments,
    housing: overview.housing,
    insurance: overview.insurance,
    expenses: overview.expenses,
    outflows,
    surplus: overview.income - outflows,
  };
}

export type PassiveMonth = { month: string; coupons: number; dividends: number };

/**
 * Coupons and dividends for the 12 calendar months starting with `today`'s month, in the home
 * currency. Coupons come from each bond's schedule (face value repaid at maturity is left out);
 * dividends are per-payment amounts in the months they usually arrive.
 */
export function passiveIncomeCalendar(
  inputs: Pick<PortfolioInputs, 'bonds' | 'stocks'>,
  today: LocalDate,
  home: CurrencyCode,
  fx: FxTable
): PassiveMonth[] {
  const { year, month } = parseLocalDate(today);
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const months: PassiveMonth[] = Array.from({ length: 12 }, (_, i) => ({
    month: monthKey(addMonths(first, i)),
    coupons: 0,
    dividends: 0,
  }));
  const index = new Map(months.map((item, i) => [item.month, i]));
  const end = addMonths(first, 12);

  for (const input of inputs.bonds) {
    for (const payment of couponSchedule(asBond(input), first, end)) {
      const i = index.get(monthKey(payment.date));
      if (i == null) continue;
      months[i].coupons += convert(payment.amount - payment.principal, input.currency, home, fx);
    }
  }
  for (const input of inputs.stocks) {
    const holding = asStock(input);
    const perPayment = holding.dividendPerShare * holding.shares;
    if (!(perPayment > 0)) continue;
    for (const payMonth of dividendMonths(holding.dividendFrequency, holding.firstPayMonth)) {
      const item = months.find((entry) => Number(entry.month.slice(5)) === payMonth);
      if (item) item.dividends += convert(perPayment, input.currency, home, fx);
    }
  }
  return months;
}

export type RatioKey =
  'debtToIncome' | 'housingCost' | 'insuranceCost' | 'emergencyMonths' | 'creditUtilization';

export type HealthTone = 'good' | 'caution' | 'danger';

export type Ratio = {
  key: RatioKey;
  /** A fraction (0.25 = 25%), or months for the emergency fund; null when it cannot be worked out. */
  value: number | null;
  tone: HealthTone | null;
};

/** Traffic-light thresholds, also used to explain each ratio. */
export const RATIO_THRESHOLDS = {
  debtToIncome: { good: 0.36, caution: 0.43 },
  housingCost: { good: 0.3, caution: 0.4 },
  insuranceCost: { good: 0.1, caution: 0.15 },
  emergencyMonths: { caution: 3 },
  creditUtilization: { good: 0.3, caution: 0.7 },
} as const;

const upTo = (value: number, good: number, caution: number): HealthTone =>
  value <= good ? 'good' : value <= caution ? 'caution' : 'danger';

export type HealthInput = {
  cashFlow: CashFlow;
  mortgagePayments: number;
  emergencyCash: number;
  essentialMonthly: number;
  revolvingBalance: number;
  revolvingLimit: number;
  emergencyTargetMonths: number;
};

export function healthRatios(input: HealthInput): Ratio[] {
  const { cashFlow } = input;
  const income = cashFlow.income;
  const ratio = (value: number) => (income > 0 ? value / income : null);

  const dti = ratio(cashFlow.debtPayments + input.mortgagePayments);
  const housing = ratio(cashFlow.housing);
  const insurance = ratio(cashFlow.insurance);
  const months = input.essentialMonthly > 0 ? input.emergencyCash / input.essentialMonthly : null;
  const utilization =
    input.revolvingLimit > 0 ? input.revolvingBalance / input.revolvingLimit : null;
  const t = RATIO_THRESHOLDS;

  return [
    {
      key: 'debtToIncome',
      value: dti,
      tone: dti == null ? null : upTo(dti, t.debtToIncome.good, t.debtToIncome.caution),
    },
    {
      key: 'housingCost',
      value: housing,
      tone: housing == null ? null : upTo(housing, t.housingCost.good, t.housingCost.caution),
    },
    {
      key: 'insuranceCost',
      value: insurance,
      tone:
        insurance == null
          ? null
          : insurance === 0
            ? 'caution'
            : upTo(insurance, t.insuranceCost.good, t.insuranceCost.caution),
    },
    {
      key: 'emergencyMonths',
      value: months,
      tone:
        months == null
          ? null
          : months >= input.emergencyTargetMonths
            ? 'good'
            : months >= t.emergencyMonths.caution
              ? 'caution'
              : 'danger',
    },
    {
      key: 'creditUtilization',
      value: utilization,
      tone:
        utilization == null
          ? null
          : upTo(utilization, t.creditUtilization.good, t.creditUtilization.caution),
    },
  ];
}

export type InsuranceGap =
  | { key: 'noHealth' }
  | { key: 'lowLife'; coverage: number; suggested: number }
  | { key: 'noCriticalIllness'; suggested: number }
  | { key: 'highPremiums'; share: number };

/** Life cover of about 10 years of income when someone depends on you (a mortgage or family costs). */
export const LIFE_COVER_YEARS = 10;
/** Critical-illness cover of about 3 years of income replaces earnings during treatment. */
export const CRITICAL_ILLNESS_YEARS = 3;

/** Coverage checks relative to income. Flags gaps only; the app never suggests products. */
export function insuranceGaps(
  inputs: Pick<PortfolioInputs, 'insurance' | 'housing' | 'expenses'>,
  monthlyIncome: number,
  home: CurrencyCode,
  fx: FxTable
): InsuranceGap[] {
  const annualIncome = monthlyIncome * 12;
  const coverOf = (type: string) =>
    inputs.insurance
      .filter((policy) => policy.type === type)
      .reduce((sum, policy) => sum + convert(policy.coverage ?? 0, policy.currency, home, fx), 0);
  const has = (type: string) => inputs.insurance.some((policy) => policy.type === type);
  const dependents =
    inputs.housing.some((item) => item.kind === 'mortgage') ||
    inputs.expenses.some((item) => item.category === 'childcare' || item.category === 'family');

  const gaps: InsuranceGap[] = [];
  if (!has('health')) gaps.push({ key: 'noHealth' });
  if (annualIncome > 0 && dependents) {
    const suggested = annualIncome * LIFE_COVER_YEARS;
    const coverage = coverOf('life');
    if (coverage < suggested * 0.5) gaps.push({ key: 'lowLife', coverage, suggested });
  }
  if (annualIncome > 0 && !has('critical_illness')) {
    gaps.push({ key: 'noCriticalIllness', suggested: annualIncome * CRITICAL_ILLNESS_YEARS });
  }
  const premiums = inputs.insurance.reduce((sum, policy) => {
    const months = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[policy.premiumPeriod];
    return sum + convert(policy.premium / months, policy.currency, home, fx);
  }, 0);
  if (monthlyIncome > 0 && premiums / monthlyIncome > RATIO_THRESHOLDS.insuranceCost.caution) {
    gaps.push({ key: 'highPremiums', share: premiums / monthlyIncome });
  }
  return gaps;
}

/** What is invested in each bucket today, in the home currency. The emergency fund is excluded. */
export function currentAllocation(
  inputs: Pick<PortfolioInputs, 'cash' | 'bonds' | 'stocks'>,
  overview: InputsOverview,
  home: CurrencyCode,
  fx: FxTable
): BucketAmounts {
  const amounts: BucketAmounts = {
    cash: 0,
    bonds: 0,
    domestic_equity: 0,
    international_equity: 0,
    other: 0,
  };
  const flagged = inputs.cash.some((item) => item.isEmergencyFund);
  // Without a flagged emergency fund all cash is treated as the emergency fund.
  amounts.cash = flagged ? overview.cash - overview.emergencyFund : 0;
  amounts.bonds = overview.bonds;
  for (const stock of inputs.stocks) {
    amounts[stock.assetClass] += convert(
      stockMarketValue(asStock(stock)),
      stock.currency,
      home,
      fx
    );
  }
  return amounts;
}

const sumOf = (amounts: BucketAmounts) => BUCKETS.reduce((sum, bucket) => sum + amounts[bucket], 0);

/** How far each bucket is from its target share: positive means buy more, negative over target. */
export function allocationGaps(current: BucketAmounts, target: BucketAmounts): BucketAmounts {
  const total = sumOf(current);
  return Object.fromEntries(
    BUCKETS.map((bucket) => [bucket, target[bucket] * total - current[bucket]])
  ) as BucketAmounts;
}

/**
 * Splits a monthly contribution so new money flows to underweight buckets first, in proportion
 * to how far each is below its target after the contribution; overweight buckets get nothing,
 * so nothing has to be sold. When no bucket is overweight this lands every bucket on target.
 */
export function splitContribution(
  current: BucketAmounts,
  target: BucketAmounts,
  amount: number
): BucketAmounts {
  const split: BucketAmounts = {
    cash: 0,
    bonds: 0,
    domestic_equity: 0,
    international_equity: 0,
    other: 0,
  };
  if (!(amount > 0)) return split;
  const after = sumOf(current) + amount;
  const shortfalls = BUCKETS.map((bucket) => Math.max(0, target[bucket] * after - current[bucket]));
  // The shortfalls add up to at least `amount`, because the targets add up to 1.
  const totalShortfall = shortfalls.reduce((sum, value) => sum + value, 0);
  BUCKETS.forEach((bucket, i) => {
    split[bucket] = (amount * shortfalls[i]) / totalShortfall;
  });
  return split;
}

/** Weighted average of the return assumptions for an allocation, in percent per year. */
export function expectedReturn(target: BucketAmounts): number {
  return BUCKETS.reduce((sum, bucket) => sum + target[bucket] * RETURN_ASSUMPTIONS[bucket], 0);
}

export type ProjectionPoint = { year: number; netWorth: number };

/**
 * Net worth over the years if invested assets compound monthly at `annualReturnPercent` and
 * `monthly` is added each month. Everything else (property, debts) is held flat, which keeps the
 * projection conservative and easy to follow.
 */
export function projectNetWorth(params: {
  invested: number;
  other: number;
  monthly: number;
  annualReturnPercent: number;
  years: number;
}): ProjectionPoint[] {
  const r = params.annualReturnPercent / 100 / 12;
  let invested = params.invested;
  const points: ProjectionPoint[] = [{ year: 0, netWorth: invested + params.other }];
  for (let year = 1; year <= params.years; year++) {
    for (let m = 0; m < 12; m++) invested = invested * (1 + r) + params.monthly;
    points.push({ year, netWorth: invested + params.other });
  }
  return points;
}

export type HighInterestDebt = { id: string; name: string; balance: number; aprPercent: number };

export type Action =
  | {
      key: 'payHighInterest';
      done: boolean;
      threshold: number;
      debts: HighInterestDebt[];
      total: number;
      /** Months to clear them with the whole surplus; null when there is no surplus. */
      months: number | null;
      /** Keep a starter cushion first when the emergency fund is under a month. */
      keepStarterFund: boolean;
    }
  | {
      key: 'emergencyFund';
      done: boolean;
      target: number;
      current: number;
      monthsCovered: number | null;
      targetMonths: number;
      essentialMonthly: number;
      gap: number;
      months: number | null;
    }
  | { key: 'insurance'; done: boolean; gaps: InsuranceGap[]; annualIncome: number }
  | { key: 'fixCashFlow'; done: false; shortfall: number }
  | {
      key: 'invest';
      done: false;
      monthly: number;
      profile: RiskProfileKey;
      assumedProfile: boolean;
      split: BucketAmounts;
      /** True while earlier steps take the surplus; investing starts after them. */
      afterEarlierSteps: boolean;
    }
  | {
      key: 'rebalance';
      done: boolean;
      gaps: BucketAmounts;
      total: number;
      largest: { bucket: Bucket; gap: number } | null;
    }
  | { key: 'payCardsInFull'; done: false; highestApr: number; name: string };

export type Allocation = {
  profile: RiskProfileKey;
  /** No risk profile yet, so Balanced is used. */
  assumedProfile: boolean;
  target: BucketAmounts;
  current: BucketAmounts;
  total: number;
  gaps: BucketAmounts;
  split: BucketAmounts;
};

export type PlannerInput = {
  today: LocalDate;
  home: CurrencyCode;
  fx: FxTable;
  inputs: PortfolioInputs;
  debts: DebtInput[];
  risk: RiskResult | null;
  settings?: PlannerSettings;
};

export type Plan = {
  overview: InputsOverview;
  netWorth: NetWorth;
  cashFlow: CashFlow;
  passive: { months: PassiveMonth[]; annual: number; monthlyAverage: number };
  ratios: Ratio[];
  actions: Action[];
  allocation: Allocation;
  /** Invested assets (cash beyond the emergency fund, bonds, stocks), home currency. */
  invested: number;
  expectedReturn: number;
  settings: PlannerSettings;
};

/** Rebalancing is suggested when a bucket is off target by more than this share of the total. */
export const REBALANCE_TOLERANCE = 0.05;

export function buildPlan(input: PlannerInput): Plan {
  const { today, home, fx, inputs, debts, risk } = input;
  const settings = input.settings ?? DEFAULT_PLANNER_SETTINGS;
  const overview = summarizeInputs(inputs, today, home, fx);
  const netWorth = netWorthOf(overview, debts);
  const cashFlow = cashFlowOf(overview, debts);
  const surplus = cashFlow.surplus;

  const months = passiveIncomeCalendar(inputs, today, home, fx);
  const annualPassive = months.reduce((sum, item) => sum + item.coupons + item.dividends, 0);

  const flaggedFund = inputs.cash.some((item) => item.isEmergencyFund);
  const emergencyCash = flaggedFund ? overview.emergencyFund : overview.cash;
  const essentialMonthly =
    overview.essentialExpenses + overview.housing + overview.insurance + cashFlow.debtPayments;
  const revolving = debts.filter((debt) => isRevolving(debt.kind));

  const ratios = healthRatios({
    cashFlow,
    mortgagePayments: mortgagePaymentsOf(inputs, home, fx),
    emergencyCash,
    essentialMonthly,
    revolvingBalance: revolving.reduce((sum, debt) => sum + debt.balance, 0),
    revolvingLimit: revolving.reduce((sum, debt) => sum + debt.creditLimit, 0),
    emergencyTargetMonths: settings.emergencyMonths,
  });

  const profile: RiskProfileKey = risk?.profile ?? 'balanced';
  const target = TARGET_ALLOCATIONS[profile];
  const current = currentAllocation(inputs, overview, home, fx);
  const total = sumOf(current);
  const gaps = allocationGaps(current, target);
  const split = splitContribution(current, target, Math.max(0, surplus));

  const actions: Action[] = [];

  // 1. High-interest debt first: a guaranteed return equal to its rate.
  const highInterest = debts
    .filter(
      (debt) =>
        debt.balance > 0 &&
        !debt.hasGracePeriod &&
        debt.aprPercent != null &&
        debt.aprPercent > settings.highInterestApr
    )
    .map((debt) => ({
      id: debt.id,
      name: debt.name,
      balance: debt.balance,
      aprPercent: debt.aprPercent as number,
    }))
    .sort((a, b) => b.aprPercent - a.aprPercent);
  const highInterestTotal = highInterest.reduce((sum, debt) => sum + debt.balance, 0);
  actions.push({
    key: 'payHighInterest',
    done: highInterest.length === 0,
    threshold: settings.highInterestApr,
    debts: highInterest,
    total: highInterestTotal,
    months: surplus > 0 ? Math.ceil(highInterestTotal / surplus) : null,
    keepStarterFund: highInterest.length > 0 && emergencyCash < essentialMonthly,
  });

  // 2. Emergency fund.
  const target6 = essentialMonthly * settings.emergencyMonths;
  const gap = Math.max(0, target6 - emergencyCash);
  actions.push({
    key: 'emergencyFund',
    done: essentialMonthly > 0 && gap === 0,
    target: target6,
    current: emergencyCash,
    monthsCovered: essentialMonthly > 0 ? emergencyCash / essentialMonthly : null,
    targetMonths: settings.emergencyMonths,
    essentialMonthly,
    gap,
    months: gap > 0 && surplus > 0 ? Math.ceil(gap / surplus) : null,
  });

  // 3. Insurance relative to income.
  const gapsFound = insuranceGaps(inputs, overview.income, home, fx);
  actions.push({
    key: 'insurance',
    done: gapsFound.length === 0,
    gaps: gapsFound,
    annualIncome: overview.income * 12,
  });

  // 4. Invest the surplus by the risk profile (or fix a negative cash flow first).
  if (surplus <= 0 && cashFlow.income > 0) {
    actions.push({ key: 'fixCashFlow', done: false, shortfall: -surplus });
  } else if (surplus > 0) {
    actions.push({
      key: 'invest',
      done: false,
      monthly: surplus,
      profile,
      assumedProfile: risk == null,
      split,
      afterEarlierSteps: highInterest.length > 0 || gap > 0,
    });
  }

  // 5. Rebalance holdings that drifted from the target.
  const largest = BUCKETS.map((bucket) => ({ bucket, gap: gaps[bucket] })).sort(
    (a, b) => Math.abs(b.gap) - Math.abs(a.gap)
  )[0];
  if (total > 0) {
    actions.push({
      key: 'rebalance',
      done: Math.abs(largest.gap) <= total * REBALANCE_TOLERANCE,
      gaps,
      total,
      largest: largest ?? null,
    });
  }

  // 6. Cards stay interest-free only when paid in full.
  const cards = revolving
    .filter((debt) => debt.balance > 0 && debt.aprPercent != null && debt.aprPercent > 0)
    .sort((a, b) => (b.aprPercent ?? 0) - (a.aprPercent ?? 0));
  if (cards.length > 0) {
    actions.push({
      key: 'payCardsInFull',
      done: false,
      highestApr: cards[0].aprPercent as number,
      name: cards[0].name,
    });
  }

  return {
    overview,
    netWorth,
    cashFlow,
    passive: { months, annual: annualPassive, monthlyAverage: annualPassive / 12 },
    ratios,
    actions,
    allocation: { profile, assumedProfile: risk == null, target, current, total, gaps, split },
    invested: total,
    expectedReturn: expectedReturn(target),
    settings,
  };
}

/** Mortgage payments as entered, or estimated, in the home currency (for debt-to-income). */
export function mortgagePaymentsOf(
  inputs: Pick<PortfolioInputs, 'housing'>,
  home: CurrencyCode,
  fx: FxTable
): number {
  return inputs.housing
    .filter((item) => item.kind === 'mortgage')
    .reduce((sum, item) => sum + convert(monthlyHousingCost(item), item.currency, home, fx), 0);
}
