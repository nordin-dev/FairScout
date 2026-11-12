import type { AccountError, PickSource, PickSport } from '../../account';
import type { Loose } from '../../i18n';
import type * as en from '../en/account';

const pl = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

/** Svi tekstovi prijave, ekrana Moji izbori i dugmadi u zaglavlju. */
export const account: Loose<typeof en.account> = {
  kicker: 'Nalog',
  title: 'Tvoj skautski nalog',
  switchLabel: 'Prijavi se ili napravi nalog',
  modeLogin: 'Prijava',
  modeRegister: 'Napravi nalog',
  nameLabel: 'Ime',
  passwordLabel: 'Lozinka',
  submitLogin: 'Prijava',
  submitRegister: 'Napravi nalog',
  errors: {
    name: 'Ime mora imati najmanje 2 znaka.',
    password: 'Lozinka mora imati najmanje 4 znaka.',
    taken: 'To ime se već koristi na ovom računaru. Prijavi se.',
    wrong: 'Ime ili lozinka nisu tačni.',
  } satisfies Record<AccountError, string>,
  caption: 'Nalozi se čuvaju samo u ovom pregledniku. Servera nema, pa nalog napravljen ovdje ne postoji na drugom računaru.',
  signedIn: (name: string) => `Prijavljen kao ${name}`,
  toPicks: 'Idi na Moje izbore',
  logout: 'Odjava',
  header: {
    login: 'Prijava',
    picks: 'Moji izbori',
    loginTip: 'Prijavi se ili napravi nalog',
  },
};

export const myPicks: Loose<typeof en.myPicks> = {
  kicker: 'Moji izbori',
  signedOutTitle: 'Prijavi se da sačuvaš svoje izbore.',
  signedOutText: 'Lista se čuva za skauta koji je prijavljen.',
  signedOutAction: 'Prijava',
  title: (n: number) => (n === 0 ? 'Tvoja lista je prazna.' : `${n} ${pl(n, 'igrač', 'igrača', 'igrača')} na tvojoj listi.`),
  emptyText: 'Dodaj igrače iz Slijepog izbora, s Radara ili s kartice igrača.',
  lede: (name: string) => `Skaut: ${name}`,
  filterLabel: 'Prikaži sport',
  all: 'Sve',
  sports: { football: 'Fudbal', tennis: 'Tenis', basketball: 'Košarka' } satisfies Record<PickSport, string>,
  group: (sport: string, n: number) => `${sport} · ${n}`,
  noOutlook: '—',
  from: {
    blind: 'Iz Slijepog izbora',
    radar: 'S Radara',
    card: 'S kartice igrača',
  } satisfies Record<PickSource, string>,
  remove: 'Ukloni',
  removeLabel: (name: string) => `Ukloni: ${name}`,
  outlook: 'Izgledi',
};
