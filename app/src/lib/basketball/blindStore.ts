import { useSyncExternalStore } from 'react';
import { DEFAULT_BRIEF, toggleMatter as toggled, type BasketBrief, type BasketMatter, type BasketPosition } from './blind';

export type BasketBlindStep = 'brief' | 'compare' | 'revealed';
export type BasketBlindState = {
  brief: BasketBrief;
  step: BasketBlindStep;
  /** The last pick of the scout and the model's pick at that time. */
  lastPick: { scoutId: string; modelId: string } | null;
};

const initial = (): BasketBlindState => ({ brief: DEFAULT_BRIEF, step: 'brief', lastPick: null });
let state: BasketBlindState = initial();
const listeners = new Set<() => void>();

function update(patch: Partial<BasketBlindState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const getBlindState = (): BasketBlindState => state;
export const useBlindState = (): BasketBlindState => useSyncExternalStore(subscribe, getBlindState, getBlindState);

export const setPosition = (position: BasketPosition): void => update({ brief: { ...state.brief, position } });
export const setMaxAge = (maxAge: number): void => update({ brief: { ...state.brief, maxAge } });
export const setHidden = (hidden: number): void => update({ brief: { ...state.brief, hidden } });
export const toggleMatter = (m: BasketMatter): void => update({ brief: { ...state.brief, matters: toggled(state.brief.matters, m) } });
export const setStep = (step: BasketBlindStep): void => update({ step });
export const pickPlayer = (scoutId: string, modelId: string): void => update({ step: 'revealed', lastPick: { scoutId, modelId } });
export const backToBrief = (): void => update({ step: 'brief', lastPick: null });

/** Puts the store back to its start. Used by tests. */
export function reset(): void {
  state = initial();
  listeners.forEach((l) => l());
}
