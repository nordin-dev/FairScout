import { seasonOf, type Evidence } from '../../basketball/evidence';

const range = (e: Evidence): string => (e.years ? `seasons ${seasonOf(e.years[0])} to ${seasonOf(e.years[1])}` : 'past seasons');

export const basketEvidence = {
  kicker: '04 — Evidence',
  title: (e: Evidence) => `${e.modelHits} of the model’s ${e.picked} top picks became rotation players. The pool average is ${e.poolRatePct}%.`,
  lede: (e: Evidence) => `${e.byYear.length || 'Past'} past pools, ${range(e)}. Each scored by a model that had seen only earlier seasons.`,
  heroFirst: (e: Evidence) => `Model’s top 10%: ${e.modelHits} of ${e.picked}`,
  heroSecond: (e: Evidence) => `Whole pool: ${e.poolHits} of ${e.pool}`,
  rulesTitle: 'Against simple rules',
  chartTitle: 'Players who became rotation players, by way of picking',
  poolLine: (rate: number) => `All players: ${rate}%`,
  printed: (hits: number, picked: number, percent: number) => `${hits} of ${picked} · ${percent}%`,
  tip: (label: string, hits: number, picked: number) => `${label}: ${hits} of the ${picked} players it picked became rotation players within three seasons.`,
  honest: (e: Evidence): string => {
    if (!e.rival) return '';
    const first = `Picking by ${e.rival.label.toLowerCase()} alone gives ${e.rival.hits} of ${e.picked}.`;
    if (e.verdict === 'inside') return `${first} The model’s lead over it is inside the margin of ±${e.marginPct} points: we cannot claim it beats that rule.`;
    if (e.verdict === 'ahead') return `${first} The model’s lead over it, ${e.leadPct} points, is larger than the margin of ±${e.marginPct} points.`;
    return `${first} The model is not ahead of it.`;
  },
  tiersTitle: 'What a tier meant',
  tierLabel: (tier: string) => `Tier ${tier}`,
  tierCaption: (hits: number, n: number, percent: number) => `${hits} of ${n} became rotation players (${percent}%)`,
  yearsTitle: 'Season by season',
  yearsLabel: 'Each tested season: the pool and the top 10% of two rules',
  headers: { year: 'Season', pool: 'Pool', reached: 'Became rotation players', model: 'Model’s top 10%', rank: 'Most minutes’ top 10%' },
  ofCount: (hits: number, n: number) => `${hits} of ${n}`,
  tally: (t: { ahead: number; level: number; behind: number; years: number }) =>
    `The model’s top 10% was ahead of the most-minutes rule’s in ${t.ahead} of ${t.years} seasons, level in ${t.level}, behind in ${t.behind}.`,
  methodTitle: 'How it was tested',
  method: (e: Evidence, trainedOn: number, poolRule: string, outcome: string) => [
    `The pool: ${poolRule}`,
    `The outcome: ${outcome} That is playing time, not money.`,
    `The model is a logistic regression, fitted on ${trainedOn} players of past pools.`,
    'The test walks forward. Each season’s pool was scored by a model fitted only on pools whose three following seasons had already ended.',
    `The picks are the top 10% of each season’s pool, ${e.picked} players in all. The other rules pick the same number.`,
  ],
  inputsTitle: 'What the model looks at',
  inputLine: (words: string) => `${words}: higher score`,
  /** Name of each input, then the words that raise the score when its weight is positive, and when it is negative. */
  inputs: {
    age: ['Age', 'older', 'younger'],
    mpg: ['Minutes a game', 'more minutes a game', 'fewer minutes a game'],
    pir40: ['Index rating per 40 minutes', 'a higher index rating per 40 minutes', 'a lower index rating per 40 minutes'],
    pts40: ['Points per 40 minutes', 'more points per 40 minutes', 'fewer points per 40 minutes'],
    games: ['Games', 'more games played', 'fewer games played'],
    euroleague: ['Competition', 'playing in the EuroLeague rather than the EuroCup', 'playing in the EuroCup rather than the EuroLeague'],
  } as Record<string, [string, string, string]>,
  limitsTitle: 'Limits',
  limits: [
    'The pools are small, a few dozen players a season. One season can swing the picture.',
    'The outcome is playing time, not money.',
    'A move to the NBA or to a league outside these two competitions counts as not reached.',
    'Only EuroLeague and EuroCup are covered, so younger talents in domestic leagues are not in the data.',
  ],
  loadingNote: 'Loading the test…',
  errorReason: 'The basketball test did not arrive.',
};
