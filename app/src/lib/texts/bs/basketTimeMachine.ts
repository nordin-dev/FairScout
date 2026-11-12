import type { Loose } from '../../i18n';
import type * as en from '../en/basketTimeMachine';

const pl = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

const postali = (n: number) => pl(n, 'je postao igrač rotacije', 'su postala igrači rotacije', 'je postalo igrači rotacije');

export const basketTimeMachine: Loose<typeof en.basketTimeMachine> = {
  kicker: '03 — Vremeplov',
  seasonsLabel: 'Sezona',
  loadingNote: 'Učitavam ranije sezone…',
  errorReason: 'Košarkaški podaci se nisu učitali.',
  emptyTitle: 'Još se nijedna ranija sezona ne može provjeriti.',
  emptyLede: 'Sezona se može provjeriti tri sezone nakon što završi.',
  emptyBlockTitle: 'U podacima nema ranijih sezona.',
  emptyBlockText: 'Test modela na ranijim sezonama je na ekranu Dokazi.',
  openEvidence: 'Otvori Dokaze →',
  evidencePath: '/evidence',
  thenTitle: (season: string, n: number) => `Kraj je sezone ${season}. Ovo je top ${n} po modelu.`,
  thenLede: (pool: number) =>
    `${pool} igrača mlađih od 23 s malom ulogom u takmičenjima EuroLeague ili EuroCup. Model je vidio samo ranije sezone.`,
  revealedTitle: (hits: number, n: number) => `${hits} od ${n} ${postali(hits)} u roku od tri sezone.`,
  revealedLede: (pool: number, poolHits: number) => `Od svih ${pool} igrača u grupi, to je uspjelo njih ${poolHits}.`,
  reveal: (season: string) => `Pokaži šta se desilo do sezone ${season} →`,
  hide: 'Sakrij ponovo',
  listLabel: 'Tadašnji najbolji igrači po modelu, od najboljeg',
  head: { player: 'Igrač', age: 'God', minutes: 'Tadašnje minute po utakmici', tier: 'Tier modela', later: 'Najviše minuta po utakmici otad', outcome: 'Ishod' },
  minutes: (n: number) => n.toFixed(1),
  noLater: 'nema',
  reached: (season: string) => `Postao igrač rotacije · ${season}`,
  reachedNoSeason: 'Postao igrač rotacije',
  notReached: (target: number) => `Nije došao do ${target} minuta po utakmici`,
  noLaterSeason: 'Nema kasnije sezone u takmičenjima EuroLeague ili EuroCup',
  caption: 'Igrač koji je otišao u NBA ili u drugu ligu ovdje nema kasniju sezonu i računa se kao da nije uspio.',
  hiddenLabel: 'skriveno dok ne pokažeš šta se desilo',
  missedTitle: 'Koga je model propustio',
  missedLabel: 'Igrači izvan vrha modela koji su postali igrači rotacije',
  missedLede: (n: number, top: number) =>
    n === 0
      ? `Nijedan igrač izvan top ${top} modela nije postao igrač rotacije.`
      : `${n} ${pl(n, 'igrač', 'igrača', 'igrača')} izvan top ${top} modela također ${postali(n)}.`,
  tierThen: (tier: string) => `Tada tier ${tier}`,
};
