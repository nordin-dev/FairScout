import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ValueChart } from '../src/components/ValueChart';
import { DataProvider } from '../src/lib/data';
import { reset } from '../src/lib/store';
import type { TimeMachineFile } from '../src/lib/types';
import { HEIGHT, MARGIN, WIDTH, fanValues, layout, yearFraction } from '../src/lib/valuechart';
import { TimeMachine } from '../src/screens/TimeMachine/TimeMachine';

const SAMPLES = resolve(__dirname, '../../contract/samples');
const sample = (name: string): unknown => JSON.parse(readFileSync(resolve(SAMPLES, `${name}.json`), 'utf8'));

afterEach(() => {
  vi.unstubAllGlobals();
  reset();
});

async function open(file: TimeMachineFile) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const name = /data\/(\w+)\.json$/.exec(url)?.[1] ?? '';
      return new Response(JSON.stringify(name === 'timemachine' ? file : sample(name)), { status: 200 });
    }),
  );
  render(
    <DataProvider>
      <MemoryRouter initialEntries={['/time-machine']}>
        <TimeMachine />
      </MemoryRouter>
    </DataProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
}

const fileCopy = () => structuredClone(sample('timemachine')) as TimeMachineFile;
const reveal = () => userEvent.click(screen.getByRole('button', { name: /Show what happened/ }));
const rows = () => screen.getAllByRole('row').filter((r) => !r.classList.contains('tm-head'));
const panel = () => document.querySelector('.tm-panel') as HTMLElement;
const chart = () => document.querySelector('svg.vc') as SVGSVGElement;
const season = (file: TimeMachineFile, i: number) => file.seasons[i];

const MULT = { p25: 1.33, p50: 3, p75: 7.2 };
const base = {
  history: [
    ['2019-06-30', 400000],
    ['2020-01-15', 500000],
    ['2021-01-15', 1500000],
    ['2022-06-30', 2500000],
  ] as [string, number][],
  decisionDate: '2020-06-30',
  decisionValue: 500000,
  multiples: MULT,
  outcome: { date: '2023-06-30', value: 2000000 as number | null },
  revealed: false,
  madeIt: true,
};

describe('value chart arithmetic', () => {
  it('multiplies the value then by the three tier multiples', () => {
    const f = fanValues(500000, MULT);
    expect(f.lo).toBeCloseTo(665000, 6);
    expect(f.mid).toBeCloseTo(1500000, 6);
    expect(f.hi).toBeCloseTo(3600000, 6);
  });

  it('maps time and value linearly onto the plot area, zero value on the baseline', () => {
    const L = layout(base);
    expect(L.x(L.x0)).toBeCloseTo(MARGIN.l, 6);
    expect(L.x(L.x1)).toBeCloseTo(WIDTH - MARGIN.r, 6);
    expect(L.y(0)).toBeCloseTo(HEIGHT - MARGIN.b, 6);
    expect(L.y(L.ymax)).toBeCloseTo(MARGIN.t, 6);
    expect(L.x(L.endT) - L.x(L.flagT)).toBeGreaterThan(0);
    expect(L.endT - L.flagT).toBeCloseTo(yearFraction('2023-06-30') - yearFraction('2020-06-30'), 9);
  });

  it('keeps the top of the fan on the scale, also when the later history is lower, and the highest later value when revealed', () => {
    const then = layout(base);
    expect(then.ymax).toBeCloseTo(3600000 * 1.14, 3);
    expect(then.y(then.fan.hi)).toBeGreaterThan(MARGIN.t);
    const high = layout({ ...base, revealed: true, outcome: { date: '2023-06-30', value: 9000000 } });
    expect(high.ymax).toBeCloseTo(9000000 * 1.14, 3);
  });

  it('draws the fan ends at value then times p25, p50 and p75 on the scale', () => {
    render(<ValueChart {...base} />);
    const L = layout(base);
    const poly = chart().querySelector('polygon')?.getAttribute('points') ?? '';
    expect(poly).toBe(
      `${L.x(L.flagT)},${L.y(500000)} ${L.x(L.endT)},${L.y(500000 * 7.2)} ${L.x(L.endT)},${L.y(500000 * 1.33)}`,
    );
    const mid = chart().querySelector('line.mid');
    expect(Number(mid?.getAttribute('y2'))).toBeCloseTo(L.y(1500000), 6);
  });

  it('holds nothing later than the radar date in the then state, text alternative included', () => {
    render(<ValueChart {...base} />);
    const L = layout(base);
    expect(L.points.every((p) => p[0] <= L.flagT)).toBe(true);
    expect(chart().querySelector('circle.dot-out')).toBeNull();
    expect(chart().querySelectorAll('circle')).toHaveLength(1);
    const text = (chart().getAttribute('aria-label') ?? '') + (chart().textContent ?? '');
    expect(text).not.toContain('€2M');
    expect(text).not.toContain('€2.5M');
    expect(text).not.toMatch(/made it/);
  });

  it('adds the later history, the outcome dot and today only when revealed', () => {
    const today = { date: '2026-07-06', value: 4000000 };
    render(<ValueChart {...base} revealed today={today} />);
    const L = layout({ ...base, revealed: true, today });
    expect(L.points.some((p) => p[0] > L.flagT && p[0] < L.endT)).toBe(true);
    expect(chart().querySelector('circle.dot-out')).not.toBeNull();
    expect(chart().querySelectorAll('circle')).toHaveLength(3);
    expect(chart().getAttribute('aria-label')).toBe(
      "Market value of the selected player: €500k at the radar's date, €2M three seasons later, he made it. Today €4M.",
    );
  });

  it('draws no outcome dot for a missing later value and says there is none', () => {
    render(<ValueChart {...base} revealed madeIt={false} outcome={{ date: '2023-06-30', value: null }} />);
    expect(chart().querySelector('circle.dot-out')).toBeNull();
    expect(chart().getAttribute('aria-label')).toContain('no market value three seasons later, he did not make it');
  });
});

