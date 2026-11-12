import { isNumber, isText, parseTable, referenceSource } from '../references';
import type { BasketPlayer } from './types';

/**
 * A basketball player of basketball_references.json: everyone of the season with the pool's minimum
 * of games who is not in the pool. His three scores are measured against the pool. Written by
 * scripts/basketball_data.py.
 */
export type BasketReference = {
  id: string;
  name: string;
  team: string;
  competition: string;
  position: BasketPlayer['position'];
  age: number;
  mpg: number;
  scoring: number;
  impact: number;
  trust: number;
  low_sample: boolean;
};

const TEXT = ['id', 'name', 'team', 'competition'] as const;
const NUMBERS = ['age', 'mpg', 'scoring', 'impact', 'trust'] as const;
const POSITIONS: readonly unknown[] = ['Guard', 'Forward', 'Center', null];

/** Reads basketball_references.json. */
export function parseBasketReferences(json: unknown): BasketReference[] {
  return parseTable<BasketReference>(json, [...TEXT, ...NUMBERS, 'position', 'low_sample'], (cell) => {
    const ok = TEXT.every((name) => isText(cell(name))) && NUMBERS.every((name) => isNumber(cell(name))) && POSITIONS.includes(cell('position'));
    if (!ok) return null;
    return {
      id: cell('id') as string,
      name: cell('name') as string,
      team: cell('team') as string,
      competition: cell('competition') as string,
      position: cell('position') as BasketReference['position'],
      age: cell('age') as number,
      mpg: cell('mpg') as number,
      scoring: cell('scoring') as number,
      impact: cell('impact') as number,
      trust: cell('trust') as number,
      low_sample: Boolean(cell('low_sample')),
    };
  });
}

const source = referenceSource('basketball_references.json', parseBasketReferences);

export const loadBasketReferences = source.load;
export const setBasketReferencesForTests = source.setForTests;
export const useBasketReferences = source.use;
