import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../src/lib/data';
import { shortNote, similarInBudget } from '../src/lib/similar';
import { reset, setBudget, setDetails } from '../src/lib/store';
import { player as t } from '../src/lib/text.en';
import type { Player } from '../src/lib/types';
import { PlayerCard } from '../src/screens/PlayerCard/PlayerCard';

const SAMPLES = resolve(__dirname, '../../contract/samples');
const sample = (name: string): unknown => JSON.parse(readFileSync(resolve(SAMPLES, `${name}.json`), 'utf8'));
const base = (sample('players') as Player[])[0];

const make = (id: string, value: number, extra: Partial<Player> = {}): Player => ({
  ...base,
  id,
  name: `Name ${id}`,
  league_name: `League ${id}`,
  value_eur: value,
  similar: [],
  note: null,
  note_source: null,
  ...extra,
});
const entry = (id: string, similarity: number) => ({ id, similarity, diff: `diff of ${id}` });

const main = make('main', 800_000, {
  similar: [entry('a', 80), entry('b', 91), entry('c', 91), entry('d', 70), entry('main', 99), entry('ghost', 95)],
});
const others = [make('a', 200_000), make('b', 400_000), make('c', 300_000), make('d', 900_000)];
const all = [main, ...others];

function renderCard(list: Player[], at = list[0].id) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      return new Response(JSON.stringify(name === 'players' ? list : sample(name)), { status: 200 });
    }),
  );
  render(
    <DataProvider>
      <MemoryRouter initialEntries={[`/player/${at}`]}>
        <Routes>
          <Route path="/player/:id" element={<PlayerCard />} />
        </Routes>
      </MemoryRouter>
    </DataProvider>,
  );
}
const panel = (label: string) => screen.getByText(label).closest('section') as HTMLElement;

beforeEach(reset);
afterEach(() => vi.unstubAllGlobals());

describe('similarInBudget', () => {
  it('keeps players inside the budget, most similar first, ties by id, at most three', () => {
    const ids = similarInBudget(main, all, 1_000_000).map((r) => r.player.id);
    expect(ids).toEqual(['b', 'c', 'a']);
  });

  it('leaves out an entry pointing at himself or at an unknown id', () => {
    const ids = similarInBudget(main, all, 1_000_000).map((r) => r.player.id);
    expect(ids).not.toContain('main');
    expect(ids).not.toContain('ghost');
  });

  it('leaves out players above the budget', () => {
    expect(similarInBudget(main, all, 250_000).map((r) => r.player.id)).toEqual(['a']);
  });
});

describe('similar panel', () => {
  it('shows name, league, price and percentage', async () => {
    renderCard(all);
    await screen.findByRole('heading', { name: main.name });
    const rows = within(panel(t.similarLabel));
    expect(rows.getByText('Name b')).toBeInTheDocument();
    expect(rows.getByText('League b · €400k')).toBeInTheDocument();
    expect(rows.getAllByText('91%')).toHaveLength(2);
  });

  it('changes the list when the shared budget changes', async () => {
    renderCard(all);
    await screen.findByRole('heading', { name: main.name });
    expect(within(panel(t.similarLabel)).getAllByRole('link')).toHaveLength(3);
    act(() => setBudget(250_000));
    expect(within(panel(t.similarLabel)).getAllByRole('link')).toHaveLength(1);
  });

  it('says so when none is inside the budget or the data has none', async () => {
    renderCard([make('main', 800_000, { similar: [entry('d', 70)] }), others[3]]);
    await screen.findByRole('heading', { name: 'Name main' });
    expect(screen.getByText(t.similarNone)).toBeInTheDocument();
  });

  it('makes each row a link to the other card, opened with Enter', async () => {
    renderCard(all);
    await screen.findByRole('heading', { name: main.name });
    const link = within(panel(t.similarLabel)).getByRole('link', { name: /Name b/ });
    expect(link).toHaveAttribute('href', '/player/b');
    link.focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('heading', { name: 'Name b' })).toBeInTheDocument();
  });
});

describe('note panel', () => {
  it('is labelled AI scout note for a model note and Summary for a template note', async () => {
    renderCard([make('main', 1, { note: 'One.', note_source: 'model' })]);
    expect(await screen.findByText('AI scout note')).toBeInTheDocument();
    expect(screen.queryByText('Summary')).toBeNull();
  });

  it('is labelled Summary for a template note', async () => {
    renderCard([make('main', 1, { note: 'One.', note_source: 'template' })]);
    expect(await screen.findByText('Summary')).toBeInTheDocument();
    expect(screen.queryByText('AI scout note')).toBeNull();
  });

  it('is not shown without a note', async () => {
    renderCard([make('main', 1, { note: '', note_source: 'model' })]);
    await screen.findByRole('heading', { name: 'Name main' });
    expect(screen.queryByText('AI scout note')).toBeNull();
    expect(screen.queryByText('Summary')).toBeNull();
  });

  it('shows two sentences of a three-sentence note', async () => {
    expect(shortNote('First one. Second one! Third one.')).toBe('First one. Second one!');
    renderCard([make('main', 1, { note: 'First one. Second one. Third one.', note_source: 'template' })]);
    expect(await screen.findByText('First one. Second one.')).toBeInTheDocument();
    expect(screen.queryByText(/Third/)).toBeNull();
  });
});

describe('shortNote', () => {
  it('keeps a first sentence that holds a decimal', () => {
    expect(shortNote('He has 0.53 goals and assists per 90. Young for the league.')).toBe(
      'He has 0.53 goals and assists per 90. Young for the league.',
    );
  });

  it('shows exactly the first two of three sentences with decimals', () => {
    expect(shortNote('Scores 1.5 goals a game. Rated 0.8 above peers. Third one 2.5 here.')).toBe(
      'Scores 1.5 goals a game. Rated 0.8 above peers.',
    );
  });

  it('shows a note with no final period whole', () => {
    expect(shortNote('One season only, 0.5 per 90')).toBe('One season only, 0.5 per 90');
  });
});

describe('similar link', () => {
  it('encodes an id that needs it', async () => {
    const odd = make('x/y z', 100_000);
    renderCard([make('main', 800_000, { similar: [entry('x/y z', 80)] }), odd]);
    await screen.findByRole('heading', { name: 'Name main' });
    expect(within(panel(t.similarLabel)).getByRole('link')).toHaveAttribute('href', '/player/x%2Fy%20z');
  });
});

describe('detail texts', () => {
  it('appear only with details on', async () => {
    renderCard([make('main', 1, { note: 'One.', note_source: 'model' })]);
    await screen.findByRole('heading', { name: 'Name main' });
    expect(screen.queryByText(t.similarDetail)).toBeNull();
    expect(screen.queryByText(t.noteDetailModel)).toBeNull();
    act(() => setDetails(true));
    expect(screen.getByText(t.similarDetail)).toBeInTheDocument();
    expect(screen.getByText(t.noteDetailModel)).toBeInTheDocument();
  });
});
