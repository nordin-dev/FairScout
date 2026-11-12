import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { positionOf, scaleOf } from '../src/components/DotScale';
import { DataProvider } from '../src/lib/data';
import { reset, setDetails } from '../src/lib/store';
import type { EvidenceFile, LeaguesFile } from '../src/lib/types';
import { BirthMonths, Evidence } from '../src/screens/Evidence/Evidence';

const SAMPLES = resolve(__dirname, '../../contract/samples');
const sample = (name: string): unknown => JSON.parse(readFileSync(resolve(SAMPLES, `${name}.json`), 'utf8'));
const evidence = sample('evidence') as EvidenceFile;
const leagues = sample('leagues') as LeaguesFile;

function stub(over: { evidence?: unknown; leagues?: unknown } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      const body = name === 'evidence' ? (over.evidence ?? evidence) : name === 'leagues' ? (over.leagues ?? leagues) : sample(name);
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

async function open(details = true) {
  setDetails(details);
  render(
    <DataProvider>
      <MemoryRouter>
        <Evidence />
      </MemoryRouter>
    </DataProvider>,
  );
  await screen.findByText('Does it work? We tested it on the past.');
}

beforeEach(() => {
  reset();
  stub();
});
afterEach(() => vi.unstubAllGlobals());

describe('scale arithmetic', () => {
  it('holds the reference and every value with room on both sides', () => {
    const scale = scaleOf([0.59, 1.62], 1);
    expect(scale.min).toBeLessThan(0.59);
    expect(scale.max).toBeGreaterThan(1.62);
    const at = positionOf(1, scale);
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(100);
    expect(positionOf(0.59, scale)).toBeLessThan(at);
  });

  it('still holds the reference when every value lies on one side', () => {
    const scale = scaleOf([1.3, 1.5], 1);
    expect(scale.min).toBeLessThan(1);
    expect(positionOf(1, scale)).toBeGreaterThan(0);
  });
});

describe('the two detail blocks', () => {
  it('are absent with details off and present with details on', async () => {
    await open(false);
    expect(screen.queryByText('League difficulty')).toBeNull();
    expect(screen.queryByText('Born early, picked more')).toBeNull();
    expect(screen.queryAllByTestId('dscale-dot')).toHaveLength(0);
  });

  it('show both blocks with details on', async () => {
    await open();
    expect(await screen.findByText('League difficulty')).toBeTruthy();
    expect(screen.getByText('Born early, picked more')).toBeTruthy();
  });

  it('draw one dot per league, ordered by factor, with the reference inside the track', async () => {
    await open();
    const dots = await screen.findAllByTestId('dscale-dot');
    expect(dots).toHaveLength(leagues.leagues.length);
    expect(screen.getAllByTestId('dscale-row')).toHaveLength(leagues.leagues.length);
    const printed = screen.getAllByTestId('dscale-row').map((r) => parseFloat(r.lastElementChild!.textContent!));
    expect(printed).toEqual([...printed].sort((a, b) => a - b));
    const lefts = dots.map((d) => parseFloat(d.style.left));
    expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
    expect(screen.getAllByTestId('dscale-ref')).toHaveLength(1);
    expect(screen.getByTestId('dscale-ref').textContent).toBe('average');
  });

  it('draw estimated factors hollow and name them estimated, measured ones not', async () => {
    await open();
    const dots = await screen.findAllByTestId('dscale-dot');
    for (const l of leagues.leagues) {
      const dot = dots.find((d) => d.getAttribute('aria-label')?.startsWith(`${l.name}: ${l.factor.toFixed(2)}`))!;
      const row = dot.closest('[data-testid="dscale-row"]')!;
      expect(row.lastElementChild!.textContent).toBe(l.factor.toFixed(2));
      const estimate = l.factor_source === 'estimate';
      expect(dot.getAttribute('data-mark')).toBe(estimate ? 'hollow' : 'filled');
      expect(dot.classList.contains('est')).toBe(estimate);
      expect(dot.getAttribute('aria-label')!.includes('estimated')).toBe(estimate);
      expect(row.getAttribute('data-tip')).toBe(`${l.name}: ${l.factor.toFixed(2)} ${estimate ? '(estimate)' : '(from player moves)'}`);
    }
  });

  it('leave out a league without a factor and count it in the caption', async () => {
    const broken = { leagues: leagues.leagues.map((l, i) => (i === 0 ? { ...l, factor: 0 } : l)) };
    stub({ leagues: broken });
    await open();
    expect(await screen.findAllByTestId('dscale-dot')).toHaveLength(leagues.leagues.length - 1);
    expect(screen.queryByLabelText(new RegExp(`^${leagues.leagues[0].name}: `))).toBeNull();
    expect(screen.getByText(/1 league has no factor and is left out/)).toBeTruthy();
  });

  it('give the same-players example from the file in the caption', async () => {
    await open();
    const s = evidence.same_players_two_leagues;
    const text = (await screen.findByText(/Hollow dot/)).textContent!;
    expect(text).toContain(`${s.players} players`);
    expect(text).toContain(`${s.ga90_a.toFixed(2)} goals + assists per 90 minutes in ${s.league_a}`);
    expect(text).toContain(`${s.ga90_b.toFixed(2)} in ${s.league_b}`);
    expect(text).not.toContain('left out');
  });

  it('show one line and no dot when no league has a factor', async () => {
    stub({ leagues: { leagues: [] } });
    await open();
    expect(await screen.findByText('League difficulty')).toBeTruthy();
    expect(screen.getAllByText('The data holds no such figures.')).toHaveLength(1);
    expect(screen.queryAllByTestId('dscale-dot')).toHaveLength(0);
  });

  it('show the two quarter shares as the large figures', async () => {
    await open();
    const figures = (await screen.findAllByTestId('pair-figure')).map((f) => f.textContent);
    const q = evidence.birth_months.pct_by_quarter;
    expect(figures).toEqual([`${Math.round(q[0])}%`, `${Math.round(q[3])}%`]);
  });

  it('draw twelve columns in the order of the shares, with a text alternative listing them', async () => {
    await open();
    const cols = await screen.findAllByTestId('month-col');
    expect(cols).toHaveLength(12);
    const shares = evidence.birth_months.pct_by_month;
    const heights = cols.map((c) => parseFloat(c.style.height));
    expect(heights[0]).toBe(100);
    heights.forEach((h, i) => expect(h).toBeCloseTo((shares[i] / Math.max(...shares)) * 100, 1));
    const alt = screen.getByRole('img', { name: /Share of players by birth month/ }).getAttribute('aria-label')!;
    shares.forEach((s) => expect(alt).toContain(`${s}%`));
    expect(alt).toContain('January 11.4%');
    expect(alt).toContain('December 6.2%');
  });

  it('say the data holds no figures when the birth months are missing', () => {
    const rest = { ...evidence, birth_months: undefined } as unknown as EvidenceFile;
    render(<BirthMonths file={rest} leagues={leagues} />);
    expect(screen.getByText('Born early, picked more')).toBeTruthy();
    expect(screen.queryAllByTestId('pair-figure')).toHaveLength(0);
    expect(screen.getAllByText('The data holds no such figures.')).toHaveLength(1);
  });

  it('leave the main chart with its five rows, with details on or off', async () => {
    await open(false);
    const off = screen.getAllByRole('img').filter((e) => e.classList.contains('bar-row')).length;
    expect(off).toBe(5);
  });
});
