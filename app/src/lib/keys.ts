import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toggleDetails, getState, type StoreState } from './store';

const SECTION_KEYS: Record<string, string> = {
  '1': '/similar',
  '2': '/radar',
  '3': '/time-machine',
  '4': '/evidence',
};

export type KeyAction = { type: 'go'; to: string } | { type: 'reveal' } | { type: 'details' };

const go = (to: string): KeyAction => ({ type: 'go', to });

/**
 * The pure decision: given the open path, the key (with modifier flags) and the store,
 * what should happen. Returns null when the key does nothing.
 */
export function decideKey(
  path: string,
  key: string,
  state: Pick<StoreState, 'origin' | 'modelPickId'>,
  mods: { ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean } = {},
): KeyAction | null {
  if (mods.ctrlKey || mods.altKey || mods.metaKey) return null;
  if (key in SECTION_KEYS) return go(SECTION_KEYS[key]);
  const k = key.toLowerCase();
  if (k === 'r') return { type: 'reveal' };
  if (k === 'd') return { type: 'details' };
  const onCard = path.startsWith('/player/');
  if (key === 'ArrowRight') {
    if (path === '/similar') return go(state.modelPickId ? `/player/${state.modelPickId}` : '/radar');
    if (onCard || path === '/radar') return go(onCard ? '/radar' : '/time-machine');
    if (path === '/time-machine') return go('/evidence');
  }
  if (key === 'ArrowLeft') {
    if (onCard) return go(state.origin === 'radar' ? '/radar' : '/similar');
    if (path === '/radar') return go('/similar');
    if (path === '/time-machine') return go('/radar');
    if (path === '/evidence') return go('/time-machine');
  }
  return null;
}

let reveal: (() => void) | null = null;

/** Registers the reveal of the open screen. Returns the function that unregisters it. */
export function registerReveal(fn: () => void): () => void {
  reveal = fn;
  return () => {
    if (reveal === fn) reveal = null;
  };
}

/** A screen calls this with its reveal; key R then triggers it while the screen is open. */
export function useReveal(fn: () => void): void {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => registerReveal(() => latest.current()), []);
}

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Installs the one keyboard listener of the app. Mount it once, in the frame. */
export function useKeys(): void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const path = useRef(pathname);
  useEffect(() => {
    path.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      const action = decideKey(path.current, e.key, getState(), e);
      if (!action) return;
      if (action.type === 'go') navigate(action.to);
      else if (action.type === 'details') toggleDetails();
      else reveal?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate]);
}
