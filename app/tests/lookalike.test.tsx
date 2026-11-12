import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { register, resetAccounts, type SavedPick } from '../src/lib/account';
import { setBasketForTests } from '../src/lib/basketball/data';
import { DataProvider } from '../src/lib/data';
import { setLang } from '../src/lib/i18n';
import { lookalikes, searchRows, similarity, suggestions, type LookRow } from '../src/lib/lookalike';
import { resetSimilar } from '../src/lib/similarStore';
import { getState, reset, setSport } from '../src/lib/store';
import { setTennisForTests } from '../src/lib/tennis/data';
import { BasketSimilar } from '../src/screens/Similar/BasketSimilar';
import { FootballSimilar, timesCheaper } from '../src/screens/Similar/FootballSimilar';
import { TennisSimilar } from '../src/screens/Similar/TennisSimilar';
import { FILE as BASKET_FILE, make as basket } from './basket-radar-fixture';
import { FILE as TENNIS_FILE, make as tennis } from './tennis-radar-fixture';

const sample = (name: string): unknown => JSON.parse(readFileSync(resolve(__dirname, `../../contract/samples/${name}.json`), 'utf8'));

const row = (id: string, s: Partial<LookRow> = {}): LookRow => ({
  id,
  name: `Name ${id}`,
  line: 'Club',
  group: 'winger',
  scores: [50, 50, 50],
  compare: [50, 50, 50],
  cost: 100,
  costText: '100',
  facts: '',
  tier: 'B',
  eligible: true,
  adjust: null,
  flags: [],
  ...s,
});

describe('lookalikes', () => {
  const ref = row('ref', { cost: 1000, compare: [80, 80, 80], eligible: false });

  it('scores similarity as 100 minus the mean gap', () => {
    expect(similarity(ref, row('a', { compare: [70, 80, 60] }))).toBe(90);
    expect(similarity(ref, row('a', { compare: null }))).toBe(0);
  });

  it('offers only pool players of the same group, inside the limit and cheaper than the named player', () => {
    const rows = [
      ref,
      row('near', { compare: [78, 80, 80] }),
      row('far', { compare: [20, 20, 20] }),
      row('other-group', { group: 'striker', compare: [80, 80, 80] }),
      row('not-pool', { eligible: false, compare: [80, 80, 80] }),
      row('too-dear', { cost: 600, compare: [80, 80, 80] }),
      row('no-scores', { compare: null, scores: null }),
    ];
    expect(lookalikes(ref, rows, 500).map((m) => m.row.id)).toEqual(['near', 'far']);
    expect(lookalikes(row('cheap-ref', { cost: 100, compare: [80, 80, 80] }), rows, 500)).toEqual([]);
  });

  it('returns at most three, the most similar first, the cheaper first on a tie', () => {
    const rows = [
      row('d', { compare: [50, 50, 50] }),
      row('c', { compare: [70, 70, 70], cost: 300 }),
      row('b', { compare: [70, 70, 70], cost: 200 }),
      row('a', { compare: [79, 80, 80] }),
    ];
    expect(lookalikes(ref, rows, 500).map((m) => m.row.id)).toEqual(['a', 'b', 'c']);
  });

  it('suggests the furthest out of reach and finds names without accents', () => {
    const rows = [row('x', { cost: 5, name: 'Ermedin Demirović' }), row('y', { cost: 9, name: 'Amar Dedić' }), row('z', { compare: null, cost: 99 })];
    expect(suggestions(rows).map((r) => r.id)).toEqual(['y', 'x']);
    expect(searchRows(rows, 'demirovic').map((r) => r.id)).toEqual(['x']);
    expect(searchRows(rows, '  ')).toEqual([]);
  });

  it('writes how many times cheaper: whole from ten, one decimal below', () => {
    expect(timesCheaper(row('r', { cost: 22_000_000 }), row('m', { cost: 300_000 }))).toBe('73');
    expect(timesCheaper(row('r', { cost: 450_000 }), row('m', { cost: 300_000 }))).toBe('1.5');
  });
});

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function saved(): SavedPick[] {
  const book = JSON.parse(localStorage.getItem('fairscout.accounts') ?? '{}') as Record<string, { picks: SavedPick[] }>;
  return book['ana']?.picks ?? [];
}

