import { seasonOf, type Evidence } from '../../basketball/evidence';
import type { Loose } from '../../i18n';
import type * as en from '../en/basketEvidence';

const pl = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

const range = (e: Evidence): string => (e.years ? `sezone od ${seasonOf(e.years[0])} do ${seasonOf(e.years[1])}` : 'ranije sezone');
const postali = (n: number) => pl(n, 'postao je igrač rotacije', 'postala su igrači rotacije', 'postalo je igrači rotacije');

/** Nazivi pravila dolaze iz podataka na engleskom; ovdje su njihovi bosanski nazivi za rečenicu o poređenju. */
const RULES: Record<string, string> = {
  'most minutes': 'najviše minuta',
  'best index rating per game': 'najbolji indeks korisnosti po utakmici',
  youngest: 'najmlađi',
};
const rule = (label: string) => RULES[label.toLowerCase()] ?? label.toLowerCase();

export const basketEvidence: Loose<typeof en.basketEvidence> = {
  kicker: '04 — Dokazi',
  title: (e: Evidence) =>
    `${e.modelHits} od ${e.picked} najboljih izbora modela ${postali(e.modelHits)}. Prosjek grupe je ${e.poolRatePct}%.`,
  lede: (e: Evidence) =>
    `${e.byYear.length ? `${e.byYear.length} ${pl(e.byYear.length, 'ranija grupa', 'ranije grupe', 'ranijih grupa')}` : 'Ranije grupe'}, ${range(e)}. Svaku je bodovao model koji je vidio samo ranije sezone.`,
  heroFirst: (e: Evidence) => `Top 10% modela: ${e.modelHits} od ${e.picked}`,
  heroSecond: (e: Evidence) => `Cijela grupa: ${e.poolHits} od ${e.pool}`,
  rulesTitle: 'Protiv jednostavnih pravila',
  chartTitle: 'Igrači koji su postali igrači rotacije, po načinu biranja',
  poolLine: (rate: number) => `Svi igrači: ${rate}%`,
  printed: (hits: number, picked: number, percent: number) => `${hits} od ${picked} · ${percent}%`,
  tip: (label: string, hits: number, picked: number) =>
    `${label}: ${hits} od ${picked} tako izabranih igrača ${postali(hits)} u roku od tri sezone.`,
  honest: (e: Evidence): string => {
    if (!e.rival) return '';
    const first = `Biranje samo po pravilu „${rule(e.rival.label)}“ daje ${e.rival.hits} od ${e.picked}.`;
    if (e.verdict === 'inside') return `${first} Prednost modela nad njim je unutar margine od ±${e.marginPct} poena: ne možemo tvrditi da je bolji od tog pravila.`;
    if (e.verdict === 'ahead') return `${first} Prednost modela nad njim, ${e.leadPct} poena, veća je od margine od ±${e.marginPct} poena.`;
    return `${first} Model nije ispred njega.`;
  },
  tiersTitle: 'Šta je tier značio',
  tierLabel: (tier: string) => `Tier ${tier}`,
  tierCaption: (hits: number, n: number, percent: number) => `${hits} od ${n} ${postali(hits)} (${percent}%)`,
  yearsTitle: 'Sezonu po sezonu',
  yearsLabel: 'Svaka testirana sezona: grupa i top 10% po dva pravila',
  headers: { year: 'Sezona', pool: 'Grupa', reached: 'Postali igrači rotacije', model: 'Top 10% modela', rank: 'Top 10% po minutama' },
  ofCount: (hits: number, n: number) => `${hits} od ${n}`,
  tally: (t: { ahead: number; level: number; behind: number; years: number }) =>
    `Top 10% modela bio je ispred top 10% pravila „najviše minuta“ u ${t.ahead} od ${t.years} sezona, izjednačen u ${t.level}, iza u ${t.behind}.`,
  methodTitle: 'Kako je testirano',
  method: (e: Evidence, trainedOn: number, poolRule: string, outcome: string) => [
    `Grupa: ${poolRule}`,
    `Ishod: ${outcome} To je minutaža, a ne novac.`,
    `Model je logistička regresija, naučena na ${trainedOn} igrača iz ranijih grupa.`,
    'Test ide unaprijed kroz vrijeme. Grupu svake sezone bodovao je model naučen samo na grupama čije su tri naredne sezone već završile.',
    `Izbori su top 10% grupe svake sezone, ukupno ${e.picked} igrača. Ostala pravila biraju isti broj.`,
  ],
  inputsTitle: 'Šta model gleda',
  inputLine: (words: string) => `${words}: više bodova`,
  /** Naziv svakog ulaza, zatim riječi koje dižu bodove kad mu je težina pozitivna i kad je negativna. */
  inputs: {
    age: ['Godine', 'stariji', 'mlađi'],
    mpg: ['Minute po utakmici', 'više minuta po utakmici', 'manje minuta po utakmici'],
    pir40: ['Indeks korisnosti na 40 minuta', 'viši indeks korisnosti na 40 minuta', 'niži indeks korisnosti na 40 minuta'],
    pts40: ['Poeni na 40 minuta', 'više poena na 40 minuta', 'manje poena na 40 minuta'],
    games: ['Utakmice', 'više odigranih utakmica', 'manje odigranih utakmica'],
    euroleague: ['Takmičenje', 'igra EuroLeague, a ne EuroCup', 'igra EuroCup, a ne EuroLeague'],
  } as Record<string, [string, string, string]>,
  limitsTitle: 'Ograničenja',
  limits: [
    'Grupe su male, nekoliko desetina igrača po sezoni. Jedna sezona može promijeniti sliku.',
    'Ishod je minutaža, a ne novac.',
    'Odlazak u NBA ili u ligu izvan ova dva takmičenja računa se kao da nije uspio.',
    'Pokriveni su samo EuroLeague i EuroCup, pa mlađih talenata iz domaćih liga nema u podacima.',
  ],
  loadingNote: 'Učitavam test…',
  errorReason: 'Košarkaški test nije stigao.',
};
