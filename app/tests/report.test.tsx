import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addPick, register, resetAccounts } from '../src/lib/account';
import { setBasketForTests } from '../src/lib/basketball/data';
import { DataProvider } from '../src/lib/data';
import { setLang } from '../src/lib/i18n';
import { setTennisForTests } from '../src/lib/tennis/data';
import { MyPicks } from '../src/screens/Account/MyPicks';
import { Report } from '../src/screens/Account/Report';
import { FILE as BASKET_FILE, PLAYERS as BASKET_PLAYERS } from './basket-radar-fixture';
import { FILE as TENNIS_FILE, PLAYERS as TENNIS_PLAYERS } from './tennis-radar-fixture';

const sample = (name: string): unknown => JSON.parse(readFileSync(resolve(__dirname, `../../contract/samples/${name}.json`), 'utf8'));

function renderAt(path: string) {
  render(
    <DataProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/my-picks" element={<MyPicks />} />
          <Route path="/my-picks/report" element={<Report />} />
        </Routes>
      </MemoryRouter>
    </DataProvider>,
  );
}

const tennis = TENNIS_PLAYERS[0];
const basket = BASKET_PLAYERS[0];

async function signInWithPicks() {
  await register('Ana', 'secret');
  addPick({ sport: 'football', id: 'sample-a', name: 'Ivan Uzorak', line: 'NK Primjer · Croatia', tier: 'A', from: 'similar' });
  addPick({ sport: 'football', id: 'gone', name: 'Old Name', line: 'Old Club', tier: 'C', from: 'radar' });
  addPick({ sport: 'tennis', id: tennis.id, name: tennis.name, line: tennis.country, tier: tennis.tier, from: 'radar' });
  addPick({ sport: 'basketball', id: basket.id, name: basket.name, line: basket.team, tier: basket.tier, from: 'card' });
}

beforeEach(() => {
  localStorage.clear();
  resetAccounts();
  setLang('en');
  setTennisForTests(TENNIS_FILE);
  setBasketForTests(BASKET_FILE);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => new Response(JSON.stringify(sample(/data\/(\w+)\.json$/.exec(url)?.[1] ?? '')), { status: 200 })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  setTennisForTests(null);
  setBasketForTests(null);
  setLang('en');
});

describe('PDF report of My picks', () => {
  it('is offered on My picks, for the sport the list shows', async () => {
    await signInWithPicks();
    renderAt('/my-picks');
    expect(screen.getByRole('link', { name: 'Save as PDF report' })).toHaveAttribute('href', '/my-picks/report');
    await userEvent.click(screen.getByRole('button', { name: /^Tennis/ }));
    expect(screen.getByRole('link', { name: 'Save as PDF report' })).toHaveAttribute('href', '/my-picks/report?sport=tennis');
  });

  it('lists every saved player of every sport with his figures and the model’s reasons', async () => {
    await signInWithPicks();
    renderAt('/my-picks/report');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('4 players to watch');
    const ivan = await screen.findByRole('article', { name: 'Ivan Uzorak' });
    expect(within(ivan).getByText('€150k')).toBeInTheDocument();
    expect(within(ivan).getByText('Rating, of 100')).toBeInTheDocument();
    expect(within(ivan).getByText('From the similar players · saved', { exact: false })).toBeInTheDocument();
    expect(within(await screen.findByRole('article', { name: tennis.name })).getByText(`No. ${tennis.rank}`)).toBeInTheDocument();
    expect(within(await screen.findByRole('article', { name: basket.name })).getByText(basket.mpg.toFixed(1))).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Old Name' })).getByText(/Not in the current data/)).toBeInTheDocument();
    expect(document.title).toMatch(/^Fair Scout report – Ana – /);
  });

  it('keeps to one sport when asked and prints with the button', async () => {
    await signInWithPicks();
    const print = vi.fn();
    vi.stubGlobal('print', print);
    renderAt('/my-picks/report?sport=tennis');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('1 player to watch');
    expect(screen.queryByRole('heading', { name: /^Football/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Save as PDF' }));
    expect(print).toHaveBeenCalledOnce();
  });

  it('follows the language and asks a signed-out visitor to log in', async () => {
    renderAt('/my-picks/report');
    expect(screen.getByRole('heading', { name: 'Log in to make a report of your picks.' })).toBeInTheDocument();
  });

  it('is written in the chosen language', async () => {
    await signInWithPicks();
    setLang('bs');
    renderAt('/my-picks/report');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('4 igrača za praćenje');
    expect(screen.getByRole('button', { name: 'Spasi kao PDF' })).toBeInTheDocument();
  });
});
