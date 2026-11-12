import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frameRoutes } from '../src/App';
import { DetailBlock } from '../src/components/DetailBlock';
import { money } from '../src/lib/format';
import { decideKey, registerReveal } from '../src/lib/keys';
import { getState, reset, setBudget, setDefaultBudget, setModelPick, setOrigin } from '../src/lib/store';

const sample = (name: string) =>
  JSON.parse(readFileSync(resolve(__dirname, `../../contract/samples/${name}.json`), 'utf8')) as Record<string, unknown>;

beforeEach(() => {
  reset();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => new Response(JSON.stringify(sample(/data\/(\w+)\.json$/.exec(url)?.[1] ?? '')), { status: 200 })),
  );
});
afterEach(() => vi.unstubAllGlobals());

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: frameRoutes[0].element,
        children: [
          { path: 'player/:id', element: <p>card</p> },
          { path: 'radar', element: <p>radar</p> },
          { path: 'blind', element: <DetailBlock>method</DetailBlock> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const st = (origin: 'blind' | 'radar' = 'blind', modelPickId: string | null = null) => ({ origin, modelPickId });
const to = (path: string, key: string, s = st()) => decideKey(path, key, s);

describe('budget', () => {
  it('takes its default from the meta sample and shows it in the top bar', async () => {
    const meta = sample('meta') as { default_brief: { budget_eur: number } };
    renderAt('/blind');
    expect(await screen.findByText('Budget ≤ €500k')).toBeInTheDocument();
    await waitFor(() => expect(getState().budget).toBe(meta.default_brief.budget_eur));
  });

  it('falls back to the default for a value off the range or the step', () => {
    setDefaultBudget(1_000_000);
    setBudget(250_000);
    setBudget(777);
    expect(getState().budget).toBe(1_000_000);
    setBudget(350_000);
    expect(getState().budget).toBe(350_000);
    setBudget(1_050_000);
    expect(getState().budget).toBe(1_000_000);
  });

  it('survives a route change', async () => {
    const router = renderAt('/blind');
    await screen.findByText('Budget ≤ €500k');
    act(() => setBudget(250_000));
    await act(() => router.navigate('/radar'));
    expect(screen.getByText('Budget ≤ €250k')).toBeInTheDocument();
  });
});

describe('details', () => {
  it('toggles on click and on D, and DetailBlock follows', async () => {
    renderAt('/blind');
    const sw = await screen.findByRole('button', { name: /Details/ });
    expect(sw).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('method')).not.toBeInTheDocument();
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('method')).toBeInTheDocument();
    await userEvent.keyboard('d');
    expect(sw).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('method')).not.toBeInTheDocument();
  });
});

describe('keys', () => {
  it('opens the four sections with 1 to 4', () => {
    expect(['1', '2', '3', '4'].map((k) => to('/evidence', k))).toEqual([
      { type: 'go', to: '/blind' },
      { type: 'go', to: '/radar' },
      { type: 'go', to: '/time-machine' },
      { type: 'go', to: '/evidence' },
    ]);
  });

  it('follows the demo order with the arrows, with and without a revealed model pick', () => {
    expect(to('/blind', 'ArrowRight')).toEqual({ type: 'go', to: '/radar' });
    expect(to('/blind', 'ArrowRight', st('blind', 'p9'))).toEqual({ type: 'go', to: '/player/p9' });
    expect(to('/player/p9', 'ArrowRight')).toEqual({ type: 'go', to: '/radar' });
    expect(to('/radar', 'ArrowRight')).toEqual({ type: 'go', to: '/time-machine' });
    expect(to('/time-machine', 'ArrowRight')).toEqual({ type: 'go', to: '/evidence' });
    expect(to('/evidence', 'ArrowRight')).toBeNull();
    expect(to('/radar', 'ArrowLeft')).toEqual({ type: 'go', to: '/blind' });
    expect(to('/time-machine', 'ArrowLeft')).toEqual({ type: 'go', to: '/radar' });
    expect(to('/evidence', 'ArrowLeft')).toEqual({ type: 'go', to: '/time-machine' });
  });

  it('returns from a player card to its origin with the left arrow', async () => {
    expect(to('/player/p9', 'ArrowLeft', st('radar'))).toEqual({ type: 'go', to: '/radar' });
    expect(to('/player/p9', 'ArrowLeft', st('blind'))).toEqual({ type: 'go', to: '/blind' });
    setOrigin('radar');
    setModelPick('p9');
    const router = renderAt('/player/p9');
    await screen.findByText('card');
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/radar'));
  });

  it('calls the registered reveal on R and does nothing without one', async () => {
    renderAt('/blind');
    await screen.findByRole('button', { name: /Details/ });
    await userEvent.keyboard('r');
    const fn = vi.fn();
    const off = registerReveal(fn);
    await userEvent.keyboard('r');
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    await userEvent.keyboard('r');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ignores keys pressed with Ctrl, Alt or Cmd', async () => {
    expect(decideKey('/blind', '2', st(), { ctrlKey: true })).toBeNull();
    expect(decideKey('/blind', 'd', st(), { altKey: true })).toBeNull();
    expect(decideKey('/blind', 'r', st(), { metaKey: true })).toBeNull();
    renderAt('/blind');
    await screen.findByRole('button', { name: /Details/ });
    await userEvent.keyboard('{Control>}d{/Control}');
    expect(getState().details).toBe(false);
  });
});

describe('money', () => {
  it('formats the offered budgets and other values', () => {
    expect([250_000, 500_000, 1_000_000, 1_100_000, 40_000_000].map(money)).toEqual(['€250k', '€500k', '€1M', '€1.1M', '€40M']);
  });
});
