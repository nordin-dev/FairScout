import type { Loose } from '../../i18n';
import type * as en from '../en/tennisTimeMachine';

const pl = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];
const MONTHS_GEN = ['januara', 'februara', 'marta', 'aprila', 'maja', 'juna', 'jula', 'augusta', 'septembra', 'oktobra', 'novembra', 'decembra'];

/** "juni 2022" postaje "juna 2022", a "27 juni 2019" postaje "27. juna 2019". */
const gen = (date: string) =>
  date
    .split(' ')
    .map((word) => (MONTHS.includes(word) ? MONTHS_GEN[MONTHS.indexOf(word)] : word))
    .join(' ')
    .replace(/^(\d{1,2}) /, '$1. ');

const usli = (n: number) => pl(n, 'je ušao', 'su ušla', 'je ušlo');

export const tennisTimeMachine: Loose<typeof en.tennisTimeMachine> = {
  kicker: '03 — Vremeplov',
  yearsLabel: 'Godina',
  loadingNote: 'Učitavam ranije godine…',
  errorReason: 'Teniski podaci se nisu učitali.',
  emptyTitle: 'Još se nijedna ranija godina ne može provjeriti.',
  emptyLede: 'Godina se može provjeriti tri godine nakon što završi.',
  emptyBlockTitle: 'U podacima nema ranijih godina.',
  emptyBlockText: 'Test modela na ranijim godinama je na ekranu Dokazi.',
  openEvidence: 'Otvori Dokaze →',
  evidencePath: '/evidence',
  thenTitle: (monthYear: string, n: number) => `Sada je ${monthYear}. Ovo je top ${n} po modelu.`,
  thenLede: (date: string, pool: number) =>
    `ATP plasman od ${gen(date)}: ${pool} igrača mlađih od 21 s plasmanom od 101 do 1000. Model je vidio samo ranije godine.`,
  revealedTitle: (hits: number, n: number) => `${hits} od ${n} ${usli(hits)} u top 100 u roku od tri godine.`,
  revealedLede: (pool: number, poolHits: number) => `Od svih ${pool} igrača u grupi, to je uspjelo njih ${poolHits}.`,
  reveal: (monthYear: string) => `Pokaži šta se desilo do ${gen(monthYear)} →`,
  hide: 'Sakrij ponovo',
  listLabel: 'Tadašnji najbolji igrači po modelu, od najboljeg',
  head: { player: 'Igrač', age: 'God', rank: 'Tadašnji plasman', tier: 'Tier modela', later: 'Najbolji plasman otad', outcome: 'Ishod' },
  rankNo: (n: number) => `Br. ${n}`,
  noRanking: 'bez plasmana',
  reached: (monthYear: string) => `Ušao u top 100 · ${monthYear}`,
  reachedNoDate: 'Ušao u top 100',
  notReached: 'Nije ušao u top 100',
  hiddenLabel: 'skriveno dok ne pokažeš šta se desilo',
  missedTitle: 'Koga je model propustio',
  missedLabel: 'Igrači izvan vrha modela koji su ušli u top 100',
  missedLede: (n: number, top: number) =>
    n === 0
      ? `Nijedan igrač izvan top ${top} modela nije ušao u top 100.`
      : `${n} ${pl(n, 'igrač', 'igrača', 'igrača')} izvan top ${top} modela također ${usli(n)} u top 100.`,
  tierThen: (tier: string) => `Tada tier ${tier}`,
  months: MONTHS,
};
