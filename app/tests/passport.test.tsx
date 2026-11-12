import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../src/lib/data';
import { bosnianPlayers, passportCounts, showsRating } from '../src/lib/radar';
import { getState, reset, setBudget } from '../src/lib/store';
import type { Player } from '../src/lib/types';
import { Radar } from '../src/screens/Radar/Radar';

const sample = (name: string): unknown =>
  JSON.parse(readFileSync(resolve(__dirname, `../../contract/samples/${name}.json`), 'utf8'));
const base = (sample('players') as Player[])[0] as Player;

type Spec = Partial<Omit<Player, 'flags' | 'pct'>> & { rating?: number };
const make = (id: string, s: Spec = {}): Player => {
  const { rating, ...rest } = s;
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
    citizenship: 'Croatia',
    position_group: 'Attack',
    position: 'Left Winger',
    age: 20,
    ...rest,
    pct: { ...base.pct, output: rating ?? 50 },
    flags: { ...base.flags, under18: false, contract_ending: false },
  };
};
const bih = { citizenship: 'Bosnia-Herzegovina' };
const FIXTURE: Player[] = [
  make('h1', { ...bih, age: 22.5, value_eur: 2_000_000, in_pool: false, tier: null, rating: 77 }),
  make('h2', { ...bih, age: 19.1, value_eur: 400_000, rating: 88, position: 'Attacking Midfield', position_group: 'Midfield' }),
  make('h3', { ...bih, age: 19.1, value_eur: 150_000, position_group: 'Defender', position: 'Centre-Back', rating: 91 }),
  make('h4', { ...bih, age: 24, value_eur: 900_000, position_group: 'Midfield', position: 'Defensive Midfield', rating: 92 }),
  make('h5', { ...bih, age: 20, value_eur: 100_000, position_group: 'Goalkeeper', position: 'Goalkeeper', rating: 93 }),
  make('o1', { age: 18 }),
  make('o2', { ...bih, age: 21, value_eur: 500_000, league_id: 'GB1', league_name: 'England', rating: 66 }),
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
const heading = () => screen.findByRole('heading', { level: 1 });
const pass = () => screen.getByRole('button', { name: /Bosnian passport/ });
const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;
async function openPassport() {
  renderRadar();
  await heading();
  await userEvent.click(pass());
}

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

describe('passport logic', () => {
  it('lists Bosnian players whatever the pool, youngest first, ties by id', () => {
    expect(bosnianPlayers(FIXTURE).map((p) => p.id)).toEqual(['h2', 'h3', 'h5', 'o2', 'h1', 'h4']);
  });
  it('shows the rating only for attackers and attacking midfielders', () => {
    expect(FIXTURE.filter(showsRating).map((p) => p.id)).toEqual(['h1', 'h2', 'o1', 'o2']);
  });
  it('counts total, 21 or younger today and inside the budget', () => {
    expect(passportCounts(bosnianPlayers(FIXTURE), 500_000)).toEqual({ total: 6, young: 4, budget: 4 });
  });
  it('counts an age of 21.9 as 21 or younger and an age of 22.0 as older', () => {
    const aged = (age: number): Player => ({ ...FIXTURE[1], id: `a${age}`, age });
    expect(passportCounts([aged(21.2), aged(21.9), aged(22), aged(22.5)], 500_000).young).toBe(2);
  });
});

describe('passport view', () => {
  it('shows both counts and marks the pressed view', async () => {
    renderRadar();
    await heading();
    const group = screen.getByRole('group', { name: 'View' });
    expect(within(group).getByRole('button', { name: /In my budget/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: /In my budget/ })).toHaveTextContent('4');
    expect(pass()).toHaveTextContent('6');
    expect(pass()).toHaveAttribute('aria-pressed', 'false');
    pass().focus();
    await userEvent.keyboard('{Enter}');
    expect(pass()).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: /In my budget/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('lists every Bosnian player youngest first with the columns of the story', async () => {
    await openPassport();
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveTextContent('Name h2');
    expect(rows[0]).toHaveTextContent('Club h2 · Croatia');
    expect(rows[3]).toHaveTextContent('Club o2 · England');
    expect(rows[4]).toHaveTextContent('Name h1');
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Player', 'Pos', 'Age', 'Price', 'Min', 'Goals + assists', 'Rating', 'For you', 'My picks',
    ]);
    expect(screen.getByText('6 players.')).toBeInTheDocument();
  });

  it('gives a rating to attack and attacking midfield, Limited data to the rest', async () => {
    await openPassport();
    expect(within(rowOf('Name h2')).getByRole('meter')).toHaveAttribute('aria-valuenow', '88');
    expect(within(rowOf('Name h1')).getByRole('meter')).toBeInTheDocument();
    for (const id of ['h3', 'h4', 'h5']) {
      expect(within(rowOf(`Name ${id}`)).queryByRole('meter')).toBeNull();
      expect(within(rowOf(`Name ${id}`)).getByText('Limited data')).toBeInTheDocument();
    }
  });

  it('says In budget or Above budget by the shared budget', async () => {
    await openPassport();
    expect(within(rowOf('Name h2')).getByText('In budget')).toBeInTheDocument();
    expect(within(rowOf('Name h4')).getByText('Above budget')).toBeInTheDocument();
    expect(within(rowOf('Name h1')).getByText('Above budget')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /In my budget/ }));
    setBudget(1_000_000);
    await userEvent.click(pass());
    expect(within(rowOf('Name h4')).getByText('In budget')).toBeInTheDocument();
  });

  it('writes the three figures in the title and lede', async () => {
    await openPassport();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^6 players with a Bosnian passport play in these 23 leagues\.$/);
    expect(document.querySelector('.lede')).toHaveTextContent('4 are 21 or younger today. 4 fit your budget.');
  });

  it('says so and shows no table when nobody has the passport', async () => {
    current = FIXTURE.filter((p) => p.citizenship !== 'Bosnia-Herzegovina');
    await openPassport();
    expect(screen.getByText('No players with a Bosnian passport are in the data.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(pass()).toHaveTextContent('0');
  });

  it('keeps the first view filters when switching, and disables the rail', async () => {
    renderRadar();
    await heading();
    await userEvent.click(screen.getByRole('checkbox', { name: /Aged 18 or older/ }));
    await userEvent.click(pass());
    expect(screen.getByRole('checkbox', { name: /Aged 18 or older/ })).toBeDisabled();
    expect(screen.getByRole('slider')).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /In my budget/ }));
    expect(screen.getByRole('checkbox', { name: /Aged 18 or older/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Aged 18 or older/ })).toBeEnabled();
  });

  it('opens the card from a row and sets the origin', async () => {
    await openPassport();
    await userEvent.click(screen.getByText('Name h2'));
    expect(screen.getByTestId('where')).toHaveTextContent('/player/h2');
    expect(getState().origin).toBe('radar');
  });

  it('does not open the card on Enter inside a chip in a row', async () => {
    await openPassport();
    const chip = within(rowOf('Name h3')).getByText('Limited data');
    chip.focus();
    expect(chip).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByTestId('where')).toBeNull();
    rowOf('Name h3').focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('where')).toHaveTextContent('/player/h3');
  });
});
