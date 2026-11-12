import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frameRoutes } from '../src/App';
import { biasSummary, leans, shareGap, signalsOf, type PickRecord } from '../src/lib/fairness';
import { getState, nextBlindRound, reset, startBlindRounds } from '../src/lib/store';
import { briefKey, drawTrio, pickTrio, unseenCount, type TrioBrief } from '../src/lib/trio';
import type { Player } from '../src/lib/types';

const sample = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(__dirname, `../../contract/samples/${name}.json`), 'utf8'));
const samplePlayers = sample('players') as Player[];
const base = samplePlayers[0];

type Over = Partial<Pick<Player, 'score' | 'goals' | 'assists' | 'minutes' | 'birth_quarter' | 'league_factor_source'>> & {
  role?: number;
  scoring?: number;
  creating?: number;
};
const mk = (id: string, over: Over = {}): Player => ({
  ...base,
  id,
  name: `Name ${id}`,
  club: `Club ${id}`,
  score: over.score === undefined ? 0.5 : over.score,
  goals: over.goals ?? 1,
  assists: over.assists ?? 1,
  minutes: over.minutes ?? 1000,
  birth_quarter: over.birth_quarter ?? 2,
  league_factor_source: over.league_factor_source ?? 'moves',
  pct: { ...base.pct, role: over.role ?? 50, scoring: over.scoring ?? 50, creating: over.creating ?? 50 },
});

const brief: TrioBrief = { position: 'winger', maxAge: 21, budget: 500_000, matters: ['creates', 'scores'] };
const pool: Player[] = Array.from({ length: 10 }, (_, i) => mk(`w${i}`, { score: i / 10, goals: 10 - i, minutes: 500 + 100 * i }));

beforeEach(() => reset());
afterEach(() => vi.unstubAllGlobals());

describe('overlooked signals', () => {
  it('names each sign from the player’s own data', () => {
    expect(signalsOf(mk('a'))).toEqual([]);
    expect(signalsOf(mk('b', { birth_quarter: 4 }))).toEqual(['young_for_year']);
    expect(signalsOf(mk('c', { role: 39, scoring: 70 }))).toEqual(['short_of_chances']);
    expect(signalsOf(mk('d', { role: 39, creating: 69, scoring: 69 }))).toEqual([]);
    expect(signalsOf(mk('e', { role: 40, scoring: 90 }))).toEqual([]);
    expect(signalsOf(mk('f', { league_factor_source: 'estimate' }))).toEqual([]);
    expect(signalsOf(mk('g', { birth_quarter: 4, role: 10, creating: 80 }))).toEqual(['young_for_year', 'short_of_chances']);
  });
});

describe('later rounds', () => {
  it('draws three players not shown before, fixed for the brief and the round', () => {
    const first = pickTrio(pool, brief);
    const seen = new Set(first?.order.map((p) => p.id));
    const second = drawTrio(pool, brief, seen, 1);
    expect(second).not.toBeNull();
    for (const p of second?.order ?? []) expect(seen.has(p.id)).toBe(false);
    expect(new Set(second?.order.map((p) => p.id)).size).toBe(3);
    expect(drawTrio(pool, brief, seen, 1)?.order.map((p) => p.id)).toEqual(second?.order.map((p) => p.id));
  });

  it('gives the roles inside the three: highest score, then most goals plus assists', () => {
    const t = drawTrio(pool, brief, new Set(), 3);
    const three = t?.order ?? [];
    const topScore = Math.max(...three.map((p) => p.score ?? -1));
    expect(t?.modelTop.score).toBe(topScore);
    const rest = three.filter((p) => p.id !== t?.modelTop.id);
    expect(t?.rawTop.goals).toBe(Math.max(...rest.map((p) => p.goals)));
    expect([t?.modelTop.id, t?.rawTop.id, t?.bestFit.id].sort()).toEqual(three.map((p) => p.id).sort());
  });

  it('stops when fewer than three unseen players match', () => {
    const seen = new Set(pool.slice(0, 8).map((p) => p.id));
    expect(unseenCount(pool, brief, seen)).toBe(2);
    expect(drawTrio(pool, brief, seen, 4)).toBeNull();
  });

  it('keeps rounds per brief and starts again for another brief', () => {
    const key = briefKey(brief);
    startBlindRounds(key);
    nextBlindRound(key, ['w1', 'w2', 'w3']);
    nextBlindRound(key, ['w4', 'w5', 'w6']);
    expect(getState().blindRounds).toEqual({ key, round: 2, seen: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'] });
    nextBlindRound('other', ['w7', 'w8', 'w9']);
    expect(getState().blindRounds).toEqual({ key: 'other', round: 1, seen: ['w7', 'w8', 'w9'] });
    expect(getState().blindStep).toBe('compare');
  });
});

describe('bias summary', () => {
  const players = [
    mk('hi', { goals: 9, minutes: 2000, birth_quarter: 1 }),
    mk('mid', { goals: 4, minutes: 1200, birth_quarter: 2 }),
    mk('low', { goals: 1, minutes: 300, birth_quarter: 4, role: 10, scoring: 80 }),
  ];
  const byId = new Map(players.map((p) => [p.id, p]));
  const rec = (scoutId: string, modelId = 'low'): PickRecord => ({ scoutId, modelId, shown: ['hi', 'mid', 'low'] });

  it('waits for three usable picks', () => {
    expect(biasSummary([rec('hi'), rec('hi')], byId)).toBeNull();
    expect(biasSummary([rec('hi'), rec('hi'), { scoutId: 'gone', modelId: 'low', shown: ['gone', 'mid', 'low'] }], byId)).toBeNull();
  });

  it('counts picks of the biggest numbers against chance and names the lean', () => {
    const s = biasSummary([rec('hi'), rec('hi'), rec('hi'), rec('low')], byId);
    expect(s?.picks).toBe(4);
    expect(s?.output).toEqual({ hits: 3, picks: 4, chance: 4 / 3 });
    expect(s?.minutes.hits).toBe(3);
    expect(s?.model.hits).toBe(1);
    expect(leans(s!.output)).toBe(true);
    expect(leans(s!.model)).toBe(false);
  });

  it('compares the birth and overlooked shares of the picks with everyone shown', () => {
    const s = biasSummary([rec('hi'), rec('hi'), rec('mid')], byId);
    expect(s?.bornEarly).toEqual({ picked: 3, pickedOf: 3, shown: 6, shownOf: 9 });
    expect(shareGap(s!.bornEarly)).toBe(33);
    expect(s?.overlooked).toEqual({ picked: 0, pickedOf: 3, shown: 3, shownOf: 9 });
    expect(shareGap(s!.overlooked)).toBe(-33);
    expect(s?.passedOverlooked).toEqual(['low']);
  });
});

function stubFetch(players: Player[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      return new Response(JSON.stringify(name === 'players' ? players : sample(name)), { status: 200 });
    }),
  );
}

