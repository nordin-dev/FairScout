import type { RouteObject } from 'react-router-dom';
import { Account } from './screens/Account/Account';
import { MyPicks } from './screens/Account/MyPicks';
import { BlindPick } from './screens/BlindPick/BlindPick';
import { Evidence } from './screens/Evidence/Evidence';
import { PlayerCard } from './screens/PlayerCard/PlayerCard';
import { Radar } from './screens/Radar/Radar';
import { BasketBlind } from './screens/Basketball/BasketBlind';
import { BasketCard } from './screens/Basketball/BasketCard';
import { BasketEvidence } from './screens/Basketball/BasketEvidence';
import { BasketRadar } from './screens/Basketball/BasketRadar';
import { BasketTimeMachine } from './screens/Basketball/BasketTimeMachine';
import { BySport } from './screens/Tennis/BySport';
import { TennisBlind } from './screens/Tennis/TennisBlind';
import { TennisCard } from './screens/Tennis/TennisCard';
import { TennisEvidence } from './screens/Tennis/TennisEvidence';
import { TennisRadar } from './screens/Tennis/TennisRadar';
import { TennisTimeMachine } from './screens/Tennis/TennisTimeMachine';
import { TimeMachine } from './screens/TimeMachine/TimeMachine';

/**
 * The section screens. A later story adds its screen with one line, for example
 * `{ path: 'blind', element: <BlindPick /> }`. The start redirect and the not-found
 * screen are part of the frame (App.tsx) and need no entry here.
 */
export const screenRoutes: RouteObject[] = [
  { path: 'blind', element: <BySport football={<BlindPick />} tennis={<TennisBlind />} basketball={<BasketBlind />} /> },
  { path: 'radar', element: <BySport football={<Radar />} tennis={<TennisRadar />} basketball={<BasketRadar />} /> },
  { path: 'tennis/:id', element: <TennisCard /> },
  { path: 'basketball/:id', element: <BasketCard /> },
  { path: 'player/:id', element: <PlayerCard /> },
  { path: 'time-machine', element: <BySport football={<TimeMachine />} tennis={<TennisTimeMachine />} basketball={<BasketTimeMachine />} /> },
  { path: 'evidence', element: <BySport football={<Evidence />} tennis={<TennisEvidence />} basketball={<BasketEvidence />} /> },
  { path: 'account', element: <Account /> },
  { path: 'my-picks', element: <MyPicks /> },
];
