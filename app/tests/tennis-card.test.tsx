import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { RankChart } from '../src/components/RankChart';
import { reset, setOrigin } from '../src/lib/store';
import { chartLayout } from '../src/lib/tennis/cardChart';
import { tennisCard as t } from '../src/lib/tennis/cardText';
import { setTennisForTests } from '../src/lib/tennis/data';
import { TennisCard } from '../src/screens/Tennis/TennisCard';
import { FILE, META, PLAYERS, make } from './tennis-radar-fixture';

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}
function renderCard(id: string) {
  render(
    <MemoryRouter initialEntries={[`/tennis/${id}`]}>
      <Routes>
        <Route path="/tennis/:id" element={<TennisCard />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  reset();
  setTennisForTests(FILE);
});

describe('tennis card', () => {
  it('shows name, headline and the facts', () => {
    const p = make('c1', { name: 'Ola Nordmann', rank: 122, rank_year_ago: 309, wins: 53, losses: 31, top200_wins: 20, best_win_rank: 45, age: 19.8 });
    setTennisForTests({ meta: META, players: [...PLAYERS, p] , timemachine: [] });
    renderCard('c1');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ola Nordmann');
    expect(screen.getByText('Tennis · age 19 · Norway · right-handed')).toBeInTheDocument();
    for (const text of ['No. 122', 'No. 309', '53–31', '20', 'No. 45']) expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('shows dashes for unknown values and leaves out an unknown hand', () => {
    setTennisForTests({ meta: META, players: [make('c2', { rank_year_ago: null, best_win_rank: null, hand: null })] , timemachine: [] });
    renderCard('c2');
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByText('Tennis · age 19 · Norway')).toBeInTheDocument();
  });

  it('shows the outlook with the past of the tier and the caution', () => {
    renderCard('t1');
    expect(screen.getByText('Model score 90 of 100 for a top-100 ranking within three years.')).toBeInTheDocument();
    expect(screen.getByText('Of 99 past tier A players, 70 reached the top 100 within three years.')).toBeInTheDocument();
    expect(screen.getByText(/not a forecast for this one/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Tier A/ })).toBeInTheDocument();
  });

  it('lists the drivers with signs as text', () => {
    renderCard('t1');
    expect(screen.getByText('Wins most of his matches')).toBeInTheDocument();
    expect(screen.getByText('Older than most of the pool')).toBeInTheDocument();
    expect(screen.getByText('Helps:')).toBeInTheDocument();
    expect(screen.getByText('Hurts:')).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
    expect(screen.getByText('−')).toBeInTheDocument();
  });

  it('draws the chart with a text alternative', () => {
    renderCard('t1');
    expect(screen.getByRole('img', { name: 'Ranking from No. 400 on 1 Jun 2025 to No. 200 on 8 Jun 2026.' })).toBeInTheDocument();
    expect(screen.getByText('Top 100')).toBeInTheDocument();
  });

  it('shows one line instead of a chart with fewer than two points', () => {
    setTennisForTests({ meta: META, players: [make('c3', { rank_history: [{ date: '2026-06-08', rank: 200 }] })], timemachine: [] });
    renderCard('c3');
    expect(screen.getByText(t.chartEmpty)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Ranking from/ })).not.toBeInTheDocument();
  });

  it('shows a not-found block with a way back', async () => {
    const user = userEvent.setup();
    renderCard('nope');
    expect(screen.getByText(t.notFoundTitle)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.notFoundButton }));
    expect(screen.getByTestId('where')).toHaveTextContent('/radar');
  });

  it('links back to the section it was opened from', () => {
    setOrigin('blind');
    renderCard('t1');
    expect(screen.getByRole('link', { name: t.backToBlind })).toHaveAttribute('href', '/blind');
  });
});

describe('rank chart scales', () => {
  it('puts the better ranking higher and rank 100 inside the chart', () => {
    const L = chartLayout(
      [
        { date: '2025-01-01', rank: 800 },
        { date: '2025-07-01', rank: 300 },
        { date: '2026-01-01', rank: 150 },
      ],
      100,
    );
    expect(L).not.toBeNull();
    if (!L) return;
    expect(L.last.y).toBeLessThan(L.first.y);
    expect(L.refY).toBeLessThan(L.last.y);
    expect(L.last.x).toBeGreaterThan(L.first.x);
  });

  it('returns null for fewer than two points', () => {
    expect(chartLayout([{ date: '2026-01-01', rank: 150 }], 100)).toBeNull();
    render(<RankChart points={[]} reference={100} referenceLabel="x" rankLabel={String} describe={() => ''} empty="Nothing" />);
    expect(screen.getByText('Nothing')).toBeInTheDocument();
  });
});
