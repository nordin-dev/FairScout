import type { RouteObject } from 'react-router-dom';
import { BlindPick } from './screens/BlindPick/BlindPick';
import { Evidence } from './screens/Evidence/Evidence';
import { PlayerCard } from './screens/PlayerCard/PlayerCard';
import { Radar } from './screens/Radar/Radar';
import { TimeMachine } from './screens/TimeMachine/TimeMachine';

/**
 * The section screens. A later story adds its screen with one line, for example
 * `{ path: 'blind', element: <BlindPick /> }`. The start redirect and the not-found
 * screen are part of the frame (App.tsx) and need no entry here.
 */
export const screenRoutes: RouteObject[] = [
  { path: 'blind', element: <BlindPick /> },
  { path: 'radar', element: <Radar /> },
  { path: 'player/:id', element: <PlayerCard /> },
  { path: 'time-machine', element: <TimeMachine /> },
  { path: 'evidence', element: <Evidence /> },
];
