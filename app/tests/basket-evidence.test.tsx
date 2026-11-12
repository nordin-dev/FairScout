import { MemoryRouter } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBasketForTests } from '../src/lib/basketball/data';
import { evidenceOf, seasonOf, tallyOf, verdictOf, weightLines } from '../src/lib/basketball/evidence';
import { reset, setDetails } from '../src/lib/store';
import { BasketEvidence } from '../src/screens/Basketball/BasketEvidence';
import { BACKTEST, FILE, META, WEIGHTS } from './basket-evidence-fixture';

const withRules = (model: number, pir: number) => ({
  ...BACKTEST,
  rules: BACKTEST.rules.map((r) => (r.key === 'model' ? { ...r, hits: model, rate_pct: (model / 28) * 100 } : r.key === 'pir' ? { ...r, hits: pir, rate_pct: (pir / 28) * 100 } : r)),
});

const renderScreen = () =>
  render(
    <MemoryRouter>
      <BasketEvidence />
    </MemoryRouter>,
  );

beforeEach(() => {
  reset();
  setBasketForTests(FILE);
});
afterEach(() => {
  setBasketForTests(null);
  vi.unstubAllGlobals();
});

describe('basketball evidence logic', () => {
  it('gives the margin verdicts', () => {
    expect(evidenceOf(BACKTEST).verdict).toBe('inside');
    expect(evidenceOf(withRules(20, 10)).verdict).toBe('ahead');
    expect(evidenceOf(withRules(9, 10)).verdict).toBe('behind');
    expect(evidenceOf({ ...BACKTEST, rules: [] }).verdict).toBe('none');
    expect(verdictOf(null, 5)).toBe('none');
  });

  it('names the strongest other rule as the rival', () => {
    expect(evidenceOf(BACKTEST).rival?.key).toBe('pir');
  });

  it('tallies the seasons', () => {
    expect(tallyOf(evidenceOf(BACKTEST).byYear)).toEqual({ ahead: 1, level: 1, behind: 1, years: 3 });
  });

  it('words a start year as a season', () => {
    expect(seasonOf(2013)).toBe('2013/14');
    expect(seasonOf(2022)).toBe('2022/23');
  });

  it('reads the direction of each weight', () => {
    expect(weightLines(WEIGHTS)).toEqual([
      { key: 'age', positive: true },
      { key: 'mpg', positive: true },
      { key: 'pir40', positive: false },
      { key: 'pts40', positive: true },
      { key: 'games', positive: true },
      { key: 'euroleague', positive: true },
    ]);
    expect(weightLines({})).toEqual([]);
  });
});

describe('basketball evidence screen', () => {
  it('shows the title, lede and hero numbers', () => {
    renderScreen();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('14 of the model’s 28 top picks became rotation players. The pool average is 12.5%.');
    expect(screen.getByText('3 past pools, seasons 2013/14 to 2015/16. Each scored by a model that had seen only earlier seasons.')).toBeInTheDocument();
    expect(screen.getAllByTestId('pair-figure').map((f) => f.textContent)).toEqual(['50%', '12.5%']);
    expect(screen.getByText('Model’s top 10%: 14 of 28')).toBeInTheDocument();
    expect(screen.getByText('Whole pool: 34 of 272')).toBeInTheDocument();
  });

  it('draws the rules and says the lead is inside the margin', () => {
    renderScreen();
    expect(screen.getByRole('img', { name: /Model: 14 of 28/ })).toBeInTheDocument();
    expect(
      screen.getByText('Picking by best index rating per game alone gives 10 of 28. The model’s lead over it is inside the margin of ±15 points: we cannot claim it beats that rule.'),
    ).toBeInTheDocument();
  });

  it('words the other two verdicts', () => {
    setBasketForTests({ ...FILE, meta: { ...META, backtest: withRules(20, 10) } });
    const { unmount } = renderScreen();
    expect(screen.getByText(/lead over it, 35\.7 points, is larger than the margin of ±15 points/)).toBeInTheDocument();
    unmount();
    setBasketForTests({ ...FILE, meta: { ...META, backtest: withRules(9, 10) } });
    renderScreen();
    expect(screen.getByText('Picking by best index rating per game alone gives 10 of 28. The model is not ahead of it.')).toBeInTheDocument();
  });

  it('shows the three tier lines', () => {
    renderScreen();
    expect(screen.getByText('Tier A')).toBeInTheDocument();
    expect(screen.getByText('14 of 28 became rotation players (50%)')).toBeInTheDocument();
    expect(screen.getByText('6 of 28 became rotation players (21%)')).toBeInTheDocument();
    expect(screen.getByText('14 of 216 became rotation players (6%)')).toBeInTheDocument();
  });

  it('shows the season table and its tally', () => {
    renderScreen();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('2013');
    expect(rows[1]).toHaveTextContent('5 of 11');
    expect(rows[1]).toHaveTextContent('2 of 11');
    expect(screen.getByText('The model’s top 10% was ahead of the most-minutes rule’s in 1 of 3 seasons, level in 1, behind in 1.')).toBeInTheDocument();
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
    expect(screen.getByText(/fitted only on pools whose three following seasons had already ended/)).toBeInTheDocument();
    expect(screen.getByText('older: higher score')).toBeInTheDocument();
    expect(screen.getByText('a lower index rating per 40 minutes: higher score')).toBeInTheDocument();
    expect(screen.getByText('playing in the EuroLeague rather than the EuroCup: higher score')).toBeInTheDocument();
    expect(screen.getByText('The outcome is playing time, not money.')).toBeInTheDocument();
    expect(screen.getByText(/NBA or to a league outside these two competitions counts as not reached/)).toBeInTheDocument();
    expect(screen.getByText('Test source caption')).toBeInTheDocument();
  });

  it('shows a loading note, then an error with retry', async () => {
    setBasketForTests(null);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    renderScreen();
    expect(screen.getByText('Loading the test…')).toBeInTheDocument();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The basketball test did not arrive.');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
