import { useEffect, useState } from 'react';

/**
 * The players a scout can name on the "Similar" screen who are not in the sport's own file: a table
 * of `columns` and `rows`, one file per sport. They are only named, never offered as a match.
 */

/** Reads one cell of a row by the name of its column. */
export type Cells = (name: string) => unknown;

export const isText = (v: unknown): v is string => typeof v === 'string' && v !== '';
export const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Reads a table: `columns` names the cells of every row, in any order. `read` turns a row into a
 * player or returns null for a row with a missing or wrong cell, which is then left out. A file
 * without one of the `needed` columns throws.
 */
export function parseTable<T>(json: unknown, needed: readonly string[], read: (cell: Cells) => T | null): T[] {
  const file = json as { columns?: unknown; rows?: unknown } | null;
  if (!file || !Array.isArray(file.columns) || !Array.isArray(file.rows)) throw new Error('required fields are missing');
  const columns = file.columns as unknown[];
  const missing = needed.filter((name) => !columns.includes(name));
  if (missing.length > 0) throw new Error(`columns are missing: ${missing.join(', ')}`);
  const at = new Map(needed.map((name) => [name, columns.indexOf(name)]));
  const out: T[] = [];
  for (const row of file.rows as unknown[]) {
    if (!Array.isArray(row)) continue;
    const player = read((name) => row[at.get(name) ?? -1]);
    if (player) out.push(player);
  }
  return out;
}

export type ReferenceSource<T> = {
  /** Fetches the file once and keeps it for the session. A failed fetch is tried again by the next call. */
  load: (baseUrl?: string) => Promise<T[]>;
  /**
   * The players of the file. Empty while it loads and when it cannot be read: the screen then works
   * with the players of the sport's own file alone.
   */
  use: () => readonly T[];
  /** Puts a list in place of the fetch. Used by tests; null empties it. */
  setForTests: (list: T[] | null) => void;
};

/** One file of players that can be named: `data/<file>`, read with `parse`. */
export function referenceSource<T>(file: string, parse: (json: unknown) => T[]): ReferenceSource<T> {
  let cached: T[] | null = null;
  let pending: Promise<T[]> | null = null;
  const none: readonly T[] = [];

  const load = (baseUrl: string = import.meta.env.BASE_URL): Promise<T[]> => {
    if (cached) return Promise.resolve(cached);
    pending ??= (async () => {
      try {
        const response = await fetch(`${baseUrl}data/${file}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        cached = parse(await response.json());
        return cached;
      } finally {
        pending = null;
      }
    })();
    return pending;
  };

  const use = (): readonly T[] => {
    const [list, setList] = useState<readonly T[]>(() => cached ?? none);
    useEffect(() => {
      let current = true;
      load().then(
        (loaded) => current && setList(loaded),
        () => undefined,
      );
      return () => {
        current = false;
      };
    }, []);
    return list;
  };

  const setForTests = (list: T[] | null): void => {
    cached = list;
    pending = null;
  };

  return { load, use, setForTests };
}

/**
 * A football player of references.json: every player of the radar season with the minimum minutes
 * who is outside the pool. The file is written by scripts/reference_players.py.
 */
export type Reference = {
  id: string;
  name: string;
  club: string;
  league: string;
  position: string;
  group: 'Attack' | 'Midfield' | 'Defender' | 'Goalkeeper';
  age: number;
  value: number;
  creating: number;
  scoring: number;
  role: number;
  ga90: number;
  ga90_adj: number | null;
  low_sample: boolean;
  born_q4: boolean;
};

const TEXT = ['id', 'name', 'club', 'league', 'position', 'group'] as const;
const NUMBERS = ['age', 'value', 'creating', 'scoring', 'role', 'ga90'] as const;
const GROUPS: readonly string[] = ['Attack', 'Midfield', 'Defender', 'Goalkeeper'];

/** Reads references.json. */
export function parseReferences(json: unknown): Reference[] {
  return parseTable<Reference>(json, [...TEXT, ...NUMBERS, 'ga90_adj', 'low_sample', 'born_q4'], (cell) => {
    const adjusted = cell('ga90_adj');
    const ok =
      TEXT.every((name) => isText(cell(name))) &&
      NUMBERS.every((name) => isNumber(cell(name))) &&
      GROUPS.includes(cell('group') as string) &&
      (adjusted === null || isNumber(adjusted));
    if (!ok) return null;
    return {
      id: cell('id') as string,
      name: cell('name') as string,
      club: cell('club') as string,
      league: cell('league') as string,
      position: cell('position') as string,
      group: cell('group') as Reference['group'],
      age: cell('age') as number,
      value: cell('value') as number,
      creating: cell('creating') as number,
      scoring: cell('scoring') as number,
      role: cell('role') as number,
      ga90: cell('ga90') as number,
      ga90_adj: adjusted as number | null,
      low_sample: Boolean(cell('low_sample')),
      born_q4: Boolean(cell('born_q4')),
    };
  });
}

const football = referenceSource('references.json', parseReferences);

export const loadReferences = football.load;
export const setReferencesForTests = football.setForTests;
export const useReferences = football.use;
