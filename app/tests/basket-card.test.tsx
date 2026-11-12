import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { basketCard as t } from '../src/lib/basketball/cardText';
import { setBasketForTests } from '../src/lib/basketball/data';
import type { BasketFile, BasketPlayer } from '../src/lib/basketball/types';
import { reset, setOrigin } from '../src/lib/store';
import { BasketCard } from '../src/screens/Basketball/BasketCard';

const make = (id: string, over: Partial<BasketPlayer> = {}): BasketPlayer => ({
  id,
  name: `Name ${id}`,
  country: 'France',
  team: 'ASVEL',
  competition: 'EuroLeague',
  position: 'Guard',
  height_cm: 201,
  age: 20.6,
  games: 31,
  mpg: 15.9,
  ppg: 5.8,
  rpg: 3.5,
  apg: 2.2,
  pirpg: 6.2,
  pts40: 14.6,
  pir40: 15.6,
  score: 0.62,
  score_rank_pct: 90,
  tier: 'A',
  pct: { scoring: 70, impact: 70, trust: 70 },
  rating: 70,
  drivers: [
    { key: 'a', sign: '+', text: 'Plays in the EuroLeague' },
    { key: 'b', sign: '-', text: 'Few games so far' },
  ],
  flags: { under20: false, low_sample: false },
  history: [
    { season: '2024/25', team: 'Nanterre', competition: 'EuroCup', games: 12, mpg: 8.4, ppg: 3.1 },
    { season: '2025/26', team: 'ASVEL', competition: 'EuroLeague', games: 31, mpg: 15.9, ppg: 5.8 },
  ],
  ...over,
});

const tiers = { A: { n: 71, hits: 35 }, B: { n: 71, hits: 16 }, C: { n: 516, hits: 47 } };
const fileOf = (players: BasketPlayer[]) => ({ meta: { season: '2025/26', target_minutes: 20, backtest: { tiers } }, players, timemachine: [] }) as unknown as BasketFile;

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}
function renderCard(id: string) {
  render(
    <MemoryRouter initialEntries={[`/basketball/${id}`]}>
      <Routes>
        <Route path="/basketball/:id" element={<BasketCard />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  reset();
  setBasketForTests(fileOf([make('p1', { name: 'Ola Nordmann' })]));
});

describe('basketball card', () => {
  it('shows name, headline and the facts', () => {
    renderCard('p1');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ola Nordmann');
    expect(screen.getByText('Basketball · Guard · age 20 · ASVEL, EuroLeague · France')).toBeInTheDocument();
    for (const text of ['15.9', '5.8', '3.5', '2.2', '6.2']) expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    for (const label of ['Minutes a game', 'Points a game', 'Rebounds a game', 'Assists a game', 'Index rating a game']) expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getAllByText('season 2025/26, 31 games')).toHaveLength(5);
  });

  it('leaves out unknown parts of the headline', () => {
    setBasketForTests(fileOf([make('p2', { position: null, country: null })]));
    renderCard('p2');
    expect(screen.getByText('Basketball · age 20 · ASVEL, EuroLeague')).toBeInTheDocument();
  });

  it('shows the outlook with the past of the tier and the caution', () => {
    renderCard('p1');
    expect(screen.getByText('Model score 62 of 100 for a rotation role within three seasons.')).toBeInTheDocument();
    expect(screen.getByText('Of 71 past tier A players, 35 became rotation players within three seasons.')).toBeInTheDocument();
    expect(screen.getByText(/not a forecast for this one/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Tier A/ })).toBeInTheDocument();
  });

  it('lists the drivers with signs as text', () => {
    renderCard('p1');
    expect(screen.getByText('Plays in the EuroLeague')).toBeInTheDocument();
    expect(screen.getByText('Few games so far')).toBeInTheDocument();
    expect(screen.getByText('Helps:')).toBeInTheDocument();
    expect(screen.getByText('Hurts:')).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
    expect(screen.getByText('−')).toBeInTheDocument();
  });

  it('shows his seasons in a table', () => {
    renderCard('p1');
    expect(screen.getByText(t.seasonsLabel)).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('2024/25')).toBeInTheDocument();
    expect(screen.getByText('Nanterre')).toBeInTheDocument();
    expect(screen.getByText('EuroCup')).toBeInTheDocument();
    expect(screen.getByText('8.4')).toBeInTheDocument();
    expect(screen.queryByText(t.oneSeason)).not.toBeInTheDocument();
  });

  it('shows one line of text with a single season', () => {
    setBasketForTests(fileOf([make('p3', { history: [{ season: '2025/26', team: 'ASVEL', competition: 'EuroLeague', games: 31, mpg: 15.9, ppg: 5.8 }] })]));
    renderCard('p3');
    expect(screen.getByText(t.oneSeason)).toBeInTheDocument();
  });

  it('shows a not-found block with a way back', async () => {
    const user = userEvent.setup();
    renderCard('nope');
    expect(screen.getByText(t.notFoundTitle)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.notFoundButton }));
    expect(screen.getByTestId('where')).toHaveTextContent('/radar');
  });

  it('links back to the section it was opened from', () => {
    setOrigin('similar');
    renderCard('p1');
    expect(screen.getByRole('link', { name: t.backToSimilar })).toHaveAttribute('href', '/similar');
  });
});
