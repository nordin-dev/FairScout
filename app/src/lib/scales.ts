import { money } from "./format";

/** The right end of the price axis. */
export const PRICE_MAX = 1_000_000;

const STEPS = [1, 2, 5];

/** Rounds down to a 1-2-5 step: 74,000 gives 50,000 and 130,000 gives 100,000. */
export function floor125(v: number): number {
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / e;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * e;
}

/** The price axis: from the lowest price shown, rounded down to a 1-2-5 step, to 1,000,000 EUR. */
export function priceDomain(prices: readonly number[]): {
  min: number;
  max: number;
} {
  const lowest = Math.min(...prices.filter((p) => p > 0));
  const min = Number.isFinite(lowest) ? floor125(lowest) : 100_000;
  return { min: Math.min(min, PRICE_MAX / 10), max: PRICE_MAX };
}

/** Position of a price along a base-10 logarithmic axis, 0 at `min` and 1 at `max`; clamped to the axis. */
export function logPosition(value: number, min: number, max: number): number {
  const t =
    (Math.log10(value) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
  return Math.min(1, Math.max(0, t));
}

/** The 1-2-5 ticks from `min` to `max`, each with its label such as "€100k". */
export function priceTicks(
  min: number,
  max: number,
): { value: number; label: string }[] {
  const out: { value: number; label: string }[] = [];
  for (let e = Math.pow(10, Math.floor(Math.log10(min))); e <= max; e *= 10) {
    for (const s of STEPS) {
      const value = s * e;
      if (value >= min && value <= max)
        out.push({ value, label: money(value) });
    }
  }
  return out;
}

/** Position of an outlook score (`score_rank_pct`, 0 to 100) from the bottom, 0 to 1; higher is better. */
export function outlookPosition(pct: number): number {
  return Math.min(1, Math.max(0, pct / 100));
}
