import type { Loose } from '../../i18n';
import { countWord } from '../../tennis/radar';
import type * as en from '../en/tennisRadar';

const pl = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

export const tennisRadar: Loose<typeof en.tennisRadar> = {
  kicker: '02 — Radar',
  title: (n: number, top: number) =>
    `${n} ${pl(n, 'mladi igrač je', 'mlada igrača su', 'mladih igrača je')} izvan top ${top}.`,
  tierLine: (k: number) => (k === 0 ? 'Nijedan nije tier A.' : `${countWord(k)} ${pl(k, 'je', 'su', 'je')} tier A.`),
  emptyTitle: 'Nijedan igrač ne odgovara ovim filterima.',
  lede: (date: string, from: number, to: number, under18: boolean) =>
    `ATP plasman, ${date}; muškarci ${under18 ? 'mlađi od 18' : 'mlađi od 21'}, plasman od ${from} do ${to}.`,
  railLabel: 'Filteri',
  rankLabel: 'Plasman izvan top',
  rankValue: (n: number) => `> ${n}`,
  country: 'Država',
  countries: (n: number, selected: number) =>
    `${n} ${pl(n, 'država', 'države', 'država')}${selected < n ? ` · ${selected} ${pl(selected, 'izabrana', 'izabrane', 'izabranih')}` : ''}`,
  countriesList: 'Države',
  selectAll: 'Izaberi sve',
  clearAll: 'Poništi',
  age: 'Godine',
  under18Only: 'Samo mlađi od 18',
  plays: 'Ruka',
  leftOnly: 'Samo ljevaci',
  headers: { rank: '#', player: 'Igrač', age: 'God', ranking: 'Plasman', yearAgo: 'Prije godinu', record: 'P–P', rating: 'Ocjena', outlook: 'Izgledi', notes: 'Napomene' },
  tableLabel: 'Mladi teniseri na Radaru',
  ratingLabel: 'Ocjena',
  dash: '—',
  record: (w: number, l: number) => `${w}–${l}`,
  showing: (shown: number, total: number) =>
    shown >= total ? `${total} ${pl(total, 'igrač', 'igrača', 'igrača')}.` : `Prikazano ${shown} od ${total}.`,
  showAll: 'Prikaži sve',
  flags: {
    under18: 'Mlađi od 18',
    lowSample: 'Malo mečeva',
    top200: (n: number) => `Pobjede nad top 200: ${n}`,
  },
  emptyBlockTitle: 'Još ništa ne odgovara.',
  emptyText: 'Spusti granicu plasmana ili označi više država da opet vidiš igrače.',
  reset: 'Poništi filtere',
  loadingNote: 'Učitavam igrače…',
  errorReason: 'Lista tenisera nije stigla.',
  evidenceLine: (hits: number, picked: number, poolRate: number) =>
    `U ranijim grupama, ${hits} od ${picked} najboljih izbora modela ${pl(hits, 'ušao je', 'ušla su', 'ušlo je')} u top 100; prosjek grupe je ${poolRate}%.`,
  evidenceLink: 'Pogledaj Dokaze →',
};
