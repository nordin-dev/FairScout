import type { Loose } from '../../i18n';
import type * as en from '../en/basketCard';

const pl = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

/** Svi tekstovi kartice košarkaša. */
export const basketCard: Loose<typeof en.basketCard> = {
  backToBlind: '← Nazad na Slijepi izbor',
  backToRadar: '← Nazad na Radar',
  headline: (position: string | null, age: number, team: string, competition: string, country: string | null): string =>
    ['Košarka', position, `${age} god.`, `${team}, ${competition}`, country].filter(Boolean).join(' · '),
  minutes: 'Minute po utakmici',
  points: 'Poeni po utakmici',
  rebounds: 'Skokovi po utakmici',
  assists: 'Asistencije po utakmici',
  rating: 'Indeks korisnosti po utakmici',
  figure: (n: number) => n.toFixed(1),
  caption: (season: string, games: number) => `sezona ${season}, ${games} ${pl(games, 'utakmica', 'utakmice', 'utakmica')}`,
  outlookLabel: 'Izgledi',
  gives: (percent: number) => `Bodovi modela: ${percent} od 100 za ulogu u rotaciji u roku od tri sezone.`,
  tierLine: (tier: string, n: number, hits: number) =>
    `Od ${n} ranijih igrača iz tiera ${tier}, ${hits} ${pl(hits, 'je postao igrač rotacije', 'su postala igrači rotacije', 'je postalo igrači rotacije')} u roku od tri sezone.`,
  caution: 'Ovo su raniji ishodi sličnih igrača, a ne prognoza za ovog.',
  whyLabel: 'Šta model vidi',
  plusSign: '+',
  minusSign: '−',
  plusLabel: 'Pomaže',
  minusLabel: 'Odmaže',
  flagUnder20: 'Mlađi od 20',
  flagLow: 'Malo utakmica',
  seasonsLabel: 'Njegove dosadašnje sezone',
  seasonsCaption: 'Njegove sezone u takmičenjima EuroLeague i EuroCup',
  colSeason: 'Sezona',
  colClub: 'Klub',
  colCompetition: 'Takmičenje',
  colGames: 'Utakmice',
  colMinutes: 'Min po utakmici',
  colPoints: 'Poeni po utakmici',
  oneSeason: 'Ovo mu je zasad jedina sezona u takmičenjima EuroLeague ili EuroCup.',
  noSeasons: 'U podacima nema ranijih sezona.',
  notFoundTitle: 'Ovog igrača nema u grupi.',
  notFoundText: 'Link je možda star. Vrati se na Radar i izaberi igrača.',
  notFoundButton: 'Nazad na Radar',
  errorFile: 'basketball.json',
  errorReason: 'Lista košarkaša nije stigla.',
  loadingNote: 'Učitavam igrača…',
};
