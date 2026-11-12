import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../src/lib/data';
import { biggestRiser, edgeOverMinutes, budgetEntry, riserLink, riserTotals, risers } from '../src/lib/evidence';
import { money } from '../src/lib/format';
import { reset, setDetails } from '../src/lib/store';
import type { EvidenceFile, TimeMachineFile, TimeMachinePick, TimeMachineSeason } from '../src/lib/types';
import { Evidence } from '../src/screens/Evidence/Evidence';
import { TimeMachine } from '../src/screens/TimeMachine/TimeMachine';

const SAMPLES = resolve(__dirname, '../../contract/samples');
const sample = (name: string): unknown => JSON.parse(readFileSync(resolve(SAMPLES, `${name}.json`), 'utf8'));
const evidenceFile = sample('evidence') as EvidenceFile;
const tmFile = sample('timemachine') as TimeMachineFile;

const pick = (rank: number, id: string, later: number | null, then = 100_000): TimeMachinePick => ({
  rank, id, name: `Player ${id}`, club: 'Club', league: 'League', position: 'CF', age: 19,
  value_then: then, value_3y: later, made_it: later !== null && later >= 2 * then, value_peak: later ?? then, value_latest: later ?? then,
  history: [['2020-01-01', then]],
});
const season = (name: string, picks: TimeMachinePick[]): TimeMachineSeason => ({
  season: name, decision_date: '2020-06-30', outcome_date: '2023-06-30', trained_on: '', training_rows: 0, pool: 10, pool_rate: 0.1, hits: 0, picks,
});

function stubFetch(overrides: Record<string, () => Response> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      return overrides[name] ? overrides[name]() : new Response(JSON.stringify(sample(name)), { status: 200 });
    }),
  );
}

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

function renderEvidence() {
  render(
    <DataProvider>
      <MemoryRouter>
        <Where />
        <Evidence />
      </MemoryRouter>
    </DataProvider>,
  );
}

beforeEach(() => {
  reset();
  stubFetch();
});
afterEach(() => vi.unstubAllGlobals());

describe('the selection rule and the totals', () => {
  it('picks the highest later value of the season', () => {
    const s = season('A', [pick(1, 'a', 200_000), pick(2, 'b', 900_000), pick(3, 'c', 300_000)]);
    expect(biggestRiser(s)?.id).toBe('b');
  });

  it('never lets a missing later value win', () => {
    const s = season('A', [pick(1, 'a', null), pick(2, 'b', 150_000)]);
    expect(biggestRiser(s)?.id).toBe('b');
  });

  it('gives a tie to the better rank, whatever the order in the file', () => {
    const s = season('A', [pick(3, 'c', 500_000), pick(1, 'a', 500_000), pick(2, 'b', 500_000)]);
    expect(biggestRiser(s)?.id).toBe('a');
  });

  it('shows no tile for a season whose picks all lack a later value', () => {
    const file = { ...tmFile, seasons: [season('X', [pick(1, 'a', null)]), season('Y', [pick(1, 'b', 400_000)])] };
    expect(risers(file).map((r) => r.season.season)).toEqual(['Y']);
  });

  it('counts a missing later value as zero and as not made it', () => {
    const file = { ...tmFile, seasons: [season('Y', [pick(1, 'a', 400_000), pick(2, 'b', null), pick(3, 'c', 120_000)])] };
    expect(riserTotals(risers(file))).toEqual({ picks: 3, then: 300_000, later: 520_000, missed: 2, noLater: 1 });
  });
});

describe('the riser tiles', () => {
  it('shows season, name, club, both figures and today only for an older season', async () => {
    renderEvidence();
    const links = await screen.findAllByRole('link');
    const shown = risers(tmFile);
    expect(links).toHaveLength(shown.length);
    shown.forEach((r, i) => {
      const text = links[i].textContent ?? '';
      expect(text).toContain(r.season.season);
      expect(text).toContain(r.pick.name);
      expect(text).toContain(`${r.pick.club} · ${r.pick.league}`);
      expect(text).toContain(money(r.pick.value_then));
      expect(text).toContain(money(r.pick.value_3y as number));
      expect(text.includes(`today ${money(r.pick.value_latest)}`)).toBe(r.showToday);
    });
    expect(shown.some((r) => r.showToday)).toBe(true);
    expect(shown.some((r) => !r.showToday)).toBe(true);
  });

  it('writes the totals line from the file and the note about missing values only with details on', async () => {
    renderEvidence();
    const shown = risers(tmFile);
    const tot = riserTotals(shown);
    expect(await screen.findByText(`All ${tot.picks} picks of these ${shown.length} seasons: ${money(tot.then)} then, ${money(tot.later)} three years later. ${tot.missed} of them did not make it.`)).toBeTruthy();
    expect(screen.queryByText(/counts as zero in the later total/)).toBeNull();
    setDetails(true);
    expect(await screen.findByText(/counts as zero in the later total and as not made it/)).toBeTruthy();
  });

  it('links to the time machine with season, player and the outcome revealed, and opens with Enter', async () => {
    const [first] = risers(tmFile);
    expect(riserLink(first.season.season, first.pick.id)).toBe(`/time-machine?season=${encodeURIComponent(first.season.season)}&player=${first.pick.id}&revealed=1`);
    renderEvidence();
    const links = await screen.findAllByRole('link');
    expect(links[0].getAttribute('href')).toBe(riserLink(first.season.season, first.pick.id));
    links[0].focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('where').textContent).toBe(riserLink(first.season.season, first.pick.id));
  });
});

