import { useCallback, useEffect, useState } from 'react';
import type { TennisFile } from './types';

export type TennisState =
  | { status: 'loading' }
  | { status: 'ready'; data: TennisFile }
  | { status: 'error'; reason: string };

let cached: TennisFile | null = null;

const isTennisFile = (json: unknown): json is TennisFile => {
  const file = json as Partial<TennisFile> | null;
  return !!file && typeof file === 'object' && Array.isArray(file.players) && typeof file.meta?.backtest?.picked === 'number';
};

/** Fetches data/tennis.json once and keeps it for the session. */
export async function loadTennis(baseUrl: string = import.meta.env.BASE_URL): Promise<TennisFile> {
  if (cached) return cached;
  const response = await fetch(`${baseUrl}data/tennis.json`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json: unknown = await response.json();
  if (!isTennisFile(json)) throw new Error('required fields are missing');
  cached = json;
  return json;
}

/** Puts a file in place of the fetch. Used by tests; null empties it. */
export function setTennisForTests(file: TennisFile | null): void {
  cached = file;
}

/** The tennis file: loading, ready or error, with `retry()`. It is fetched only when a tennis screen asks for it. */
export function useTennis(): TennisState & { retry: () => void } {
  const [state, setState] = useState<TennisState>(() => (cached ? { status: 'ready', data: cached } : { status: 'loading' }));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    loadTennis().then(
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
