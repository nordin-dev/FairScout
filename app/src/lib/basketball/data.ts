import { useCallback, useEffect, useState } from 'react';
import type { BasketFile } from './types';

export type BasketState =
  | { status: 'loading' }
  | { status: 'ready'; data: BasketFile }
  | { status: 'error'; reason: string };

let cached: BasketFile | null = null;

const isBasketFile = (json: unknown): json is BasketFile => {
  const file = json as Partial<BasketFile> | null;
  return !!file && typeof file === 'object' && Array.isArray(file.players) && typeof file.meta?.backtest?.picked === 'number';
};

/** Fetches data/basketball.json once and keeps it for the session. */
export async function loadBasket(baseUrl: string = import.meta.env.BASE_URL): Promise<BasketFile> {
  if (cached) return cached;
  const response = await fetch(`${baseUrl}data/basketball.json`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json: unknown = await response.json();
  if (!isBasketFile(json)) throw new Error('required fields are missing');
  cached = json;
  return json;
}

/** Puts a file in place of the fetch. Used by tests; null empties it. */
export function setBasketForTests(file: BasketFile | null): void {
  cached = file;
}

/** The basketball file: loading, ready or error, with `retry()`. It is fetched only when a basketball screen asks for it. */
export function useBasket(): BasketState & { retry: () => void } {
  const [state, setState] = useState<BasketState>(() => (cached ? { status: 'ready', data: cached } : { status: 'loading' }));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    loadBasket().then(
      (data) => current && setState({ status: 'ready', data }),
      (error: unknown) => current && setState({ status: 'error', reason: error instanceof Error ? error.message : String(error) }),
    );
    return () => {
      current = false;
    };
  }, [attempt]);
  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, retry };
}