function renderScreen(element: React.ReactNode) {
  render(
    <DataProvider>
      <MemoryRouter initialEntries={['/similar']}>
        <Routes>
          <Route path="/similar" element={element} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </DataProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetAccounts();
  reset();
  resetSimilar();
  setLang('en');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      return new Response(JSON.stringify(sample(name)), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  setLang('en');
});

describe('similar screen: football', () => {
  it('asks who is out of reach, then shows the similar players inside the budget', async () => {
    renderScreen(<FootballSimilar />);
    const pick = await screen.findByRole('button', { name: /Jakub Příklad/ });
    expect(screen.getByRole('heading', { level: 1, name: 'Who can you not afford?' })).toBeInTheDocument();
    await userEvent.click(pick);
    expect(screen.getByRole('heading', { level: 1, name: 'Like Jakub Příklad. Within €500k.' })).toBeInTheDocument();
    const cards = screen.getAllByRole('region', { name: /^Similar player/ });
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Similar player: Ivan Uzorak', 'Similar player: Andrei Exemplu']);
    expect(within(cards[0]).getByText('64%')).toBeInTheDocument();
    expect(within(cards[0]).getByText('€150k')).toBeInTheDocument();
    expect(within(cards[0]).getByText('3× cheaper')).toBeInTheDocument();
  });

  it('a lower budget leaves only the players inside it, and none shows the empty block', async () => {
    renderScreen(<FootballSimilar />);
    await userEvent.click(await screen.findByRole('button', { name: /Jakub Příklad/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Up to €250k' }));
    expect(screen.getAllByRole('region', { name: /^Similar player/ })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Change player' }));
    await userEvent.click(screen.getByRole('button', { name: /Marko Probni/ }));
    expect(screen.getByRole('heading', { name: 'Nobody similar is within this limit.' })).toBeInTheDocument();
  });

  it('finds a player by typing and says so when nobody has that name', async () => {
    renderScreen(<FootballSimilar />);
    const box = await screen.findByRole('searchbox', { name: 'Find a player' });
    await userEvent.type(box, 'priklad');
    expect(screen.getAllByRole('button', { name: /Příklad|Uzorak|Exemplu|Probni/ })).toHaveLength(1);
    await userEvent.clear(box);
    await userEvent.type(box, 'zzz');
    expect(screen.getByText('No player with that name.')).toBeInTheDocument();
  });

  it('adds a similar player to my picks and removes him again', async () => {
    await register('ana', 'pass');
    renderScreen(<FootballSimilar />);
    await userEvent.click(await screen.findByRole('button', { name: /Jakub Příklad/ }));
    await userEvent.click(screen.getAllByRole('button', { name: /^\+ Add to my picks/ })[0]);
    expect(saved()).toEqual([expect.objectContaining({ sport: 'football', id: 'sample-a', name: 'Ivan Uzorak', tier: 'A', from: 'similar' })]);
    await userEvent.click(screen.getByRole('button', { name: /^✓ In my picks/ }));
    expect(saved()).toEqual([]);
  });

  it('signed out, the button leads to the login; the card opens with section 01 as its origin', async () => {
    renderScreen(<FootballSimilar />);
    await userEvent.click(await screen.findByRole('button', { name: /Jakub Příklad/ }));
    expect(getState().modelPickId).toBe('sample-a');
    await userEvent.click(screen.getAllByRole('button', { name: 'Open card →' })[0]);
    expect(screen.getByTestId('where')).toHaveTextContent('/player/sample-a');
    expect(getState().origin).toBe('similar');
  });

  it('follows the chosen language', async () => {
    setLang('bs');
    renderScreen(<FootballSimilar />);
    const pick = await screen.findByRole('button', { name: /Jakub Příklad/ });
    expect(screen.getByRole('heading', { level: 1, name: 'Koga ne možeš platiti?' })).toBeInTheDocument();
    await userEvent.click(pick);
    expect(screen.getByRole('heading', { level: 1, name: 'Kao Jakub Příklad. Do €500k.' })).toBeInTheDocument();
    expect(screen.getAllByText('3× jeftiniji')).toHaveLength(1);
  });
});

describe('similar screen: tennis', () => {
  beforeEach(() => {
    setSport('tennis');
    setTennisForTests({
      ...TENNIS_FILE,
      players: [
        tennis('t1', { name: 'Top One', rank: 120, pct: { wins: 80, level: 80, rise: 80 } }),
        tennis('t2', { name: 'Near Two', rank: 400, pct: { wins: 78, level: 80, rise: 80 }, tier: 'A' }),
        tennis('t3', { name: 'Far Three', rank: 600, pct: { wins: 20, level: 20, rise: 20 } }),
        tennis('t4', { name: 'Seen Four', rank: 200, pct: { wins: 80, level: 80, rise: 80 } }),
      ],
    });
  });
  afterEach(() => setTennisForTests(null));

  it('shows the players like him ranked outside the limit, and saves one', async () => {
    await register('ana', 'pass');
    renderScreen(<TennisSimilar />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Who is everyone already watching?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Top One/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Like Top One. Outside the top 300.' })).toBeInTheDocument();
    const cards = screen.getAllByRole('region', { name: /^Similar player/ });
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Similar player: Near Two', 'Similar player: Far Three']);
    expect(within(cards[0]).getByText('No. 400')).toBeInTheDocument();
    expect(within(cards[0]).getByText('280 places lower')).toBeInTheDocument();
    await userEvent.click(within(cards[0]).getByRole('button', { name: /^\+ Add to my picks/ }));
    expect(saved()).toEqual([expect.objectContaining({ sport: 'tennis', id: 't2', name: 'Near Two', line: 'Norway', tier: 'A', from: 'similar' })]);
    await userEvent.click(screen.getByRole('button', { name: 'Outside the top 500' }));
    expect(screen.getAllByRole('region', { name: /^Similar player/ })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Open card →' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/tennis/t3');
  });
});

describe('similar screen: basketball', () => {
  beforeEach(() => {
    setSport('basketball');
    setBasketForTests({
      ...BASKET_FILE,
      players: [
        basket('b1', { name: 'Star One', mpg: 17, pct: { scoring: 70, impact: 60, trust: 100 } }),
        basket('b2', { name: 'Bench Two', mpg: 9, pct: { scoring: 68, impact: 60, trust: 30 }, tier: 'B' }),
        basket('b3', { name: 'Bench Three', mpg: 12, pct: { scoring: 30, impact: 30, trust: 50 } }),
        basket('b4', { name: 'Starter Four', mpg: 16, pct: { scoring: 70, impact: 60, trust: 90 } }),
        basket('b5', { name: 'Center Five', mpg: 5, position: 'Center', pct: { scoring: 70, impact: 60, trust: 10 } }),
      ],
    });
  });
  afterEach(() => setBasketForTests(null));

  it('shows the players of his position who do the same in fewer minutes, and saves one', async () => {
    await register('ana', 'pass');
    renderScreen(<BasketSimilar />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Who already gets the minutes?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Star One/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Like Star One. Under 15 minutes a game.' })).toBeInTheDocument();
    const cards = screen.getAllByRole('region', { name: /^Similar player/ });
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Similar player: Bench Two', 'Similar player: Bench Three']);
    expect(within(cards[0]).getByText('99%')).toBeInTheDocument();
    expect(within(cards[0]).getByText('8.0 min fewer')).toBeInTheDocument();
    await userEvent.click(within(cards[0]).getByRole('button', { name: /^\+ Add to my picks/ }));
    expect(saved()).toEqual([
      expect.objectContaining({ sport: 'basketball', id: 'b2', name: 'Bench Two', line: 'Club X · EuroLeague', tier: 'B', from: 'similar' }),
    ]);
  });
});
