import type { Loose } from '../../i18n';
import type * as en from '../en/tennisCard';

const pl = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

export const tennisCard: Loose<typeof en.tennisCard> = {
  backToBlind: '← Nazad na Slijepi izbor',
  backToRadar: '← Nazad na Radar',
  headline: (age: number, country: string, hand: 'Right' | 'Left' | null): string =>
    ['Tenis', `${age} god.`, country, hand ? (hand === 'Left' ? 'ljevak' : 'dešnjak') : ''].filter(Boolean).join(' · '),
  ranking: 'Plasman',
  yearAgo: 'Prije godinu dana',
  record: 'Pobjede–porazi, zadnje 52 sedmice',
  top200: 'Pobjede nad igračima iz top 200',
  bestWin: 'Najbolja pobjeda',
  rankFigure: (n: number) => `Br. ${n}`,
  dash: '—',
  captions: {
    ranking: (date: string) => `ATP, ${date}`,
    yearAgo: 'ATP plasman',
    record: 'Svi nivoi',
    top200: 'Zadnje 52 sedmice',
    bestWin: 'Po plasmanu poraženog',
  },
  recordFigure: (w: number, l: number) => `${w}–${l}`,
  outlookLabel: 'Izgledi',
  gives: (percent: number) => `Bodovi modela: ${percent} od 100 za plasman u top 100 u roku od tri godine.`,
  tierLine: (tier: string, n: number, hits: number) =>
    `Od ${n} ranijih igrača iz tiera ${tier}, ${hits} ${pl(hits, 'je ušao', 'su ušla', 'je ušlo')} u top 100 u roku od tri godine.`,
  caution: 'Ovo su raniji ishodi sličnih igrača, a ne prognoza za ovog.',
  whyLabel: 'Šta model vidi',
  plusSign: '+',
  minusSign: '−',
  plusLabel: 'Pomaže',
  minusLabel: 'Odmaže',
  flagUnder18: 'Mlađi od 18',
  flagLow: 'Malo mečeva',
  chartLabel: 'Plasman kroz tri godine',
  chartNote: 'Više na grafikonu znači bolji plasman. Skala je logaritamska.',
  chartEmpty: 'Nema dovoljno historije plasmana za grafikon.',
  chartAlt: (first: string, firstDate: string, last: string, lastDate: string) =>
    `Plasman od ${first} (${firstDate}) do ${last} (${lastDate}).`,
  topLine: 'Top 100',
  notFoundTitle: 'Ovog igrača nema u grupi.',
  notFoundText: 'Link je možda star. Vrati se na Radar i izaberi igrača.',
  notFoundButton: 'Nazad na Radar',
  errorReason: 'Lista tenisera nije stigla.',
  loadingNote: 'Učitavam igrača…',
};
