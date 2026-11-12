import { isNumber, isText, parseTable, referenceSource } from '../references';

/**
 * A tennis player of tennis_references.json: everyone ranked up to the pool's last ranking who is
 * not in the pool. His three scores are measured against the pool. Written by scripts/tennis_data.py.
 */
export type TennisReference = {
  id: string;
  name: string;
  country: string;
  age: number;
  rank: number;
  wins: number;
  level: number;
  rise: number;
  low_sample: boolean;
};

const TEXT = ['id', 'name', 'country'] as const;
const NUMBERS = ['age', 'rank', 'wins', 'level', 'rise'] as const;

/** Reads tennis_references.json. */
export function parseTennisReferences(json: unknown): TennisReference[] {
  return parseTable<TennisReference>(json, [...TEXT, ...NUMBERS, 'low_sample'], (cell) => {
    if (!TEXT.every((name) => isText(cell(name))) || !NUMBERS.every((name) => isNumber(cell(name)))) return null;
    return {
      id: cell('id') as string,
      name: cell('name') as string,
      country: cell('country') as string,
      age: cell('age') as number,
      rank: cell('rank') as number,
      wins: cell('wins') as number,
      level: cell('level') as number,
      rise: cell('rise') as number,
      low_sample: Boolean(cell('low_sample')),
    };
  });
}

const source = referenceSource('tennis_references.json', parseTennisReferences);

export const loadTennisReferences = source.load;
export const setTennisReferencesForTests = source.setForTests;
export const useTennisReferences = source.use;