describe('the time machine opened from a riser', () => {
  function openAt(query: string) {
    render(
      <DataProvider>
        <MemoryRouter initialEntries={[`/time-machine${query}`]}>
          <TimeMachine />
        </MemoryRouter>
      </DataProvider>,
    );
  }

  it('shows that season, selects that player and shows the outcome', async () => {
    const s = tmFile.seasons[1];
    const target = s.picks[4];
    openAt(`?season=${encodeURIComponent(s.season)}&player=${target.id}&revealed=1`);
    const row = await screen.findByRole('row', { current: true });
    expect(row.textContent).toContain(target.name);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(`${s.hits} of the ${s.picks.length} made it`);
    expect(screen.getByRole('button', { name: new RegExp(s.season) }).getAttribute('aria-pressed')).toBe('true');
  });

  it('falls back to the defaults for unknown parameters', async () => {
    openAt('?season=1999%2F00&player=nobody&revealed=yes');
    const last = tmFile.seasons[tmFile.seasons.length - 1];
    const row = await screen.findByRole('row', { current: true });
    expect(row.textContent).toContain(last.picks[0].name);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(`The radar shows ${last.picks.length} players`);
  });
});

describe('what it cannot see', () => {
  it('shows the four labels and the sentence, and the list only with details on', async () => {
    renderEvidence();
    const card = (await screen.findByText('What it cannot see')).closest('section') as HTMLElement;
    for (const label of ['Character', 'Play off the ball', 'Injuries', 'The real price']) expect(within(card).getByText(label)).toBeTruthy();
    expect(within(card).getByText('It says who to watch, not who to sign.')).toBeTruthy();
    expect(screen.queryByText('Limits, in full')).toBeNull();
    setDetails(true);
    const list = (await screen.findByText('Limits, in full')).closest('section') as HTMLElement;
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThanOrEqual(5);
    expect(list.textContent).toMatch(/Regional leagues:.*two seasons of data.*six of them.*Norway and Sweden/);
  });

  it('says within the margin of error when the edge is not larger than the margin, and larger otherwise', async () => {
    const main = { ...budgetEntry(evidenceFile, 1_000_000)!, margin_pp: 8.4 };
    expect(edgeOverMinutes(main)).toEqual({ points: 8, margin: 8.4, within: true });
    const budgets = evidenceFile.backtest.budgets.map((b) => (b.budget_eur === 1_000_000 ? main : b));
    stubFetch({ evidence: () => new Response(JSON.stringify({ ...evidenceFile, backtest: { ...evidenceFile.backtest, budgets } }), { status: 200 }) });
    renderEvidence();
    setDetails(true);
    expect(await screen.findByText(/is 8 points, within the margin of error \(±8 points\)/)).toBeTruthy();
  });

  it('says larger than the margin of error when the data says so', async () => {
    const budgets = evidenceFile.backtest.budgets.map((b) => (b.budget_eur === 1_000_000 ? { ...b, margin_pp: 3 } : b));
    stubFetch({ evidence: () => new Response(JSON.stringify({ ...evidenceFile, backtest: { ...evidenceFile.backtest, budgets } }), { status: 200 }) });
    renderEvidence();
    setDetails(true);
    expect(await screen.findByText(/is 8 points, larger than the margin of error \(±3 points\)/)).toBeTruthy();
  });
});

describe('the edge with a measured margin', () => {
  it('prints whole points on both sides and compares the unrounded values', async () => {
    const budgets = evidenceFile.backtest.budgets.map((b) => (b.budget_eur === 1_000_000 ? { ...b, margin_pp: 7.761315044090593 } : b));
    stubFetch({ evidence: () => new Response(JSON.stringify({ ...evidenceFile, backtest: { ...evidenceFile.backtest, budgets } }), { status: 200 }) });
    renderEvidence();
    setDetails(true);
    expect(await screen.findByText(/is 8 points, (within|larger than) the margin of error \(±8 points\)/)).toBeTruthy();
  });
});

describe('the edge without the product model row', () => {
  it('leaves the sentence out when the logistic regression row is missing', async () => {
    const budgets = evidenceFile.backtest.budgets.map((b) => ({ ...b, rows: b.rows.filter((r) => r.rule !== 'model_lr') }));
    expect(edgeOverMinutes(budgets.find((b) => b.budget_eur === 1_000_000)!)).toBeNull();
    stubFetch({ evidence: () => new Response(JSON.stringify({ ...evidenceFile, backtest: { ...evidenceFile.backtest, budgets } }), { status: 200 }) });
    renderEvidence();
    setDetails(true);
    await screen.findByText('Limits, in full');
    expect(screen.queryByText(/Edge over/)).toBeNull();
  });
});

describe('with timemachine.json missing', () => {
  it('keeps the chart and the limits card and shows the error block in place of the risers', async () => {
    stubFetch({ timemachine: () => new Response('', { status: 404 }) });
    renderEvidence();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('timemachine.json')).toBeTruthy();
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(5));
    expect(screen.getByText('What it cannot see')).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
