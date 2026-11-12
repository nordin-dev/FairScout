import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pickReason, positiveDrivers, reasonSentence } from '../src/lib/pickreason';
import { ratingOf } from '../src/lib/rating';
import type { Player } from '../src/lib/types';

const base = (JSON.parse(readFileSync(resolve(__dirname, '../../contract/samples/players.json'), 'utf8')) as Player[])[0];
const mk = (over: Partial<Player>, output = 50): Player => ({
  ...base,
  name: 'X',
  tier: 'B',
  value_eur: 300_000,
  age: 20.4,
  minutes: 1000,
  ...over,
  pct: { ...base.pct, output },
  flags: { ...base.flags, limited_position_data: false },
});
const ahead = (r: ReturnType<typeof pickReason>, key: string) => r.rows.find((x) => x.key === key)?.ahead;

describe('pickReason', () => {
  it('marks the model ahead on a better tier, higher rating, lower price, younger age and more minutes', () => {
    const r = pickReason(
      mk({ tier: 'A', value_eur: 200_000, age: 19.2, minutes: 1500 }, 80),
      mk({ tier: 'C', value_eur: 400_000, age: 21.1, minutes: 900 }, 60),
    );
    expect(r.rows.map((x) => x.key)).toEqual(['tier', 'rating', 'price', 'age', 'minutes']);
    expect(r.rows.map((x) => x.ahead)).toEqual(['model', 'model', 'model', 'model', 'model']);
    expect(r.modelAhead).toEqual(['rating', 'price', 'age', 'minutes']);
    expect(r.modelBehind).toEqual([]);
  });

  it('keeps a row where the model is behind and marks it for the scout', () => {
    const r = pickReason(
      mk({ tier: 'A', value_eur: 500_000, minutes: 800 }, 40),
      mk({ tier: 'B', value_eur: 300_000, minutes: 1200 }, 70),
    );
    expect(ahead(r, 'rating')).toBe('scout');
    expect(ahead(r, 'price')).toBe('scout');
    expect(ahead(r, 'minutes')).toBe('scout');
    expect(r.modelBehind).toEqual(['rating', 'price', 'minutes']);
    expect(r.rows.find((x) => x.key === 'price')).toMatchObject({ model: 500_000, scout: 300_000 });
  });

  it('treats equal values, including ages equal in whole years, as ahead for no one', () => {
    const r = pickReason(mk({ age: 20.1 }), mk({ age: 20.9 }));
    expect(r.rows.map((x) => x.ahead)).toEqual([null, null, null, null, null]);
  });

  it('uses ratingOf for the rating', () => {
    const m = mk({}, 77);
    expect(pickReason(m, mk({}, 10)).rows[1].model).toBe(ratingOf(m));
  });

  it('has no leader on the tier row when a tier is missing', () => {
    const r = pickReason(mk({ tier: null }), mk({ tier: 'C' }));
    expect(r.rows[0]).toMatchObject({ model: null, scout: 'C', ahead: null });
  });
});

describe('reasonSentence', () => {
  it('names both tiers and the rows ahead', () => {
    const r = pickReason(mk({ tier: 'A', value_eur: 200_000 }, 80), mk({ tier: 'C', value_eur: 400_000 }, 60));
    expect(reasonSentence(r, 'Ana', 'Bo')).toBe('The model prefers Ana for his outlook: tier A, against tier C for Bo. Ana has a higher rating and a lower price.');
  });

  it('says so when the model’s pick is behind on a row', () => {
    const r = pickReason(mk({ tier: 'A', value_eur: 500_000 }, 80), mk({ tier: 'B', value_eur: 300_000 }, 60));
    expect(reasonSentence(r, 'Ana', 'Bo')).toBe('The model prefers Ana for his outlook: tier A, against tier B for Bo. Ana has a higher rating, but a higher price.');
  });

  it('says the outlook is not known and claims nothing about tiers', () => {
    const r = pickReason(mk({ tier: null }), mk({ tier: 'B' }));
    expect(reasonSentence(r, 'Ana', 'Bo')).toBe('The outlook of Ana or Bo is not known.');
  });
});

describe('positiveDrivers', () => {
  it('keeps only what counts in the player’s favour, in order', () => {
    const p = mk({
      drivers: [
        { sign: '+', key: 'age', text: 'Young for his level' },
        { sign: '-', key: 'league_median', text: 'Cheaper league' },
        { sign: '+', key: 'role', text: 'Key part of team' },
      ],
    });
    expect(positiveDrivers(p)).toEqual(['Young for his level', 'Key part of team']);
  });
});

describe('reasonSentence inside one tier', () => {
  it('says the model scores its pick higher when no row puts it ahead', () => {
    const r = pickReason(mk({ name: 'Ana', tier: 'C', score: 0.3 }), mk({ name: 'Bo', tier: 'C', score: 0.2 }));
    expect(r.modelAhead).toEqual([]);
    expect(reasonSentence(r, 'Ana', 'Bo')).toBe('Ana and Bo are both outlook C. Inside that tier the model scores Ana higher.');
  });

  it('does not claim a higher score when the scores are equal', () => {
    const r = pickReason(mk({ tier: 'C', score: 0.2 }), mk({ tier: 'C', score: 0.2 }));
    expect(reasonSentence(r, 'Ana', 'Bo')).toBe('Ana and Bo are both outlook C.');
  });
});
