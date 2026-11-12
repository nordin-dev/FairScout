import { MemoryRouter } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setTennisForTests } from '../src/lib/tennis/data';
import { bestSince, dayMonthYear, defaultYear, monthYear, outcomeText, threeYearsLater } from '../src/lib/tennis/timeMachine';
import { TennisTimeMachine } from '../src/screens/Tennis/TennisTimeMachine';
import { TM_FILE, Y2019, Y2021, Y2022 } from './tennis-timemachine-fixture';

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;
const show = () => userEvent.click(screen.getByRole('button', { name: /^Show what happened/ }));
const year = (y: string) => userEvent.click(screen.getByRole('button', { name: y }));
const renderIt = () =>
  render(
    <MemoryRouter>
      <TennisTimeMachine />
    </MemoryRouter>,
  );

beforeEach(() => setTennisForTests(TM_FILE));
afterEach(() => {
  setTennisForTests(null);
  vi.unstubAllGlobals();
});

describe('tennis time machine logic', () => {
  it('picks 2019 or else the latest year', () => {
    expect(defaultYear([Y2019, Y2021, Y2022])).toBe(2019);
    expect(defaultYear([Y2021, Y2022])).toBe(2022);
    expect(defaultYear([])).toBeNull();
  });
  it('words dates and outcomes', () => {
    expect(monthYear('2019-05-27')).toBe('May 2019');
    expect(dayMonthYear('2019-05-27')).toBe('27 May 2019');
    expect(threeYearsLater('2019-05-27')).toBe('May 2022');
    expect(bestSince(9)).toBe('No. 9');
    expect(bestSince(null)).toBe('no ranking');
    expect(outcomeText({ hit: true, reached: '2021-07-12' })).toBe('Reached the top 100 · Jul 2021');
    expect(outcomeText({ hit: false, reached: null })).toBe('Did not reach the top 100');
  });
});

describe('tennis time machine screen', () => {
  it('opens on 2019 with names and no outcomes', () => {
    renderIt();
    expect(heading()).toBe('It is May 2019. These are the model’s top 3.');
    expect(screen.getByText(/ATP ranking of 27 May 2019: 93 players under 21/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '2019' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Ada Hit')).toBeTruthy();
    expect(screen.getByText('No. 215')).toBeTruthy();
    expect(screen.queryByText(/Reached the top 100/)).toBeNull();
    expect(screen.queryByText('No. 9')).toBeNull();
    expect(screen.queryByText('Who the model missed')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show what happened by May 2022 →' })).toBeTruthy();
  });

  it('shows outcomes, summary and the missed block after the reveal', async () => {
    renderIt();
    await show();
    expect(heading()).toBe('1 of the 3 reached the top 100 within three years.');
    expect(screen.getByText('Of all 93 players in the pool, 15 did.')).toBeTruthy();
    expect(screen.getByText('Reached the top 100 · Jul 2021')).toBeTruthy();
    expect(screen.getByText('No. 9')).toBeTruthy();
    expect(screen.getAllByText('Did not reach the top 100')).toHaveLength(2);
    expect(screen.getByText('no ranking')).toBeTruthy();
    expect(screen.getByText('Who the model missed')).toBeTruthy();
    expect(screen.getByText('2 players outside the model’s top 3 also reached the top 100.')).toBeTruthy();
    const missed = within(screen.getByRole('table', { name: /outside the model/ }));
    expect(missed.getByText('Dan Late')).toBeTruthy();
    expect(missed.getByText('Tier B then')).toBeTruthy();
    expect(missed.getByText('No. 40')).toBeTruthy();
  });

  it('uses the singular for one missed player', async () => {
    renderIt();
    await year('2022');
    await show();
    expect(screen.getByText('1 player outside the model’s top 2 also reached the top 100.')).toBeTruthy();
  });

  it('says so when nobody was missed', async () => {
    renderIt();
    await year('2021');
    await show();
    expect(screen.getByText('No player outside the model’s top 1 reached the top 100.')).toBeTruthy();
    expect(screen.queryByRole('table', { name: /outside the model/ })).toBeNull();
  });

  it('hides again, and a new year hides outcomes', async () => {
    renderIt();
    await show();
    await userEvent.click(screen.getByRole('button', { name: 'Hide again' }));
    expect(screen.queryByText(/Reached the top 100/)).toBeNull();
    await show();
    await year('2022');
    expect(screen.queryByText(/Reached the top 100/)).toBeNull();
    expect(screen.queryByText('Who the model missed')).toBeNull();
    expect(heading()).toBe('It is June 2022. These are the model’s top 2.');
  });

  it('shows the loading state, then the error with a retry', async () => {
    setTennisForTests(null);
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return calls === 1 ? new Response('no', { status: 500 }) : new Response(JSON.stringify(TM_FILE), { status: 200 });
      }),
    );
    renderIt();
    expect(screen.getByText('Loading past years…')).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toMatch(/tennis\.json/);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Ada Hit')).toBeTruthy();
  });

  it('shows the empty state when there is no past year', () => {
    setTennisForTests({ ...TM_FILE, timemachine: [] });
    renderIt();
    expect(screen.getByText('No past year can be checked yet.')).toBeTruthy();
  });
});
