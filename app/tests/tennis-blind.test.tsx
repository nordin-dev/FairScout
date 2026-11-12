import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { canShowThree, countMatches, pickReason, pickTrio, reasonSentence, toggleMatter, type TennisBrief } from '../src/lib/tennis/blind';
import { getBlindState, reset } from '../src/lib/tennis/blindStore';
import { setTennisForTests } from '../src/lib/tennis/data';
import type { TennisFile, TennisPlayer } from '../src/lib/tennis/types';
import { TennisBlind } from '../src/screens/Tennis/TennisBlind';

const mk = (id: string, over: Partial<TennisPlayer>): TennisPlayer => ({
  id,
  name: `Name ${id.toUpperCase()}`,
  country_code: 'NOR',
  country: `Land ${id.toUpperCase()}`,
  hand: 'Right',
  height_cm: 185,
  age: 19.5,
  rank: 300,
  rank_year_ago: 500,
  matches: 50,
  wins: 25,
  losses: 25,
  upper_matches: 30,
  upper_wins: 15,
  top200_wins: 5,
  best_win_rank: 150,
  score: 0.3,
  score_rank_pct: 50,
  tier: 'C',
  pct: { wins: 50, level: 50, rise: 50 },
  rating: 50,
  drivers: [{ key: 'k', sign: '+', text: 'Wins most of his matches' }, { key: 'j', sign: '-', text: 'Older than most' }],
  flags: { under18: false, low_sample: false },
  rank_history: [],
  ...over,
});

const players: TennisPlayer[] = [
  mk('a', { rank: 300, age: 19.2, score: 0.9, tier: 'A', wins: 40, losses: 20, matches: 60, top200_wins: 10, pct: { wins: 80, level: 90, rise: 70 } }),
  mk('b', { rank: 160, age: 20.5, score: 0.5, tier: 'B', wins: 30, losses: 20, matches: 50, top200_wins: 2, pct: { wins: 60, level: 40, rise: 30 } }),
  mk('c', { rank: 180, age: 18.9, score: 0.3, tier: 'C', hand: null, pct: { wins: 90, level: 20, rise: 20 } }),
  mk('d', { rank: 500, age: 19.9, score: 0.2, tier: 'C', pct: { wins: 20, level: 30, rise: 95 } }),
  mk('e', { rank: 120, age: 19 }),
  mk('f', { rank: 600, age: 21.3 }),
  mk('g', { rank: 220, age: 19.4, score: 0.6, tier: 'B', pct: { wins: 55, level: 55, rise: 55 } }),
  mk('h', { rank: 700, age: 20.1, score: 0.1, tier: 'C', pct: { wins: 10, level: 10, rise: 10 } }),
];
const file = { meta: {}, players } as unknown as TennisFile;
const byId = (id: string) => players.find((p) => p.id === id) as TennisPlayer;
const brief = (over: Partial<TennisBrief> = {}): TennisBrief => ({ maxAge: 20, hidden: 150, matters: [], ...over });

