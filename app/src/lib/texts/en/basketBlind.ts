/** All user-visible English text of the basketball blind pick. */
export const basketBlind = {
  kicker: '01 — Blind pick',
  question: 'What are you looking for?',
  positionLabel: 'Position',
  positions: [
    { value: 'Any', label: 'Any' },
    { value: 'Guard', label: 'Guard' },
    { value: 'Forward', label: 'Forward' },
    { value: 'Center', label: 'Center' },
  ],
  ageLabel: 'Age',
  ages: [
    { value: '21', label: 'Under 21' },
    { value: '23', label: 'Under 23' },
  ],
  hiddenLabel: 'How hidden',
  hiddens: [
    { value: '18', label: 'Under 18 min a game' },
    { value: '12', label: 'Under 12 min a game' },
    { value: '8', label: 'Under 8 min a game' },
  ],
  mattersLabel: 'Most important',
  mattersHint: 'pick two',
  matters: [
    { value: 'scoring', label: 'Scores' },
    { value: 'impact', label: 'All-round impact' },
    { value: 'trust', label: 'Coach’s trust' },
  ],
  countPlural: 'players match',
  tooFew: (n: number) => `${n === 1 ? 'player matches' : 'players match'}. Three are needed: loosen the position, the age or the minutes.`,
  loadingPlayers: 'Loading players…',
  showThree: 'Show me three, no names →',
  title: 'Three players. No names. Pick one.',
  summary: (position: string, age: string, hidden: number, matters: string[]) =>
    [position === 'Any' ? 'Any position' : position, age, `under ${hidden} min a game`, ...matters].join(' · '),
  matterWords: { scoring: 'scores', impact: 'all-round impact', trust: 'coach’s trust' },
  change: 'Change',
  dimLabels: { scoring: 'Scoring', impact: 'All-round impact', trust: 'Coach’s trust' },
  caption: (minutes: number) =>
    `Outlook = the model’s estimate of becoming a rotation player (${minutes} minutes a game) within three seasons. Scores out of 100, against the other players of the pool.`,
  candidate: (letter: string) => `Player ${letter}`,
  facts: (position: string | null, age: number, height: number | null) =>
    [position, `age ${age}`, height === null ? null : `${height} cm`].filter(Boolean).join(' · '),
  pick: 'Pick this player',
  pickLabel: (letter: string) => `Pick player ${letter}`,
  labelMinutes: 'Minutes',
  labelPoints: 'Points',
  labelOutlook: 'Outlook',
  perGame: (n: number) => `${n.toFixed(1)} a game`,
  yourPick: 'Your pick',
  tagModel: 'Model’s pick',
  tagMinutes: 'Most minutes',
  verdictAgree: (letter: string) => `You and the model agree: ${letter}.`,
  verdictAgreeSub: 'Chosen on what he does, not on who he is. He is on your list.',
  verdictDisagree: (you: string, model: string) => `You picked ${you}. The model picks ${model}.`,
  verdictDisagreeSub: 'Both go on your list. Where you disagree is worth a trip.',
  seeWhy: 'See why →',
  reasonLabel: (model: string, scout: string) => `${model} and ${scout} side by side`,
  reasonCandidate: (letter: string, name: string) => `${letter} · ${name}`,
  reasonRows: {
    tier: 'Outlook',
    mpg: 'Minutes per game',
    ppg: 'Points per game',
    pir40: 'Index rating per 40 min',
    age: 'Age',
  },
  noValue: '—',
  reasonAheadMark: '✓',
  reasonAheadWord: 'ahead',
  reasonAheadNote: '✓ = ahead on this row',
  reasonTiers: (model: string, modelTier: string, scout: string, scoutTier: string) =>
    modelTier === scoutTier
      ? `${model} and ${scout} are both outlook ${modelTier}.`
      : `${model} is outlook ${modelTier}, ${scout} is outlook ${scoutTier}.`,
  reasonTiersBetter: (model: string, modelTier: string, scout: string, scoutTier: string) =>
    `The model prefers ${model} for his outlook: tier ${modelTier}, against tier ${scoutTier} for ${scout}.`,
  reasonScoreHigher: (model: string) => `Inside that tier the model scores ${model} higher.`,
  reasonDrivers: (model: string, items: string[]) => `What the model sees in ${model}: ${items.join(' · ')}.`,
  reasonAhead: {
    mpg: 'more minutes',
    ppg: 'more points',
    pir40: 'a higher index rating',
    age: 'a younger age',
  },
  reasonBehind: {
    mpg: 'fewer minutes',
    ppg: 'fewer points',
    pir40: 'a lower index rating',
    age: 'an older age',
  },
  reasonRowsAhead: (model: string, ahead: string, behind: string) =>
    ahead && behind ? `${model} has ${ahead}, but ${behind}.` : ahead ? `${model} has ${ahead}.` : behind ? `${model} has ${behind}.` : '',
  reasonList: (items: string[]) =>
    items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`,
  errorFile: 'basketball.json',
};
