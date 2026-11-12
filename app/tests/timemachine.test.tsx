import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../src/lib/data';
import { useKeys } from '../src/lib/keys';
import { reset, setDetails } from '../src/lib/store';
import { defaultSeason } from '../src/lib/timemachine';
import type { TimeMachineFile } from '../src/lib/types';
import { TimeMachine } from '../src/screens/TimeMachine/TimeMachine';

const SAMPLES = resolve(__dirname, '../../contract/samples');
const sample = (name: string): unknown => JSON.parse(readFileSync(resolve(SAMPLES, `${name}.json`), 'utf8'));

/** The sample file with the first pick of the latest season stripped of its later value, as a missing market value would be. */
function fixture(): TimeMachineFile {
  const file = structuredClone(sample('timemachine')) as TimeMachineFile;
  const latest = file.seasons[file.seasons.length - 1];
  const first = latest.picks[0];
  if (first.made_it) latest.hits -= 1;
  first.value_3y = null;
  first.made_it = false;
  return file;
}

function stubFetch(timemachine: () => Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      return name === 'timemachine' ? timemachine() : new Response(JSON.stringify(sample(name)), { status: 200 });
    }),
  );
}

function Keys() {
  useKeys();
  return null;
}

async function open(file: TimeMachineFile = fixture()) {
  stubFetch(async () => new Response(JSON.stringify(file), { status: 200 }));
  render(
    <DataProvider>
      <MemoryRouter initialEntries={['/time-machine']}>
        <Keys />
        <TimeMachine />
      </MemoryRouter>
    </DataProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  return file;
}

const list = () => screen.getByRole('table');
const marks = () => screen.queryAllByRole('img', { name: /^(made it|did not make it)$/ });
const hitMarks = () => screen.queryAllByRole('img', { name: 'made it' });
const reveal = () => userEvent.click(screen.getByRole('button', { name: /Show what happened/ }));

afterEach(() => {
  vi.unstubAllGlobals();
  reset();
});

describe('time machine', () => {
  it('offers four season buttons and defaults to the latest season in the file', async () => {
    const file = await open();
    const chips = within(screen.getByRole('group', { name: 'Season' })).getAllByRole('button');
    expect(chips).toHaveLength(4);
    const latest = defaultSeason(file);
    expect(chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.textContent)).toEqual([latest]);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      `June 2023. The radar shows ${file.seasons[3].picks.length} players under €1M.`,
    );
  });

  it('shows no later value, mark or today value before the reveal', async () => {
    await open();
    expect(marks()).toHaveLength(0);
    expect(within(list()).queryByText('today')).toBeNull();
    expect(document.querySelectorAll('.later:not(:empty), .today:not(:empty)')).toHaveLength(0);
  });

  it('reveals marks whose number equals the count in the title, and counts a missing later value as not made it', async () => {
    const file = await open();
    await reveal();
    const latest = file.seasons[3];
    expect(marks()).toHaveLength(latest.picks.length);
    expect(hitMarks()).toHaveLength(latest.hits);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`June 2026. ${latest.hits} of the ${latest.picks.length} made it.`);
    expect(screen.getByText(/Among all \d+ young players of that season: \d in 10\./)).toBeTruthy();
    const firstRow = screen.getAllByRole('row')[1];
    expect(within(firstRow).getByText('–')).toBeTruthy();
    expect(within(firstRow).getByRole('img', { name: 'did not make it' })).toBeTruthy();
  });

  it('shows the today column for an older season and not for the latest', async () => {
    await open();
    await reveal();
    expect(within(list()).queryByText('today')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^2019\/20/ }));
    expect(within(list()).getAllByText('today')).toHaveLength(2);
    expect(document.querySelectorAll('.tm-row:not(.tm-head) .today').length).toBe(22);
  });

  it('puts results on the season buttons only after the first reveal and keeps them when hidden again', async () => {
    const file = await open();
    const chips = () => within(screen.getByRole('group', { name: 'Season' })).getAllByRole('button');
    expect(chips().every((c) => c.querySelector('small') === null)).toBe(true);
    await reveal();
    expect(chips().map((c) => c.querySelector('small')?.textContent)).toEqual(
      file.seasons.map((s) => `${s.hits} of ${s.picks.length}`),
    );
    await userEvent.click(screen.getByRole('button', { name: /Back to June 2023/ }));
    expect(chips().every((c) => c.querySelector('small') !== null)).toBe(true);
  });

  it('keeps the revealed state when another season is chosen', async () => {
    const file = await open();
    await reveal();
    await userEvent.click(screen.getByRole('button', { name: /^2020\/21/ }));
    const s = file.seasons[1];
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`June 2024. ${s.hits} of the ${s.picks.length} made it.`);
  });

  it('toggles the reveal with the R key', async () => {
    await open();
    await userEvent.keyboard('r');
    expect(marks().length).toBeGreaterThan(0);
    await userEvent.keyboard('r');
    expect(marks()).toHaveLength(0);
  });

  it('states the method only with details on, with the training rows and the six-season total', async () => {
    const file = await open();
    expect(screen.queryByText(/How this list was made/)).toBeNull();
    setDetails(true);
    const text = await screen.findByText(/How this list was made/);
    const s = file.seasons[3];
    expect(text.textContent).toContain(s.trained_on);
    expect(text.textContent).toContain(s.training_rows.toLocaleString('en-US'));
    expect(text.textContent).toContain('no market value three years later counts as "did not make it"');
    const six = file.six_seasons;
    expect(text.textContent).toContain(
      `${six.tier_a_hits} of ${six.tier_a_picks} picks made it, against ${six.pool_hits} of ${six.pool_players.toLocaleString('en-US')}`,
    );
  });

  it('says so when the file has no season', async () => {
    const file = fixture();
    file.seasons = [];
    await open(file);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('No past season can be checked yet.');
    expect(screen.getByText('No past radars in the data.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open the evidence →' })).toBeTruthy();
  });

  it('shows the loading state while the file loads', async () => {
    stubFetch(() => new Promise<Response>(() => undefined));
    render(
      <DataProvider>
        <MemoryRouter initialEntries={['/time-machine']}>
          <TimeMachine />
        </MemoryRouter>
      </DataProvider>,
    );
    expect(await screen.findByText('Loading past radars…')).toBeTruthy();
    expect(screen.getByText('03 — Time machine')).toBeTruthy();
  });

  it('shows the error block with the file name and retries', async () => {
    let calls = 0;
    stubFetch(async () => {
      calls += 1;
      return calls === 1 ? new Response('', { status: 500 }) : new Response(JSON.stringify(fixture()), { status: 200 });
    });
    render(
      <DataProvider>
        <MemoryRouter initialEntries={['/time-machine']}>
          <TimeMachine />
        </MemoryRouter>
      </DataProvider>,
    );
    expect(await screen.findByText('timemachine.json')).toBeTruthy();
    expect(screen.getByText('The data could not be loaded.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Show what happened/ })).toBeTruthy());
  });
});
