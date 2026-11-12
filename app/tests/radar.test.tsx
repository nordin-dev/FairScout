import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../src/lib/data';
import {
  REGIONAL_LEAGUES,
  applyFilters,
  availabilityCounts,
  defaultFilters,
  leagueCounts,
  sortRows,
  titleCounts,
} from '../src/lib/radar';
import { addBlindPick, getState, reset, setBudget } from '../src/lib/store';
import { radar as t } from '../src/lib/text.en';
import type { Player, Tier } from '../src/lib/types';
import { Radar } from '../src/screens/Radar/Radar';

const sample = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(__dirname, `../../contract/samples/${name}.json`), 'utf8'));
const base = (sample('players') as Player[])[0] as Player;

type Spec = Partial<Omit<Player, 'flags' | 'pct'>> & { flags?: Partial<Player['flags']>; rating?: number; role?: number };
const make = (id: string, s: Spec = {}): Player => {
  const { flags, rating, role, ...rest } = s;
  return {
    ...base,
    id,
    name: `Name ${id}`,
    club: `Club ${id}`,
    league_id: 'KR1',
    league_name: 'Croatia',
    tier: 'B',
    value_eur: 300_000,
    in_pool: true,
    ...rest,
    pct: { ...base.pct, output: rating ?? 50, role: role ?? 50 },
    flags: { ...base.flags, under18: false, contract_ending: false, ...flags },
  };
};

const FIXTURE: Player[] = [
  make('a1', { tier: 'A', rating: 90, flags: { contract_ending: true } }),
  make('a2', { tier: 'A', rating: 90, position_group: 'Midfield', position: 'Central Midfield' }),
  make('b1', { tier: 'B', rating: 70, value_eur: 800_000 }),
  make('c1', { tier: 'C', rating: 95, flags: { under18: true }, age: 17.4 }),
  make('s1', { league_id: 'SER1', league_name: 'Serbia', tier: 'A', rating: 80, role: 33, position_group: 'Defender', position: 'Centre-Back', flags: { limited_position_data: true } }),
  make('s2', { league_id: 'SER1', league_name: 'Serbia', tier: 'B', rating: 60 }),
  make('p1', { league_id: 'PL1', league_name: 'Poland', tier: 'B', rating: 65, flags: { contract_ending: true } }),
  make('g1', { league_id: 'GB1', league_name: 'England', tier: 'A', rating: 99 }),
  make('x1', { in_pool: false, tier: 'A', rating: 99 }),
];

