import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { canShowThree, countMatches, pickReason, pickTrio, reasonSentence, toggleMatter, type BasketBrief } from '../src/lib/basketball/blind';
import { getBlindState, reset } from '../src/lib/basketball/blindStore';
import { setBasketForTests } from '../src/lib/basketball/data';
import type { BasketFile, BasketPlayer } from '../src/lib/basketball/types';
import { BasketBlind } from '../src/screens/Basketball/BasketBlind';

const mk = (id: string, over: Partial<BasketPlayer>): BasketPlayer => ({
  id,
  name: `Name ${id.toUpperCase()}`,
  country: 'France',
  team: `Club ${id.toUpperCase()}`,
  competition: 'EuroLeague',
  position: 'Guard',
  height_cm: 201,
  age: 19.5,
  games: 20,
  mpg: 10,
  ppg: 4,
  rpg: 2,
  apg: 1,
  pirpg: 5,
  pts40: 16,
  pir40: 10,
  score: 0.3,
  score_rank_pct: 50,
  tier: 'C',
  pct: { scoring: 50, impact: 50, trust: 50 },
  rating: 50,
  drivers: [
    { key: 'k', sign: '+', text: 'Already gets minutes' },
    { key: 'j', sign: '-', text: 'Few games' },
  ],
  flags: { under20: false, low_sample: false },
  history: [],
  ...over,
});

const players: BasketPlayer[] = [
  mk('a', { mpg: 6, ppg: 5, pir40: 20, age: 19.2, score: 0.9, tier: 'A', pct: { scoring: 80, impact: 90, trust: 70 } }),
  mk('b', { position: 'Forward', mpg: 15, age: 20.5, score: 0.5, tier: 'B', pct: { scoring: 60, impact: 40, trust: 30 } }),
  mk('c', { position: null, height_cm: null, mpg: 10, pir40: 14, age: 18.9, score: 0.3, pct: { scoring: 90, impact: 20, trust: 20 } }),
  mk('d', { position: 'Forward', mpg: 7, age: 22, score: 0.2, pct: { scoring: 20, impact: 30, trust: 95 } }),
  mk('e', { position: 'Center', mpg: 11, age: 19 }),
  mk('f', { mpg: 5, age: 24 }),
  mk('g', { position: 'Center', mpg: 17.4, ppg: 3, age: 21.4, score: 0.6, tier: 'B', pct: { scoring: 55, impact: 55, trust: 55 } }),
  mk('h', { position: 'Forward', mpg: 19, age: 22.1, score: 0.1 }),
];
const tiers = { A: { n: 71, hits: 35 }, B: { n: 71, hits: 16 }, C: { n: 516, hits: 47 } };
const file = { meta: { target_minutes: 20, season: '2025/26', backtest: { tiers } }, players, timemachine: [] } as unknown as BasketFile;
const byId = (id: string) => players.find((p) => p.id === id) as BasketPlayer;
const brief = (over: Partial<BasketBrief> = {}): BasketBrief => ({ position: 'Any', maxAge: 23, hidden: 18, matters: [], ...over });

