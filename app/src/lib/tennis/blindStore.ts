import { useSyncExternalStore } from 'react';
import { DEFAULT_BRIEF, toggleMatter as toggled, type TennisBrief, type TennisMatter } from './blind';

export type TennisBlindStep = 'brief' | 'compare' | 'revealed';
export type TennisBlindState = {
  brief: TennisBrief;
  step: TennisBlindStep;
  /** The last pick of the scout and the model's pick at that time. */
  lastPick: { scoutId: string; modelId: string } | null;
};

const initial = (): TennisBlindState => ({ brief: DEFAULT_BRIEF, step: 'brief', lastPick: null });
let state: TennisBlindState = initial();
const listeners = new Set<() => void>();

function update(patch: Partial<TennisBlindState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const getBlindState = (): TennisBlindState => state;
export const useBlindState = (): TennisBlindState => useSyncExternalStore(subscribe, getBlindState, getBlindState);

export const setMaxAge = (maxAge: number): void => update({ brief: { ...state.brief, maxAge } });
export const setHidden = (hidden: number): void => update({ brief: { ...state.brief, hidden } });
export const toggleMatter = (m: TennisMatter): void => update({ brief: { ...state.brief, matters: toggled(state.brief.matters, m) } });
export const setStep = (step: TennisBlindStep): void => update({ step });
export const pickPlayer = (scoutId: string, modelId: string): void => update({ step: 'revealed', lastPick: { scoutId, modelId } });
export const backToBrief = (): void => update({ step: 'brief', lastPick: null });

/** Puts the store back to its start. Used by tests. */
export function reset(): void {
  state = initial();
  listeners.forEach((l) => l());
}
