import { points } from '../../format';
import type { Loose } from '../../i18n';
import type * as en from '../en/main';

/** Svi tekstovi interfejsa na bosanskom, po istim grupama kao engleski. */

/** Tri oblika množine: 1 igrač, 2 igrača, 5 igrača. */
const pl = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

const igrac = (n: number) => pl(n, 'igrač', 'igrača', 'igrača');
const liga = (n: number) => pl(n, 'liga', 'lige', 'liga');
const poeni = (n: number) => `${points(n)} ${pl(Number(points(n)), 'poen', 'poena', 'poena')}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];
const MONTHS_GEN = ['januara', 'februara', 'marta', 'aprila', 'maja', 'juna', 'jula', 'augusta', 'septembra', 'oktobra', 'novembra', 'decembra'];

/** "juni 2021" postaje "juna 2021", za rečenice poput "do juna 2021". */
const gen = (monthYear: string) => {
  const [month, ...rest] = monthYear.split(' ');
  const i = MONTHS.indexOf(month);
  return i < 0 ? monthYear : [MONTHS_GEN[i], ...rest].join(' ');
};

export const frame: Loose<typeof en.frame> = {
  brand: 'FAIR SCOUT',
  sectionsLabel: 'Dijelovi',
  sections: [
    { number: '01', name: 'Slični', path: '/similar' },
    { number: '02', name: 'Radar', path: '/radar' },
    { number: '03', name: 'Vremeplov', path: '/time-machine' },
    { number: '04', name: 'Dokazi', path: '/evidence' },
  ],
  detailsLabel: 'Detalji',
  detailsOn: 'uklj.',
  detailsOff: 'isklj.',
  detailsTip: 'Pokazuje metod iza svake brojke. Tipka: D',
  picks: {
    add: '+ Dodaj u moje izbore',
    saved: '✓ U mojim izborima',
    loginToSave: 'Prijavi se da sačuvaš',
    column: 'Moji izbori',
    addSign: '+',
    savedSign: '✓',
    label: (words: string, name: string) => `${words.replace(/^[+✓] /, '')}: ${name}`,
  },
  languageLabel: 'Jezik',
  sportLabel: 'Sport',
  sportQuestion: 'Koji sport skautiraš?',
  sports: { football: 'Fudbal', tennis: 'Tenis', basketball: 'Košarka' },
  basketballSource: (source: string, season: string) => `Podaci: ${source} · sezona ${season}`,
  tennisSource: (source: string, date: string) => `Podaci: ${source} · ATP plasman, ${date}`,
  notFoundTitle: 'Ova stranica ne postoji.',
  notFoundLink: 'Idi na Slične',
  screenErrorTitle: 'Ovaj ekran se nije mogao prikazati.',
  screenErrorBody: 'Ostali ekrani i dalje rade.',
  screenErrorLink: 'Učitaj ponovo na Sličnima',
  sourceLabel: 'Podaci',
  leagues: (n: number) => `${n} ${liga(n)}`,
  seasons: (range: string) => `sezone ${range}`,
  built: (date: string) => `izrađeno ${date}`,
};

export const states: Loose<typeof en.states> = {
  errorTitle: 'Podaci se nisu mogli učitati.',
  errorMissing: 'Fajl nije stigao.',
  errorMalformed: 'Fajl nije u očekivanom obliku.',
  errorNote: 'Dok se ne učita, ne prikazuju se nikakve brojke.',
  tryAgain: 'Pokušaj ponovo',
  loading: 'Učitavam podatke…',
};

export const tier: Loose<typeof en.tier> = {
  label: (tier: string) => `Tier ${tier}`,
};

export const player: Loose<typeof en.player> = {
  backToSimilar: '← Nazad na Slične',
  similarLabel: 'Slični, u tvom budžetu',
  similarNone: 'Nema sličnog igrača u ovom budžetu.',
  similarMeta: (league: string, price: string) => `${league} · ${price}`,
  similarPercent: (n: number) => `${n}%`,
  similarDetail:
    'Sličnost poredi učinak prilagođen ligi, ulogu, godine, visinu i jaču nogu, unutar iste grupe pozicija. To je skala za prikaz, a ne vjerovatnoća, i ne govori ništa o stilu igre.',
  noteLabelModel: 'Bilješka AI skauta',
  noteLabelSummary: 'Sažetak',
  noteDetailModel:
    'Ponavlja brojke s ove kartice i ne dodaje vlastite činjenice. Napisao ju je jezički model u pripremi podataka.',
  noteDetailTemplate:
    'Ponavlja brojke s ove kartice i ne dodaje vlastite činjenice. Složena je iz šablona u pripremi podataka.',
  backToRadar: '← Nazad na Radar',
  headline: (position: string, age: number, club: string, league: string) => `${position} · ${age} · ${club}, ${league}`,
  tilePrice: 'Cijena',
  tileContract: 'Ugovor',
  tileMinutes: 'Minute',
  priceCaption: 'tržišna vrijednost',
  contractFinal: 'posljednja godina',
  contractEnd: 'kraj ugovora',
  minutesCaption: (pct: number) => `${pct}% minuta ekipe`,
  unknown: 'nije poznato',
  dash: '—',
  flowTitle: 'Kako ga ocjenjujemo',
  stepDid: '01 Šta je uradio',
  stepLeague: '02 Njegova liga',
  stepScale: '03 Na istoj skali',
  stepRating: '04 Ocjena',
  stepPlays: '01 Koliko igra',
  stepRatingLimited: '02 Ocjena',
  didCaption: ['golovi + asistencije', 'na 90 minuta'],
  didTip: (goals: number, assists: number, minutes: string) =>
    `${goals} ${pl(goals, 'gol', 'gola', 'golova')} i ${assists} ${pl(assists, 'asistencija', 'asistencije', 'asistencija')} za ${minutes} min`,
  leagueCaption: (league: string, easier: boolean) => [`${league} je ${easier ? 'lakša' : 'teža'} liga od prosjeka`],
  leagueTip: (factor: string, league: string, pct: number, easier: boolean, estimate: boolean) =>
    `Faktor lige ${factor}: u ligi ${league} do učinka se dolazi oko ${pct}% ${easier ? 'lakše' : 'teže'} nego u prosječnoj ligi.` +
    (estimate ? ' Faktor je procjena na osnovu tržišne vrijednosti lige.' : ''),
  scaleCaption: ['uporedivo kroz', 'sve 23 lige'],
  scaleTip: (ga90: string, factor: string) => `${ga90} podijeljeno sa ${factor}`,
  outOf: '/100',
  ratingCaption: (pct: number, group: string) => [`bolji od ${pct}%`, `${group} njegovih godina`],
  ratingTip: (group: string) => `Percentil kod ${group} njegovih godina u 23 lige`,
  playsCaption: ['minuta svoje ekipe'],
  ratingLimitedCaption: (pct: number, group: string) => [`igra više od ${pct}%`, `${group} njegovih godina`],
  ratingLimitedTip: (group: string) => `Percentil minutaže kod ${group} njegovih godina u 23 lige`,
  groups: { Attack: 'napadača', Midfield: 'veznih igrača', Defender: 'odbrambenih igrača', Goalkeeper: 'golmana' },
  limitedFlag: 'Ograničeni podaci',
  limitedTip: 'Kod odbrambenih igrača i golmana ocjena počiva na ulozi i kontekstu ekipe, a ne na golovima.',
  meterGoals: (pct: number) => `Udio u golovima ekipe: ${pct}%`,
  meterTime: (pct: number) => `Minutaža: ${pct}% minuta ekipe`,
  meterNote: (league: string, factor: string, estimate: boolean) =>
    `Trake su percentili među igračima iste pozicije i iste starosne grupe. Faktor lige za ${league} je ${factor}, ` +
    (estimate ? 'procjena na osnovu tržišne vrijednosti lige.' : 'izveden iz prelazaka igrača između liga.'),
  loadingNote: 'Učitavam igrača…',
  errorReason: 'Brojke igrača nisu stigle.',
  notFoundTitle: 'Ovog igrača nema u podacima.',
  notFoundText: 'Link je možda star ili igra izvan 23 lige.',
  notFoundButton: 'Otvori Radar →',
  outlookLabel: 'Izgledi',
  tierFigure: (tier: string) => `Tier ${tier}`,
  outlookLike: (n: number) => [`${n} od 10`, ' igrača poput njega je uspjelo'] as const,
  outlookAverage: (n: number) => [`${n} od 10`, ' kod prosječnog mladog igrača'] as const,
  dotsAlt: (n: number) => `${n} od 10`,
  outlookDetail: (tierName: string, hits: number, n: number, poolHits: string, pool: string, madeIt: string) =>
    `${hits} od ${n} ranijih igrača koje je model stavio u tier ${tierName}, naspram ${poolHits} od svih ${pool} mladih igrača vrijednih do €1M. „Uspio“: ${madeIt}`,
  notRated: 'Bez ocjene: izvan grupe za Radar.',
  outlookErrorReason: 'Brojke iza izgleda nisu stigle.',
  whyLabel: 'Zašto',
  plusSign: '+',
  minusSign: '−',
  plusLabel: 'Za',
  minusLabel: 'Protiv',
  flagLabels: {
    born_q4: 'Rođen okt–dec · često previđen',
    low_sample: 'Malo minuta',
    limited_position_data: 'Ograničeni podaci',
    under18: 'Mlađi od 18',
    contract_ending: 'Ugovor ističe za manje od godinu',
  },
  flagTips: {
    born_q4: (times: string) =>
      `Među mladim igračima na ovom nivou, rođenih od oktobra do decembra ima ${times} puta manje nego rođenih od januara do marta.`,
    low_sample: 'Ispod 900 minuta ocjena se može dosta pomjeriti.',
    limited_position_data: 'Kod odbrambenih igrača i golmana ocjena počiva na ulozi i kontekstu ekipe, a ne na golovima.',
    under18: 'Mlađi je od 18. Međunarodni transferi maloljetnika su ograničeni.',
    contract_ending: 'Ugovor mu ističe u roku od 12 mjeseci od posljednjeg datuma u podacima.',
  },
  projLabel: 'Gdje bi mogao biti za tri godine',
  projRange: 'ovdje je završila polovina onih koji su i dalje imali tržišnu vrijednost',
  projTypical: 'tipičan',
  projDash: ' – ',
  projChart: (now: string, lo: string, hi: string, typical: string) =>
    `Dosadašnja tržišna vrijednost, danas ${now}, i raspon u kojem je tri godine kasnije završila polovina sličnih ranijih igrača koji su i dalje imali tržišnu vrijednost: od ${lo} do ${hi}, tipično ${typical}.`,
  projShort: 'Premalo historije vrijednosti za grafikon.',
  projDetail: (tier: string, p25: string, p75: string, noLater: number) =>
    `Raspon pokazuje šta se desilo s ranijim igračima iz tiera ${tier}: među onima koji su tri godine kasnije imali tržišnu vrijednost, četvrtina je završila ispod ${p25}× svoje vrijednosti, polovina između ${p25}× i ${p75}×, a četvrtina iznad. Zasebno, ${noLater}% nije imalo tržišnu vrijednost tri godine kasnije. Ovo su raniji ishodi sličnih igrača, a ne prognoza za ovog.`,
};

export const radar: Loose<typeof en.radar> = {
  kicker: '02 — Radar',
  title: (n: number) => `${n} ${pl(n, 'mladi igrač staje', 'mlada igrača staju', 'mladih igrača staje')} u tvoj budžet.`,
  tierLine: (k: number) => (k === 0 ? 'Nijedan nije tier A.' : `${k} ${pl(k, 'je', 'su', 'je')} tier A.`),
  regionalLeagues: 'Pet regionalnih liga',
  allLeagues: (n: number) => `${pl(n, 'Sva', 'Sve', 'Svih')} ${n} ${liga(n)}`,
  someLeagues: (n: number) => `${n} ${liga(n)}`,
  lede: (leagues: string, season: string, ages: string) => `${leagues}, sezona ${season}, ${ages}.`,
  agesAll: (bornFrom: number | null) => (bornFrom === null ? 'do 21 godine' : `rođeni ${bornFrom}. ili kasnije`),
  agesAdult: 'od 18 do 21 godine',
  agesUnder18: 'mlađi od 18',
  railLabel: 'Filteri',
  budget: 'Budžet',
  budgetSlider: 'Budžet',
  budgetValue: (money: string) => `≤ ${money}`,
  position: 'Pozicija',
  positions: [
    { value: 'all', label: 'Sve' },
    { value: 'Attack', label: 'Napad' },
    { value: 'Midfield', label: 'Vezni red' },
    { value: 'Defender', label: 'Odbrana' },
    { value: 'Goalkeeper', label: 'Gol' },
  ] as const,
  league: 'Liga',
  moreLeagues: (n: number, picked: number) =>
    `još ${n} ${liga(n)}${picked > 0 ? ` · ${picked} ${pl(picked, 'izabrana', 'izabrane', 'izabranih')}` : ''}`,
  moreLeaguesList: 'Ostale lige',
  selectAll: 'Izaberi sve',
  clearAll: 'Poništi',
  availability: 'Dostupnost',
  contractEnds: (when: string) => `Ugovor ističe najkasnije: ${when}`,
  adult: 'Ima 18 ili više',
  under18Only: 'Samo mlađi od 18',
  headers: { rank: '#', player: 'Igrač', pos: 'Poz', age: 'God', price: 'Cijena', min: 'Min', rating: 'Ocjena', outlook: 'Izgledi', notes: 'Napomene' },
  tableLabel: 'Igrači na Radaru',
  ratingLabel: 'Ocjena',
  clubLeague: (club: string, league: string) => `${club} · ${league}`,
  showing: (shown: number, total: number) => (shown >= total ? `${total} ${igrac(total)}.` : `Prikazano ${shown} od ${total}.`),
  showAll: 'Prikaži sve',
  flags: {
    under18: 'Mlađi od 18',
    lowSample: 'Malo minuta',
    contract: (when: string) => `Ugovor ${when}`,
    bornQ4: 'Rođen okt–dec',
    limited: 'Ograničeni podaci',
    limitedTip: 'Kod odbrambenih igrača i golmana ocjena počiva na ulozi i kontekstu ekipe, a ne na golovima.',
  },
  emptyTitle: 'Nijedan igrač ne odgovara ovim filterima.',
  emptyBlockTitle: 'Još ništa ne odgovara.',
  emptyText: 'Povećaj budžet ili dodaj lige da opet vidiš igrače.',
  reset: 'Poništi filtere',
  loadingNote: 'Učitavam igrače…',
  errorReason: 'Lista igrača nije stigla.',
  switchLabel: 'Prikaz',
  viewBudget: 'U mom budžetu',
  viewPassport: 'Bosanski pasoš',
  passportTitle: (total: number, leagues: number) =>
    `${total} ${pl(total, 'igrač s bosanskim pasošem igra', 'igrača s bosanskim pasošem igraju', 'igrača s bosanskim pasošem igra')} u ${pl(leagues, 'ovoj', 'ove', 'ovih')} ${leagues} ${pl(leagues, 'ligi', 'lige', 'liga')}.`,
  passportLede: (young: number, fit: number, youngAge: number) =>
    `${young} ${pl(young, 'danas ima', 'danas imaju', 'danas ima')} ${youngAge} ili manje godina. ${fit} ${pl(fit, 'staje', 'staju', 'staje')} u tvoj budžet.`,
  passportEmpty: 'U podacima nema igrača s bosanskim pasošem.',
  passportTableLabel: 'Igrači s bosanskim pasošem',
  passportShowing: (shown: number, total: number) =>
    shown >= total ? `${total} ${igrac(total)}.` : `${shown} ${pl(shown, 'najmlađi', 'najmlađa', 'najmlađih')} od ${total}.`,
  goalsAssists: (g: number, a: number) => `${g} + ${a}`,
  headersPassport: { player: 'Igrač', pos: 'Poz', age: 'God', price: 'Cijena', min: 'Min', ga: 'Golovi + asistencije', rating: 'Ocjena', forYou: 'Za tebe' },
  inBudget: 'U budžetu',
  aboveBudget: 'Iznad budžeta',
};

export const plot: Loose<typeof en.plot> = {
  title: 'Jeftino i perspektivno je gornji lijevi ugao',
  sub: 'Svaka tačka je jedan igrač. Lijevo = jeftiniji. Gore = bolji izgledi.',
  tooFew: 'Premalo igrača za grafikon.',
  priceAxis: 'Cijena (logaritamska skala)',
  outlookAxis: 'Izgledi',
  tierA: 'Tier A',
  budgetLine: (money: string) => `Tvoj budžet ≤ ${money}`,
  tier: (t: string | null) => (t ? `Tier ${t}` : 'Bez tiera'),
  alt: (shown: number, tierA: number, left: number) =>
    `Grafikon cijene i izgleda za ${shown} igrača; ${tierA} u tieru A.` +
    (left > 0 ? ` ${left} ${pl(left, 'izostavljen', 'izostavljena', 'izostavljeno')} jer nema cijenu ili bodove.` : ''),
};

export const time: Loose<typeof en.time> = {
  kicker: '03 — Vremeplov',
  seasonsLabel: 'Sezona',
  loadingNote: 'Učitavam ranije radare…',
  emptyTitle: 'Još se nijedna ranija sezona ne može provjeriti.',
  emptyLede: 'Sezona se može provjeriti tri godine nakon što završi.',
  emptyBlockTitle: 'U podacima nema ranijih radara.',
  emptyBlockText: 'Test modela na ranijim sezonama je na ekranu Dokazi.',
  openEvidence: 'Otvori Dokaze →',
  evidencePath: '/evidence',
  thenLede: 'Model nije vidio ništa nakon ovog datuma.',
  reveal: 'Pokaži šta se desilo →',
  back: (date: string) => `← Nazad na ${date}`,
  thenTitle: (date: string, n: number) => `${cap(date)}. Radar pokazuje ${n} igrača ispod €1M.`,
  revealedTitle: (date: string, hits: number, n: number) => `${cap(date)}. Uspjelo ih je ${hits} od ${n}.`,
  poolLine: (pool: number, inTen: number) => `Među svih ${pool} mladih igrača te sezone: ${inTen} od 10.`,
  result: (hits: number, n: number) => `${hits} od ${n}`,
  listLabel: 'Igrači na Radaru, redoslijedom modela',
  today: 'danas',
  noValue: '–',
  madeIt: 'uspio',
  notMadeIt: 'nije uspio',
  tooLittleHistory: 'Premalo historije vrijednosti za grafikon.',
  pickLine: (rank: number, club: string) => `Izbor ${rank} · ${club}`,
  chartLegend: 'Crno: njegova vrijednost. Plavo: gdje je završila polovina sličnih igrača.',
  chart: {
    then: (then: string, lo: string, hi: string, mid: string) =>
      `Tržišna vrijednost izabranog igrača do datuma radara: ${then}. Polovina ranijih igrača iz tiera A završila je tri sezone kasnije između ${lo} i ${hi}, tipično ${mid}.`,
    revealed: (then: string, later: string | null, made: boolean, today: string | null) =>
      `Tržišna vrijednost izabranog igrača: ${then} na datum radara, ` +
      (later === null ? 'bez tržišne vrijednosti tri sezone kasnije' : `${later} tri sezone kasnije`) +
      `, ${made ? 'uspio je' : 'nije uspio'}` +
      (today === null ? '.' : `. Danas ${today}.`),
  },
  months: MONTHS,
  detail: {
    how: (season: string, date: string, trainedOn: string, rows: string, pool: number) =>
      `Kako je nastala ova lista: isti model, iste varijable i isto pravilo za tier kao na današnjem Radaru. Za sezonu ${season} učio je samo iz sezona čiji je ishod bio poznat do ${gen(date)} (${trainedOn}, ${rows} igrača). Grupa su svi mladi igrači te sezone vrijedni do €1M (${pool}); niko nije naknadno izbačen, a igrač bez tržišne vrijednosti tri godine kasnije računa se kao „nije uspio“. Lista je cijeli tier A, redoslijedom modela. „Uspio“ se ocjenjuje tri sezone nakon datuma radara, što je horizont za koji je model napravljen i isti je za svaku sezonu; današnja vrijednost prikazana je informativno i ne mijenja zbir.`,
    total: (bySeason: string, hits: number, picks: number, poolHits: string, poolPlayers: string) =>
      `Svih šest testiranih sezona: ${bySeason.replace(/ of /g, ' od ')} — uspjelo je ${hits} od ${picks} izbora, naspram ${poolHits} od ${poolPlayers} u cijeloj grupi.`,
  },
};

export const evidence: Loose<typeof en.evidence> = {
  kicker: '04 — Dokazi',
  title: 'Radi li? Testirali smo na prošlosti.',
  lede: '„Uspio“ = vrijednost igrača se udvostručila i prešla €1M u roku od tri godine.',
  chartTitle: 'Koliko često pogađa svaki način biranja?',
  chartAlt: 'Udio izbora koji su uspjeli, po načinu biranja',
  rows: {
    model: 'Fair Scout',
    most_minutes: 'Najviše minuta',
    most_goals_assists: 'Najviše golova',
    youngest: 'Najmlađi',
    cheapest: 'Najjeftiniji',
  },
  modelTypes: { model_lr: 'Logistička regresija', model_gb: 'Gradient boosting' },
  modelTip: (parts: string[]) => parts.join(' '),
  modelPart: (name: string, pct: number, hits: number, picks: number) => `${name} ${pct}% (${hits} od ${picks}).`,
  ruleTip: (hits: number, picks: number) => `${hits} od ${picks}`,
  altRow: (label: string, printed: string) => `${label}: ${printed}`,
  average: (pct: number) => `Prosječan igrač ${pct}%`,
  averageShort: (pct: number) => `Prosjek ${pct}%`,
  captionSeasons: (count: number, first: string, last: string) =>
    count === 1
      ? `1 testna sezona, ${first}.`
      : `${count} ${pl(count, 'testna sezona', 'testne sezone', 'testnih sezona')}, od ${first} do ${last}.`,
  captionMethod: 'Za svaku je model učio samo iz sezona čiji je ishod već bio poznat,',
  captionPick: (share: number, budget: string) => `pa je izabrao svojih najboljih ${share}% mladih igrača vrijednih do ${budget}:`,
  captionPlayers: (n: string) => `${n} igrača`,
  captionPicks: (n: string) => `${n} izbora po pravilu`,
  captionMargin: (pp: number) => `margina oko ±${poeni(pp)}.`,
  captionRange: 'Svijetloplavo je raspon između dva testirana tipa modela.',
  smallTitle: 'Manji budžet, ista slika',
  smallSub: (budget: string, players: string, picks: string, pp: number) =>
    `Do ${budget} · ${players} igrača, ${picks} izbora po pravilu · ±${poeni(pp)}`,
  scaleAlt: 'Faktor težine po ligi',
  dotTip: (league: string, factor: string, estimate: boolean) =>
    `${league}: ${factor} ${estimate ? '(procjena)' : '(iz prelazaka igrača)'}`,
  dotNameEstimated: (tip: string) => `${tip}, procjena`,
  leagueTitle: 'Težina lige',
  leagueSub: (moves: string) => `Iz ${moves} prelazaka igrača · 1.00 = prosjek · više = lakše`,
  leagueSubPlain: '1.00 = prosjek · više = lakše',
  averageLabel: 'prosjek',
  hollowNote: 'Prazna tačka: procjena na osnovu tržišne vrijednosti lige.',
  samePlayers: (players: number, a: string, ga90a: string, b: string, ga90b: string) =>
    `Istih ${players} igrača imalo je u prosjeku ${ga90a} golova + asistencija na 90 minuta u ligi ${a}, a ${ga90b} u ligi ${b}.`,
  noFactor: (n: number) =>
    `${n} ${pl(n, 'liga nema faktor i izostavljena je', 'lige nemaju faktor i izostavljene su', 'liga nema faktor i izostavljeno je')}.`,
  noFigures: 'U podacima nema takvih brojki.',
  birthTitle: 'Rođeni ranije, birani češće',
  birthSub: (players: string, leagues: number) =>
    `Mjesec rođenja ${players} prvoligaških igrača u ${leagues} ${pl(leagues, 'ligi', 'lige', 'liga')}`,
  birthSubPlain: (players: string) => `Mjesec rođenja ${players} prvoligaških igrača`,
  bornEarly: 'rođeni jan–mar',
  bornLate: 'rođeni okt–dec',
  versus: 'naspram',
  monthsAlt: (shares: string[]) => `Udio igrača po mjesecu rođenja: ${shares.join(', ')}.`,
  monthNames: MONTHS.map(cap),
  loadingNote: 'Učitavam rezultate testa…',
  errorReason: 'Rezultati testa nisu stigli.',
  emptyTitle: 'Test na ranijim sezonama nije pokrenut.',
  emptyText: 'U podacima nema rezultata testa, pa se ne prikazuju nikakve brojke.',
  emptyFile: 'evidence.json · 0 testnih redova',
  risersLabel: 'Najveći skok svake sezone',
  riserTip: (rank: number, n: number, year: string) => `Izbor ${rank} od ${n} na radaru iz juna ${year}. Otvara taj radar.`,
  arrow: '→',
  today: (value: string) => `danas ${value}`,
  inThreeYears: 'za tri godine',
  risersFoot: (n: number, seasons: number, then: string, later: string, missed: number) =>
    `${pl(n, 'Sav', 'Sva', 'Svih')} ${n} ${pl(n, 'izbor', 'izbora', 'izbora')} iz ${pl(seasons, 'ove', 'ove', 'ovih')} ${seasons} ${pl(seasons, 'sezone', 'sezone', 'sezona')}: ${then} tada, ${later} tri godine kasnije. Nije ih uspjelo ${missed}.`,
  risersNote: (n: number) =>
    `Izbor bez tržišne vrijednosti tri godine kasnije računa se kao nula u kasnijem zbiru i kao da nije uspio. ${n} ${pl(n, 'izbor nema', 'izbora nemaju', 'izbora nema')} kasniju vrijednost.`,
  risersErrorReason: 'Rezultati Vremeplova nisu stigli.',
  cantLabel: 'Šta ne vidi',
  cantChips: ['Karakter', 'Igra bez lopte', 'Povrede', 'Stvarna cijena'],
  cantSentence: 'Kaže koga gledati, a ne koga potpisati.',
  limitsTitle: 'Ograničenja, u cijelosti',
  limits: [
    { lead: 'Tržišna vrijednost', text: ' je procjena zajednice i kasni za formom.' },
    { lead: 'Odbrambeni igrači i golmani:', text: ' ocijenjeni po ulozi i kontekstu ekipe, a ne po vlastitim potezima.' },
    {
      lead: 'Regionalne lige:',
      text: ' dvije sezone podataka; model se tamo primjenjuje, ali nije testiran. U šest liga nedostaju sastavi za petinu do trećinu utakmica sezone 2024/25, a u Norveškoj i Švedskoj odigrana je tek trećina tekuće sezone.',
    },
    { lead: 'Ispod 900 minuta', text: ' ocjena se može dosta pomjeriti.' },
    { lead: 'Rezultati se', text: ' dosta razlikuju od sezone do sezone.' },
  ],
  edgeLead: 'Prednost nad „najviše minuta“',
  edgeWithin: (edge: number, margin: number) => ` iznosi ${poeni(edge)}, unutar margine greške (±${poeni(margin)}).`,
  edgeLarger: (edge: number, margin: number) => ` iznosi ${poeni(edge)}, više od margine greške (±${poeni(margin)}).`,
};
