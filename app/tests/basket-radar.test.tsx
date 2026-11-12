import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reset, getState } from '../src/lib/store';
import { setBasketForTests } from '../src/lib/basketball/data';
import {
  applyFilters,
  competitionCounts,
  countryCounts,
  countryList,
  defaultFilters,
  sortRows,
  titleCounts,
  under20Count,
} from '../src/lib/basketball/radar';
import { basketRadar as t } from '../src/lib/basketball/radarText';
import { FILE, META, PLAYERS, make } from './basket-radar-fixture';
import { BasketRadar } from '../src/screens/Basketball/BasketRadar';

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}
function renderRadar() {
  render(
    <MemoryRouter initialEntries={['/radar']}>
      <Routes>
        <Route path="/radar" element={<BasketRadar />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}
const rowCount = () => within(screen.getByRole('table')).getAllByRole('row').length - 1;
const heading = () => screen.getByRole('heading', { level: 1 });
const setMinutes = (v: number) => fireEvent.change(document.getElementById('basket-minutes') as HTMLInputElement, { target: { value: String(v) } });
const ids = (list: { id: string }[]) => list.map((p) => p.id).sort();

beforeEach(() => {
  reset();
  setBasketForTests(FILE);
});
afterEach(() => {
  vi.unstubAllGlobals();
  setBasketForTests(null);
});

describe('basketball radar logic', () => {
  it('filters by minutes, position, competition, country and age', () => {
    const f = defaultFilters(PLAYERS);
    expect(applyFilters(PLAYERS, f)).toHaveLength(7);
    expect(ids(applyFilters(PLAYERS, { ...f, maxMpg: 12 }))).toEqual(['b3', 'b4', 'b6', 'b7']);
    expect(ids(applyFilters(PLAYERS, { ...f, position: 'Forward' }))).toEqual(['b2', 'b5']);
    expect(ids(applyFilters(PLAYERS, { ...f, competitions: ['EuroCup'] }))).toEqual(['b2', 'b5', 'b7']);
    expect(ids(applyFilters(PLAYERS, { ...f, countries: ['Serbia', ''] }))).toEqual(['b4', 'b6', 'b7']);
    expect(ids(applyFilters(PLAYERS, { ...f, under20Only: true }))).toEqual(['b1', 'b4']);
  });

  it('counts competitions, countries and the switch under the other filters', () => {
    const f = { ...defaultFilters(PLAYERS), maxMpg: 12 };
    expect(countryList(PLAYERS).map((c) => c.name)).toEqual(['France', 'Serbia', 'Spain', 'Not known']);
    expect(countryCounts(PLAYERS, { ...f, countries: ['Serbia'] })).toEqual({ France: 1, '': 1, Serbia: 2 });
    expect(competitionCounts(PLAYERS, { ...f, competitions: ['EuroCup'] })).toEqual({ EuroLeague: 3, EuroCup: 1 });
    expect(under20Count(PLAYERS, f)).toBe(1);
  });

  it('sorts by tier, then score', () => {
    expect(sortRows(PLAYERS).map((p) => p.id)).toEqual(['b1', 'b2', 'b6', 'b3', 'b5', 'b4', 'b7']);
    expect(titleCounts(PLAYERS)).toEqual({ total: 7, tierA: 2 });
  });
});

describe('basketball radar screen', () => {
  it('shows the title, lede and rows', () => {
    renderRadar();
    expect(heading()).toHaveTextContent('7 young players average under 18 minutes. Two are tier A.');
    expect(screen.getByText('Season 2025/26, EuroLeague and EuroCup, players under 23 with at least five games.')).toBeInTheDocument();
    expect(rowCount()).toBe(7);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    const first = rows[1] as HTMLElement;
    expect(first).toHaveTextContent('Name b1');
    expect(first).toHaveTextContent('Club X · EuroLeague');
    expect(first).toHaveTextContent('15.0');
    expect(first).toHaveTextContent('Under 20');
    expect(within(screen.getByRole('table')).getByText('Few games')).toBeInTheDocument();
    expect(rows.find((r) => r.textContent?.includes('Name b4'))).toHaveTextContent('—');
  });

  it('filters by the minutes slider', () => {
    renderRadar();
    setMinutes(12);
    expect(heading()).toHaveTextContent('4 young players average under 12 minutes. None are tier A.');
    expect(screen.getByText('< 12')).toBeInTheDocument();
    expect(rowCount()).toBe(4);
  });

  it('filters by position', async () => {
    const user = userEvent.setup();
    renderRadar();
    await user.click(screen.getByRole('button', { name: 'Forward' }));
    expect(rowCount()).toBe(2);
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(rowCount()).toBe(7);
  });

  it('filters by competition with counts', async () => {
    const user = userEvent.setup();
    renderRadar();
    expect(screen.getByRole('checkbox', { name: /EuroLeague/ })).toHaveTextContent('4');
    expect(screen.getByRole('checkbox', { name: /EuroCup/ })).toHaveTextContent('3');
    await user.click(screen.getByRole('checkbox', { name: /EuroLeague/ }));
    expect(rowCount()).toBe(3);
    expect(screen.getByText('Season 2025/26, EuroCup, players under 23 with at least five games.')).toBeInTheDocument();
  });

  it('opens the country list and filters by one country', async () => {
    const user = userEvent.setup();
    renderRadar();
    const toggle = screen.getByRole('button', { name: /4 countries/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('checkbox', { name: /France/ })).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('checkbox', { name: /Not known/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(screen.getByRole('checkbox', { name: /France/ }));
    expect(toggle).toHaveTextContent('4 countries · 1 selected');
    expect(rowCount()).toBe(2);
    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(rowCount()).toBe(7);
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('filters under 20 and says so in the lede', async () => {
    const user = userEvent.setup();
    renderRadar();
    expect(screen.getByRole('checkbox', { name: /Under 20 only/ })).toHaveTextContent('2');
    await user.click(screen.getByRole('checkbox', { name: /Under 20 only/ }));
    expect(rowCount()).toBe(2);
    expect(screen.getByText(/players aged under 20 with/)).toBeInTheDocument();
    expect(heading()).toHaveTextContent('2 young players average under 18 minutes. One is tier A.');
  });

  it('shows an empty state that resets', async () => {
    const user = userEvent.setup();
    renderRadar();
    await user.click(screen.getByRole('checkbox', { name: /Under 20 only/ }));
    await user.click(screen.getByRole('button', { name: 'Center' }));
    expect(heading()).toHaveTextContent(t.emptyTitle);
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(rowCount()).toBe(7);
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens the card of a clicked row', async () => {
    const user = userEvent.setup();
    renderRadar();
    await user.click(screen.getByText('Name b2'));
    expect(screen.getByTestId('where')).toHaveTextContent('/basketball/b2');
    expect(getState().origin).toBe('radar');
  });

  it('shows 20 rows first and the rest on request', async () => {
    const many = Array.from({ length: 25 }, (_, i) => make(`m${i}`, { mpg: 8 }));
    setBasketForTests({ meta: META, players: many, timemachine: [] });
    const user = userEvent.setup();
    renderRadar();
    expect(rowCount()).toBe(20);
    await user.click(screen.getByRole('button', { name: 'Show all' }));
    expect(rowCount()).toBe(25);
  });

  it('ends with one evidence line and a link to the evidence screen', async () => {
    const user = userEvent.setup();
    renderRadar();
    expect(
      screen.getByText(/In past pools, 35 of the model’s 71 top picks became rotation players; the pool average is 14.9%\./),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'See the evidence →' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/evidence');
  });

  it('shows a loading note while the file is on its way', () => {
    setBasketForTests(null);
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderRadar();
    expect(screen.getByText(t.loadingNote)).toBeInTheDocument();
  });

  it('shows an error with a retry', async () => {
    const user = userEvent.setup();
    setBasketForTests(null);
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    renderRadar();
    await waitFor(() => expect(screen.getByText(/basketball\.json/)).toBeInTheDocument());
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(FILE) });
    await user.click(screen.getByRole('button', { name: /try again|retry/i }));
    await waitFor(() => expect(rowCount()).toBe(7));
  });
});
