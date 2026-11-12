import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../src/lib/data';
import { projectionOf, threeYearsLater } from '../src/lib/projection';
import { reset, setDetails } from '../src/lib/store';
import type { EvidenceFile, Player } from '../src/lib/types';
import { PlayerCard } from '../src/screens/PlayerCard/PlayerCard';

const SAMPLES = resolve(__dirname, '../../contract/samples');
const sample = (name: string): unknown => JSON.parse(readFileSync(resolve(SAMPLES, `${name}.json`), 'utf8'));
const players = sample('players') as Player[];
const evidence = sample('evidence') as EvidenceFile;
const a = players[0] as Player;

function stubFetch(list: Player[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      return new Response(JSON.stringify(name === 'players' ? list : sample(name)), { status: 200 });
    }),
  );
}

function renderCard(id: string) {
  render(
    <DataProvider>
      <MemoryRouter initialEntries={[`/player/${id}`]}>
        <Routes>
          <Route path="/player/:id" element={<PlayerCard />} />
        </Routes>
      </MemoryRouter>
    </DataProvider>,
  );
}

beforeEach(() => {
  reset();
  stubFetch(players);
});
afterEach(() => vi.unstubAllGlobals());

describe('projection arithmetic', () => {
  const ev = {
    tiers: { A: { share: 'x', hits: 1, n: 8, rate: 0.1, multiple_p25: 1.5, multiple_p50: 3, multiple_p75: 7, no_later_value: 1 } },
  } as unknown as EvidenceFile;
  const p = { ...a, value_eur: 200_000, tier: 'A', in_pool: true } as Player;

  it('multiplies today\'s value by the three multiples', () => {
    const r = projectionOf(p, ev);
    expect(r?.low).toBeCloseTo(300_000, 6);
    expect(r?.typical).toBeCloseTo(600_000, 6);
    expect(r?.high).toBeCloseTo(1_400_000, 6);
  });

  it('gives the share with no later value as a fraction of the tier', () => {
    expect(projectionOf(p, ev)?.noLaterValue).toBe(0.125);
  });

  it('returns nothing without a tier, outside the pool, at zero value or without a tier entry', () => {
    expect(projectionOf({ ...p, tier: null }, ev)).toBeNull();
    expect(projectionOf({ ...p, in_pool: false }, ev)).toBeNull();
    expect(projectionOf({ ...p, value_eur: 0 }, ev)).toBeNull();
    expect(projectionOf({ ...p, tier: 'B' }, ev)).toBeNull();
  });

  it('moves a date three years on', () => {
    expect(threeYearsLater('2026-07-06')).toBe('2029-07-06');
    expect(threeYearsLater('2024-02-29')).toBe('2027-02-28');
  });
});

describe('projection panel', () => {
  it('shows the range and the typical outcome from the fixture', async () => {
    renderCard('sample-a');
    expect(await screen.findByText('Where he could be in three years')).toBeInTheDocument();
    const t = evidence.tiers.A;
    expect(t.multiple_p25).toBe(1.33);
    expect(screen.getByText('€199.5k – €1.1M')).toBeInTheDocument();
    expect(screen.getByText('€450k')).toBeInTheDocument();
  });

  it('draws the chart with the fan', async () => {
    renderCard('sample-a');
    await screen.findByText('Where he could be in three years');
    const chart = screen.getByRole('img', { name: /range in which half of similar past players who still had a market value ended/ });
    expect(chart.querySelector('.fan')).not.toBeNull();
    expect(chart.querySelector('.mid')).not.toBeNull();
    expect(chart.querySelector('.line')).not.toBeNull();
  });

  it('keeps the figures and shows the short-history line with fewer than two points', async () => {
    renderCard('sample-b');
    await screen.findByText('Where he could be in three years');
    expect(screen.getByText('€450k – €1.9M')).toBeInTheDocument();
    expect(screen.getByText('Too little value history for a chart.')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /range in which half/ })).toBeNull();
  });

  it('shows the detail text with its share only with details on', async () => {
    renderCard('sample-a');
    await screen.findByText('Where he could be in three years');
    expect(screen.queryByText(/past outcomes of similar players/)).toBeNull();
    setDetails(true);
    const text = await screen.findByText(/past outcomes of similar players, not a forecast/);
    expect(text.textContent).toContain('Separately, 12% had no market value three years later');
    expect(text.textContent).toContain('among those with a market value three years later');
  });

  it('holds none of the words forecast, prediction or predict with details off', async () => {
    renderCard('sample-a');
    await screen.findByText('Where he could be in three years');
    expect(document.body.innerHTML).not.toMatch(/forecast|prediction|predict/i);
  });

  it('draws no projection for a player outside the pool, but keeps the header', async () => {
    stubFetch([{ ...a, id: 'out', in_pool: false, tier: null } as Player]);
    renderCard('out');
    expect(await screen.findByRole('heading', { name: a.name })).toBeInTheDocument();
    expect(screen.queryByText('Where he could be in three years')).toBeNull();
  });
});
