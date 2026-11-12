import { useSyncExternalStore } from 'react';

/**
 * Scout accounts and their saved picks. The app has no server: accounts live in this browser's
 * local storage and nowhere else. A password is kept as a salted SHA-256 hash, which keeps it out
 * of plain sight but is not protection against someone with access to this computer.
 */

export type PickSport = 'football' | 'tennis' | 'basketball';
export type PickSource = 'blind' | 'radar' | 'card';
export type PickTier = 'A' | 'B' | 'C' | null;

/** A saved player: enough to list him and to open his card again. */
export type SavedPick = {
  sport: PickSport;
  id: string;
  name: string;
  /** One line under the name: club and league, country, or club and competition. */
  line: string;
  tier: PickTier;
  /** Where the scout added him. */
  from: PickSource;
  /** ISO date and time of the save. */
  added: string;
};

export type Account = { name: string; picks: SavedPick[] };
export type AccountError = 'name' | 'password' | 'taken' | 'wrong';

type Stored = { shown: string; salt: string; hash: string; picks: SavedPick[] };
type Book = Record<string, Stored>;

const ACCOUNTS_KEY = 'fairscout.accounts';
const SESSION_KEY = 'fairscout.session';
export const MIN_NAME = 2;
export const MIN_PASSWORD = 4;

function read<T>(key: string, fallback: T): T {
  try {
    const text = window.localStorage.getItem(key);
    return text === null ? fallback : (JSON.parse(text) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked; the account then lasts until the page is closed.
  }
}

let book: Book = read<Book>(ACCOUNTS_KEY, {});
let session: string | null = read<string | null>(SESSION_KEY, null);
if (session !== null && !book[session]) session = null;
const accountOf = (id: string): Account => ({ name: book[id].shown ?? id, picks: book[id].picks });
let current: Account | null = session === null ? null : accountOf(session);
const listeners = new Set<() => void>();

function commit(): void {
  write(ACCOUNTS_KEY, book);
  write(SESSION_KEY, session);
  current = session === null ? null : accountOf(session);
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** The salted SHA-256 of a password. Where the browser offers no SubtleCrypto (old browsers, some test runners) a plain mixing hash stands in. */
async function hashOf(salt: string, password: string): Promise<string> {
  const text = `${salt}:${password}`;
  const subtle = globalThis.crypto?.subtle;
  if (subtle) return hex(new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(text))));
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function newSalt(): string {
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
  return hex(bytes);
}

const key = (name: string): string => name.trim().toLowerCase();

/** Creates an account and signs the scout in. Returns what is wrong, or null when it worked. */
export async function register(name: string, password: string): Promise<AccountError | null> {
  const shown = name.trim();
  if (shown.length < MIN_NAME) return 'name';
  if (password.length < MIN_PASSWORD) return 'password';
  if (book[key(shown)]) return 'taken';
  const salt = newSalt();
  book = { ...book, [key(shown)]: { shown, salt, hash: await hashOf(salt, password), picks: [] } };
  session = key(shown);
  commit();
  return null;
}

/** Signs a scout in. Returns 'wrong' when the name or the password does not match. */
export async function login(name: string, password: string): Promise<AccountError | null> {
  const stored = book[key(name)];
  if (!stored || stored.hash !== (await hashOf(stored.salt, password))) return 'wrong';
  session = key(name);
  commit();
  return null;
}

export function logout(): void {
  session = null;
  commit();
}

export const isSaved = (account: Account | null, sport: PickSport, id: string): boolean =>
  !!account && account.picks.some((p) => p.sport === sport && p.id === id);

/** Saves a player for the signed-in scout; a player already saved stays once. Returns false when nobody is signed in. */
export function addPick(pick: Omit<SavedPick, 'added'>): boolean {
  if (session === null) return false;
  const stored = book[session];
  if (stored.picks.some((p) => p.sport === pick.sport && p.id === pick.id)) return true;
  book = { ...book, [session]: { ...stored, picks: [...stored.picks, { ...pick, added: new Date().toISOString() }] } };
  commit();
  return true;
}

export function removePick(sport: PickSport, id: string): void {
  if (session === null) return;
  const stored = book[session];
  book = { ...book, [session]: { ...stored, picks: stored.picks.filter((p) => !(p.sport === sport && p.id === id)) } };
  commit();
}

/** The address of a saved player's card. */
export function cardPath(pick: Pick<SavedPick, 'sport' | 'id'>): string {
  return pick.sport === 'football' ? `/player/${pick.id}` : `/${pick.sport}/${pick.id}`;
}

/** Empties every account and the session. Used by tests. */
export function resetAccounts(): void {
  book = {};
  session = null;
  commit();
}

/** The signed-in scout with his picks, or null. */
export const useAccount = (): Account | null => useSyncExternalStore(subscribe, () => current);
