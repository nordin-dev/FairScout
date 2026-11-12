/** All user-visible English text of the tennis blind pick. */
export const tennisBlind = {
  kicker: '01 — Blind pick',
  question: 'What are you looking for?',
  ageLabel: 'Age',
  ages: [
    { value: '19', label: '19 or under' },
    { value: '20', label: 'Under 21' },
  ],
  hiddenLabel: 'How hidden',
  hiddens: [
    { value: '150', label: 'Outside the top 150' },
    { value: '250', label: 'Outside the top 250' },
    { value: '400', label: 'Outside the top 400' },
  ],
  mattersLabel: 'Most important',
  mattersHint: 'pick two',
  matters: [
    { value: 'wins', label: 'Wins matches' },
    { value: 'level', label: 'Plays at a high level' },
    { value: 'rise', label: 'Climbing fast' },
  ],
  countPlural: 'players match',
  tooFew: (n: number) => `${n === 1 ? 'player matches' : 'players match'}. Three are needed: loosen the age or the ranking.`,
  loadingPlayers: 'Loading players…',
  showThree: 'Show me three, no names →',
  title: 'Three players. No names. Pick one.',
  ageWords: (maxAge: number) => (maxAge === 20 ? 'Under 21' : `${maxAge} or under`),
  summary: (ageWords: string, hidden: number, matters: string[]) =>
    [ageWords, `outside the top ${hidden}`, ...matters].join(' · '),
  matterWords: { wins: 'wins matches', level: 'plays at a high level', rise: 'climbing fast' },
  change: 'Change',
  dimLabels: { wins: 'Winning', level: 'Level of play', rise: 'Climbing' },
  caption:
    'Outlook = the model’s estimate of reaching the top 100 within three years. Scores out of 100, against the other players of the pool.',
  candidate: (letter: string) => `Player ${letter}`,
  facts: (age: number, hand: 'Right' | 'Left' | null) =>
    `age ${age}${hand === null ? '' : hand === 'Right' ? ' · right-handed' : ' · left-handed'}`,
  pick: 'Pick this player',
  pickLabel: (letter: string) => `Pick player ${letter}`,
  labelRanking: 'Ranking',
  labelRecord: 'Win–loss',
  labelOutlook: 'Outlook',
  ranking: (rank: number) => `No. ${rank}`,
  record: (wins: number, losses: number) => `${wins}–${losses}`,
  yourPick: 'Your pick',
  tagModel: 'Model’s pick',
  tagRanking: 'Best ranking',
  verdictAgree: (letter: string) => `You and the model agree: ${letter}.`,
  verdictAgreeSub: 'Chosen on what he does, not on who he is. He is on your list.',
  verdictDisagree: (you: string, model: string) => `You picked ${you}. The model picks ${model}.`,
  verdictDisagreeSub: 'Both go on your list. Where you disagree is worth a trip.',
  seeWhy: 'See why →',
  reasonLabel: (model: string, scout: string) => `${model} and ${scout} side by side`,
  reasonCandidate: (letter: string, name: string) => `${letter} · ${name}`,
  reasonRows: {
    tier: 'Outlook',
    rank: 'Ranking',
    winRate: 'Win rate, %',
    age: 'Age',
    top200: 'Wins over top-200 players',
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
    rank: 'a better ranking',
    winRate: 'a higher win rate',
    age: 'a younger age',
    top200: 'more wins over top-200 players',
  },
  reasonBehind: {
    rank: 'a worse ranking',
    winRate: 'a lower win rate',
    age: 'an older age',
    top200: 'fewer wins over top-200 players',
  },
  reasonRowsAhead: (model: string, ahead: string, behind: string) =>
    ahead && behind ? `${model} has ${ahead}, but ${behind}.` : ahead ? `${model} has ${ahead}.` : behind ? `${model} has ${behind}.` : '',
  reasonList: (items: string[]) =>
    items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`,
  errorFile: 'tennis.json',
};