function renderBlind() {
  const router = createMemoryRouter(
    [
      { path: '/blind', element: <TennisBlind /> },
      { path: '/tennis/:id', element: <p>card</p> },
    ],
    { initialEntries: ['/blind'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
const showThree = () => screen.getByRole('button', { name: /Show me three/ });

beforeEach(() => {
  reset();
  setTennisForTests(file);
});

describe('tennis blind logic', () => {
  it('filters by age in whole years and by rank', () => {
    expect(countMatches(players, brief())).toBe(6);
    expect(countMatches(players, brief({ maxAge: 19 }))).toBe(4);
    expect(countMatches(players, brief({ hidden: 250 }))).toBe(3);
    expect(countMatches(players, brief({ maxAge: 19, hidden: 250 }))).toBe(2);
    expect(canShowThree(2)).toBe(false);
    expect(canShowThree(3)).toBe(true);
  });

  it('keeps at most two priorities and drops the oldest', () => {
    expect(toggleMatter(['wins', 'rise'], 'level')).toEqual(['rise', 'level']);
    expect(toggleMatter(['wins', 'rise'], 'wins')).toEqual(['rise']);
  });

  it('chooses three different players: the model top, the best ranked, the best fit', () => {
    const trio = pickTrio(players, brief({ matters: ['rise'] }));
    expect(trio?.modelTop.id).toBe('a');
    expect(trio?.bestRanked.id).toBe('b');
    expect(trio?.bestFit.id).toBe('d');
    expect(new Set(trio?.order.map((p) => p.id)).size).toBe(3);
    expect(pickTrio(players, brief({ maxAge: 19, hidden: 250 }))).toBeNull();
  });

  it('says why: better tier', () => {
    const text = reasonSentence(pickReason(byId('a'), byId('b')), 'X', 'Y');
    expect(text).toBe('The model prefers X for his outlook: tier A, against tier B for Y. X has a higher win rate, a younger age and more wins over top-200 players, but a worse ranking.');
  });

  it('says why: same tier, the model scores higher', () => {
    const text = reasonSentence(pickReason(byId('c'), byId('d')), 'X', 'Y');
    expect(text.startsWith('X and Y are both outlook C. Inside that tier the model scores X higher.')).toBe(true);
    const behind = reasonSentence(pickReason(byId('d'), byId('c')), 'Y', 'X');
    expect(behind.startsWith('Y and X are both outlook C.')).toBe(true);
    expect(behind).not.toContain('scores Y higher');
  });

  it('says why: the model behind on a row', () => {
    expect(reasonSentence(pickReason(byId('b'), byId('a')), 'B', 'A')).toContain('B has a better ranking');
    expect(reasonSentence(pickReason(byId('a'), byId('b')), 'A', 'B')).toContain('but a worse ranking');
    expect(reasonSentence(pickReason(byId('b'), byId('c')), 'B', 'C')).toContain('an older age');
  });
});

describe('tennis blind screen', () => {
  it('shows the brief with the count, and disables the button with fewer than three', async () => {
    renderBlind();
    expect(await screen.findByText('players match')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(showThree()).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: '19 or under' }));
    await userEvent.click(screen.getByRole('button', { name: 'Outside the top 250' }));
    expect(showThree()).toBeDisabled();
    expect(screen.getByText(/Three are needed/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows three dossiers without names, then reveals names after a pick', async () => {
    renderBlind();
    await userEvent.click(showThree());
    expect(screen.getAllByRole('button', { name: /Pick player/ })).toHaveLength(3);
    expect(screen.queryByText('Name A')).not.toBeInTheDocument();
    expect(screen.getAllByText(/age 19|age 20|age 18/).length).toBe(3);
    await userEvent.click(screen.getByRole('button', { name: 'Pick player A' }));
    expect(getBlindState().step).toBe('revealed');
    for (const id of ['a', 'b']) expect(screen.getAllByText(`Name ${id.toUpperCase()}`).length).toBeGreaterThan(0);
    expect(screen.getByText('Model’s pick')).toBeInTheDocument();
    expect(screen.getByText('Best ranking')).toBeInTheDocument();
    expect(screen.getByText('No. 160')).toBeInTheDocument();
    expect(screen.getByText('40–20')).toBeInTheDocument();
  });

  async function pickPlayer(id: string) {
    const trio = pickTrio(players, brief());
    const letter = 'ABC'[trio?.order.findIndex((p) => p.id === id) ?? 0];
    await userEvent.click(showThree());
    await userEvent.click(screen.getByRole('button', { name: `Pick player ${letter}` }));
    return { trio, letter };
  }

  it('shows the comparison table when the scout disagrees, and no table when he agrees', async () => {
    renderBlind();
    const { trio } = await pickPlayer('b');
    const verdict = screen.getByText(/You picked/);
    expect(verdict).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(within(table).getAllByText(/Name A/).length).toBeGreaterThan(0);
    expect(within(table).getAllByText(/Name B/).length).toBeGreaterThan(0);
    expect(within(table).getAllByText('ahead').length).toBeGreaterThan(0);
    expect(trio?.modelTop.id).toBe('a');
    expect(screen.getByText(/The model prefers Name A for his outlook/)).toBeInTheDocument();
    expect(screen.getByText(/What the model sees in Name A: Wins most of his matches\./)).toBeInTheDocument();
  });

  it('shows no table when the scout agrees', async () => {
    renderBlind();
    await pickPlayer('a');
    expect(screen.getByText(/You and the model agree/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('See why opens the card of the model’s pick; Change returns to the brief', async () => {
    const router = renderBlind();
    await pickPlayer('b');
    await userEvent.click(screen.getByRole('button', { name: /See why/ }));
    expect(router.state.location.pathname).toBe('/tennis/a');
    reset();
    router.navigate('/blind');
    await userEvent.click(await screen.findByRole('button', { name: /Show me three/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(getBlindState().step).toBe('brief');
  });
});
