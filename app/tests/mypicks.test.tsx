import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { addPick, logout, register, resetAccounts } from '../src/lib/account';
import { getState } from '../src/lib/store';
import { MyPicks } from '../src/screens/Account/MyPicks';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}
function renderPicks() {
  render(
    <MemoryRouter initialEntries={['/my-picks']}>
      <Where />
      <Routes>
        <Route path="/my-picks" element={<MyPicks />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
const base = { line: 'Club', tier: 'B' as const, from: 'blind' as const };

beforeEach(() => {
  resetAccounts();
  localStorage.clear();
});

describe('My picks', () => {
  it('asks a signed-out visitor to log in', () => {
    renderPicks();
    expect(screen.getByText('Log in to keep your picks.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/account');
  });

  it('shows an empty list', async () => {
    await register('Ana', 'secret');
    renderPicks();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your list is empty.');
    expect(screen.getByText('Add players from the blind pick, the radar or a player card.')).toBeInTheDocument();
    expect(screen.getByText('Scout: Ana')).toBeInTheDocument();
  });

  it('groups by sport in the fixed order, newest first, with outlook and source', async () => {
    await register('Ana', 'secret');
    addPick({ ...base, sport: 'basketball', id: 'b1', name: 'Hoop One' });
    addPick({ ...base, sport: 'tennis', id: 't1', name: 'Serve One', tier: null, from: 'card' });
    addPick({ ...base, sport: 'football', id: 'f1', name: 'Kick Old', from: 'radar' });
    await new Promise((r) => setTimeout(r, 5));
    addPick({ ...base, sport: 'football', id: 'f2', name: 'Kick New' });
    renderPicks();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('4 players on your list.');
    const heads = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(heads).toEqual(['Football · 2', 'Tennis · 1', 'Basketball · 1']);
    const football = within(screen.getByRole('region', { name: 'Football · 2' })).getAllByRole('listitem');
    expect(football[0]).toHaveTextContent('Kick New');
    expect(football[1]).toHaveTextContent('Kick Old');
    expect(football[1]).toHaveTextContent('From the radar');
    const tennis = within(screen.getByRole('region', { name: 'Tennis · 1' })).getByRole('listitem');
    expect(tennis).toHaveTextContent('—');
    expect(tennis).toHaveTextContent('From the player card');
    expect(tennis).toHaveTextContent(/\d{1,2} [A-Z][a-z]{2} \d{4}/);
  });

  it('filters by sport', async () => {
    await register('Ana', 'secret');
    addPick({ ...base, sport: 'tennis', id: 't1', name: 'Serve One' });
    addPick({ ...base, sport: 'football', id: 'f1', name: 'Kick' });
    renderPicks();
    await userEvent.click(screen.getByRole('button', { name: /Tennis/ }));
    expect(screen.queryByText('Kick')).not.toBeInTheDocument();
    expect(screen.getByText('Serve One')).toBeInTheDocument();
  });

  it('removes a pick', async () => {
    await register('Ana', 'secret');
    addPick({ ...base, sport: 'football', id: 'f1', name: 'Kick' });
    renderPicks();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Kick' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your list is empty.');
  });

  it('links to the card and sets the sport', async () => {
    await register('Ana', 'secret');
    addPick({ ...base, sport: 'tennis', id: 't1', name: 'Serve One' });
    addPick({ ...base, sport: 'football', id: 'f1', name: 'Kick' });
    renderPicks();
    expect(screen.getByRole('link', { name: 'Kick' })).toHaveAttribute('href', '/player/f1');
    const link = screen.getByRole('link', { name: 'Serve One' });
    expect(link).toHaveAttribute('href', '/tennis/t1');
    await userEvent.click(link);
    expect(getState().sport).toBe('tennis');
    expect(screen.getByTestId('where')).toHaveTextContent('/tennis/t1');
    logout();
  });
});
