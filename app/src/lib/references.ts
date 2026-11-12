import { useEffect, useState } from 'react';

/**
 * A player a scout can name on the "Similar" screen who is not in players.json: every player of the
 * radar season with the minimum minutes who is outside the pool. He is only named, never offered as
 * a match. The file is written by scripts/reference_players.py.
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

/**
 * Reads the file: `columns` names the cells of every row. A row with a missing or wrong cell is
 * left out; a file without the needed columns throws.
 */
export function parseReferences(json: unknown): Reference[] {
  const file = json as { columns?: unknown; rows?: unknown } | null;
  if (!file || !Array.isArray(file.columns) || !Array.isArray(file.rows)) throw new Error('required fields are missing');
  const at = (name: string): number => (file.columns as unknown[]).indexOf(name);
  const needed = [...TEXT, ...NUMBERS, 'ga90_adj', 'low_sample', 'born_q4'];
  const missing = needed.filter((name) => at(name) < 0);
  if (missing.length > 0) throw new Error(`columns are missing: ${missing.join(', ')}`);
  const out: Reference[] = [];
  for (const row of file.rows as unknown[]) {
    if (!Array.isArray(row)) continue;
    const cell = (name: string): unknown => row[at(name)];
    const adjusted = cell('ga90_adj');
    const ok =
      TEXT.every((name) => typeof cell(name) === 'string' && cell(name) !== '') &&
      NUMBERS.every((name) => typeof cell(name) === 'number' && Number.isFinite(cell(name))) &&
      GROUPS.includes(cell('group') as string) &&
      (adjusted === null || typeof adjusted === 'number');
    if (!ok) continue;
    out.push({
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
    });
  }
  return out;
}

let cached: Reference[] | null = null;
let pending: Promise<Reference[]> | null = null;

/** Fetches data/references.json once and keeps it for the session. A failed fetch is tried again by the next call. */
export function loadReferences(baseUrl: string = import.meta.env.BASE_URL): Promise<Reference[]> {
  if (cached) return Promise.resolve(cached);
  pending ??= (async () => {
    try {
      const response = await fetch(`${baseUrl}data/references.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      cached = parseReferences(await response.json());
      return cached;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

/** Puts a list in place of the fetch. Used by tests; null empties it. */
export function setReferencesForTests(list: Reference[] | null): void {
  cached = list;
  pending = null;
}

const NONE: readonly Reference[] = [];

/**
 * The players that can be named besides those of players.json. Empty while the file loads and when
 * it cannot be read: the screen then works with the players of players.json alone.
 */
export function useReferences(): readonly Reference[] {
  const [list, setList] = useState<readonly Reference[]>(() => cached ?? NONE);
  useEffect(() => {
    let current = true;
    loadReferences().then(
      (loaded) => current && setList(loaded),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, []);
  return list;
}
