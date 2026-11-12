import type { Evidence } from '../../tennis/evidence';

const range = (e: Evidence): string => (e.years ? `${e.years[0]} to ${e.years[1]}` : 'past years');

export const tennisEvidence = {
  kicker: '04 — Evidence',
  title: (e: Evidence) => `${e.modelHits} of the model’s ${e.picked} top picks reached the top 100. The pool average is ${e.poolRatePct}%.`,
  lede: (e: Evidence) => `${e.byYear.length || 'Past'} pools, ${range(e)}. Each scored by a model that had seen only earlier years.`,
  heroFirst: (e: Evidence) => `Model’s top 10%: ${e.modelHits} of ${e.picked}`,
  heroSecond: (e: Evidence) => `Whole pool: ${e.poolHits} of ${e.pool}`,
  rulesTitle: 'Against simple rules',
  rulesSub: 'Players who reached the top 100 within three years, by way of picking.',
  chartTitle: 'Players who reached the top 100, by way of picking',
  poolLine: (rate: number) => `All players: ${rate}%`,
  printed: (hits: number, picked: number, percent: number) => `${hits} of ${picked} · ${percent}%`,
  tip: (label: string, hits: number, picked: number) => `${label}: ${hits} of the ${picked} players it picked reached the top 100 within three years.`,
  honest: (e: Evidence): string => {
    if (!e.rival) return '';
    const first = `Picking by ${e.rival.label.toLowerCase()} alone gives ${e.rival.hits} of ${e.picked}.`;
    if (e.verdict === 'inside') return `${first} The model’s lead over it is inside the margin of ±${e.marginPct} points: we cannot claim it beats that rule.`;
    if (e.verdict === 'ahead') return `${first} The model’s lead over it, ${e.leadPct} points, is larger than the margin of ±${e.marginPct} points.`;
    return `${first} The model is not ahead of it.`;
  },
  tiersTitle: 'What a tier meant',
  tierLabel: (tier: string) => `Tier ${tier}`,
  tierCaption: (hits: number, n: number, percent: number) => `${hits} of ${n} reached the top 100 (${percent}%)`,
  yearsTitle: 'Year by year',
  yearsLabel: 'Each test year: the pool and the top 10% of two rules',
  headers: { year: 'Year', pool: 'Pool', reached: 'Reached the top 100', model: 'Model’s top 10%', rank: 'Best ranking’s top 10%' },
  ofCount: (hits: number, n: number) => `${hits} of ${n}`,
  tally: (t: { ahead: number; level: number; behind: number; years: number }) =>
    `The model’s top 10% was ahead of the best ranking’s in ${t.ahead} of ${t.years} years, level in ${t.level}, behind in ${t.behind}.`,
  methodTitle: 'How it was tested',
  method: (e: Evidence, trainedOn: number, poolRule: string, outcome: string) => [
    `The pool: ${poolRule}.`,
    `The outcome: ${outcome}. That is a place in the ranking, not a market value.`,
    `The model is a logistic regression, fitted on ${trainedOn} players of past pools.`,
    'The test walks forward. Each year’s pool was scored by a model fitted only on pools whose three years had already ended.',
    `The picks are the top 10% of each year’s pool, ${e.picked} players in all. The other rules pick the same number.`,
  ],
  inputsTitle: 'What the model looks at',
  inputLine: (words: string) => `${words}: higher score`,
  /** Name of each input, then the words that raise the score when its weight is positive, and when it is negative. */
  inputs: {
    age: ['Age', 'older', 'younger'],
    log_rank: ['Ranking', 'a worse ranking', 'a better ranking'],
    win_pct: ['Win rate', 'a higher win rate', 'a lower win rate'],
    upper_share: ['Level', 'more matches at Challenger level or higher', 'fewer matches at Challenger level or higher'],
    log_top200_wins: ['Top-200 wins', 'more wins over top-200 players', 'fewer wins over top-200 players'],
  } as Record<string, [string, string, string]>,
  limitsTitle: 'Limits',
  limits: (date: string) => [
    'The pools are small, about a hundred players a year. One year can swing the picture.',
    'The outcome is a place in the ranking, not a market value.',
    `The data ends on ${date}.`,
    'Men’s tour only.',
    'Picking by best ranking alone is nearly as good.',
  ],
  loadingNote: 'Loading the test…',
  errorReason: 'The tennis test did not arrive.',
};