let current: Player[] = FIXTURE;
function stubFetch(over: Record<string, () => Response> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      if (over[name]) return over[name]();
      const body = name === 'players' ? current : sample(name);
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

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
const heading = () => screen.findByRole('heading', { level: 1 });
const box = (name: RegExp | string) => screen.getByRole('checkbox', { name });
const rowCount = () => within(screen.getByRole('table')).getAllByRole('row').length - 1;

beforeEach(() => {
  reset();
  current = FIXTURE;
  stubFetch();
});
afterEach(() => vi.unstubAllGlobals());

describe('radar logic', () => {
  it('starts with the five regional leagues, 18+ off and the shared budget', () => {
    const f = defaultFilters(500_000);
    expect(f.leagues).toEqual(['KR1', 'SER1', 'PL1', 'TS1', 'RO1']);
    expect(f.leagues).toEqual(REGIONAL_LEAGUES);
    expect(f).toMatchObject({ budget: 500_000, adultOnly: false, others: false, position: 'all', contractEnding: false });
    const rows = applyFilters(FIXTURE, f);
    expect(rows.map((p) => p.id).sort()).toEqual(['a1', 'a2', 'c1', 'p1', 's1', 's2']);
    expect(rows.find((p) => p.id === 'c1')?.flags.under18).toBe(true);
  });

  it('narrows the list with each filter', () => {
    const f = defaultFilters(500_000);
    const ids = (x: Partial<typeof f>, picks: string[] = []) =>
      applyFilters(FIXTURE, { ...f, ...x }, new Set(picks)).map((p) => p.id).sort();
    expect(ids({ budget: 1_000_000 })).toContain('b1');
    expect(ids({ position: 'Midfield' })).toEqual(['a2']);
    expect(ids({ leagues: ['PL1'] })).toEqual(['p1']);
    expect(ids({ others: true })).toContain('g1');
    expect(ids({ contractEnding: true })).toEqual(['a1', 'p1']);
    expect(ids({ adultOnly: true })).not.toContain('c1');
    expect(ids({ mine: true }, ['s2', 'a1', 'g1'])).toEqual(['a1', 's2']);
  });

  it('counts the players each league would add under the other filters', () => {
    const f = { ...defaultFilters(500_000), leagues: ['PL1'], position: 'Attack' as const };
    const c = leagueCounts(FIXTURE, f);
    expect(c.byLeague).toEqual({ KR1: 2, SER1: 1, PL1: 1 });
    expect(c.others).toBe(1);
    expect(availabilityCounts(FIXTURE, defaultFilters(500_000))).toEqual({ contract: 2, adult: 5 });
  });

  it('sorts by tier, then rating, then id', () => {
    const order = sortRows(applyFilters(FIXTURE, { ...defaultFilters(1_000_000), others: true })).map((p) => p.id);
    expect(order).toEqual(['g1', 'a1', 'a2', 's1', 'b1', 'p1', 's2', 'c1']);
    expect(titleCounts(sortRows(FIXTURE.filter((p) => p.in_pool)))).toEqual({ total: 8, tierA: 4 });
  });

  it('filters and sorts 2,000 players in under 100 ms (median of five)', () => {
    const tiers: Tier[] = ['A', 'B', 'C'];
    const ids = [...REGIONAL_LEAGUES, 'GB1', 'ES1'];
    const many = Array.from({ length: 2000 }, (_, i) =>
      make(`m${i}`, {
        tier: tiers[i % 3] ?? 'C',
        rating: (i * 7) % 100,
        league_id: ids[i % ids.length] ?? 'KR1',
        value_eur: 100_000 + (i % 9) * 100_000,
        flags: { contract_ending: i % 5 === 0 },
      }),
    );
    const f = { ...defaultFilters(1_000_000), others: true };
    const times = Array.from({ length: 5 }, () => {
      const t0 = performance.now();
      sortRows(applyFilters(many, f));
      leagueCounts(many, f);
      return performance.now() - t0;
    }).sort((a, b) => a - b);
    expect(times[2]).toBeLessThan(100);
  });
});

describe('radar screen', () => {
  it('gives the title counts and changes them with the filters', async () => {
    renderRadar();
    expect(await heading()).toHaveTextContent('6 young players fit your budget. Three are tier A.');
    expect(screen.getByText(/Five regional leagues, season 2025\/26, born 2004 or later\./)).toBeInTheDocument();
    await userEvent.click(box(/Aged 18 or older/));
    expect(await heading()).toHaveTextContent('5 young players fit your budget. Three are tier A.');
    expect(screen.getByText(/aged 18 to 21/)).toBeInTheDocument();
    await userEvent.click(box(/Contract ends by/));
    expect(await heading()).toHaveTextContent('2 young players fit your budget. One is tier A.');
    await userEvent.click(box(/Poland/));
    expect(await heading()).toHaveTextContent('1 young player fits your budget. One is tier A.');
    await userEvent.click(box(/Croatia/));
    expect(screen.queryByRole('heading', { level: 1, name: /young player/ })).toBeNull();
  });

  it('shows a defender his role percentile in the rating column, not the output one', async () => {
    renderRadar();
    await heading();
    const row = screen.getByText('Name s1').closest('tr') as HTMLElement;
    expect(within(row).getByRole('meter')).toHaveAttribute('aria-valuenow', '33');
  });

  it('shows the defaults in the rail, with a count per league', async () => {
    renderRadar();
    await heading();
    expect(box(/Croatia/)).toBeChecked();
    expect(box(/Croatia/)).toHaveTextContent('3');
    expect(box(/Serbia/)).toBeChecked();
    expect(box(/Czech Republic/)).toBeChecked();
    expect(box(/Aged 18 or older/)).not.toBeChecked();
    expect(box(/more leagues/)).not.toBeChecked();
    expect(screen.getByRole('slider')).toHaveValue('1');
    expect(screen.getByText('≤ €500k')).toBeInTheDocument();
    expect(rowCount()).toBe(6);
    expect(screen.getByText('Under 18')).toBeInTheDocument();
  });

  it('binds the slider to the shared budget and lists the position filter', async () => {
    renderRadar();
    await heading();
    setBudget(1_000_000);
    await waitFor(() => expect(rowCount()).toBe(7));
    await userEvent.click(screen.getByRole('button', { name: 'Midfield' }));
    expect(rowCount()).toBe(1);
  });

  it('keeps only blind picks when asked', async () => {
    addBlindPick({ scoutId: 's2', modelId: 'a1' });
    renderRadar();
    await heading();
    expect(box(/My blind picks/)).toHaveTextContent('1');
    await userEvent.click(box(/My blind picks/));
    expect(rowCount()).toBe(1);
    expect(screen.getByText('Name s2')).toBeInTheDocument();
  });

  it('has column headers and rows in order', async () => {
    renderRadar();
    await heading();
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['#', 'Player', 'Pos', 'Age', 'Price', 'Min', 'Rating', 'Outlook', 'Notes']);
    const first = within(screen.getByRole('table')).getAllByRole('row')[1] as HTMLElement;
    expect(first).toHaveTextContent('Name a1');
    expect(first).toHaveTextContent('Club a1 · Croatia');
  });

  it('opens the card on Enter and on click, and sets the origin', async () => {
    renderRadar();
    await heading();
    const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;
    rowOf('Name a1').focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('where')).toHaveTextContent('/player/a1');
    expect(getState().origin).toBe('radar');
  });

  it('opens the card on a click', async () => {
    renderRadar();
    await heading();
    await userEvent.click(screen.getByText('Name s1'));
    expect(screen.getByTestId('where')).toHaveTextContent('/player/s1');
    expect(getState().origin).toBe('radar');
  });

  it('hides name and club with black bars but keeps the league', async () => {
    renderRadar();
    await heading();
    await userEvent.click(box(/Hide names/));
    expect(screen.queryByText('Name a1')).toBeNull();
    expect(screen.queryByText(/Club a1/)).toBeNull();
    expect(within(screen.getByRole('table')).getAllByRole('img', { name: /hidden/i }).length).toBeGreaterThanOrEqual(12);
    expect(screen.getAllByText(/Croatia/).length).toBeGreaterThan(1);
  });

  it('shows the first 20 with a caption and Show all', async () => {
    current = Array.from({ length: 25 }, (_, i) => make(`q${i}`, { rating: i }));
    renderRadar();
    await heading();
    expect(rowCount()).toBe(20);
    expect(screen.getByText('Showing 20 of 25.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(rowCount()).toBe(25);
    expect(screen.getByText('25 players.')).toBeInTheDocument();
  });

  it('says so when nothing matches, and Reset keeps the budget', async () => {
    renderRadar();
    await heading();
    await userEvent.click(screen.getByRole('button', { name: 'GK' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.emptyTitle);
    expect(screen.getByText('02 — Radar')).toBeInTheDocument();
    expect(box(/Croatia/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(await heading()).toHaveTextContent('6 young players');
    expect(getState().budget).toBe(500_000);
  });

  it('draws loading and error states itself', async () => {
    stubFetch({ players: () => new Response('x', { status: 500 }) });
    renderRadar();
    expect(screen.getByText('Loading players…')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('The list of players did not arrive.');
    expect(screen.getByText('players.json')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
