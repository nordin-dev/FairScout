import { useSyncExternalStore } from 'react';

/** The budget runs from 50k to 1M euros in steps of 50k. */
export const BUDGET_MIN = 50_000;
export const BUDGET_MAX = 1_000_000;
export const BUDGET_STEP = 50_000;
/** The three budgets section 01 offers as buttons. */
export const BRIEF_BUDGETS: readonly number[] = [250_000, 500_000, 1_000_000];
export type Origin = 'similar' | 'radar';
export type Sport = 'football' | 'tennis' | 'basketball';
export const SPORTS: readonly Sport[] = ['football', 'tennis', 'basketball'];

export type StoreState = {
  sport: Sport;
  budget: number;
  details: boolean;
  origin: Origin;
  /** The best match of section 01 in football: the right-arrow key opens his card. */
  modelPickId: string | null;
};

const FALLBACK_BUDGET = 500_000;

const isBudget = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= BUDGET_MIN && v <= BUDGET_MAX && v % BUDGET_STEP === 0;

let defaultBudget = FALLBACK_BUDGET;
const initial = (): StoreState => ({
  sport: 'football',
  budget: defaultBudget,
  details: false,
  origin: 'similar',
  modelPickId: null,
});

let state: StoreState = initial();
let budgetChosen = false;
const listeners = new Set<() => void>();

function update(patch: Partial<StoreState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const getState = (): StoreState => state;

/** Sets the budget. A value outside the range or off the step sets the default. */
export function setBudget(value: number): void {
  budgetChosen = true;
  update({ budget: isBudget(value) ? value : defaultBudget });
}

/** Takes the default budget from meta.json (`default_brief.budget_eur`). Keeps a budget the scout already chose. */
export function setDefaultBudget(value: number): void {
  defaultBudget = isBudget(value) ? value : FALLBACK_BUDGET;
  if (!budgetChosen) update({ budget: defaultBudget });
}

export const toggleDetails = (): void => update({ details: !state.details });
export const setDetails = (on: boolean): void => update({ details: on });
export const setSport = (sport: Sport): void => update({ sport });
export const setOrigin = (section: Origin): void => update({ origin: section });
export const setModelPick = (id: string | null): void => update({ modelPickId: id });

/** Back to the start state. Used by tests. */
export function reset(): void {
  defaultBudget = FALLBACK_BUDGET;
  budgetChosen = false;
  update(initial());
}

const select = <T,>(pick: (s: StoreState) => T) => () => useSyncExternalStore(subscribe, () => pick(state));

export const useSport = select((s) => s.sport);
export const useBudget = select((s) => s.budget);
export const useDetails = select((s) => s.details);
export const useOrigin = select((s) => s.origin);
export const useModelPick = select((s) => s.modelPickId);
