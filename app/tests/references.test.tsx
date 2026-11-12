import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAccounts } from '../src/lib/account';
import { DataProvider } from '../src/lib/data';
import { setLang } from '../src/lib/i18n';
import { searchRows, suggestions } from '../src/lib/lookalike';
import { parseReferences, setReferencesForTests, type Reference } from '../src/lib/references';
import { resetSimilar } from '../src/lib/similarStore';
import { reset } from '../src/lib/store';
import type { Player } from '../src/lib/types';
import { setBasketForTests } from '../src/lib/basketball/data';
import { parseBasketReferences, setBasketReferencesForTests, type BasketReference } from '../src/lib/basketball/references';
import { setTennisForTests } from '../src/lib/tennis/data';
import { parseTennisReferences, setTennisReferencesForTests, type TennisReference } from '../src/lib/tennis/references';
import { BasketSimilar, basketReferenceRow, basketRows } from '../src/screens/Similar/BasketSimilar';
import { FootballSimilar, footballRows, referenceRow } from '../src/screens/Similar/FootballSimilar';
import { TennisSimilar, tennisReferenceRow, tennisRows } from '../src/screens/Similar/TennisSimilar';
import { FILE as BASKET_FILE, make as basket } from './basket-radar-fixture';
import { FILE as TENNIS_FILE, make as tennis } from './tennis-radar-fixture';

const sample = (name: string): unknown => JSON.parse(readFileSync(resolve(__dirname, `../../contract/samples/${name}.json`), 'utf8'));
const samplePlayers = sample('players') as Player[];

const COLUMNS = ['id', 'name', 'club', 'league', 'position', 'group', 'age', 'value', 'creating', 'scoring', 'role', 'ga90', 'ga90_adj', 'low_sample', 'born_q4'];
const star: unknown[] = ['900', 'Lamine Zvijezda', 'FC Veliki', 'Spain', 'Right Winger', 'Attack', 19, 200_000_000, 100, 98, 87, 0.9, 0.62, 0, 0];
const back: unknown[] = ['901', 'Rúben Štoper', 'City FC', 'England', 'Centre-Back', 'Defender', 29.1, 55_000_000, 24, 92, 60, 0.1, 0.06, 1, 1];

const make = (over: Partial<Reference> = {}): Reference => ({
  id: '900',
  name: 'Lamine Zvijezda',
  club: 'FC Veliki',
  league: 'Spain',
  position: 'Right Winger',
  group: 'Attack',
  age: 19,
  value: 200_000_000,
  creating: 100,
  scoring: 98,
  role: 87,
  ga90: 0.9,
  ga90_adj: 0.62,
  low_sample: false,
  born_q4: false,
  ...over,
});

