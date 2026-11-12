import type { Loose } from '../../i18n';
import type { Evidence } from '../../tennis/evidence';
import type * as en from '../en/tennisEvidence';

const pl = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

const range = (e: Evidence): string => (e.years ? `od ${e.years[0]} do ${e.years[1]}` : 'ranije godine');
const usli = (n: number) => pl(n, 'ušao je', 'ušla su', 'ušlo je');

/** Nazivi pravila dolaze iz podataka na engleskom; ovdje su njihovi bosanski nazivi za rečenicu o poređenju. */
const RULES: Record<string, string> = {
  'best ranking': 'najbolji plasman',
  'most wins': 'najviše pobjeda',
  youngest: 'najmlađi',
};
const rule = (label: string) => RULES[label.toLowerCase()] ?? label.toLowerCase();

export const tennisEvidence: Loose<typeof en.tennisEvidence> = {
  kicker: '04 — Dokazi',
  title: (e: Evidence) =>
    `${e.modelHits} od ${e.picked} najboljih izbora modela ${usli(e.modelHits)} u top 100. Prosjek grupe je ${e.poolRatePct}%.`,
  lede: (e: Evidence) =>
    `${e.byYear.length ? `${e.byYear.length} ${pl(e.byYear.length, 'grupa', 'grupe', 'grupa')}` : 'Ranije grupe'}, ${range(e)}. Svaku je bodovao model koji je vidio samo ranije godine.`,
  heroFirst: (e: Evidence) => `Top 10% modela: ${e.modelHits} od ${e.picked}`,
  heroSecond: (e: Evidence) => `Cijela grupa: ${e.poolHits} od ${e.pool}`,
  rulesTitle: 'Protiv jednostavnih pravila',
  rulesSub: 'Igrači koji su ušli u top 100 u roku od tri godine, po načinu biranja.',
  chartTitle: 'Igrači koji su ušli u top 100, po načinu biranja',
  poolLine: (rate: number) => `Svi igrači: ${rate}%`,
  printed: (hits: number, picked: number, percent: number) => `${hits} od ${picked} · ${percent}%`,
  tip: (label: string, hits: number, picked: number) =>
    `${label}: ${hits} od ${picked} tako izabranih igrača ${usli(hits)} u top 100 u roku od tri godine.`,
  honest: (e: Evidence): string => {
    if (!e.rival) return '';
    const first = `Biranje samo po pravilu „${rule(e.rival.label)}“ daje ${e.rival.hits} od ${e.picked}.`;
    if (e.verdict === 'inside') return `${first} Prednost modela nad njim je unutar margine od ±${e.marginPct} poena: ne možemo tvrditi da je bolji od tog pravila.`;
    if (e.verdict === 'ahead') return `${first} Prednost modela nad njim, ${e.leadPct} poena, veća je od margine od ±${e.marginPct} poena.`;
    return `${first} Model nije ispred njega.`;
  },
  tiersTitle: 'Šta je tier značio',
  tierLabel: (tier: string) => `Tier ${tier}`,
  tierCaption: (hits: number, n: number, percent: number) => `${hits} od ${n} ${usli(hits)} u top 100 (${percent}%)`,
  yearsTitle: 'Godinu po godinu',
  yearsLabel: 'Svaka testna godina: grupa i top 10% po dva pravila',
  headers: { year: 'Godina', pool: 'Grupa', reached: 'Ušli u top 100', model: 'Top 10% modela', rank: 'Top 10% po plasmanu' },
  ofCount: (hits: number, n: number) => `${hits} od ${n}`,
  tally: (t: { ahead: number; level: number; behind: number; years: number }) =>
    `Top 10% modela bio je ispred top 10% po najboljem plasmanu u ${t.ahead} od ${t.years} godina, izjednačen u ${t.level}, iza u ${t.behind}.`,
  methodTitle: 'Kako je testirano',
  method: (e: Evidence, trainedOn: number, poolRule: string, outcome: string) => [
    `Grupa: ${poolRule}.`,
    `Ishod: ${outcome}. To je plasman, a ne tržišna vrijednost.`,
    `Model je logistička regresija, naučena na ${trainedOn} igrača iz ranijih grupa.`,
    'Test ide unaprijed kroz vrijeme. Grupu svake godine bodovao je model naučen samo na grupama čije su tri godine već istekle.',
    `Izbori su top 10% grupe svake godine, ukupno ${e.picked} igrača. Ostala pravila biraju isti broj.`,
  ],
  inputsTitle: 'Šta model gleda',
  inputLine: (words: string) => `${words}: više bodova`,
  /** Naziv svakog ulaza, zatim riječi koje dižu bodove kad mu je težina pozitivna i kad je negativna. */
  inputs: {
    age: ['Godine', 'stariji', 'mlađi'],
    log_rank: ['Plasman', 'slabiji plasman', 'bolji plasman'],
    win_pct: ['Procenat pobjeda', 'viši procenat pobjeda', 'niži procenat pobjeda'],
    upper_share: ['Nivo', 'više mečeva na Challenger nivou ili višem', 'manje mečeva na Challenger nivou ili višem'],
    log_top200_wins: ['Pobjede nad top 200', 'više pobjeda nad igračima iz top 200', 'manje pobjeda nad igračima iz top 200'],
  } as Record<string, [string, string, string]>,
  limitsTitle: 'Ograničenja',
  limits: (date: string) => [
    'Grupe su male, oko stotinu igrača godišnje. Jedna godina može promijeniti sliku.',
    'Ishod je plasman, a ne tržišna vrijednost.',
    `Podaci idu do: ${date}.`,
    'Samo muški tenis.',
    'Biranje samo po najboljem plasmanu gotovo je jednako dobro.',
  ],
  loadingNote: 'Učitavam test…',
  errorReason: 'Teniski test nije stigao.',
};
