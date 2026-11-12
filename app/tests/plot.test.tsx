import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../src/lib/data';
import { logPosition, outlookPosition, priceDomain, priceTicks } from '../src/lib/scales';
import { reset, setBudget } from '../src/lib/store';
import { plot as t } from '../src/lib/text.en';
import type { Player, Tier } from '../src/lib/types';
import { Radar } from '../src/screens/Radar/Radar';

const sample = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(__dirname, `../../contract/samples/${name}.json`), 'utf8'));
const base = (sample('players') as Player[])[0] as Player;

const make = (id: string, tier: Tier, value_eur: number, score_rank_pct: number | null, extra: Partial<Player> = {}): Player => ({
  ...base,
  id,
  name: `Name ${id}`,
  league_id: 'KR1',
  in_pool: true,
  tier,
  value_eur,
  score_rank_pct,
  ...extra,
});

const FIXTURE: Player[] = [
  make('a1', 'A', 150_000, 96),
  make('a2', 'A', 400_000, 92),
  make('b1', 'B', 300_000, 60),
  make('c1', 'C', 800_000, 40),
  make('z0', 'B', 0, 50),
  make('n1', 'B', 200_000, null),
  make('x1', 'A', 100_000, 99, { in_pool: false }),
];
let current: Player[] = FIXTURE;

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}
function renderRadar() {
  render(
    <DataProvider>
      <MemoryRouter initialEntries={['/radar']}>
        <Routes>
          <Route path="/radar" element={<Radar />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </DataProvider>,
  );
}
const dots = async () => (await screen.findAllByRole('button', { name: /, (€|Tier)/ })).filter((e) => e.classList.contains('dot'));

beforeEach(() => {
  reset();
  setBudget(500_000);
  current = FIXTURE;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      return new Response(JSON.stringify(name === 'players' ? current : sample(name)), { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('scales', () => {
  it('maps the lowest price, the budget and 1,000,000 EUR on a log axis', () => {
    const { min, max } = priceDomain([130_000, 400_000]);
    expect(min).toBe(100_000);
    expect(max).toBe(1_000_000);
    expect(logPosition(100_000, min, max)).toBe(0);
    expect(logPosition(1_000_000, min, max)).toBe(1);
    expect(logPosition(500_000, min, max)).toBeCloseTo(Math.log10(5), 10);
    expect(logPosition(5_000_000, min, max)).toBe(1);
  });

  it('rounds the lowest price down to a 1-2-5 step', () => {
    expect(priceDomain([74_000, 90_000]).min).toBe(50_000);
    expect(priceDomain([21_000]).min).toBe(20_000);
  });

  it('puts ticks at 1-2-5 steps with short labels', () => {
    const ticks = priceTicks(50_000, 1_000_000);
    expect(ticks.map((k) => k.value)).toEqual([50_000, 100_000, 200_000, 500_000, 1_000_000]);
    expect(ticks.map((k) => k.label)).toEqual(['€50k', '€100k', '€200k', '€500k', '€1M']);
  });

  it('maps the outlook from 0 to 100, higher is better', () => {
    expect(outlookPosition(0)).toBe(0);
    expect(outlookPosition(100)).toBe(1);
    expect(outlookPosition(75)).toBeGreaterThan(outlookPosition(25));
  });
});

describe('value and outlook plot', () => {
  it('draws one dot per filtered player, including those above the budget', async () => {
    renderRadar();
    const found = await dots();
    expect(found).toHaveLength(4);
    const over = found.filter((d) => d.getAttribute('data-over') === 'true');
    expect(over.map((d) => d.getAttribute('aria-label'))).toEqual(['Name c1, €800k, Tier C']);
    expect(over[0]?.classList.contains('dot-over')).toBe(true);
  });

  it('makes tier A dots larger and names the tier', async () => {
    renderRadar();
    const found = await dots();
    const a = found.find((d) => d.getAttribute('aria-label') === 'Name a1, €150k, Tier A');
    const b = found.find((d) => d.getAttribute('aria-label') === 'Name b1, €300k, Tier B');
    expect(Number(a?.getAttribute('r'))).toBeGreaterThan(Number(b?.getAttribute('r')));
    expect(a?.getAttribute('data-tip')).toBe('Name a1, €150k, Tier A');
  });

  it('labels the budget line and the tier A line directly', async () => {
    renderRadar();
    await dots();
    expect(within(screen.getByTestId('plot-budget-line')).getByText('Your budget ≤ €500k')).toBeTruthy();
    expect(within(screen.getByTestId('plot-tier-line')).getByText('Tier A')).toBeTruthy();
  });

  it('opens the card with Enter on a dot', async () => {
    renderRadar();
    const a = (await dots()).find((d) => d.getAttribute('aria-label')?.startsWith('Name a2'));
    a?.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/player/a2'));
  });

  it('replaces the names with "Hidden" when names are hidden', async () => {
    renderRadar();
    await dots();
    await userEvent.click(screen.getByRole('checkbox', { name: /Hide names/ }));
    const found = await dots();
    expect(found.map((d) => d.getAttribute('aria-label'))).toContain('Hidden, €150k, Tier A');
    for (const d of found) {
      expect(d.getAttribute('aria-label')).not.toMatch(/Name /);
      expect(d.getAttribute('data-tip')).not.toMatch(/Name /);
    }
  });

  it('states how many players and how many tier A in the text alternative', async () => {
    renderRadar();
    await dots();
    const alt = screen.getByRole('group', { name: /Scatter of price/ });
    expect(alt.getAttribute('aria-label')).toBe(t.alt(4, 2, 2));
    expect(alt.getAttribute('aria-label')).toContain('4 players');
    expect(alt.getAttribute('aria-label')).toContain('2 in tier A');
    expect(alt.getAttribute('aria-label')).toContain('2 left out');
  });

  it('shows one line of text with fewer than two players', async () => {
    current = [make('a1', 'A', 150_000, 96), make('b1', 'B', 300_000, null)];
    renderRadar();
    expect(await screen.findByText(t.tooFew)).toBeTruthy();
    expect(screen.queryByRole('group', { name: /Scatter of price/ })).toBeNull();
  });
});
