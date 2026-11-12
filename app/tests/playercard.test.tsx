import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../src/lib/data';
import { adjustedOutput, adjustmentPercent, displayReconciles, leagueAdjustment, signedPercent } from '../src/lib/rating';
import { activeSection } from '../src/lib/sections';
import { ratingOf } from '../src/lib/rating';
import { reset, setDetails, setOrigin } from '../src/lib/store';
import type { Player } from '../src/lib/types';
import { PlayerCard } from '../src/screens/PlayerCard/PlayerCard';

const SAMPLES = resolve(__dirname, '../../contract/samples');
const sample = (name: string): unknown => JSON.parse(readFileSync(resolve(SAMPLES, `${name}.json`), 'utf8'));
const players = sample('players') as Player[];

function stubFetch(over: { players?: () => Promise<Response> } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      if (name === 'players' && over.players) return over.players();
      return new Response(JSON.stringify(sample(name)), { status: 200 });
    }),
  );
}

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function renderCard(id: string) {
  render(
    <DataProvider>
      <MemoryRouter initialEntries={[`/player/${id}`]}>
        <Routes>
          <Route path="/player/:id" element={<PlayerCard />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </DataProvider>,
  );
}

const withPlayers = (list: Player[]) => () => Promise.resolve(new Response(JSON.stringify(list), { status: 200 }));

beforeEach(() => {
  reset();
  stubFetch();
});
afterEach(() => vi.unstubAllGlobals());

describe('step arithmetic', () => {
  it('turns a factor above 1 into a minus and a factor below 1 into a plus', () => {
    expect(adjustmentPercent(1.36)).toBe(-26);
    expect(signedPercent(adjustmentPercent(1.36))).toBe('−26%');
    expect(leagueAdjustment(0.8)).toBeCloseTo(0.25, 10);
    expect(signedPercent(adjustmentPercent(0.8))).toBe('+25%');
    expect(adjustedOutput(0.53, 1.36)).toBeCloseTo(0.53 / 1.36, 12);
  });

  it('reconciles for every sample player, unrounded and as displayed', () => {
    expect(players.length).toBeGreaterThan(0);
    for (const p of players) {
      expect(p.ga90 * (1 + leagueAdjustment(p.league_factor))).toBeCloseTo(p.ga90 / p.league_factor, 10);
      expect(Math.abs(adjustedOutput(p.ga90, p.league_factor) - p.ga90_adj)).toBeLessThanOrEqual(0.01);
      expect(displayReconciles(p.ga90, p.league_factor, p.ga90_adj)).toBe(true);
    }
  });
});

describe('player card', () => {
  it('shows the header line, the tiles and the four steps', async () => {
    renderCard('sample-a');
    expect(await screen.findByRole('heading', { name: 'Ivan Uzorak' })).toBeInTheDocument();
    expect(screen.getByText('Right Winger · 20 · NK Primjer, Croatia')).toBeInTheDocument();
    expect(within(screen.getByText('Price').closest('.tile') as HTMLElement).getByText('€150k')).toBeInTheDocument();
    expect(screen.getByText('Jun 2027')).toBeInTheDocument();
    expect(screen.getByText('final year')).toBeInTheDocument();
    expect(screen.getByText('1,180')).toBeInTheDocument();
    expect(screen.getByText('39% of team')).toBeInTheDocument();
    for (const fig of ['0.53', '−26%', '0.39', '86']) expect(screen.getByText(fig)).toBeInTheDocument();
    expect(screen.getByText('01 What he did').closest('.step')).toHaveAttribute('data-tip', '4 goals and 3 assists in 1,180 minutes');
    expect(screen.getByText('02 His league').closest('.step')?.getAttribute('data-tip')).toContain('League factor 1.36');
  });

  it('shows a dash and "not known" for a missing contract, not a zero', async () => {
    renderCard('sample-c');
    await screen.findByRole('heading', { name: 'Andrei Exemplu' });
    const tile = screen.getByText('Contract').closest('.tile') as HTMLElement;
    expect(within(tile).getByText('—')).toBeInTheDocument();
    expect(within(tile).getByText('not known')).toBeInTheDocument();
  });

  it('gives a defender two steps and the flag, and no goals step', async () => {
    const defender = { ...players[0], id: 'def', position_group: 'Defender', position: 'Centre-Back', role: 0.8, pct: { ...players[0].pct, role: 77 }, flags: { ...players[0].flags, limited_position_data: true } } as Player;
    stubFetch({ players: withPlayers([defender]) });
    renderCard('def');
    expect(await screen.findByText('01 How much he plays')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('77')).toBeInTheDocument();
    expect(screen.getAllByText('Limited data')[0]).toHaveAttribute('data-tip', expect.stringContaining('role and team context'));
    expect(screen.getAllByText('Limited data')[0]).toHaveAttribute('tabindex', '0');
    expect(screen.queryByText('01 What he did')).toBeNull();
    expect(document.querySelectorAll('.arrow')).toHaveLength(1);
  });

  it('shows the two meters only with details on', async () => {
    renderCard('sample-a');
    await screen.findByRole('heading', { name: 'Ivan Uzorak' });
    expect(screen.queryAllByRole('meter')).toHaveLength(0);
    setDetails(true);
    const meters = await screen.findAllByRole('meter');
    expect(meters.map((m) => m.getAttribute('aria-label'))).toEqual([
      'Share of his team’s goals: 31%',
      'Playing time: 39% of team minutes',
    ]);
    expect(screen.getByText(/league factor for Croatia is 1\.36, an estimate/)).toBeInTheDocument();
  });

  it('shows the not-found block with a button to the radar for an unknown id', async () => {
    renderCard('nobody');
    expect(await screen.findByText('This player is not in the data.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open the radar →' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/radar');
  });

  it('shows its own loading layout while the data is pending', () => {
    stubFetch({ players: () => new Promise<Response>(() => undefined) });
    renderCard('sample-a');
    expect(screen.getByText('Loading player…')).toBeInTheDocument();
    expect(screen.getByText('04 Rating')).toBeInTheDocument();
  });

  it('shows the error block with the file name and retries', async () => {
    stubFetch({ players: () => Promise.resolve(new Response('', { status: 500 })) });
    renderCard('sample-a');
    expect(await screen.findByRole('alert')).toHaveTextContent('players.json');
    expect(screen.getByRole('link', { name: '← Back to blind pick' })).toBeInTheDocument();
    stubFetch();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ivan Uzorak' })).toBeInTheDocument());
  });

  it('points the back link at the section the card was opened from', async () => {
    setOrigin('radar');
    renderCard('sample-a');
    const link = await screen.findByRole('link', { name: '← Back to radar' });
    expect(link).toHaveAttribute('href', '/radar');
  });
});

describe('active section', () => {
  it('follows the origin on a player card and the path elsewhere', () => {
    const sections = ['/blind', '/radar', '/time-machine', '/evidence'];
    expect(activeSection('/player/x', 'radar', sections)).toBe('/radar');
    expect(activeSection('/player/x', 'blind', sections)).toBe('/blind');
    expect(activeSection('/time-machine', 'radar', sections)).toBe('/time-machine');
    expect(activeSection('/nowhere', 'blind', sections)).toBeNull();
  });
});

describe('one rating', () => {
  it('gives the role percentile to limited position data and the output percentile to the rest', () => {
    const p = players[0] as Player;
    const pct = { ...p.pct, output: 84, role: 19 };
    expect(ratingOf({ pct, flags: { ...p.flags, limited_position_data: true } })).toBe(19);
    expect(ratingOf({ pct, flags: { ...p.flags, limited_position_data: false } })).toBe(84);
  });
});

describe('a card outside the pool', () => {
  it('has no similar, projection or note panel and no empty cell', async () => {
    const out = { ...players[0], id: 'out', in_pool: false, tier: null, note: null, flags: { ...players[0].flags, born_q4: true } } as Player;
    stubFetch({ players: withPlayers([out]) });
    renderCard('out');
    await screen.findByText(/Not rated/);
    expect(screen.queryByText('Similar players')).toBeNull();
    expect(screen.queryByText(/No similar player/)).toBeNull();
    expect(screen.queryByText('Where he could be in three years')).toBeNull();
    expect(document.querySelector('.say')).toBeNull();
    for (const cell of document.querySelectorAll('.p-row2 > *, .p-row3 > *')) expect(cell.textContent?.trim()).not.toBe('');
    expect(document.querySelectorAll('.p-row2.solo > *')).toHaveLength(1);
  });
});
