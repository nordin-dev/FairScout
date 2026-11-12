import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../src/lib/data';
import { bornLateTimes, dotsOf, pickDrivers } from '../src/lib/outlook';
import { reset, setDetails } from '../src/lib/store';
import { player as t } from '../src/lib/text.en';
import type { EvidenceFile, Flags, Player } from '../src/lib/types';
import { PlayerCard } from '../src/screens/PlayerCard/PlayerCard';

const SAMPLES = resolve(__dirname, '../../contract/samples');
const sample = (name: string): unknown => JSON.parse(readFileSync(resolve(SAMPLES, `${name}.json`), 'utf8'));
const players = sample('players') as Player[];
const evidence = sample('evidence') as EvidenceFile;
const base = players.find((p) => p.id === 'sample-a') as Player;

function renderCard(list: Player[], ev: EvidenceFile = evidence) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      const body = name === 'players' ? list : name === 'evidence' ? ev : sample(name);
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
  render(
    <DataProvider>
      <MemoryRouter initialEntries={[`/player/${list[0].id}`]}>
        <Routes>
          <Route path="/player/:id" element={<PlayerCard />} />
        </Routes>
      </MemoryRouter>
    </DataProvider>,
  );
}

const panel = (label: string) => screen.getByText(label).closest('section') as HTMLElement;
const noFlags: Flags = { under18: false, low_sample: false, contract_ending: false, born_q4: false, limited_position_data: false };

beforeEach(reset);
afterEach(() => vi.unstubAllGlobals());

describe('outlook', () => {
  it('rounds a rate to whole dots: 0.53 gives 5, 0.30 gives 3', () => {
    expect(dotsOf(0.53)).toBe(5);
    expect(dotsOf(0.3)).toBe(3);
  });

  it('shows the tier and both rows from the evidence file', async () => {
    renderCard([base]);
    await screen.findByRole('heading', { name: base.name });
    const outlook = within(panel('Outlook'));
    expect(outlook.getByText('Tier A')).toBeInTheDocument();
    expect(outlook.getByText('5 in 10')).toBeInTheDocument();
    expect(outlook.getByText('3 in 10')).toBeInTheDocument();
    expect(outlook.getByText(/players like him made it/)).toBeInTheDocument();
    expect(outlook.getByText(/for the average young player/)).toBeInTheDocument();
    expect(outlook.getByRole('img', { name: '5 of 10' })).toBeInTheDocument();
    expect(outlook.getByRole('img', { name: '3 of 10' })).toBeInTheDocument();
  });

  it('shows the exact counts only with details on', async () => {
    renderCard([base]);
    await screen.findByText('Tier A');
    expect(screen.queryByText(/70 of 133/)).not.toBeInTheDocument();
    setDetails(true);
    expect(await screen.findByText(/70 of 133 past players the model put in tier A, against 395 of all 1,333/)).toBeInTheDocument();
  });

  it('shows no tier, no dots and the not-rated line outside the pool', async () => {
    renderCard([{ ...base, in_pool: false, tier: null, drivers: [], flags: noFlags }]);
    await screen.findByRole('heading', { name: base.name });
    expect(screen.getByText('Not rated: outside the radar pool.')).toBeInTheDocument();
    expect(screen.queryByText(/Tier [ABC]/)).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('Why')).not.toBeInTheDocument();
  });

  it('shows the error block and no figures when the evidence has no 1M budget, and keeps the header', async () => {
    const broken = { ...evidence, backtest: { ...evidence.backtest, budgets: [] } };
    renderCard([base], broken);
    expect(await screen.findByRole('heading', { name: base.name })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('evidence.json');
    expect(screen.queryByText('Tier A')).not.toBeInTheDocument();
    expect(screen.queryByText(/in 10/)).not.toBeInTheDocument();
    expect(screen.getByText('How we rate him')).toBeInTheDocument();
  });
});

describe('why', () => {
  it('keeps at most three plus and one minus reason, each with its sign', async () => {
    const d = (sign: '+' | '-', i: number) => ({ sign, key: `k${i}`, text: `Reason ${i}` });
    const many = [d('+', 1), d('+', 2), d('-', 3), d('+', 4), d('+', 5), d('-', 6)];
    expect(pickDrivers({ drivers: many }).map((x) => x.key)).toEqual(['k1', 'k2', 'k4', 'k3']);
    renderCard([{ ...base, drivers: many }]);
    await screen.findByText('Tier A');
    const items = within(panel('Why')).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['+For: Reason 1', '+For: Reason 2', '+For: Reason 4', '−Against: Reason 3']);
  });

  it('renders each of the five flags with its label and tip', async () => {
    const all: Flags = { under18: true, low_sample: true, contract_ending: true, born_q4: true, limited_position_data: true };
    renderCard([{ ...base, flags: all }]);
    await screen.findByText('Tier A');
    const why = within(panel('Why'));
    const tips: Record<string, string> = {
      'Born Oct–Dec · often overlooked': t.flagTips.born_q4(bornLateTimes(evidence)),
      'Few minutes': t.flagTips.low_sample,
      'Limited data': t.flagTips.limited_position_data,
      'Under 18': t.flagTips.under18,
      'Contract ends within a year': t.flagTips.contract_ending,
    };
    for (const [label, tip] of Object.entries(tips)) {
      const chip = why.getByText(label).closest('.chip') as HTMLElement;
      expect(chip).toHaveAttribute('data-tip', tip);
      await userEvent.tab();
    }
    expect(why.getByText('Under 18').closest('.chip')).toHaveAttribute('tabindex', '0');
  });

  it('takes the born-late number from the evidence file', async () => {
    const q = evidence.birth_months.pct_by_quarter;
    const times = (q[0] / q[3]).toFixed(1);
    renderCard([{ ...base, flags: { ...noFlags, born_q4: true } }]);
    await screen.findByText('Tier A');
    expect(screen.getByText(/often overlooked/).closest('.chip')?.getAttribute('data-tip')).toContain(`${times} times rarer`);
    expect(times).toBe('1.6');
  });

  it('leaves the header and the rating sheet as they were', async () => {
    renderCard([base]);
    await screen.findByText('Tier A');
    expect(screen.getByText('Right Winger · 20 · NK Primjer, Croatia')).toBeInTheDocument();
    for (const fig of ['0.53', '−26%', '0.39', '86']) expect(screen.getByText(fig)).toBeInTheDocument();
  });
});
