import type { Origin } from './store';

const SECTION_PATH: Record<Origin, string> = { blind: '/blind', radar: '/radar' };

/**
 * The top-bar section that is marked for the open address. On a player card it is the section the
 * card (football or tennis) was opened from; elsewhere it is the section whose path the address starts with.
 */
export function activeSection(pathname: string, origin: Origin, sections: readonly string[]): string | null {
  if (pathname === '/player' || pathname.startsWith('/player/') || pathname.startsWith('/tennis/')) return SECTION_PATH[origin];
  return sections.find((s) => pathname === s || pathname.startsWith(`${s}/`)) ?? null;
}