async function openCompare() {
  const router = createMemoryRouter(frameRoutes, { initialEntries: ['/blind'] });
  render(<RouterProvider router={router} />);
  const show = await screen.findByRole('button', { name: /Show me three/ });
  await waitFor(() => expect(show).toBeEnabled());
  await userEvent.click(show);
}
const pickFirst = () => userEvent.click(screen.getAllByRole('button', { name: /Pick player/ })[0]);
const shownNames = () => Array.from(document.querySelectorAll('.ident-name')).map((n) => n.textContent ?? '');

describe('rounds on the screen', () => {
  const nine = Array.from({ length: 9 }, (_, i) =>
    mk(`s${i}`, { score: 0.9 - i / 20, goals: i, birth_quarter: i % 2 === 0 ? 4 : 1 }),
  );

  it('offers the next three, shows new players and the summary after the third pick', async () => {
    stubFetch(nine);
    await openCompare();
    expect(screen.getByText(/Round 1 · 6 more players match, not shown yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next three/ })).toBeNull();
    await pickFirst();
    const first = shownNames();
    expect(screen.getByText(/Pick 2 more times to see what drives your choices/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Next three/ }));
    expect(screen.getByText(/Round 2 · 3 more players match/)).toBeInTheDocument();
    await pickFirst();
    for (const name of shownNames()) expect(first).not.toContain(name);

    await userEvent.click(screen.getByRole('button', { name: /Next three/ }));
    expect(screen.getByText(/Round 3 · nobody else matches/)).toBeInTheDocument();
    await pickFirst();
    expect(screen.queryByRole('button', { name: /Next three/ })).toBeNull();
    expect(screen.getByText('You have seen every player that matches this brief.')).toBeInTheDocument();

    const summary = screen.getByRole('region', { name: 'What drives your picks' });
    expect(within(summary).getByText(/3 picks: read this as a hint/)).toBeInTheDocument();
    expect(within(summary).getAllByRole('row')).toHaveLength(5);
    expect(getState().blindPicks).toHaveLength(3);

    await userEvent.click(within(summary).getByRole('button', { name: 'Start over' }));
    expect(getState().blindPicks).toHaveLength(0);
    expect(screen.queryByRole('region', { name: 'What drives your picks' })).toBeNull();
  });

  it('shows the easy-to-overlook signs only after the pick', async () => {
    stubFetch(nine);
    await openCompare();
    expect(screen.queryByText('Easy to overlook')).toBeNull();
    expect(document.body.innerHTML).not.toContain('Young for his year');
    await pickFirst();
    expect(screen.getAllByText('Easy to overlook').length).toBeGreaterThan(0);
  });
});
