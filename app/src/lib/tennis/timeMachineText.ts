const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const tennisTimeMachine = {
  kicker: '03 — Time machine',
  yearsLabel: 'Year',
  loadingNote: 'Loading past years…',
  errorReason: 'The tennis data did not load.',
  emptyTitle: 'No past year can be checked yet.',
  emptyLede: 'A year can be checked three years after it ends.',
  emptyBlockTitle: 'No past years in the data.',
  emptyBlockText: 'The model’s test on past years is on the evidence screen.',
  openEvidence: 'Open the evidence →',
  evidencePath: '/evidence',
  thenTitle: (monthYear: string, n: number) => `It is ${monthYear}. These are the model’s top ${n}.`,
  thenLede: (date: string, pool: number) =>
    `ATP ranking of ${date}: ${pool} players under 21 ranked 101 to 1000. The model had seen only earlier years.`,
  revealedTitle: (hits: number, n: number) => `${hits} of the ${n} reached the top 100 within three years.`,
  revealedLede: (pool: number, poolHits: number) => `Of all ${pool} players in the pool, ${poolHits} did.`,
  reveal: (monthYear: string) => `Show what happened by ${monthYear} →`,
  hide: 'Hide again',
  listLabel: 'The model’s top players then, best first',
  head: { player: 'Player', age: 'Age', rank: 'Ranking then', tier: 'Model tier', later: 'Best ranking since', outcome: 'Outcome' },
  rankNo: (n: number) => `No. ${n}`,
  noRanking: 'no ranking',
  reached: (monthYear: string) => `Reached the top 100 · ${monthYear}`,
  reachedNoDate: 'Reached the top 100',
  notReached: 'Did not reach the top 100',
  hiddenLabel: 'hidden until you show what happened',
  missedTitle: 'Who the model missed',
  missedLabel: 'Players outside the model’s top group who reached the top 100',
  missedLede: (n: number, top: number) =>
    n === 0
      ? `No player outside the model’s top ${top} reached the top 100.`
      : `${n} ${plural(n, 'player', 'players')} outside the model’s top ${top} also reached the top 100.`,
  tierThen: (tier: string) => `Tier ${tier} then`,
  months: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ],
};