beforeEach(() => {
  localStorage.clear();
  resetAccounts();
  reset();
  resetSimilar();
  setLang('en');
  setReferencesForTests(null);
  setTennisReferencesForTests(null);
  setBasketReferencesForTests(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  setTennisForTests(null);
  setBasketForTests(null);
});

describe('references file', () => {
  it('reads the rows by the names of the columns, in any order', () => {
    const list = parseReferences({ columns: COLUMNS, rows: [star, back] });
    expect(list[0]).toEqual(make());
    expect(list[1]).toMatchObject({ id: '901', group: 'Defender', low_sample: true, born_q4: true });
    const turned = parseReferences({ columns: [...COLUMNS].reverse(), rows: [[...star].reverse()] });
    expect(turned).toEqual([make()]);
  });

  it('leaves out a row with a missing or wrong cell and keeps the rest', () => {
    const noValue = [...star];
    noValue[7] = null;
    const oddGroup = [...star];
    oddGroup[5] = 'Coach';
    const noAdjusted = [...back];
    noAdjusted[12] = null;
    const list = parseReferences({ columns: COLUMNS, rows: [noValue, oddGroup, 'text', noAdjusted] });
    expect(list.map((p) => p.id)).toEqual(['901']);
    expect(list[0].ga90_adj).toBeNull();
  });

  it('refuses a file without the needed columns', () => {
    expect(() => parseReferences({ rows: [] })).toThrow('required fields are missing');
    expect(() => parseReferences({ columns: COLUMNS.slice(1), rows: [] })).toThrow('columns are missing: id');
  });

  it('reads every row of the file the app ships', () => {
    const file = JSON.parse(readFileSync(resolve(__dirname, '../public/data/references.json'), 'utf8')) as { rows: unknown[] };
    const list = parseReferences(file);
    expect(file.rows.length).toBeGreaterThan(0);
    expect(list).toHaveLength(file.rows.length);
    expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
  });
});

describe('reference rows', () => {
  it('makes a player who can be named and is never offered', () => {
    const row = referenceRow(make());
    expect(row).toMatchObject({
      id: '900',
      name: 'Lamine Zvijezda',
      line: 'FC Veliki · Spain',
      group: 'winger',
      compare: [100, 98, 87],
      cost: 200_000_000,
      costText: '€200M',
      tier: null,
      eligible: false,
      searchOnly: true,
      adjust: { where: 'Spain', raw: '0.90', adjusted: '0.62' },
    });
  });

  it('shows no output line for a defender or a goalkeeper, and carries the warnings', () => {
    const row = referenceRow(make({ position: 'Centre-Back', group: 'Defender', low_sample: true, born_q4: true }));
    expect(row.group).toBe('defender');
    expect(row.adjust).toBeNull();
    expect(row.flags).toHaveLength(2);
  });

  it('adds only the players that players.json does not hold', () => {
    const rows = footballRows(samplePlayers, [make(), make({ id: samplePlayers[0].id, name: 'Double' })]);
    expect(rows).toHaveLength(samplePlayers.length + 1);
    expect(rows.filter((r) => r.id === samplePlayers[0].id).map((r) => r.name)).toEqual([samplePlayers[0].name]);
  });

  it('keeps them out of the players to start from, and finds them by every typed word', () => {
    const rows = footballRows(samplePlayers, [make(), make({ id: '901', name: 'Rúben Štoper', value: 55_000_000 })]);
    expect(suggestions(rows).map((r) => r.id)).not.toContain('900');
    expect(searchRows(rows, 'zvijezda').map((r) => r.id)).toEqual(['900']);
    expect(searchRows(rows, '  stoper   ruben ').map((r) => r.id)).toEqual(['901']);
    expect(searchRows(rows, 'ruben zvijezda')).toEqual([]);
    expect(searchRows(rows, '   ')).toEqual([]);
  });
});

const shipped = (name: string): { rows: unknown[] } => JSON.parse(readFileSync(resolve(__dirname, `../public/data/${name}.json`), 'utf8')) as { rows: unknown[] };

const ace: TennisReference = { id: 't900', name: 'Jannik Prvi', country: 'Italy', age: 24.8, rank: 1, wins: 100, level: 100, rise: 10, low_sample: false };
const star5: BasketReference = {
  id: 'b900',
  name: 'Sasha Zvijezda',
  team: 'Club Y',
  competition: 'EuroLeague',
  position: 'Guard',
  age: 30.2,
  mpg: 27.8,
  scoring: 70,
  impact: 60,
  trust: 100,
  low_sample: false,
};

describe('tennis references', () => {
  const columns = ['id', 'name', 'country', 'age', 'rank', 'wins', 'level', 'rise', 'low_sample'];

  it('reads the file, leaves out a broken row and refuses a file without a column', () => {
    const rows = [
      ['t900', 'Jannik Prvi', 'Italy', 24.8, 1, 100, 100, 10, 0],
      ['t901', 'No Rank', 'Italy', 24.8, null, 100, 100, 10, 0],
      ['t902', 'Few Matches', 'Spain', 31, 640, 20, 30, 1, 1],
    ];
    const list = parseTennisReferences({ columns, rows });
    expect(list).toEqual([ace, { id: 't902', name: 'Few Matches', country: 'Spain', age: 31, rank: 640, wins: 20, level: 30, rise: 1, low_sample: true }]);
    expect(() => parseTennisReferences({ columns: columns.filter((c) => c !== 'rank'), rows })).toThrow('columns are missing: rank');
  });

  it('reads every row of the file the app ships, and none of them is in the pool', () => {
    const file = shipped('tennis_references');
    const list = parseTennisReferences(file);
    expect(list.length).toBeGreaterThan(0);
    expect(list).toHaveLength(file.rows.length);
    const pool = new Set((shipped('tennis') as unknown as { players: { id: string }[] }).players.map((p) => p.id));
    expect(list.filter((p) => pool.has(p.id))).toEqual([]);
  });

  it('makes a row that can be named and is never offered, next to the pool', () => {
    expect(tennisReferenceRow(ace)).toMatchObject({ id: 't900', line: 'Italy', cost: -1, costText: 'No. 1', compare: [100, 100, 10], tier: null, eligible: false, searchOnly: true });
    const rows = tennisRows([tennis('t1'), tennis('t2')], [ace, { ...ace, id: 't1', name: 'Double' }]);
    expect(rows.map((r) => r.id)).toEqual(['t1', 't2', 't900']);
    expect(suggestions(rows).map((r) => r.id)).toEqual(['t1', 't2']);
  });

  it('finds a top player by name and shows pool players like him outside the limit', async () => {
    setTennisReferencesForTests([ace]);
    setTennisForTests({
      ...TENNIS_FILE,
      players: [
        tennis('t1', { name: 'Near One', rank: 400, pct: { wins: 95, level: 95, rise: 20 } }),
        tennis('t2', { name: 'Far Two', rank: 600, pct: { wins: 20, level: 20, rise: 20 } }),
        tennis('t3', { name: 'Seen Three', rank: 150, pct: { wins: 100, level: 100, rise: 10 } }),
      ],
    });
    renderScreen(<TennisSimilar />);
    const box = await screen.findByRole('searchbox', { name: 'Find a player' });
    expect(screen.queryByRole('button', { name: /Jannik Prvi/ })).toBeNull();
    await userEvent.type(box, 'prvi jannik');
    await userEvent.click(screen.getByRole('button', { name: /Jannik Prvi/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Like Jannik Prvi. Outside the top 300.' })).toBeInTheDocument();
    const cards = screen.getAllByRole('region', { name: /^Similar player/ });
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Similar player: Near One', 'Similar player: Far Two']);
    expect(screen.getByText('399 places lower')).toBeInTheDocument();
  });

  it('says who can be named when a name finds nobody', async () => {
    setTennisForTests(TENNIS_FILE);
    renderScreen(<TennisSimilar />);
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Find a player' }), 'zzz');
    expect(screen.getByRole('status')).toHaveTextContent('Only players ranked inside the top 1000 can be named.');
  });
});

describe('basketball references', () => {
  const columns = ['id', 'name', 'team', 'competition', 'position', 'age', 'mpg', 'scoring', 'impact', 'trust', 'low_sample'];

  it('reads the file, keeps a player without a position and leaves out a broken row', () => {
    const rows = [
      ['b900', 'Sasha Zvijezda', 'Club Y', 'EuroLeague', 'Guard', 30.2, 27.8, 70, 60, 100, 0],
      ['b901', 'No Position', 'Club Y', 'EuroCup', null, 28, 20.1, 50, 50, 100, 1],
      ['b902', 'Odd Position', 'Club Y', 'EuroCup', 'Coach', 28, 20.1, 50, 50, 100, 0],
      ['b903', 'No Minutes', 'Club Y', 'EuroCup', 'Center', 28, 'many', 50, 50, 100, 0],
    ];
    const list = parseBasketReferences({ columns, rows });
    expect(list.map((p) => p.id)).toEqual(['b900', 'b901']);
    expect(list[0]).toEqual(star5);
    expect(list[1]).toMatchObject({ position: null, low_sample: true });
  });

  it('reads every row of the file the app ships, and none of them is in the pool', () => {
    const file = shipped('basketball_references');
    const list = parseBasketReferences(file);
    expect(list.length).toBeGreaterThan(0);
    expect(list).toHaveLength(file.rows.length);
    const pool = new Set((shipped('basketball') as unknown as { players: { id: string }[] }).players.map((p) => p.id));
    expect(list.filter((p) => pool.has(p.id))).toEqual([]);
  });

  it('makes a row that can be named and is never offered, compared on scoring and impact', () => {
    expect(basketReferenceRow(star5)).toMatchObject({
      id: 'b900',
      line: 'Club Y · EuroLeague',
      group: 'Guard',
      scores: [70, 60, 100],
      compare: [70, 60],
      cost: 27.8,
      costText: '27.8 min',
      tier: null,
      eligible: false,
      searchOnly: true,
    });
    expect(basketReferenceRow({ ...star5, position: null }).group).toBe('');
    const rows = basketRows([basket('b1')], [star5, { ...star5, id: 'b1', name: 'Double' }]);
    expect(rows.map((r) => r.id)).toEqual(['b1', 'b900']);
    expect(suggestions(rows).map((r) => r.id)).toEqual(['b1']);
  });

  it('finds a starter by name and shows pool players of his position with fewer minutes', async () => {
    setBasketReferencesForTests([star5]);
    setBasketForTests({
      ...BASKET_FILE,
      players: [
        basket('b1', { name: 'Bench One', mpg: 9, pct: { scoring: 68, impact: 60, trust: 30 } }),
        basket('b2', { name: 'Bench Two', mpg: 12, pct: { scoring: 30, impact: 30, trust: 50 } }),
        basket('b3', { name: 'Center Three', mpg: 5, position: 'Center', pct: { scoring: 70, impact: 60, trust: 10 } }),
      ],
    });
    renderScreen(<BasketSimilar />);
    const box = await screen.findByRole('searchbox', { name: 'Find a player' });
    await userEvent.type(box, 'zvijezda');
    await userEvent.click(screen.getByRole('button', { name: /Sasha Zvijezda/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Like Sasha Zvijezda. Under 15 minutes a game.' })).toBeInTheDocument();
    const cards = screen.getAllByRole('region', { name: /^Similar player/ });
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Similar player: Bench One', 'Similar player: Bench Two']);
    expect(screen.getByText('18.8 min fewer')).toBeInTheDocument();
  });
});

function renderScreen(element: React.ReactNode = <FootballSimilar />) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      return new Response(JSON.stringify(sample(name)), { status: 200 });
    }),
  );
  render(
    <DataProvider>
      <MemoryRouter initialEntries={['/similar']}>
        <Routes>
          <Route path="/similar" element={element} />
        </Routes>
      </MemoryRouter>
    </DataProvider>,
  );
}

describe('similar screen with the players of references.json', () => {
  it('finds a well-known player by name and shows pool players like him', async () => {
    setReferencesForTests([make()]);
    renderScreen();
    const box = await screen.findByRole('searchbox', { name: 'Find a player' });
    expect(screen.queryByRole('button', { name: /Lamine Zvijezda/ })).toBeNull();
    await userEvent.type(box, 'lamine');
    await userEvent.click(screen.getByRole('button', { name: /Lamine Zvijezda/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Like Lamine Zvijezda. Within €500k.' })).toBeInTheDocument();
    const cards = screen.getAllByRole('region', { name: /^Similar player/ });
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) expect(card.getAttribute('aria-label')).not.toContain('Lamine');
  });

  it('works with the players of players.json alone when the file cannot be read', async () => {
    renderScreen();
    const box = await screen.findByRole('searchbox', { name: 'Find a player' });
    await userEvent.type(box, 'lamine');
    expect(screen.getByText('No player with that name.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Only players with enough league minutes this season, in one of the leagues Fair Scout covers, can be named.');
  });

  it('goes back to the search, with the typed name still there', async () => {
    setReferencesForTests([make()]);
    renderScreen();
    const box = await screen.findByRole('searchbox', { name: 'Find a player' });
    expect(screen.queryByRole('button', { name: '← Back to search' })).toBeNull();
    await userEvent.type(box, 'lamine');
    await userEvent.click(screen.getByRole('button', { name: /Lamine Zvijezda/ }));
    await userEvent.click(screen.getByRole('button', { name: '← Back to search' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Who can you not afford?' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Find a player' })).toHaveValue('lamine');
    expect(screen.queryByRole('button', { name: '← Back to search' })).toBeNull();
  });

  it('names the back button in the chosen language', async () => {
    setReferencesForTests([make()]);
    setLang('bs');
    renderScreen();
    await userEvent.type(await screen.findByRole('searchbox'), 'lamine');
    await userEvent.click(screen.getByRole('button', { name: /Lamine Zvijezda/ }));
    expect(screen.getByRole('button', { name: '← Nazad na pretragu' })).toBeInTheDocument();
    setLang('en');
  });
});
