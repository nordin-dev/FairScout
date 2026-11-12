import type { Loose } from '../../i18n';
import type * as en from '../en/tennisBlind';

const pl = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

/** Svi tekstovi teniskog Slijepog izbora. */
export const tennisBlind: Loose<typeof en.tennisBlind> = {
  kicker: '01 — Slijepi izbor',
  question: 'Šta tražiš?',
  ageLabel: 'Godine',
  ages: [
    { value: '19', label: '19 ili mlađi' },
    { value: '20', label: 'Mlađi od 21' },
  ],
  hiddenLabel: 'Koliko skriven',
  hiddens: [
    { value: '150', label: 'Izvan top 150' },
    { value: '250', label: 'Izvan top 250' },
    { value: '400', label: 'Izvan top 400' },
  ],
  mattersLabel: 'Najvažnije',
  mattersHint: 'izaberi dvoje',
  matters: [
    { value: 'wins', label: 'Dobija mečeve' },
    { value: 'level', label: 'Igra na visokom nivou' },
    { value: 'rise', label: 'Brzo napreduje' },
  ],
  countPlural: 'igrača po tvojim uslovima',
  tooFew: (n: number) =>
    `${pl(n, 'igrač odgovara', 'igrača odgovaraju', 'igrača odgovara')}. Trebaju tri: popusti na godinama ili na plasmanu.`,
  loadingPlayers: 'Učitavam igrače…',
  showThree: 'Pokaži mi trojicu, bez imena →',
  title: 'Tri igrača. Bez imena. Izaberi jednog.',
  ageWords: (maxAge: number) => (maxAge === 20 ? 'Mlađi od 21' : `${maxAge} ili mlađi`),
  summary: (ageWords: string, hidden: number, matters: string[]) =>
    [ageWords, `izvan top ${hidden}`, ...matters].join(' · '),
  matterWords: { wins: 'dobija mečeve', level: 'igra na visokom nivou', rise: 'brzo napreduje' },
  change: 'Promijeni',
  dimLabels: { wins: 'Pobjede', level: 'Nivo igre', rise: 'Napredak' },
  caption:
    'Izgledi = procjena modela da će ući u top 100 u roku od tri godine. Bodovi do 100, u odnosu na ostale igrače iz grupe.',
  candidate: (letter: string) => `Igrač ${letter}`,
  facts: (age: number, hand: 'Right' | 'Left' | null) =>
    `${age} god.${hand === null ? '' : hand === 'Right' ? ' · dešnjak' : ' · ljevak'}`,
  pick: 'Izaberi ovog igrača',
  pickLabel: (letter: string) => `Izaberi igrača ${letter}`,
  labelRanking: 'Plasman',
  labelRecord: 'Pobjede–porazi',
  labelOutlook: 'Izgledi',
  ranking: (rank: number) => `Br. ${rank}`,
  record: (wins: number, losses: number) => `${wins}–${losses}`,
  yourPick: 'Tvoj izbor',
  tagModel: 'Izbor modela',
  tagRanking: 'Najbolji plasman',
  verdictAgree: (letter: string) => `Ti i model se slažete: ${letter}.`,
  verdictAgreeSub: 'Izabran po onome šta radi, a ne po tome ko je. Na tvojoj je listi.',
  verdictDisagree: (you: string, model: string) => `Tvoj izbor je ${you}. Model bira ${model}.`,
  verdictDisagreeSub: 'Obojica idu na tvoju listu. Gdje se ne slažete, vrijedi puta.',
  seeWhy: 'Pogledaj zašto →',
  reasonLabel: (model: string, scout: string) => `${model} i ${scout} jedan pored drugog`,
  reasonCandidate: (letter: string, name: string) => `${letter} · ${name}`,
  reasonRows: {
    tier: 'Izgledi',
    rank: 'Plasman',
    winRate: 'Procenat pobjeda, %',
    age: 'Godine',
    top200: 'Pobjede nad igračima iz top 200',
  },
  noValue: '—',
  reasonAheadMark: '✓',
  reasonAheadWord: 'bolji',
  reasonAheadNote: '✓ = bolji u ovom redu',
  reasonTiers: (model: string, modelTier: string, scout: string, scoutTier: string) =>
    modelTier === scoutTier
      ? `${model} i ${scout} imaju iste izglede: tier ${modelTier}.`
      : `${model} ima izglede tier ${modelTier}, ${scout} tier ${scoutTier}.`,
  reasonTiersBetter: (model: string, modelTier: string, scout: string, scoutTier: string) =>
    `${model} je modelu draži zbog izgleda: tier ${modelTier}, dok je ${scout} tier ${scoutTier}.`,
  reasonScoreHigher: (model: string) => `U tom tieru ${model} kod modela ima više bodova.`,
  reasonDrivers: (model: string, items: string[]) => `${model}, šta model vidi: ${items.join(' · ')}.`,
  reasonAhead: {
    rank: 'bolji plasman',
    winRate: 'viši procenat pobjeda',
    age: 'manje godina',
    top200: 'više pobjeda nad igračima iz top 200',
  },
  reasonBehind: {
    rank: 'slabiji plasman',
    winRate: 'niži procenat pobjeda',
    age: 'više godina',
    top200: 'manje pobjeda nad igračima iz top 200',
  },
  reasonRowsAhead: (model: string, ahead: string, behind: string) =>
    ahead && behind ? `${model} ima ${ahead}, ali ${behind}.` : ahead ? `${model} ima ${ahead}.` : behind ? `${model} ima ${behind}.` : '',
  reasonList: (items: string[]) =>
    items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} i ${items[items.length - 1]}`,
  errorFile: 'tennis.json',
};
