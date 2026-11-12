import { useSyncExternalStore } from 'react';
import { toggleMatter as toggled, type DefaultBrief, type MaxAge, type Matter, type Position } from './brief';

/** The budget runs from 50k to 1M euros in steps of 50k. */
export const BUDGET_MIN = 50_000;
export const BUDGET_MAX = 1_000_000;
export const BUDGET_STEP = 50_000;
/** The three budgets the brief offers as buttons. */
export const BRIEF_BUDGETS: readonly number[] = [250_000, 500_000, 1_000_000];
export type Origin = 'blind' | 'radar';
export type Sport = 'football' | 'tennis';
export const SPORTS: readonly Sport[] = ['football', 'tennis'];
export type BlindStep = 'brief' | 'compare' | 'revealed';
export type Brief = { position: Position; maxAge: MaxAge; matters: Matter[] };
/** One blind pick: the scout's choice, the model's choice and the three players shown. */
export type BlindPick = { scoutId: string; modelId: string; shown: string[] };
/** The rounds of one brief: which round is open and the players shown in the rounds before it. */
export type BlindRounds = { key: string; round: number; seen: string[] };

export type StoreState = {
  sport: Sport;
  budget: number;
  details: boolean;
  origin: Origin;
  brief: Brief;
  blindStep: BlindStep;
  blindPicks: BlindPick[];
  blindRounds: BlindRounds | null;
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
  origin: 'blind',
  brief: { position: 'winger', maxAge: 21, matters: [] },
  blindStep: 'brief',
  blindPicks: [],
  blindRounds: null,
  modelPickId: null,
});

let state: StoreState = initial();
let budgetChosen = false;
const briefChosen = { position: false, maxAge: false, matters: false };
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

export function setPosition(position: Position): void {
  briefChosen.position = true;
  update({ brief: { ...state.brief, position } });
}

export function setMaxAge(maxAge: MaxAge): void {
  briefChosen.maxAge = true;
  update({ brief: { ...state.brief, maxAge } });
}

/** Chooses or un-chooses a priority; a third one drops the oldest of the two. */
export function toggleMatter(matter: Matter): void {
  briefChosen.matters = true;
  update({ brief: { ...state.brief, matters: toggled(state.brief.matters, matter) } });
}

/** Takes the default brief from meta.json. Keeps every part the scout already chose. */
export function setDefaultBrief(def: DefaultBrief): void {
  const next = { ...state.brief };
  if (!briefChosen.position && def.position) next.position = def.position;
  if (!briefChosen.maxAge && def.maxAge) next.maxAge = def.maxAge;
  if (!briefChosen.matters) next.matters = def.matters;
  update({ brief: next });
}

export const setBlindStep = (step: BlindStep): void => update({ blindStep: step });

export const toggleDetails = (): void => update({ details: !state.details });
export const setDetails = (on: boolean): void => update({ details: on });
export const setSport = (sport: Sport): void => update({ sport });
export const setOrigin = (section: Origin): void => update({ origin: section });
export const addBlindPick = (pick: BlindPick): void => update({ blindPicks: [...state.blindPicks, pick] });
export const setModelPick = (id: string | null): void => update({ modelPickId: id });
/** Forgets every blind pick of this session; the bias summary starts again. */
export const clearBlindPicks = (): void => update({ blindPicks: [] });

/** Opens the first round of a brief: the comparison, with nobody shown before. */
export const startBlindRounds = (key: string): void =>
  update({ blindStep: 'compare', blindRounds: { key, round: 0, seen: [] }, modelPickId: null });

/** Opens the next round of the same brief; the three just shown are not drawn again. */
export function nextBlindRound(key: string, shown: readonly string[]): void {
  const current = state.blindRounds?.key === key ? state.blindRounds : { key, round: 0, seen: [] };
  update({
    blindStep: 'compare',
    blindRounds: { key, round: current.round + 1, seen: [...current.seen, ...shown] },
    modelPickId: null,
  });
}

/** Back to the start state. Used by tests. */
export function reset(): void {
  defaultBudget = FALLBACK_BUDGET;
  budgetChosen = false;
  briefChosen.position = false;
  briefChosen.maxAge = false;
  briefChosen.matters = false;
  update(initial());
}

const select = <T,>(pick: (s: StoreState) => T) => () => useSyncExternalStore(subscribe, () => pick(state));

export const useSport = select((s) => s.sport);
export const useBudget = select((s) => s.budget);
export const useDetails = select((s) => s.details);
export const useOrigin = select((s) => s.origin);
export const useBrief = select((s) => s.brief);
export const useBlindStep = select((s) => s.blindStep);
export const useBlindPicks = select((s) => s.blindPicks);
export const useBlindRounds = select((s) => s.blindRounds);
export const useModelPick = select((s) => s.modelPickId);
