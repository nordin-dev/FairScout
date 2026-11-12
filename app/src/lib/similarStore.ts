import { useSyncExternalStore } from 'react';
import type { Sport } from './store';

/** The limits the tennis and basketball screens offer. Football uses the shared budget. */
export const TENNIS_LIMITS: readonly number[] = [300, 500, 700];
export const BASKET_LIMITS: readonly number[] = [15, 10, 6];

export type SimilarState = {
  /** The player the scout named, per sport. */
  ref: Record<Sport, string | null>;
  /** Tennis: only players ranked outside this number. */
  tennisLimit: number;
  /** Basketball: only players with at most this many minutes per game. */
  basketLimit: number;
};

const initial = (): SimilarState => ({
  ref: { football: null, tennis: null, basketball: null },
  tennisLimit: 300,
  basketLimit: 15,
});

let state: SimilarState = initial();
const listeners = new Set<() => void>();

function update(patch: Partial<SimilarState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const getSimilarState = (): SimilarState => state;
export const useSimilarState = (): SimilarState => useSyncExternalStore(subscribe, getSimilarState, getSimilarState);

export const setRef = (sport: Sport, id: string | null): void => update({ ref: { ...state.ref, [sport]: id } });
export const setTennisLimit = (limit: number): void => update({ tennisLimit: limit });
export const setBasketLimit = (limit: number): void => update({ basketLimit: limit });

/** Back to the start state. Used by tests. */
export function resetSimilar(): void {
  state = initial();
  listeners.forEach((l) => l());
}
