import { MemoryRouter } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBasketForTests } from '../src/lib/basketball/data';
import { bestSince, defaultYear, outcomeText, seasonOf, threeSeasonsLater } from '../src/lib/basketball/timeMachine';
import { BasketTimeMachine } from '../src/screens/Basketball/BasketTimeMachine';
import { TM_FILE, Y2016, Y2021, Y2022 } from './basket-timemachine-fixture';

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;
const show = () => userEvent.click(screen.getByRole('button', { name: /^Show what happened/ }));
const season = (s: string) => userEvent.click(screen.getByRole('button', { name: s }));
const renderIt = () =>
  render(
    <MemoryRouter>
      <BasketTimeMachine />
    </MemoryRouter>,
  );

beforeEach(() => setBasketForTests(TM_FILE));
afterEach(() => {
  setBasketForTests(null);
  vi.unstubAllGlobals();
});

describe('basketball time machine logic', () => {
  it('picks 2016 or else the latest season', () => {
    expect(defaultYear([Y2016, Y2021, Y2022])).toBe(2016);
    expect(defaultYear([Y2021, Y2022])).toBe(2022);
    expect(defaultYear([])).toBeNull();
  });
  it('words seasons and outcomes', () => {
    expect(seasonOf(2016)).toBe('2016/17');
    expect(seasonOf(2099)).toBe('2099/00');
    expect(threeSeasonsLater(2016)).toBe('2019/20');
    expect(bestSince(27.9)).toBe('27.9');
    expect(bestSince(null)).toBe('none');
    expect(outcomeText({ hit: true, reached: '2017/18', best_later: 27.9 })).toBe('Became a rotation player · 2017/18');
    expect(outcomeText({ hit: false, reached: null, best_later: 14.2 })).toBe('Did not reach 20 minutes a game');
    expect(outcomeText({ hit: false, reached: null, best_later: null })).toBe('No later season in EuroLeague or EuroCup');
  });
});

describe('basketball time machine screen', () => {
  it('opens on 2016/17 with names and no outcomes', () => {
    renderIt();
    expect(heading()).toBe('It is the end of season 2016/17. These are the model’s top 3.');
    expect(screen.getByText('44 players under 23 with a small role in EuroLeague or EuroCup. The model had seen only earlier seasons.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '2016/17' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Ada Hit')).toBeTruthy();
    expect(screen.getByText('Club Two · EuroCup')).toBeTruthy();
    expect(screen.getByText('15.3')).toBeTruthy();
    expect(screen.queryByText(/Became a rotation player/)).toBeNull();
    expect(screen.queryByText('27.9')).toBeNull();
    expect(screen.queryByText('Who the model missed')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show what happened by 2019/20 →' })).toBeTruthy();
    expect(screen.getByText('A player who left for the NBA or another league has no later season here and counts as not reached.')).toBeTruthy();
  });

  it('shows outcomes, summary and the missed block after the reveal', async () => {
    renderIt();
    await show();
    expect(heading()).toBe('1 of the 3 became rotation players within three seasons.');
    expect(screen.getByText('Of all 44 players in the pool, 10 did.')).toBeTruthy();
    expect(screen.getByText('Became a rotation player · 2017/18')).toBeTruthy();
    expect(screen.getByText('27.9')).toBeTruthy();
    expect(screen.getByText('Did not reach 20 minutes a game')).toBeTruthy();
    expect(screen.getByText('No later season in EuroLeague or EuroCup')).toBeTruthy();
    expect(screen.getByText('Who the model missed')).toBeTruthy();
    expect(screen.getByText('2 players outside the model’s top 3 also became rotation players.')).toBeTruthy();
    const missed = within(screen.getByRole('table', { name: /outside the model/ }));
    expect(missed.getByText('Dan Late')).toBeTruthy();
    expect(missed.getByText('Tier B then')).toBeTruthy();
    expect(missed.getByText('21.4')).toBeTruthy();
  });

  it('uses the singular for one missed player', async () => {
    renderIt();
    await season('2022/23');
    await show();
    expect(screen.getByText('1 player outside the model’s top 2 also became a rotation player.')).toBeTruthy();
  });

  it('says so when nobody was missed', async () => {
    renderIt();
    await season('2021/22');
    await show();
    expect(screen.getByText('No player outside the model’s top 1 became a rotation player.')).toBeTruthy();
    expect(screen.queryByRole('table', { name: /outside the model/ })).toBeNull();
  });

  it('hides again, and a new season hides outcomes', async () => {
    renderIt();
    await show();
    await userEvent.click(screen.getByRole('button', { name: 'Hide again' }));
    expect(screen.queryByText(/Became a rotation player/)).toBeNull();
    await show();
    await season('2022/23');
    expect(screen.queryByText(/Became a rotation player/)).toBeNull();
    expect(screen.queryByText('Who the model missed')).toBeNull();
    expect(heading()).toBe('It is the end of season 2022/23. These are the model’s top 2.');
  });

  it('shows the loading state, then the error with a retry', async () => {
    setBasketForTests(null);
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        return calls === 1 ? new Response('no', { status: 500 }) : new Response(JSON.stringify(TM_FILE), { status: 200 });
      }),
    );
    renderIt();
    expect(screen.getByText('Loading past seasons…')).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toMatch(/basketball\.json/);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Ada Hit')).toBeTruthy();
  });

  it('shows the empty state when there is no past season', () => {
    setBasketForTests({ ...TM_FILE, timemachine: [] });
    renderIt();
    expect(screen.getByText('No past season can be checked yet.')).toBeTruthy();
  });
});
