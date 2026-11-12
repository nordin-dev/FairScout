import type { Loose } from '../../i18n';
import type * as en from '../en/basketBlind';

const pl = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

/** Pozicije stižu kao engleske vrijednosti; ovdje su njihovi bosanski nazivi. */
const POSITIONS: Record<string, string> = { Guard: 'Bek', Forward: 'Krilo', Center: 'Centar' };
const position = (value: string | null) => (value === null ? null : (POSITIONS[value] ?? value));

/** Svi tekstovi košarkaškog Slijepog izbora. */
export const basketBlind: Loose<typeof en.basketBlind> = {
  kicker: '01 — Slijepi izbor',
  question: 'Šta tražiš?',
  positionLabel: 'Pozicija',
  positions: [
    { value: 'Any', label: 'Bilo koja' },
    { value: 'Guard', label: 'Bek' },
    { value: 'Forward', label: 'Krilo' },
    { value: 'Center', label: 'Centar' },
  ],
  ageLabel: 'Godine',
  ages: [
    { value: '21', label: 'Mlađi od 21' },
    { value: '23', label: 'Mlađi od 23' },
  ],
  hiddenLabel: 'Koliko skriven',
  hiddens: [
    { value: '18', label: 'Ispod 18 min po utakmici' },
    { value: '12', label: 'Ispod 12 min po utakmici' },
    { value: '8', label: 'Ispod 8 min po utakmici' },
  ],
  mattersLabel: 'Najvažnije',
  mattersHint: 'izaberi dvoje',
  matters: [
    { value: 'scoring', label: 'Poentira' },
    { value: 'impact', label: 'Ukupan doprinos' },
    { value: 'trust', label: 'Povjerenje trenera' },
  ],
  countPlural: 'igrača po tvojim uslovima',
  tooFew: (n: number) =>
    `${pl(n, 'igrač odgovara', 'igrača odgovaraju', 'igrača odgovara')}. Trebaju tri: popusti na poziciji, godinama ili minutama.`,
  loadingPlayers: 'Učitavam igrače…',
  showThree: 'Pokaži mi trojicu, bez imena →',
  title: 'Tri igrača. Bez imena. Izaberi jednog.',
  summary: (pos: string, age: string, hidden: number, matters: string[]) =>
    [pos === 'Any' ? 'Bilo koja pozicija' : position(pos), age, `ispod ${hidden} min po utakmici`, ...matters].join(' · '),
  matterWords: { scoring: 'poentira', impact: 'ukupan doprinos', trust: 'povjerenje trenera' },
  change: 'Promijeni',
  dimLabels: { scoring: 'Poeni', impact: 'Ukupan doprinos', trust: 'Povjerenje trenera' },
  caption: (minutes: number) =>
    `Izgledi = procjena modela da će postati igrač rotacije (${minutes} minuta po utakmici) u roku od tri sezone. Bodovi do 100, u odnosu na ostale igrače iz grupe.`,
  candidate: (letter: string) => `Igrač ${letter}`,
  facts: (pos: string | null, age: number, height: number | null) =>
    [position(pos), `${age} god.`, height === null ? null : `${height} cm`].filter(Boolean).join(' · '),
  pick: 'Izaberi ovog igrača',
  pickLabel: (letter: string) => `Izaberi igrača ${letter}`,
  labelMinutes: 'Minute',
  labelPoints: 'Poeni',
  labelOutlook: 'Izgledi',
  perGame: (n: number) => `${n.toFixed(1)} po utakmici`,
  yourPick: 'Tvoj izbor',
  tagModel: 'Izbor modela',
  tagMinutes: 'Najviše minuta',
  verdictAgree: (letter: string) => `Ti i model se slažete: ${letter}.`,
  verdictAgreeSub: 'Izabran po onome šta radi, a ne po tome ko je. Na tvojoj je listi.',
  verdictDisagree: (you: string, model: string) => `Tvoj izbor je ${you}. Model bira ${model}.`,
  verdictDisagreeSub: 'Obojica idu na tvoju listu. Gdje se ne slažete, vrijedi puta.',
  seeWhy: 'Pogledaj zašto →',
  reasonLabel: (model: string, scout: string) => `${model} i ${scout} jedan pored drugog`,
  reasonCandidate: (letter: string, name: string) => `${letter} · ${name}`,
  reasonRows: {
    tier: 'Izgledi',
    mpg: 'Minute po utakmici',
    ppg: 'Poeni po utakmici',
    pir40: 'Indeks korisnosti na 40 min',
    age: 'Godine',
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
    mpg: 'više minuta',
    ppg: 'više poena',
    pir40: 'viši indeks korisnosti',
    age: 'manje godina',
  },
  reasonBehind: {
    mpg: 'manje minuta',
    ppg: 'manje poena',
    pir40: 'niži indeks korisnosti',
    age: 'više godina',
  },
  reasonRowsAhead: (model: string, ahead: string, behind: string) =>
    ahead && behind ? `${model} ima ${ahead}, ali ${behind}.` : ahead ? `${model} ima ${ahead}.` : behind ? `${model} ima ${behind}.` : '',
  reasonList: (items: string[]) =>
    items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} i ${items[items.length - 1]}`,
  errorFile: 'basketball.json',
};
