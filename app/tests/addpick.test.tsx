import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { register, resetAccounts, type SavedPick } from '../src/lib/account';
import { setBasketForTests } from '../src/lib/basketball/data';
import { DataProvider } from '../src/lib/data';
import { reset } from '../src/lib/store';
import { setTennisForTests } from '../src/lib/tennis/data';
import type { Player } from '../src/lib/types';
import { BasketBlindCompare } from '../src/screens/Basketball/BasketBlindCompare';
import { BasketCard } from '../src/screens/Basketball/BasketCard';
import { BasketRadar } from '../src/screens/Basketball/BasketRadar';
import { Compare } from '../src/screens/BlindPick/Compare';
import { PlayerCard } from '../src/screens/PlayerCard/PlayerCard';
import { Radar } from '../src/screens/Radar/Radar';
import { TennisBlindCompare } from '../src/screens/Tennis/TennisBlindCompare';
import { TennisCard } from '../src/screens/Tennis/TennisCard';
import { TennisRadar } from '../src/screens/Tennis/TennisRadar';
import { pickTrio as basketTrio } from '../src/lib/basketball/blind';
import { pickTrio as tennisTrio } from '../src/lib/tennis/blind';
import { FILE as BASKET_FILE, PLAYERS as BASKET_PLAYERS } from './basket-radar-fixture';
import { FILE as TENNIS_FILE, PLAYERS as TENNIS_PLAYERS } from './tennis-radar-fixture';
import { reset as resetBasketBlind } from '../src/lib/basketball/blindStore';
import { reset as resetTennisBlind } from '../src/lib/tennis/blindStore';
import type { Trio } from '../src/lib/trio';

const sample = (name: string): unknown => JSON.parse(readFileSync(resolve(__dirname, `../../contract/samples/${name}.json`), 'utf8'));
const footballers = sample('players') as Player[];

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

/** The signed-in scout's saved picks, read from the browser storage. */
function saved(): SavedPick[] {
  const book = JSON.parse(localStorage.getItem('fairscout.accounts') ?? '{}') as Record<string, { picks: SavedPick[] }>;
  return book['ana']?.picks ?? [];
}

const add = () => screen.getByRole('button', { name: /^\+ Add to my picks/ });

