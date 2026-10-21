/**
 * Risk profile questionnaire: five questions, each scored 0–4, mapped to one of five profiles.
 * Two guardrails override a high score: money needed within three years, or selling everything
 * after a 20% drop, both cap the profile at "cautious", because a plan you abandon in a downturn
 * is worse than a calmer one you keep.
 */

export const HORIZONS = ['under3', '3to7', '7to15', 'over15'] as const;
export type Horizon = (typeof HORIZONS)[number];

export const GOALS = ['preserve', 'income', 'balanced', 'growth'] as const;
export type Goal = (typeof GOALS)[number];

export const DROP_REACTIONS = ['sell_all', 'sell_some', 'hold', 'buy_more'] as const;
export type DropReaction = (typeof DROP_REACTIONS)[number];

export const INCOME_STABILITY = ['unstable', 'variable', 'stable', 'very_stable'] as const;
export type IncomeStability = (typeof INCOME_STABILITY)[number];

export const RISK_PROFILES = [
  'conservative',
  'cautious',
  'balanced',
  'growth',
  'aggressive',
] as const;
export type RiskProfileKey = (typeof RISK_PROFILES)[number];

export type RiskAnswers = {
  age: number;
  horizon: Horizon;
  goal: Goal;
  dropReaction: DropReaction;
  incomeStability: IncomeStability;
};

export type RiskQuestion = keyof RiskAnswers;

const HORIZON_POINTS: Record<Horizon, number> = { under3: 0, '3to7': 2, '7to15': 3, over15: 4 };
const GOAL_POINTS: Record<Goal, number> = { preserve: 0, income: 1, balanced: 2, growth: 4 };
const DROP_POINTS: Record<DropReaction, number> = {
  sell_all: 0,
  sell_some: 1,
  hold: 3,
  buy_more: 4,
};
const STABILITY_POINTS: Record<IncomeStability, number> = {
  unstable: 0,
  variable: 1,
  stable: 3,
  very_stable: 4,
};

export function agePoints(age: number): number {
  if (age < 30) return 4;
  if (age < 40) return 3;
  if (age < 50) return 2;
  if (age < 60) return 1;
  return 0;
}

export const MAX_RISK_SCORE = 20;

export type RiskResult = {
  score: number;
  profile: RiskProfileKey;
  /** Points per question, for explaining the result. */
  points: Record<RiskQuestion, number>;
  /** Why the profile is lower than the score alone suggests, if it is. */
  cappedBy: ('shortHorizon' | 'sellsInDrop')[];
};

function profileForScore(score: number): RiskProfileKey {
  if (score <= 5) return 'conservative';
  if (score <= 9) return 'cautious';
  if (score <= 13) return 'balanced';
  if (score <= 16) return 'growth';
  return 'aggressive';
}

export function scoreRisk(answers: RiskAnswers): RiskResult {
  const points: Record<RiskQuestion, number> = {
    age: agePoints(answers.age),
    horizon: HORIZON_POINTS[answers.horizon],
    goal: GOAL_POINTS[answers.goal],
    dropReaction: DROP_POINTS[answers.dropReaction],
    incomeStability: STABILITY_POINTS[answers.incomeStability],
  };
  const score = Object.values(points).reduce((sum, value) => sum + value, 0);
  const uncapped = profileForScore(score);
  const reasons: RiskResult['cappedBy'] = [];
  if (answers.horizon === 'under3') reasons.push('shortHorizon');
  if (answers.dropReaction === 'sell_all') reasons.push('sellsInDrop');
  const aboveCap = RISK_PROFILES.indexOf(uncapped) > RISK_PROFILES.indexOf('cautious');
  const capped = aboveCap && reasons.length > 0;
  return {
    score,
    profile: capped ? 'cautious' : uncapped,
    points,
    cappedBy: capped ? reasons : [],
  };
}

export function isCompleteAnswers(
  value: Partial<RiskAnswers> | null | undefined
): value is RiskAnswers {
  return (
    value != null &&
    typeof value.age === 'number' &&
    value.age >= 16 &&
    value.age <= 110 &&
    HORIZONS.includes(value.horizon as Horizon) &&
    GOALS.includes(value.goal as Goal) &&
    DROP_REACTIONS.includes(value.dropReaction as DropReaction) &&
    INCOME_STABILITY.includes(value.incomeStability as IncomeStability)
  );
}
