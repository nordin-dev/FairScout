import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { reset, getState } from '../src/lib/store';
import { setTennisForTests } from '../src/lib/tennis/data';
import {
  applyFilters,
  countryCounts,
  countryList,
  dayMonthYear,
  defaultFilters,
  sortRows,
  switchCounts,
  titleCounts,
} from '../src/lib/tennis/radar';
import { tennisRadar as t } from '../src/lib/tennis/radarText';
import { FILE, META, PLAYERS, make } from './tennis-radar-fixture';
import { TennisRadar } from '../src/screens/Tennis/TennisRadar';

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}
function renderRadar() {
  render(
    <MemoryRouter initialEntries={['/radar']}>
      <Routes>
        <Route path="/radar" element={<TennisRadar />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}
const rowCount = () => within(screen.getByRole('table')).getAllByRole('row').length - 1;
const heading = () => screen.getByRole('heading', { level: 1 });
const setRank = (v: number) => fireEvent.change(document.getElementById('tennis-rank') as HTMLInputElement, { target: { value: String(v) } });

beforeEach(() => {
  reset();
  setTennisForTests(FILE);
});

describe('tennis radar logic', () => {
  it('filters by rank, country, age and hand', () => {
    const f = defaultFilters(PLAYERS);
    expect(applyFilters(PLAYERS, f)).toHaveLength(7);
    expect(applyFilters(PLAYERS, { ...f, minRank: 250 }).map((p) => p.id).sort()).toEqual(['t3', 't4', 't5', 't6', 't7']);
    expect(applyFilters(PLAYERS, { ...f, countries: ['ARG'] }).map((p) => p.id).sort()).toEqual(['t4', 't6']);
    expect(applyFilters(PLAYERS, { ...f, under18Only: true }).map((p) => p.id)).toEqual(['t4']);
    expect(applyFilters(PLAYERS, { ...f, leftOnly: true }).map((p) => p.id).sort()).toEqual(['t2', 't5']);
  });

  it('counts countries and switches under the other filters', () => {
    const f = { ...defaultFilters(PLAYERS), minRank: 250 };
    expect(countryList(PLAYERS).map((c) => c.name)).toEqual(['Argentina', 'France', 'Norway']);
    expect(countryCounts(PLAYERS, { ...f, countries: ['NOR'] })).toEqual({ ARG: 2, FRA: 2, NOR: 1 });
    expect(switchCounts(PLAYERS, f)).toEqual({ under18: 1, left: 1 });
    expect(switchCounts(PLAYERS, { ...f, countries: ['FRA'] })).toEqual({ under18: 0, left: 0 });
  });

  it('sorts by tier, then score', () => {
    expect(sortRows(PLAYERS).map((p) => p.id)).toEqual(['t1', 't2', 't6', 't3', 't5', 't4', 't7']);
    expect(titleCounts(PLAYERS)).toEqual({ total: 7, tierA: 2 });
  });

  it('formats a ranking date', () => {
    expect(dayMonthYear('2026-06-08')).toBe('8 Jun 2026');
  });
});

describe('tennis radar screen', () => {
  it('shows the title, lede and rows', () => {
    renderRadar();
    expect(heading()).toHaveTextContent('7 young players are ranked outside the top 100. Two are tier A.');
    expect(screen.getByText('ATP ranking of 8 Jun 2026, men under 21, ranked 101 to 1000.')).toBeInTheDocument();
    expect(rowCount()).toBe(7);
    const first = within(screen.getByRole('table')).getAllByRole('row')[1] as HTMLElement;
    expect(first).toHaveTextContent('Name t1');
    expect(first).toHaveTextContent('25–15');
    expect(first).toHaveTextContent('Top-200 wins: 5');
    expect(within(screen.getByRole('table')).getByText('Few matches')).toBeInTheDocument();
  });

  it('filters by the rank slider', () => {
    renderRadar();
    setRank(250);
    expect(heading()).toHaveTextContent('5 young players are ranked outside the top 250. None are tier A.');
    expect(screen.getByText('> 250')).toBeInTheDocument();
    expect(screen.getByText(/ranked 251 to 1000/)).toBeInTheDocument();
    expect(rowCount()).toBe(5);
  });

  it('opens the country list and filters by one country', async () => {
    const user = userEvent.setup();
    renderRadar();
    const toggle = screen.getByRole('button', { name: /3 countries/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('checkbox', { name: /France/ })).not.toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(screen.getByRole('checkbox', { name: /France/ }));
    expect(toggle).toHaveTextContent('3 countries · 1 selected');
    expect(rowCount()).toBe(3);
    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(rowCount()).toBe(7);
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('filters under 18 and left-handed and says so in the lede', async () => {
    const user = userEvent.setup();
    renderRadar();
    await user.click(screen.getByRole('checkbox', { name: /Under 18 only/ }));
    expect(rowCount()).toBe(1);
    expect(screen.getByText(/men aged under 18/)).toBeInTheDocument();
    expect(heading()).toHaveTextContent('1 young player is ranked outside the top 100. None are tier A.');
    await user.click(screen.getByRole('checkbox', { name: /Under 18 only/ }));
    await user.click(screen.getByRole('checkbox', { name: /Left-handed only/ }));
    expect(rowCount()).toBe(2);
  });

  it('shows an empty state that resets', async () => {
    const user = userEvent.setup();
    renderRadar();
    await user.click(screen.getByRole('checkbox', { name: /Under 18 only/ }));
    await user.click(screen.getByRole('checkbox', { name: /Left-handed only/ }));
    expect(heading()).toHaveTextContent(t.emptyTitle);
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(rowCount()).toBe(7);
  });

  it('opens the card of a clicked row', async () => {
    const user = userEvent.setup();
    renderRadar();
    await user.click(screen.getByText('Name t2'));
    expect(screen.getByTestId('where')).toHaveTextContent('/tennis/t2');
    expect(getState().origin).toBe('radar');
  });

  it('shows 20 rows first and the rest on request', async () => {
    const many = Array.from({ length: 25 }, (_, i) => make(`m${i}`, { rank: 200 + i }));
    setTennisForTests({ meta: META, players: many, timemachine: [] });
    const user = userEvent.setup();
    renderRadar();
    expect(rowCount()).toBe(20);
    await user.click(screen.getByRole('button', { name: 'Show all' }));
    expect(rowCount()).toBe(25);
  });

  it('ends with one evidence line and a link to the evidence screen', async () => {
    const user = userEvent.setup();
    renderRadar();
    expect(screen.queryByRole('heading', { name: 'Does the model work?' })).not.toBeInTheDocument();
    expect(screen.getByText(/In past pools, 70 of the model’s 99 top picks reached the top 100; the pool average is 13.5%\./)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'See the evidence →' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/evidence');
  });
});
