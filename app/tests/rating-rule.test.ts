import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isLimitedPosition, ratingOf } from '../src/lib/rating';
import type { Player } from '../src/lib/types';

const players = JSON.parse(readFileSync(resolve(__dirname, '../public/data/players.json'), 'utf8')) as Player[];

describe('the rating rule against the exported data', () => {
  it('the flag of the data marks exactly the defenders and goalkeepers', () => {
    const drift = players.filter((p) => isLimitedPosition(p) !== (p.position_group === 'Defender' || p.position_group === 'Goalkeeper'));
    expect(drift.map((p) => p.id)).toEqual([]);
  });

  it('every note names the rating the app shows for that player', () => {
    const named = (note: string): number | null => {
      const found = /\brat(?:ing|ed)\D{0,12}(\d+)/i.exec(note);
      return found ? Number(found[1]) : null;
    };
    const noted = players.filter((p) => p.in_pool && p.note !== null && named(p.note) !== null);
    expect(noted.length).toBeGreaterThan(0);
    expect(noted.filter((p) => named(p.note as string) !== ratingOf(p)).map((p) => p.id)).toEqual([]);
  });
});
