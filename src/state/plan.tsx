import { createContext, useContext, useEffect, type ReactNode } from 'react';

import { upsertSnapshot } from '@/db/planner';
import { monthKey } from '@/domain/dates';
import { buildPlan, debtsFromCredit, type Plan } from '@/domain/portfolioPlanner';
import { scoreRisk } from '@/domain/riskProfile';

import { useCreditData } from './creditData';
import { usePreferences } from './preferences';
import { useWealthData } from './wealthData';

const PlanContext = createContext<Plan | null>(null);

/** The planner's view of everything, computed once for all screens. */
export function PlanProvider({ children }: { children: ReactNode }) {
  const credit = useCreditData();
  const wealth = useWealthData();
  const { prefs } = usePreferences();
  const home = prefs.homeCurrency;
  const plan = buildPlan({
    today: credit.today,
    home,
    fx: credit.fx,
    inputs: {
      incomes: wealth.incomes,
      housing: wealth.housing,
      insurance: wealth.insurance,
      expenses: wealth.expenses,
      cash: wealth.cash,
      bonds: wealth.bonds,
      stocks: wealth.stocks,
    },
    debts: debtsFromCredit(credit.products, credit.installments, credit.today, home, credit.fx),
    risk: wealth.risk ? scoreRisk(wealth.risk.answers) : null,
    settings: wealth.plannerSettings,
  });

  // Keep this month's net-worth snapshot current; past months are left as they were.
  const month = monthKey(credit.today);
  const { assets, liabilities, netWorth } = plan.netWorth;
  const hasData = assets > 0 || liabilities > 0;
  useEffect(() => {
    if (!hasData) return;
    const timer = setTimeout(() => {
      upsertSnapshot(month, { assets, liabilities, netWorth, currency: home });
    }, 1000);
    return () => clearTimeout(timer);
  }, [hasData, month, assets, liabilities, netWorth, home]);

  return <PlanContext.Provider value={plan}>{children}</PlanContext.Provider>;
}

export function usePlan(): Plan {
  const value = useContext(PlanContext);
  if (!value) throw new Error('usePlan must be used inside <PlanProvider>');
  return value;
}
