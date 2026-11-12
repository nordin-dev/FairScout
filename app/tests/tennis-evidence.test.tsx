import { MemoryRouter } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reset, setDetails } from '../src/lib/store';
import { setTennisForTests } from '../src/lib/tennis/data';
import { evidenceOf, tallyOf, verdictOf, weightLines } from '../src/lib/tennis/evidence';
import type { TennisFile } from '../src/lib/tennis/types';
import { TennisEvidence } from '../src/screens/Tennis/TennisEvidence';
import { FILE, META } from './tennis-radar-fixture';

const BY_YEAR = [
  { year: 2017, pool: 169, pool_hits: 21, picked: 17, model_hits: 14, rank_hits: 11 },
  { year: 2018, pool: 159, pool_hits: 15, picked: 16, model_hits: 9, rank_hits: 9 },
  { year: 2019, pool: 150, pool_hits: 18, picked: 15, model_hits: 8, rank_hits: 10 },
];
const WEIGHTS = { age: -0.75, log_rank: -0.056, win_pct: 0.789, upper_share: 0.679, log_top200_wins: 0.57 };
const META2 = { ...META, weights: WEIGHTS, backtest: { ...META.backtest, by_year: BY_YEAR } };
const FILE2: TennisFile = { ...FILE, meta: META2 };

const withRules = (model: number, rank: number) => ({
  ...META.backtest,
  rules: META.backtest.rules.map((r) => (r.key === 'model' ? { ...r, hits: model, rate_pct: (model / 99) * 100 } : r.key === 'rank' ? { ...r, hits: rank, rate_pct: (rank / 99) * 100 } : r)),
});

function renderScreen() {
  render(
    <MemoryRouter>
      <TennisEvidence />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  reset();
  setTennisForTests(FILE2);
});
afterEach(() => vi.unstubAllGlobals());

describe('tennis evidence logic', () => {
  it('gives the three margin verdicts', () => {
    expect(evidenceOf(META.backtest).verdict).toBe('inside');
    expect(evidenceOf(withRules(80, 64)).verdict).toBe('ahead');
    expect(evidenceOf(withRules(60, 64)).verdict).toBe('behind');
    expect(evidenceOf({ ...META.backtest, rules: [] }).verdict).toBe('none');
    expect(verdictOf(null, 5)).toBe('none');
  });

  it('tallies the years', () => {
    expect(tallyOf(evidenceOf(META2.backtest).byYear)).toEqual({ ahead: 1, level: 1, behind: 1, years: 3 });
  });

  it('reads the direction of each weight', () => {
    expect(weightLines(WEIGHTS)).toEqual([
      { key: 'age', positive: false },
      { key: 'log_rank', positive: false },
      { key: 'win_pct', positive: true },
      { key: 'upper_share', positive: true },
      { key: 'log_top200_wins', positive: true },
    ]);
    expect(weightLines({})).toEqual([]);
  });
});

describe('tennis evidence screen', () => {
  it('shows the title, lede and hero numbers', () => {
    renderScreen();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('70 of the model’s 99 top picks reached the top 100. The pool average is 13.5%.');
    expect(screen.getByText('3 pools, 2017 to 2023. Each scored by a model that had seen only earlier years.')).toBeInTheDocument();
    const figures = screen.getAllByTestId('pair-figure').map((f) => f.textContent);
    expect(figures).toEqual(['71%', '13.5%']);
    expect(screen.getByText('Model’s top 10%: 70 of 99')).toBeInTheDocument();
    expect(screen.getByText('Whole pool: 131 of 971')).toBeInTheDocument();
  });

  it('draws the rules and says the lead is inside the margin', () => {
    renderScreen();
    expect(screen.getByRole('img', { name: /Model: 70 of 99/ })).toBeInTheDocument();
    expect(
      screen.getByText('Picking by best ranking alone gives 64 of 99. The model’s lead over it is inside the margin of ±6.7 points: we cannot claim it beats that rule.'),
    ).toBeInTheDocument();
  });

  it('words the other two verdicts', () => {
    setTennisForTests({ ...FILE2, meta: { ...META2, backtest: withRules(80, 64) } });
    const { unmount } = render(<MemoryRouter><TennisEvidence /></MemoryRouter>);
    expect(screen.getByText(/lead over it, 16\.2 points, is larger than the margin of ±6\.7 points/)).toBeInTheDocument();
    unmount();
    setTennisForTests({ ...FILE2, meta: { ...META2, backtest: withRules(60, 64) } });
    renderScreen();
    expect(screen.getByText('Picking by best ranking alone gives 64 of 99. The model is not ahead of it.')).toBeInTheDocument();
  });

  it('shows the three tier lines', () => {
    renderScreen();
    expect(screen.getByText('Tier A')).toBeInTheDocument();
    expect(screen.getByText('70 of 99 reached the top 100 (71%)')).toBeInTheDocument();
    expect(screen.getByText('23 of 99 reached the top 100 (23%)')).toBeInTheDocument();
    expect(screen.getByText('38 of 773 reached the top 100 (5%)')).toBeInTheDocument();
  });

  it('shows the year table and its tally', () => {
    renderScreen();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('2017');
    expect(rows[1]).toHaveTextContent('14 of 17');
    expect(rows[1]).toHaveTextContent('11 of 17');
    expect(screen.getByText('The model’s top 10% was ahead of the best ranking’s in 1 of 3 years, level in 1, behind in 1.')).toBeInTheDocument();
  });

  it('hides the method until Details is on', () => {
    renderScreen();
    expect(screen.queryByText('How it was tested')).not.toBeInTheDocument();
    expect(screen.queryByText('Test source caption')).not.toBeInTheDocument();
  });

  it('shows the method, inputs, limits and source with Details on', () => {
    setDetails(true);
    renderScreen();
    expect(screen.getByText('How it was tested')).toBeInTheDocument();
    expect(screen.getByText(/fitted only on pools whose three years had already ended/)).toBeInTheDocument();
    expect(screen.getByText('younger: higher score')).toBeInTheDocument();
    expect(screen.getByText('a better ranking: higher score')).toBeInTheDocument();
    expect(screen.getByText('a higher win rate: higher score')).toBeInTheDocument();
    expect(screen.getByText('The data ends on 8 Jun 2026.')).toBeInTheDocument();
    expect(screen.getByText('Picking by best ranking alone is nearly as good.')).toBeInTheDocument();
    expect(screen.getByText('Test source caption')).toBeInTheDocument();
  });

  it('shows a loading note, then an error with retry', async () => {
    setTennisForTests(null);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    renderScreen();
    expect(screen.getByText('Loading the test…')).toBeInTheDocument();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The tennis test did not arrive.');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
