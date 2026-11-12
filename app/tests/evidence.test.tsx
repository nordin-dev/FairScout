import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scaleMax } from '../src/components/BarRanking';
import { DataProvider } from '../src/lib/data';
import { budgetEntry, chartForBudget } from '../src/lib/evidence';
import { reset, setDetails } from '../src/lib/store';
import type { EvidenceFile } from '../src/lib/types';
import { Evidence } from '../src/screens/Evidence/Evidence';

const SAMPLES = resolve(__dirname, '../../contract/samples');
const sample = (name: string): unknown => JSON.parse(readFileSync(resolve(SAMPLES, `${name}.json`), 'utf8'));
const file = sample('evidence') as EvidenceFile;
const main = budgetEntry(file, 1_000_000)!;

function stub(evidence: () => Response = () => new Response(JSON.stringify(file), { status: 200 })) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      return name === 'evidence' ? evidence() : new Response(JSON.stringify(sample(name)), { status: 200 });
    }),
  );
}

function renderScreen() {
  render(
    <DataProvider>
      <MemoryRouter>
        <Evidence />
      </MemoryRouter>
    </DataProvider>,
  );
}

beforeEach(() => {
  reset();
  stub();
});
afterEach(() => vi.unstubAllGlobals());

describe('chartForBudget', () => {
  it('builds the five rows in the fixed order', () => {
    expect(chartForBudget(main).bars.map((b) => b.label)).toEqual([
      'Fair Scout', 'Most minutes', 'Most goals', 'Youngest', 'Cheapest',
    ]);
  });

  it('joins the two model types into one range from the lower to the higher rate', () => {
    const [model] = chartForBudget(main).bars;
    expect(model.value).toBe(0.474);
    expect(model.upper).toBe(0.526);
    expect(model.printed).toBe('47–53%');
    expect(model.emphasis).toBe(true);
  });

  it('prints one figure when both rates round alike', () => {
    const rows = main.rows.map((r) => (r.rule === 'model_gb' ? { ...r, rate: 0.53 } : r));
    expect(chartForBudget({ ...main, rows }).bars[0].printed).toBe('53%');
  });

  it('leaves out a missing rule and keeps the order', () => {
    const rows = main.rows.filter((r) => r.rule !== 'most_goals_assists');
    expect(chartForBudget({ ...main, rows }).bars.map((b) => b.label)).toEqual([
      'Fair Scout', 'Most minutes', 'Youngest', 'Cheapest',
    ]);
  });

  it('carries hits and picks in the tips and the base rate in the reference', () => {
    const chart = chartForBudget(main);
    expect(chart.bars[0].tip).toBe('Logistic regression 53% (70 of 133). Gradient boosting 47% (63 of 133).');
    expect(chart.bars[1].tip).toBe('59 of 133');
    expect(chart.reference).toEqual({ value: 0.296, label: 'Average player 30%' });
    expect(chartForBudget(main, true).reference.label).toBe('Average 30%');
  });
});

describe('Evidence screen', () => {
  it('draws the reference line on the same scale as the bars', async () => {
    renderScreen();
    const line = await screen.findByTestId('bar-ref');
    const { bars, reference } = chartForBudget(main);
    const max = scaleMax(bars, reference.value);
    expect(line.getAttribute('style')).toContain(`${Math.round((reference.value / max) * 10000) / 100}%`);
    expect(screen.getAllByRole('img')).toHaveLength(5);
  });

  it('lists label and value of each row as a text alternative', async () => {
    renderScreen();
    const rows = await screen.findAllByRole('img');
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/^Fair Scout: 47–53%\./),
      expect.stringMatching(/^Most minutes: 44%\./),
      expect.stringMatching(/^Most goals: 36%\./),
      expect.stringMatching(/^Youngest: 36%\./),
      expect.stringMatching(/^Cheapest: 12%\./),
    ]);
    expect(rows[0].tabIndex).toBe(0);
  });

  it('shows the caption and the small chart only with details on', async () => {
    renderScreen();
    await screen.findByText('Does it work? We tested it on the past.');
    expect(screen.queryByText('Tighter budget, same picture')).toBeNull();
    expect(screen.queryByText(/margin about/)).toBeNull();
    setDetails(true);
    expect(await screen.findByText('Tighter budget, same picture')).toBeTruthy();
    expect(screen.getByText(/6 test seasons, 2017\/18 to 2022\/23\..*133 picks per rule, margin about ±8 points/)).toBeTruthy();
    expect(screen.getByText(/Up to €500k · 732 players, 74 picks per rule · ±11 points/)).toBeTruthy();
    expect(screen.getAllByRole('img').filter((e) => e.classList.contains('bar-row'))).toHaveLength(10);
  });

  it('says so and shows no number when the file holds no test rows', async () => {
    const empty = { ...file, backtest: { ...file.backtest, budgets: file.backtest.budgets.map((b) => ({ ...b, rows: [] })) } };
    stub(() => new Response(JSON.stringify(empty), { status: 200 }));
    renderScreen();
    expect(await screen.findByText('The test on past seasons has not been run.')).toBeTruthy();
    expect(screen.queryAllByRole('img')).toHaveLength(0);
    expect(screen.queryByTestId('bar-ref')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d%/);
  });

  it('shows the loading layout and then the error block with the file name', async () => {
    stub(() => new Response('', { status: 404 }));
    renderScreen();
    expect(screen.getByText('Loading test results…')).toBeTruthy();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('evidence.json')).toBeTruthy();
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeTruthy();
    await waitFor(() => expect(screen.queryAllByRole('img')).toHaveLength(0));
  });
});

describe('the margin of error in whole points', () => {
  const withMargins = (main: number, small: number) => {
    const budgets = file.backtest.budgets.map((b) =>
      b.budget_eur === 1_000_000 ? { ...b, margin_pp: main } : b.budget_eur === 500_000 ? { ...b, margin_pp: small } : b,
    );
    stub(() => new Response(JSON.stringify({ ...file, backtest: { ...file.backtest, budgets } }), { status: 200 }));
  };

  it('prints a measured margin as a whole number in the caption and the small chart', async () => {
    withMargins(7.761315044090593, 9.55658414352988);
    renderScreen();
    setDetails(true);
    expect(await screen.findByText(/margin about ±8 points\./)).toBeTruthy();
    expect(screen.getByText(/· ±10 points/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d\.\d{3}/);
  });
});