describe('time machine panel', () => {
  it('selects the first row on open and after a season change, and shows the name', async () => {
    const file = fileCopy();
    await open(file);
    const latest = season(file, 3);
    expect(rows()[0].getAttribute('aria-current')).toBe('true');
    expect(panel().textContent).toContain(latest.picks[0].name);
    await userEvent.click(rows()[2]);
    expect(rows()[2].getAttribute('aria-current')).toBe('true');
    expect(panel().textContent).toContain(latest.picks[2].name);
    await userEvent.click(screen.getByRole('button', { name: /^2019\/20/ }));
    expect(rows()[0].getAttribute('aria-current')).toBe('true');
    expect(rows().filter((r) => r.getAttribute('aria-current') === 'true')).toHaveLength(1);
    expect(panel().textContent).toContain(season(file, 0).picks[0].name);
  });

  it('selects with the Enter key and keeps the reveal', async () => {
    const file = fileCopy();
    await open(file);
    await reveal();
    rows()[1].focus();
    await userEvent.keyboard('{Enter}');
    expect(rows()[1].getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: /Back to/ })).toBeTruthy();
  });

  it('shows no outcome in the panel before the reveal and the outcome and today after, for an older season', async () => {
    const file = fileCopy();
    await open(file);
    await userEvent.click(screen.getByRole('button', { name: /^2019\/20/ }));
    expect(chart().querySelectorAll('circle')).toHaveLength(1);
    expect(chart().getAttribute('aria-label')).not.toMatch(/three seasons later,|made it/);
    await reveal();
    expect(chart().querySelectorAll('circle')).toHaveLength(3);
    expect(chart().textContent).toContain('today');
  });

  it('shows no today dot for the latest season', async () => {
    await open(fileCopy());
    await reveal();
    expect(chart().querySelectorAll('circle')).toHaveLength(2);
    expect(chart().textContent).not.toContain('today');
  });

  it('shows the message for a player with fewer than two value points, name kept', async () => {
    const file = fileCopy();
    const first = season(file, 3).picks[0];
    first.history = first.history.slice(0, 1);
    await open(file);
    expect(panel().textContent).toContain('Too little value history for a chart.');
    expect(panel().textContent).toContain(first.name);
    expect(document.querySelector('svg.vc')).toBeNull();
  });
});
