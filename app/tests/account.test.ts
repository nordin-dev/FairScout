import { beforeEach, describe, expect, it } from 'vitest';
import { addPick, cardPath, isSaved, login, logout, register, removePick, resetAccounts, type SavedPick } from '../src/lib/account';

const pick = (id: string, sport: SavedPick['sport'] = 'football'): Omit<SavedPick, 'added'> => ({
  sport,
  id,
  name: `Player ${id}`,
  line: 'Club · League',
  tier: 'A',
  from: 'radar',
});

beforeEach(() => {
  resetAccounts();
  localStorage.clear();
});

describe('register and login', () => {
  it('creates an account and signs in', async () => {
    expect(await register('Ana', 'secret')).toBeNull();
    expect(addPick(pick('1'))).toBe(true);
  });

  it('refuses a short name, a short password and a taken name', async () => {
    expect(await register('A', 'secret')).toBe('name');
    expect(await register('Ana', 'abc')).toBe('password');
    expect(await register('Ana', 'secret')).toBeNull();
    logout();
    expect(await register(' ana ', 'other-secret')).toBe('taken');
  });

  it('logs in with the right password and refuses a wrong one or an unknown name', async () => {
    await register('Ana', 'secret');
    logout();
    expect(await login('Ana', 'nope')).toBe('wrong');
    expect(await login('Nobody', 'secret')).toBe('wrong');
    expect(addPick(pick('1'))).toBe(false);
    expect(await login('Ana', 'secret')).toBeNull();
    expect(addPick(pick('1'))).toBe(true);
  });

  it('logout ends the session', async () => {
    await register('Ana', 'secret');
    logout();
    expect(addPick(pick('1'))).toBe(false);
  });
});

describe('picks', () => {
  it('adds a pick once, tells it is saved and removes it', async () => {
    await register('Ana', 'secret');
    addPick(pick('1'));
    addPick(pick('1'));
    addPick(pick('1', 'tennis'));
    const stored = JSON.parse(localStorage.getItem('fairscout.accounts') ?? '{}').ana.picks as SavedPick[];
    expect(stored).toHaveLength(2);
    expect(isSaved({ name: 'ana', picks: stored }, 'football', '1')).toBe(true);
    removePick('football', '1');
    const after = JSON.parse(localStorage.getItem('fairscout.accounts') ?? '{}').ana.picks as SavedPick[];
    expect(after.map((p) => p.sport)).toEqual(['tennis']);
  });

  it('keeps picks over a logout and a new login, and keeps two scouts apart', async () => {
    await register('Ana', 'secret');
    addPick(pick('1'));
    logout();
    await register('Ben', 'hunter2');
    addPick(pick('2'));
    logout();
    await login('Ana', 'secret');
    const book = () => JSON.parse(localStorage.getItem('fairscout.accounts') ?? '{}');
    expect(book().ana.picks.map((p: SavedPick) => p.id)).toEqual(['1']);
    expect(book().ben.picks.map((p: SavedPick) => p.id)).toEqual(['2']);
  });

  it('gives the card address of each sport', () => {
    expect(cardPath({ sport: 'football', id: 'x' })).toBe('/player/x');
    expect(cardPath({ sport: 'tennis', id: 'x' })).toBe('/tennis/x');
    expect(cardPath({ sport: 'basketball', id: 'x' })).toBe('/basketball/x');
  });
});
