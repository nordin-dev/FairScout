import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frameRoutes } from '../src/App';
import { getState, reset, setBlindStep, setBudget } from '../src/lib/store';
import { pickTrio, type TrioBrief } from '../src/lib/trio';
import type { Player } from '../src/lib/types';

const sample = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(__dirname, `../../contract/samples/${name}.json`), 'utf8'));
const samplePlayers = sample('players') as Player[];

function stubFetch(players: Player[] = samplePlayers) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      return new Response(JSON.stringify(name === 'players' ? players : sample(name)), { status: 200 });
    }),
  );
}

beforeEach(() => {
  reset();
  stubFetch();
});
afterEach(() => vi.unstubAllGlobals());

const base = samplePlayers[0];
const mk = (id: string, over: { score?: number | null; goals?: number; assists?: number; ga90?: number; creating?: number; scoring?: number; role?: number }): Player => ({
  ...base,
  id,
  name: `Name ${id}`,
  club: `Club ${id}`,
  score: over.score === undefined ? 0.5 : over.score,
  goals: over.goals ?? 1,
  assists: over.assists ?? 1,
  ga90: over.ga90 ?? 0.3,
  pct: { ...base.pct, creating: over.creating ?? 50, scoring: over.scoring ?? 50, role: over.role ?? 50 },
});
const brief: TrioBrief = { position: 'winger', maxAge: 21, budget: 500_000, matters: ['creates', 'scores'] };
const fixture: Player[] = [
  mk('p1', { score: 0.9, goals: 3, assists: 1, creating: 60, scoring: 60 }),
  mk('p2', { score: 0.6, goals: 12, assists: 3 }),
  mk('p3', { score: 0.55, goals: 5, assists: 5, creating: 95, scoring: 85 }),
  mk('p4', { score: 0.5, goals: 5, assists: 5, creating: 95, scoring: 85, ga90: 0.2 }),
  mk('p5', { score: 0.4, goals: 2, assists: 0, creating: 92, scoring: 92 }),
  mk('p6', { score: 0.3 }),
  { ...mk('p7', { score: 0.99, goals: 30 }), position: 'Centre-Forward' },
  { ...mk('p8', { score: 0.98, goals: 30 }), value_eur: 900_000 },
];

