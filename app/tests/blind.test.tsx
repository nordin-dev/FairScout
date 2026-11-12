import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frameRoutes } from '../src/App';
import { Compare } from '../src/screens/BlindPick/Compare';
import { canShowThree, countMatches, positionOf, readDefaultBrief, toggleMatter, type BriefCriteria } from '../src/lib/brief';
import { getState, reset } from '../src/lib/store';
import type { Player } from '../src/lib/types';

const sample = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(__dirname, `../../contract/samples/${name}.json`), 'utf8'));

function stubFetch(overrides: Record<string, () => Response> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      return overrides[name] ? overrides[name]() : new Response(JSON.stringify(sample(name)), { status: 200 });
    }),
  );
}

beforeEach(() => {
  reset();
  stubFetch();
});
afterEach(() => vi.unstubAllGlobals());

type P = Pick<Player, 'in_pool' | 'position' | 'position_group' | 'age' | 'value_eur'>;
const p = (over: Partial<P>): P => ({
  in_pool: true, position: 'Right Winger', position_group: 'Attack', age: 20, value_eur: 300_000, ...over,
});
const crit = (over: Partial<BriefCriteria> = {}): BriefCriteria => ({ position: 'winger', maxAge: 21, budget: 500_000, ...over });

describe('matching', () => {
  it('matches by position, age, budget and pool', () => {
    const players = [
      p({}),
      p({ position: 'Centre-Forward' }),
      p({ age: 20.4 }),
      p({ age: 19.8 }),
      p({ value_eur: 500_000 }),
      p({ value_eur: 500_001 }),
      p({ in_pool: false }),
    ];
    expect(countMatches(players, crit())).toBe(4);
    expect(countMatches(players, crit({ position: 'striker' }))).toBe(1);
    expect(countMatches(players, crit({ maxAge: 19 }))).toBe(1);
    expect(countMatches(players, crit({ budget: 250_000 }))).toBe(0);
  });

  it('falls back on position_group for a position it does not know', () => {
    expect(positionOf({ position: 'Attack', position_group: 'Attack' })).toBe('striker');
    expect(positionOf({ position: 'Sweeper', position_group: 'Defender' })).toBe('defender');
    expect(positionOf({ position: 'Left Midfield', position_group: 'Midfield' })).toBe('winger');
  });

  it('drops the oldest priority when a third is chosen', () => {
    expect(toggleMatter(['creates', 'scores'], 'plays')).toEqual(['scores', 'plays']);
    expect(toggleMatter(['creates', 'scores'], 'creates')).toEqual(['scores']);
  });

  it('enables the button only with three matches and a priority', () => {
    expect(canShowThree(3, ['plays'])).toBe(true);
    expect(canShowThree(2, ['plays'])).toBe(false);
    expect(canShowThree(9, [])).toBe(false);
  });
});

function renderBlind() {
  const router = createMemoryRouter(frameRoutes, { initialEntries: ['/blind'] });
  render(<RouterProvider router={router} />);
}
const button = () => screen.getByRole('button', { name: /Show me three/ });
const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('brief screen', () => {
  it('starts from the default brief of the meta sample, with the count', async () => {
    const meta = sample('meta') as { default_brief: Parameters<typeof readDefaultBrief>[0] };
    renderBlind();
    await screen.findByText('players match');
    await waitFor(() => expect(button()).toBeEnabled());
    expect(pressed('Winger')).toBe('true');
    expect(pressed('U21 · born 2004+')).toBe('true');
    expect(pressed('Up to €500k')).toBe('true');
    expect(getState().brief.matters).toEqual(readDefaultBrief(meta.default_brief).matters);
    expect(pressed('Creates chances')).toBe('true');
    expect(pressed('Plays regularly')).toBe('false');
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(button()).toBeEnabled();
  });

  it('a budget choice changes the shared budget and the count; a third priority drops the oldest', async () => {
    renderBlind();
    await screen.findByText('players match');
    await waitFor(() => expect(button()).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Up to €250k' }));
    expect(getState().budget).toBe(250_000);
    expect(await screen.findByText(/Three are needed: raise the budget or the age limit/)).toHaveTextContent('player matches');
    expect(screen.getByText('Budget ≤ €250k')).toBeInTheDocument();
    expect(button()).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Plays regularly' }));
    expect(getState().brief.matters).toEqual(['scores', 'plays']);
    expect(pressed('Creates chances')).toBe('false');
  });

  it('is disabled with no priority, and Enter continues only when enabled', async () => {
    renderBlind();
    await screen.findByText('players match');
    await waitFor(() => expect(button()).toBeEnabled());
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(getState().blindStep).toBe('compare');

    reset();
    await userEvent.click(await screen.findByRole('button', { name: 'Creates chances' }));
    await userEvent.click(screen.getByRole('button', { name: 'Scores goals' }));
    await userEvent.click(screen.getByRole('button', { name: 'Scores goals' }));
    await userEvent.click(screen.getByRole('button', { name: 'Creates chances' }));
    expect(getState().brief.matters).toEqual([]);
    expect(button()).toBeDisabled();
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(getState().blindStep).toBe('brief');
  });

  it('shows the loading state with the brief drawn, then the error state with Try again', async () => {
    stubFetch({ players: () => new Response('', { status: 500 }) });
    renderBlind();
    expect(screen.getByRole('status')).toHaveTextContent('Loading players…');
    expect(screen.getByRole('button', { name: 'Winger' })).toBeInTheDocument();
    expect(button()).toBeDisabled();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('players.json');
    expect(screen.getByRole('heading', { name: 'What are you looking for?' })).toBeInTheDocument();
    stubFetch();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(await screen.findByText('players match')).toBeInTheDocument();
  });

  it('shows the not-found screen when the data failed', async () => {
    stubFetch({ meta: () => new Response('', { status: 404 }) });
    const router = createMemoryRouter(frameRoutes, { initialEntries: ['/nowhere'] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByText('This page does not exist.')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByText('This page does not exist.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('comparison scores', () => {
  it('shows the percentiles as whole numbers from 0 to 100, as the data holds them', () => {
    const base = (sample('players') as Player[])[0];
    const mk = (id: string, creating: number, scoring: number, role: number): Player => ({
      ...base, id, pct: { ...base.pct, creating, scoring, role },
    });
    const order: [Player, Player, Player] = [mk('a', 87, 85, 16), mk('b', 40, 41, 42), mk('c', 1, 2, 3)];
    const trio = { modelTop: order[0], rawTop: order[1], bestFit: order[2], order };
    const router = createMemoryRouter([{ path: '/', element: <Compare trio={trio} /> }]);
    render(<RouterProvider router={router} />);
    const first = screen.getByLabelText('Player A');
    expect(Array.from(first.querySelectorAll('.score b')).map((b) => b.textContent).sort()).toEqual(['16', '85', '87']);
  });
});
