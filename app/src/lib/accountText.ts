import type { AccountError, PickSource, PickSport } from './account';

/** Every text of the login, the My picks screen and the header chips. */
export const account = {
  kicker: 'Account',
  title: 'Your scout account',
  switchLabel: 'Log in or create an account',
  modeLogin: 'Log in',
  modeRegister: 'Create account',
  nameLabel: 'Name',
  passwordLabel: 'Password',
  submitLogin: 'Log in',
  submitRegister: 'Create account',
  errors: {
    name: 'Use a name of at least 2 characters.',
    password: 'Use a password of at least 4 characters.',
    taken: 'That name is already used on this computer. Log in instead.',
    wrong: 'Name or password does not match.',
  } satisfies Record<AccountError, string>,
  caption: 'Accounts are kept in this browser only. There is no server, so an account made here does not exist on another computer.',
  signedIn: (name: string) => `Signed in as ${name}`,
  toPicks: 'Go to My picks',
  logout: 'Log out',
  header: {
    login: 'Log in',
    picks: 'My picks',
    loginTip: 'Log in or create an account',
  },
};

export const myPicks = {
  kicker: 'My picks',
  signedOutTitle: 'Log in to keep your picks.',
  signedOutText: 'Your list is kept for the scout who is logged in.',
  signedOutAction: 'Log in',
  title: (n: number) => (n === 0 ? 'Your list is empty.' : n === 1 ? '1 player on your list.' : `${n} players on your list.`),
  emptyText: 'Add players from the blind pick, the radar or a player card.',
  lede: (name: string) => `Scout: ${name}`,
  filterLabel: 'Show sport',
  all: 'All',
  sports: { football: 'Football', tennis: 'Tennis', basketball: 'Basketball' } satisfies Record<PickSport, string>,
  group: (sport: string, n: number) => `${sport} · ${n}`,
  noOutlook: '—',
  from: {
    blind: 'From the blind pick',
    radar: 'From the radar',
    card: 'From the player card',
  } satisfies Record<PickSource, string>,
  remove: 'Remove',
  removeLabel: (name: string) => `Remove ${name}`,
  outlook: 'Outlook',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Nov 2026" from an ISO date and time; an unreadable value gives an empty text. */
export function pickDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