function renderBlind() {
  const router = createMemoryRouter(
    [
      { path: '/blind', element: <BasketBlind /> },
      { path: '/basketball/:id', element: <p>card</p> },
    ],
    { initialEntries: ['/blind'] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
const showThree = () => screen.getByRole('button', { name: /Show me three/ });

beforeEach(() => {
  reset();
  setBasketForTests(file);
});

describe('basketball blind logic', () => {
  it('filters by position, age in whole years and minutes per game', () => {
    expect(countMatches(players, brief())).toBe(6);
    expect(countMatches(players, brief({ maxAge: 21 }))).toBe(4);
    expect(countMatches(players, brief({ hidden: 12 }))).toBe(4);
    expect(countMatches(players, brief({ maxAge: 21, hidden: 8 }))).toBe(1);
    expect(countMatches(players, brief({ position: 'Forward' }))).toBe(2);
    expect(countMatches(players, brief({ position: 'Center' }))).toBe(2);
    expect(countMatches(players, brief({ position: 'Guard' }))).toBe(1);
    expect(canShowThree(2)).toBe(false);
    expect(canShowThree(3)).toBe(true);
  });

  it('keeps at most two priorities and drops the oldest', () => {
    expect(toggleMatter(['scoring', 'trust'], 'impact')).toEqual(['trust', 'impact']);
    expect(toggleMatter(['scoring', 'trust'], 'scoring')).toEqual(['trust']);
  });

  it('chooses three different players: the model top, the most minutes, the best fit', () => {
    const trio = pickTrio(players, brief({ matters: ['trust'] }));
    expect(trio?.modelTop.id).toBe('a');
    expect(trio?.mostMinutes.id).toBe('g');
    expect(trio?.bestFit.id).toBe('d');
    expect(new Set(trio?.order.map((p) => p.id)).size).toBe(3);
    expect(pickTrio(players, brief({ position: 'Forward' }))).toBeNull();
  });

  it('says why: better tier', () => {
    const text = reasonSentence(pickReason(byId('a'), byId('g')), 'X', 'Y');
    expect(text).toBe('The model prefers X for his outlook: tier A, against tier B for Y. X has more points, a higher index rating and a younger age, but fewer minutes.');
  });

  it('says why: same tier, the model scores higher', () => {
    const text = reasonSentence(pickReason(byId('c'), byId('d')), 'X', 'Y');
    expect(text.startsWith('X and Y are both outlook C. Inside that tier the model scores X higher.')).toBe(true);
    expect(text).toContain('X has more minutes, a higher index rating and a younger age.');
    const behind = reasonSentence(pickReason(byId('d'), byId('c')), 'Y', 'X');
    expect(behind.startsWith('Y and X are both outlook C.')).toBe(true);
    expect(behind).not.toContain('scores Y higher');
  });

  it('says why: the model behind on a row', () => {
    expect(reasonSentence(pickReason(byId('g'), byId('a')), 'G', 'A')).toContain('G has more minutes');
    expect(reasonSentence(pickReason(byId('a'), byId('g')), 'A', 'G')).toContain('but fewer minutes');
    expect(reasonSentence(pickReason(byId('d'), byId('c')), 'D', 'C')).toContain('an older age');
  });
});

describe('basketball blind screen', () => {
  it('shows the brief with the count, and disables the button with fewer than three', async () => {
    renderBlind();
    expect(await screen.findByText('players match')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(showThree()).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Forward' }));
    expect(showThree()).toBeDisabled();
    expect(screen.getByText(/Three are needed/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Any' }));
    await userEvent.click(screen.getByRole('button', { name: 'Under 21' }));
    await userEvent.click(screen.getByRole('button', { name: 'Under 8 min a game' }));
    expect(showThree()).toBeDisabled();
    expect(screen.getByText('player matches', { exact: false })).toBeInTheDocument();
  });

  it('shows three dossiers without names, then reveals names after a pick', async () => {
    renderBlind();
    await userEvent.click(showThree());
    expect(screen.getAllByRole('button', { name: /Pick player/ })).toHaveLength(3);
    expect(screen.queryByText('Name A')).not.toBeInTheDocument();
    expect(screen.queryByText(/Club A/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/age 19|age 21|age 20|age 18/).length).toBe(3);
    expect(screen.getAllByText(/201 cm/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Outlook = the model’s estimate of becoming a rotation player \(20 minutes a game\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pick player A' }));
    expect(getBlindState().step).toBe('revealed');
    for (const id of ['A', 'G']) expect(screen.getAllByText(`Name ${id}`).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Club A · EuroLeague').length).toBe(1);
    expect(screen.getByText('Model’s pick')).toBeInTheDocument();
    expect(screen.getByText('Most minutes')).toBeInTheDocument();
    expect(screen.getByText('17.4 a game')).toBeInTheDocument();
    expect(screen.getByText('3.0 a game')).toBeInTheDocument();
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
    const { trio } = await pickPlayer('g');
    expect(screen.getByText(/You picked/)).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(6);
    expect(within(table).getAllByText(/Name A/).length).toBeGreaterThan(0);
    expect(within(table).getAllByText(/Name G/).length).toBeGreaterThan(0);
    expect(within(table).getAllByText('ahead').length).toBeGreaterThan(0);
    expect(trio?.modelTop.id).toBe('a');
    expect(screen.getByText(/The model prefers Name A for his outlook/)).toBeInTheDocument();
    expect(screen.getByText(/What the model sees in Name A: Already gets minutes\./)).toBeInTheDocument();
  });

  it('shows no table when the scout agrees', async () => {
    renderBlind();
    await pickPlayer('a');
    expect(screen.getByText(/You and the model agree/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('See why opens the card of the model’s pick; Change returns to the brief', async () => {
    const router = renderBlind();
    await pickPlayer('g');
    await userEvent.click(screen.getByRole('button', { name: /See why/ }));
    expect(router.state.location.pathname).toBe('/basketball/a');
    reset();
    router.navigate('/blind');
    await userEvent.click(await screen.findByRole('button', { name: /Show me three/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(getBlindState().step).toBe('brief');
  });
});
