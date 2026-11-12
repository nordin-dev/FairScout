import type { Loose } from '../../i18n';
import type * as en from '../en/report';

export const report: Loose<typeof en.report> = {
  open: 'Spasi izvještaj kao PDF',
  kicker: 'Fair Scout · Skautski izvještaj',
  title: (n: number) => {
    const d = n % 10;
    const h = n % 100;
    const word = d === 1 && h !== 11 ? 'igrač' : 'igrača';
    return `${n} ${word} za praćenje`;
  },
  meta: (scout: string, date: string) => `Skaut: ${scout} · ${date}`,
  save: 'Spasi kao PDF',
  saveHint: 'U prozoru za štampu izaberi „Sačuvaj kao PDF” kao odredište.',
  back: '← Nazad na Moje izbore',
  fileName: (scout: string, date: string) => `Fair Scout izvještaj – ${scout} – ${date}`,
  signedOut: 'Prijavi se da napraviš izvještaj svojih izbora.',
  empty: 'Lista ti je prazna, pa nema šta ući u izvještaj.',
  sumPlayers: 'Igrači',
  sumTierA: 'Izgledi A',
  sumPrice: 'Fudbaleri ukupno koštaju',
  loading: 'Učitavam podatke igrača…',
  failed: 'Podaci za ovaj sport se nisu mogli učitati.',
  missing: 'Nema ga u trenutnim podacima.',
  saved: (from: string, date: string) => `${from} · sačuvan ${date}`,
  outlook: 'Izgledi',
  noTier: '—',
  plus: 'Za njega',
  minus: 'Protiv njega',
  note: 'Bilješka skauta',
  chance: (n: number) => `${n}/100`,
  football: {
    facts: (position: string, age: number) => `${position} · ${age} god.`,
    price: 'Cijena',
    contract: 'Ugovor do',
    minutes: 'Minute',
    goalsAssists: 'Golovi + asistencije',
    rating: 'Ocjena, od 100',
    goalsAssistsFigure: (goals: number, assists: number) => `${goals} + ${assists}`,
  },
  tennis: {
    facts: (country: string, age: number) => `${country} · ${age} god.`,
    ranking: 'Rang',
    yearAgo: 'Prije godinu',
    record: 'Pobjede–porazi',
    top200: 'Pobjede nad top 200',
    chance: 'Model: top 100',
    rank: (n: number) => `Br. ${n}`,
  },
  basketball: {
    facts: (position: string, age: number) => `${position} · ${age} god.`,
    minutes: 'Minuta po utakmici',
    points: 'Poena po utakmici',
    rebounds: 'Skokova po utakmici',
    assists: 'Asistencija po utakmici',
    games: 'Utakmice',
    chance: 'Model: rotacija',
  },
  flags: {
    lowSample: 'Malo minuta',
    bornLate: 'Rođen okt–dec',
    contractEnding: 'Ugovor uskoro ističe',
    under18: 'Mlađi od 18',
    under20: 'Mlađi od 20',
  },
  dash: '—',
  footer: 'Izgledi su procjena modela iz otvorenih podataka, a ne obećanje. Svakog igrača provjeri svojim očima.',
  sources: (list: string) => `Podaci: ${list}`,
};
