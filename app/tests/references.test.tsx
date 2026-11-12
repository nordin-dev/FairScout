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
import { FootballSimilar, footballRows, referenceRow } from '../src/screens/Similar/FootballSimilar';

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
});
afterEach(() => vi.unstubAllGlobals());

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

function renderScreen() {
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
          <Route path="/similar" element={<FootballSimilar />} />
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