beforeEach(() => {
  localStorage.clear();
  resetAccounts();
  reset();
  resetTennisBlind();
  resetBasketBlind();
  setTennisForTests(TENNIS_FILE);
  setBasketForTests(BASKET_FILE);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      return new Response(JSON.stringify(sample(name)), { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function renderAt(path: string, route: string, element: React.ReactNode, withData = false) {
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
  render(withData ? <DataProvider>{tree}</DataProvider> : tree);
}

describe('add to my picks: football', () => {
  const [a, b, c] = footballers;
  const trio: Trio = { modelTop: b, rawTop: a, bestFit: c, order: [a, b, c] };

  it('shows no button on the blind dossiers before the reveal', () => {
    renderAt('/', '/', <Compare trio={trio} />);
    expect(screen.queryByRole('button', { name: /my picks|Log in to save/ })).toBeNull();
  });

  it('adds and removes a player from a revealed dossier', async () => {
    await register('ana', 'pass');
    renderAt('/', '/', <Compare trio={trio} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pick player A' }));
    const buttons = screen.getAllByRole('button', { name: /^\+ Add to my picks/ });
    expect(buttons).toHaveLength(3);
    await userEvent.click(buttons[1]);
    expect(saved()).toEqual([
      expect.objectContaining({ sport: 'football', id: b.id, name: b.name, line: `${b.club} · ${b.league_name}`, tier: b.tier, from: 'blind' }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: /^✓ In my picks/ }));
    expect(saved()).toEqual([]);
  });

  it('signed out, the revealed dossier asks for a login and adds nothing', async () => {
    renderAt('/', '/', <Compare trio={trio} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pick player A' }));
    const buttons = screen.getAllByRole('button', { name: 'Log in to save' });
    expect(buttons).toHaveLength(3);
    await userEvent.click(buttons[0]);
    expect(screen.getByTestId('where')).toHaveTextContent('/account');
    expect(JSON.parse(localStorage.getItem('fairscout.accounts') ?? '{}')).toEqual({});
  });

  it('adds from a radar row without opening the card, with the mouse and with the keyboard', async () => {
    await register('ana', 'pass');
    renderAt('/radar', '/radar', <Radar />, true);
    const table = await screen.findByRole('table', { name: /Players on the radar/ });
    const row = within(table).getAllByRole('row')[1];
    const button = within(row).getByRole('button', { name: /^Add to my picks: / });
    await userEvent.click(button);
    expect(screen.queryByTestId('where')).toBeNull();
    const [pick] = saved();
    const player = footballers.find((p) => p.id === pick.id) as Player;
    expect(pick).toMatchObject({ sport: 'football', name: player.name, line: `${player.club} · ${player.league_name}`, tier: player.tier, from: 'radar' });
    expect(within(row).getByRole('button', { name: /^In my picks: / })).toHaveAttribute('aria-pressed', 'true');
    within(row).getByRole('button', { name: /^In my picks: / }).focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByTestId('where')).toBeNull();
    expect(saved()).toEqual([]);
  });

  it('signed out, a radar row only shows the login words', async () => {
    renderAt('/radar', '/radar', <Radar />, true);
    const table = await screen.findByRole('table', { name: /Players on the radar/ });
    const row = within(table).getAllByRole('row')[1];
    await userEvent.click(within(row).getByRole('button', { name: /^Log in to save: / }));
    expect(screen.getByTestId('where')).toHaveTextContent('/account');
    expect(JSON.parse(localStorage.getItem('fairscout.accounts') ?? '{}')).toEqual({});
  });

  it('adds and removes from the player card', async () => {
    await register('ana', 'pass');
    const p = footballers[0];
    renderAt(`/player/${p.id}`, '/player/:id', <PlayerCard />, true);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(p.name));
    await userEvent.click(add());
    expect(saved()).toEqual([
      expect.objectContaining({ sport: 'football', id: p.id, name: p.name, line: `${p.club} · ${p.league_name}`, tier: p.tier, from: 'card' }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: /^✓ In my picks/ }));
    expect(saved()).toEqual([]);
  });

  it('signed out, the card shows the login words', async () => {
    const p = footballers[0];
    renderAt(`/player/${p.id}`, '/player/:id', <PlayerCard />, true);
    await userEvent.click(await screen.findByRole('button', { name: 'Log in to save' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/account');
    expect(JSON.parse(localStorage.getItem('fairscout.accounts') ?? '{}')).toEqual({});
  });
});

describe('add to my picks: tennis', () => {
  const trio = () => tennisTrio(TENNIS_PLAYERS, { maxAge: 30, hidden: 1, matters: [] })!;

  it('shows no button before the reveal, then adds from the dossier', async () => {
    await register('ana', 'pass');
    const t = trio();
    renderAt('/', '/', <TennisBlindCompare trio={t} />);
    expect(screen.queryByRole('button', { name: /my picks/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Pick player A' }));
    const buttons = screen.getAllByRole('button', { name: /^\+ Add to my picks/ });
    expect(buttons).toHaveLength(3);
    await userEvent.click(buttons[2]);
    const p = t.order[2];
    expect(saved()).toEqual([expect.objectContaining({ sport: 'tennis', id: p.id, name: p.name, line: p.country, tier: p.tier, from: 'blind' })]);
    await userEvent.click(screen.getByRole('button', { name: /^✓ In my picks/ }));
    expect(saved()).toEqual([]);
  });

  it('adds from a radar row without opening the card; signed out it adds nothing', async () => {
    renderAt('/radar', '/radar', <TennisRadar />);
    const row = within(screen.getByRole('table')).getAllByRole('row')[1];
    await userEvent.click(within(row).getByRole('button', { name: /^Log in to save: / }));
    expect(screen.getByTestId('where')).toHaveTextContent('/account');
    expect(JSON.parse(localStorage.getItem('fairscout.accounts') ?? '{}')).toEqual({});
  });

  it('signed in, a radar click saves the row and stays on the radar', async () => {
    await register('ana', 'pass');
    renderAt('/radar', '/radar', <TennisRadar />);
    const row = within(screen.getByRole('table')).getAllByRole('row')[1];
    await userEvent.click(within(row).getByRole('button', { name: /^Add to my picks: / }));
    expect(screen.queryByTestId('where')).toBeNull();
    const [pick] = saved();
    const p = TENNIS_PLAYERS.find((x) => x.id === pick.id)!;
    expect(pick).toMatchObject({ sport: 'tennis', name: p.name, line: p.country, tier: p.tier, from: 'radar' });
    await userEvent.click(within(row).getByRole('button', { name: /^In my picks: / }));
    expect(saved()).toEqual([]);
  });

  it('adds and removes from the card', async () => {
    await register('ana', 'pass');
    const p = TENNIS_PLAYERS[0];
    renderAt(`/tennis/${p.id}`, '/tennis/:id', <TennisCard />);
    await userEvent.click(add());
    expect(saved()).toEqual([expect.objectContaining({ sport: 'tennis', id: p.id, name: p.name, line: p.country, tier: p.tier, from: 'card' })]);
    await userEvent.click(screen.getByRole('button', { name: /^✓ In my picks/ }));
    expect(saved()).toEqual([]);
  });

  it('signed out, the card shows the login words', async () => {
    renderAt(`/tennis/${TENNIS_PLAYERS[0].id}`, '/tennis/:id', <TennisCard />);
    await userEvent.click(screen.getByRole('button', { name: 'Log in to save' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/account');
    expect(JSON.parse(localStorage.getItem('fairscout.accounts') ?? '{}')).toEqual({});
  });
});

describe('add to my picks: basketball', () => {
  const trio = () => basketTrio(BASKET_PLAYERS, { position: 'Any', maxAge: 30, hidden: 30, matters: [] })!;

  it('shows no button before the reveal, then adds from the dossier', async () => {
    await register('ana', 'pass');
    const t = trio();
    renderAt('/', '/', <BasketBlindCompare trio={t} minutes={10} />);
    expect(screen.queryByRole('button', { name: /my picks/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Pick player A' }));
    const buttons = screen.getAllByRole('button', { name: /^\+ Add to my picks/ });
    expect(buttons).toHaveLength(3);
    await userEvent.click(buttons[0]);
    const p = t.order[0];
    expect(saved()).toEqual([
      expect.objectContaining({ sport: 'basketball', id: p.id, name: p.name, line: `${p.team} · ${p.competition}`, tier: p.tier, from: 'blind' }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: /^✓ In my picks/ }));
    expect(saved()).toEqual([]);
  });

  it('signed out, a radar row only leads to the login', async () => {
    renderAt('/radar', '/radar', <BasketRadar />);
    const row = within(screen.getByRole('table')).getAllByRole('row')[1];
    await userEvent.click(within(row).getByRole('button', { name: /^Log in to save: / }));
    expect(screen.getByTestId('where')).toHaveTextContent('/account');
    expect(JSON.parse(localStorage.getItem('fairscout.accounts') ?? '{}')).toEqual({});
  });

  it('signed in, a radar click saves the row and stays on the radar', async () => {
    await register('ana', 'pass');
    renderAt('/radar', '/radar', <BasketRadar />);
    const row = within(screen.getByRole('table')).getAllByRole('row')[1];
    await userEvent.click(within(row).getByRole('button', { name: /^Add to my picks: / }));
    expect(screen.queryByTestId('where')).toBeNull();
    const [pick] = saved();
    const p = BASKET_PLAYERS.find((x) => x.id === pick.id)!;
    expect(pick).toMatchObject({ sport: 'basketball', name: p.name, line: `${p.team} · ${p.competition}`, tier: p.tier, from: 'radar' });
    await userEvent.click(within(row).getByRole('button', { name: /^In my picks: / }));
    expect(saved()).toEqual([]);
  });

  it('adds and removes from the card, signed out it asks for a login', async () => {
    const p = BASKET_PLAYERS[0];
    renderAt(`/basketball/${p.id}`, '/basketball/:id', <BasketCard />);
    await userEvent.click(screen.getByRole('button', { name: 'Log in to save' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/account');
    expect(JSON.parse(localStorage.getItem('fairscout.accounts') ?? '{}')).toEqual({});
  });

  it('signed in, the card saves and removes him', async () => {
    await register('ana', 'pass');
    const p = BASKET_PLAYERS[0];
    renderAt(`/basketball/${p.id}`, '/basketball/:id', <BasketCard />);
    await userEvent.click(add());
    expect(saved()).toEqual([
      expect.objectContaining({ sport: 'basketball', id: p.id, name: p.name, line: `${p.team} · ${p.competition}`, tier: p.tier, from: 'card' }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: /^✓ In my picks/ }));
    expect(saved()).toEqual([]);
  });
});