describe('trio selection', () => {
  it('picks the model top, the raw top and the best fit by the rules, ties to ga90 then id', () => {
    const t = pickTrio(fixture, brief);
    expect(t?.modelTop.id).toBe('p1');
    expect(t?.rawTop.id).toBe('p2');
    expect(t?.bestFit.id).toBe('p5');
    const tie = pickTrio(fixture.filter((p) => !['p5'].includes(p.id)), brief);
    expect(tie?.bestFit.id).toBe('p3');
  });

  it('never repeats a player when the model top is also the top scorer', () => {
    const list = [mk('a', { score: 0.9, goals: 20 }), mk('b', { goals: 4 }), mk('c', { goals: 3 }), mk('d', { goals: 1 })];
    const t = pickTrio(list, brief);
    expect(t?.modelTop.id).toBe('a');
    const ids = t?.order.map((p) => p.id) ?? [];
    expect(new Set(ids).size).toBe(3);
    expect(ids).toContain('b');
  });

  it('gives the same three in the same order for the same brief; another brief may differ', () => {
    const first = pickTrio(fixture, brief)?.order.map((p) => p.id);
    expect(pickTrio(fixture, { ...brief })?.order.map((p) => p.id)).toEqual(first);
    const orders = new Set(
      [250_000, 500_000, 1_000_000].flatMap((budget) =>
        (['plays', 'scores', 'creates'] as const).map((m) =>
          pickTrio(fixture, { ...brief, budget, matters: [m] })?.order.map((p) => p.id).join(),
        ),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it('returns null with fewer than three matches', () => {
    expect(pickTrio(fixture.slice(0, 2), brief)).toBeNull();
  });
});

function renderBlind() {
  const router = createMemoryRouter(frameRoutes, { initialEntries: ['/blind'] });
  render(<RouterProvider router={router} />);
  return router;
}
const compare = async () => {
  const router = renderBlind();
  const show = await screen.findByRole('button', { name: /Show me three/ });
  await waitFor(() => expect(show).toBeEnabled());
  await userEvent.click(show);
  return router;
};
const dossiers = () => screen.getAllByRole('region').filter((r) => /^Player [ABC]$/.test(r.getAttribute('aria-label') ?? ''));
const trioOrder = () => pickTrio(samplePlayers, { ...getState().brief, budget: getState().budget });

describe('comparison screen', () => {
  it('shows nothing of the candidates before the pick, and hides the bars from screen readers', async () => {
    await compare();
    expect(await screen.findByRole('heading', { name: 'Three wingers. No names. Pick one.' })).toBeInTheDocument();
    expect(dossiers()).toHaveLength(3);
    expect(screen.getByText(/Winger · U21 · up to €500k · creates chances, scores goals/)).toBeInTheDocument();
    const html = document.body.innerHTML;
    for (const p of samplePlayers) {
      for (const secret of [p.name, p.club, p.league_name, `€${p.value_eur / 1000}k`]) expect(html).not.toContain(secret);
    }
    for (const word of ['Price', 'Goals', 'Outlook', 'Your pick', 'Model’s pick', 'Most goals']) expect(screen.queryByText(word)).toBeNull();
    expect(screen.queryByRole('img', { name: /Tier/ })).toBeNull();
    expect(screen.getAllByRole('img', { name: 'hidden until you pick' })).toHaveLength(6);
    expect(screen.getAllByRole('button', { name: /Pick player/ })).toHaveLength(3);
  });

  it('puts the priorities first and dims the others', async () => {
    await compare();
    const first = dossiers()[0];
    const labels = [...first.querySelectorAll('.score .label')].map((e) => e.textContent);
    expect(labels).toEqual(['Creating', 'Scoring', 'Playing time']);
    const cells = [...first.querySelectorAll('.score > div')];
    expect(cells.map((c) => c.classList.contains('dim'))).toEqual([false, false, true]);
  });

  it('a pick reveals all three with both tags, the Your pick mark and no pick buttons', async () => {
    await compare();
    await userEvent.click(screen.getAllByRole('button', { name: /Pick player/ })[0]);
    for (const p of samplePlayers.filter((q) => q.in_pool)) {
      expect(screen.getByText(p.name)).toBeInTheDocument();
      expect(screen.getByText(`${p.club} · ${p.league_name}`)).toBeInTheDocument();
    }
    expect(screen.getAllByText('Price')).toHaveLength(3);
    expect(screen.getByText('€150k')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /^Tier [ABC]$/ })).toHaveLength(3);
    const model = screen.getByText('Ivan Uzorak').closest('section') as HTMLElement;
    const goals = screen.getByText('Jakub Příklad').closest('section') as HTMLElement;
    expect(within(model).getByText('Model’s pick')).toBeInTheDocument();
    expect(within(goals).getByText('Most goals')).toBeInTheDocument();
    expect(screen.getAllByText('Your pick')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Pick player/ })).toBeNull();
  });

  it('words the verdict as agreement when the scout picks the model top', async () => {
    await compare();
    const modelAt = (trioOrder()?.order ?? []).findIndex((p) => p.id === 'sample-a');
    await userEvent.click(screen.getAllByRole('button', { name: /Pick player/ })[modelAt]);
    expect(screen.getByText(/You and the model agree/)).toBeInTheDocument();
    expect(screen.getByText(/Chosen on what he does/)).toBeInTheDocument();
  });

  it('words the verdict as a disagreement when the scout picks another player', async () => {
    await compare();
    const modelAt = (trioOrder()?.order ?? []).findIndex((p) => p.id === 'sample-a');
    await userEvent.click(screen.getAllByRole('button', { name: /Pick player/ })[modelAt === 0 ? 1 : 0]);
    expect(screen.getByText(/You picked [ABC]\. The model picks [ABC]\./)).toBeInTheDocument();
    expect(screen.queryByText(/You and the model agree/)).toBeNull();
  });

  it('remembers both picks in the store', async () => {
    await compare();
    await userEvent.click(screen.getAllByRole('button', { name: /Pick player/ })[2]);
    const order = trioOrder()?.order ?? [];
    expect(getState().blindPicks).toEqual([{ scoutId: order[2]?.id, modelId: 'sample-a', shown: order.map((p) => p.id) }]);
    expect(getState().modelPickId).toBe('sample-a');
    expect(getState().blindStep).toBe('revealed');
  });

  it('See why opens the model pick with origin blind', async () => {
    const router = await compare();
    await userEvent.click(screen.getAllByRole('button', { name: /Pick player/ })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'See why →' }));
    expect(router.state.location.pathname).toBe('/player/sample-a');
    expect(getState().origin).toBe('blind');
  });

  it('Change returns to the brief and clears the model pick', async () => {
    await compare();
    await userEvent.click(screen.getAllByRole('button', { name: /Pick player/ })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(getState().blindStep).toBe('brief');
    expect(getState().modelPickId).toBeNull();
    expect(await screen.findByRole('heading', { name: 'What are you looking for?' })).toBeInTheDocument();
  });

  it('goes back to the covered comparison when a changed budget gives another trio', async () => {
    const strong = { ...samplePlayers[0], id: 'x0', name: 'Xavi Nou', value_eur: 800_000, score: 0.99, goals: 50 };
    stubFetch([...samplePlayers, strong]);
    await compare();
    const cAt = (trioOrder()?.order ?? []).findIndex((p) => p.id === 'sample-c');
    await userEvent.click(screen.getAllByRole('button', { name: /Pick player/ })[cAt]);
    expect(screen.getByText('Andrei Exemplu')).toBeInTheDocument();
    act(() => setBudget(1_000_000));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Pick player/ })).toHaveLength(3));
    expect(screen.queryByText('Andrei Exemplu')).toBeNull();
    expect(screen.queryByText('Xavi Nou')).toBeNull();
    expect(screen.queryByText('Your pick')).toBeNull();
  });

  it('R picks the middle dossier once and then does nothing', async () => {
    await compare();
    fireEvent.keyDown(document.body, { key: 'r' });
    const order = trioOrder()?.order ?? [];
    expect(getState().blindPicks).toEqual([{ scoutId: order[1]?.id, modelId: 'sample-a', shown: order.map((p) => p.id) }]);
    fireEvent.keyDown(document.body, { key: 'R' });
    expect(getState().blindPicks).toHaveLength(1);
  });

  it('shows the brief when fewer than three players match', async () => {
    stubFetch(samplePlayers.slice(0, 2));
    setBlindStep('compare');
    renderBlind();
    await waitFor(() => expect(getState().blindStep).toBe('brief'));
    expect(screen.getByRole('heading', { name: 'What are you looking for?' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /No names/ })).toBeNull();
  });
});
