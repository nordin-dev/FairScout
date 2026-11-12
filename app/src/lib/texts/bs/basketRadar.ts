import { countWord } from '../../basketball/radar';
import type { Loose } from '../../i18n';
import type * as en from '../en/basketRadar';

const pl = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

export const basketRadar: Loose<typeof en.basketRadar> = {
  kicker: '02 — Radar',
  title: (n: number, max: number) =>
    `${n} ${pl(n, 'mladi igrač igra', 'mlada igrača igraju', 'mladih igrača igra')} u prosjeku ispod ${max} minuta.`,
  tierLine: (k: number) => (k === 0 ? 'Nijedan nije tier A.' : `${countWord(k)} ${pl(k, 'je', 'su', 'je')} tier A.`),
  emptyTitle: 'Nijedan igrač ne odgovara ovim filterima.',
  lede: (season: string, competitions: string, under20: boolean) =>
    `Sezona ${season}, ${competitions}, igrači ${under20 ? 'mlađi od 20' : 'mlađi od 23'} s najmanje pet utakmica.`,
  railLabel: 'Filteri',
  minutesLabel: 'Minute po utakmici ispod',
  minutesValue: (n: number) => `< ${n}`,
  position: 'Pozicija',
  positions: [
    { value: 'All', label: 'Sve' },
    { value: 'Guard', label: 'Bek' },
    { value: 'Forward', label: 'Krilo' },
    { value: 'Center', label: 'Centar' },
  ] as const,
  competition: 'Takmičenje',
  country: 'Država',
  countries: (n: number, selected: number) =>
    `${n} ${pl(n, 'država', 'države', 'država')}${selected < n ? ` · ${selected} ${pl(selected, 'izabrana', 'izabrane', 'izabranih')}` : ''}`,
  countriesList: 'Države',
  selectAll: 'Izaberi sve',
  clearAll: 'Poništi',
  age: 'Godine',
  under20Only: 'Samo mlađi od 20',
  headers: { rank: '#', player: 'Igrač', pos: 'Poz', age: 'God', min: 'Min', pts: 'Poeni', index: 'Indeks', rating: 'Ocjena', outlook: 'Izgledi', notes: 'Napomene' },
  tableLabel: 'Mladi košarkaši na Radaru',
  ratingLabel: 'Ocjena',
  dash: '—',
  showing: (shown: number, total: number) =>
    shown >= total ? `${total} ${pl(total, 'igrač', 'igrača', 'igrača')}.` : `Prikazano ${shown} od ${total}.`,
  showAll: 'Prikaži sve',
  flags: { under20: 'Mlađi od 20', lowSample: 'Malo utakmica' },
  emptyBlockTitle: 'Još ništa ne odgovara.',
  emptyText: 'Podigni granicu minuta ili označi više takmičenja i država da opet vidiš igrače.',
  reset: 'Poništi filtere',
  loadingNote: 'Učitavam igrače…',
  errorReason: 'Lista košarkaša nije stigla.',
  evidenceLine: (hits: number, picked: number, poolRate: number) =>
    `U ranijim grupama, ${hits} od ${picked} najboljih izbora modela ${pl(hits, 'postao je igrač rotacije', 'postala su igrači rotacije', 'postalo je igrači rotacije')}; prosjek grupe je ${poolRate}%.`,
  evidenceLink: 'Pogledaj Dokaze →',
};
