import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RouterProvider, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frameRoutes } from '../src/App';
import { frame } from '../src/lib/text.en';
import { reloadAt } from '../src/lib/reload';

vi.mock('../src/lib/reload', () => ({ reloadAt: vi.fn() }));
import { FILE_NAMES, loadAll, loadFile } from '../src/lib/data';

const SAMPLES = resolve(__dirname, '../../contract/samples');
const sample = (name: string): unknown => JSON.parse(readFileSync(resolve(SAMPLES, `${name}.json`), 'utf8'));

type Overrides = Record<string, () => Response>;
function stubFetch(overrides: Overrides = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
    if (overrides[name]) return overrides[name]();
    return new Response(JSON.stringify(sample(name)), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderAt(path: string) {
  const router = createMemoryRouter(frameRoutes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  stubFetch();
});
afterEach(() => vi.unstubAllGlobals());

describe('loader', () => {
  it('accepts the five sample files', async () => {
    const data = await loadAll('./');
    expect(Object.keys(data).sort()).toEqual([...FILE_NAMES].sort());
    expect(data.players).toHaveLength(4);
    expect(data.meta.leagues).toBe(23);
  });

  it('rejects a file with a missing required field and names the file', async () => {
    const meta = sample('meta') as Record<string, unknown>;
    delete meta.source;
    stubFetch({ meta: () => new Response(JSON.stringify(meta), { status: 200 }) });
    await expect(loadFile('meta', './')).rejects.toMatchObject({ file: 'meta.json', kind: 'malformed' });
  });

  it('rejects a player record with a wrong field type and a missing file', async () => {
    const players = sample('players') as Record<string, unknown>[];
    players[1] = { ...players[1], in_pool: 'yes' };
    stubFetch({
      players: () => new Response(JSON.stringify(players), { status: 200 }),
      leagues: () => new Response('', { status: 404 }),
    });
    await expect(loadFile('players', './')).rejects.toMatchObject({ file: 'players.json', kind: 'malformed' });
    await expect(loadFile('leagues', './')).rejects.toMatchObject({ file: 'leagues.json', kind: 'missing' });
  });
});

describe('frame', () => {
  it('redirects the start address to /similar', async () => {
    const router = renderAt('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/similar'));
  });

  it('shows the not-found message with a link to /similar for an unknown address', async () => {
    renderAt('/nowhere');
    expect(await screen.findByText('This page does not exist.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the similar players' })).toHaveAttribute('href', '/similar');
  });

  it('lists the four sections in order and marks the active one', async () => {
    renderAt('/radar');
    const nav = await screen.findByRole('navigation', { name: 'Sections' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['01Similar', '02Radar', '03Time machine', '04Evidence']);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/similar', '/radar', '/time-machine', '/evidence']);
    expect(links.map((l) => l.getAttribute('aria-current'))).toEqual([null, 'page', null, null]);
    expect(screen.getByText('FAIR SCOUT')).toBeInTheDocument();
  });

  it('shows the loading state, then the source line from meta.json', async () => {
    renderAt('/similar');
    expect(screen.getByRole('status')).toHaveTextContent('Loading players');
    expect(screen.getByText('FAIR SCOUT')).toBeInTheDocument();
    const meta = sample('meta') as { source: string; leagues: number; seasons: string; built: string };
    const footer = await screen.findByText(/Data:/);
    expect(footer).toHaveTextContent(meta.source);
    expect(footer).toHaveTextContent(`${meta.leagues} leagues`);
    expect(footer).toHaveTextContent(meta.seasons);
    expect(footer).toHaveTextContent(meta.built.slice(0, 10));
  });

  it('shows the error block with the file name and no figures, and Try again loads anew', async () => {
    let broken = true;
    stubFetch({
      evidence: () => (broken ? new Response('{ not json', { status: 200 }) : new Response(JSON.stringify(sample('evidence')))),
    });
    renderAt('/similar');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The data could not be loaded.');
    expect(alert).toHaveTextContent('evidence.json');
    expect(screen.queryByText(/Data:/)).not.toBeInTheDocument();
    expect(screen.getByText('FAIR SCOUT')).toBeInTheDocument();
    expect(document.querySelector('.state-block')?.textContent).not.toMatch(/\d/);

    broken = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Who can you not afford?' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('scroll', () => {
  it('scrolls to the top on every change of route', async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const router = renderAt('/similar');
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 0));
    scrollTo.mockClear();
    await router.navigate('/radar');
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 0));
  });
});

describe('a screen that throws', () => {
  function Boom(): never {
    throw new Error('boom');
  }

  it('is replaced by an error block inside the frame, and the header stays', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = frameRoutes[0];
    const inner = root.children?.[0];
    const routes: RouteObject[] = [
      {
        path: '/',
        element: root.element,
        children: [{ errorElement: inner?.errorElement, children: [...(inner?.children ?? []), { path: 'boom', element: <Boom /> }] }],
      },
    ];
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/boom'] })} />);
    const block = await screen.findByRole('alert');
    expect(within(block).getByRole('heading', { level: 1 })).toHaveTextContent(frame.screenErrorTitle);
    await userEvent.click(within(block).getByRole('link', { name: frame.screenErrorLink }));
    expect(reloadAt).toHaveBeenCalledWith('#/similar');
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
    quiet.mockRestore();
  });
});
