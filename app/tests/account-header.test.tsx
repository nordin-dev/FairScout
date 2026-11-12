import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frameRoutes } from '../src/App';
import { addPick, resetAccounts, register } from '../src/lib/account';

const SAMPLES = resolve(__dirname, '../../contract/samples');

beforeEach(() => {
  resetAccounts();
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      return new Response(readFileSync(resolve(SAMPLES, `${name}.json`), 'utf8'), { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const header = () => screen.getByRole('banner');
const renderAt = (path: string) => render(<RouterProvider router={createMemoryRouter(frameRoutes, { initialEntries: [path] })} />);

describe('header account chips', () => {
  it('shows a Log in chip when signed out', async () => {
    renderAt('/account');
    expect(within(header()).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/account');
    expect(within(header()).queryByRole('link', { name: /My picks/ })).not.toBeInTheDocument();
  });

  it('shows My picks with the count and the scout name when signed in', async () => {
    await register('Ana', 'secret');
    addPick({ sport: 'football', id: 'f1', name: 'Kick', line: 'Club', tier: 'A', from: 'blind' });
    renderAt('/similar');
    expect(within(header()).getByRole('link', { name: 'My picks 1' })).toHaveAttribute('href', '/my-picks');
    const name = within(header()).getByRole('link', { name: 'Ana' });
    expect(name).toHaveAttribute('href', '/account');
    expect(within(header()).getByRole('button', { name: /Details/i })).toBeInTheDocument();
    await userEvent.click(within(header()).getByRole('link', { name: 'My picks 1' }));
    expect(await screen.findByText('1 player on your list.')).toBeInTheDocument();
  });
});
