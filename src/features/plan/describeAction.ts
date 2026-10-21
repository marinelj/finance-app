import type { TFunction } from 'i18next';

import { roundTo } from '@/domain/money';
import { TARGET_ALLOCATIONS, type Action, type Bucket } from '@/domain/portfolioPlanner';
import type { RiskProfileKey } from '@/domain/riskProfile';

export type ActionText = { title: string; lines: string[]; done: boolean };

type Context = {
  t: TFunction;
  money: (amount: number) => string;
  percent: (fraction: number) => string;
};

const bucketKey = (bucket: Bucket) => `plan.buckets.${bucket}` as const;
const profileKey = (profile: RiskProfileKey) => `risk.profiles.${profile}` as const;

/** The plain-language title and reasoning for one step of the plan. */
export function describeAction(action: Action, { t, money, percent }: Context): ActionText {
  switch (action.key) {
    case 'payHighInterest': {
      if (action.done) {
        return {
          title: t('plan.actions.payHighInterest.titleDone'),
          lines: [t('plan.actions.payHighInterest.reasonDone', { threshold: action.threshold })],
          done: true,
        };
      }
      const [first, ...rest] = action.debts;
      const lines = [
        t('plan.actions.payHighInterest.reason', {
          name: first.name,
          apr: roundTo(first.aprPercent, 2),
          threshold: action.threshold,
        }),
      ];
      if (rest.length > 0) {
        lines.push(
          t('plan.actions.payHighInterest.then', {
            others: rest.map((debt) => `${debt.name} (${roundTo(debt.aprPercent, 2)}%)`).join(', '),
          })
        );
      }
      if (action.months != null) {
        lines.push(t('plan.actions.payHighInterest.timeline', { count: action.months }));
      }
      if (action.keepStarterFund) lines.push(t('plan.actions.payHighInterest.starter'));
      return { title: t('plan.actions.payHighInterest.title'), lines, done: false };
    }
    case 'emergencyFund': {
      if (action.essentialMonthly <= 0) {
        return {
          title: t('plan.actions.emergencyFund.titleDone'),
          lines: [t('plan.actions.emergencyFund.noEssentials')],
          done: false,
        };
      }
      const covered = roundTo(action.monthsCovered ?? 0, 1);
      if (action.done) {
        return {
          title: t('plan.actions.emergencyFund.titleDone'),
          lines: [
            t('plan.actions.emergencyFund.reasonDone', { covered, months: action.targetMonths }),
          ],
          done: true,
        };
      }
      const lines = [
        t('plan.actions.emergencyFund.reason', {
          essential: money(action.essentialMonthly),
          months: action.targetMonths,
          target: money(action.target),
          current: money(action.current),
          covered,
        }),
      ];
      if (action.months != null) {
        lines.push(
          t('plan.actions.emergencyFund.timeline', { count: action.months, gap: money(action.gap) })
        );
      }
      return {
        title: t('plan.actions.emergencyFund.title', { amount: money(action.target) }),
        lines,
        done: false,
      };
    }
    case 'insurance': {
      if (action.done) {
        return {
          title: t('plan.actions.insurance.titleDone'),
          lines: [t('plan.actions.insurance.reasonDone')],
          done: true,
        };
      }
      const lines = action.gaps.map((gap) => {
        switch (gap.key) {
          case 'noHealth':
            return t('plan.actions.insurance.noHealth');
          case 'lowLife':
            return t('plan.actions.insurance.lowLife', {
              coverage: money(gap.coverage),
              suggested: money(gap.suggested),
            });
          case 'noCriticalIllness':
            return t('plan.actions.insurance.noCriticalIllness', {
              suggested: money(gap.suggested),
            });
          case 'highPremiums':
            return t('plan.actions.insurance.highPremiums', { share: percent(gap.share) });
        }
      });
      lines.push(t('plan.actions.insurance.guideOnly'));
      return { title: t('plan.actions.insurance.title'), lines, done: false };
    }
    case 'fixCashFlow':
      return {
        title: t('plan.actions.fixCashFlow.title'),
        lines: [t('plan.actions.fixCashFlow.reason', { amount: money(action.shortfall) })],
        done: false,
      };
    case 'invest': {
      const lines = [
        t('plan.actions.invest.reason', {
          profile: t(profileKey(action.profile)),
          equity: percent(equityShare(action.profile)),
        }),
      ];
      if (action.afterEarlierSteps) lines.push(t('plan.actions.invest.after'));
      if (action.assumedProfile) lines.push(t('plan.actions.invest.assumed'));
      return {
        title: t('plan.actions.invest.title', { amount: money(action.monthly) }),
        lines,
        done: false,
      };
    }
    case 'rebalance': {
      if (action.done || !action.largest) {
        return {
          title: t('plan.actions.rebalance.titleDone'),
          lines: [t('plan.actions.rebalance.reasonDone')],
          done: true,
        };
      }
      const { bucket, gap } = action.largest;
      const params = { bucket: t(bucketKey(bucket)), amount: money(Math.abs(gap)) };
      return {
        title: t('plan.actions.rebalance.title'),
        lines: [
          gap < 0
            ? t('plan.actions.rebalance.over', params)
            : t('plan.actions.rebalance.under', params),
        ],
        done: false,
      };
    }
    case 'payCardsInFull':
      return {
        title: t('plan.actions.payCardsInFull.title'),
        lines: [
          t('plan.actions.payCardsInFull.reason', {
            name: action.name,
            apr: roundTo(action.highestApr, 2),
          }),
        ],
        done: false,
      };
  }
}

/** The stock share of a profile's target, for "targets 70% in stocks". */
function equityShare(profile: RiskProfileKey): number {
  const target = TARGET_ALLOCATIONS[profile];
  return target.domestic_equity + target.international_equity;
}
