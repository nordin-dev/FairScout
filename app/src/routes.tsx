import { redirect, type RouteObject } from 'react-router-dom';
import { Account } from './screens/Account/Account';
import { MyPicks } from './screens/Account/MyPicks';
import { Report } from './screens/Account/Report';
import { Evidence } from './screens/Evidence/Evidence';
import { PlayerCard } from './screens/PlayerCard/PlayerCard';
import { Radar } from './screens/Radar/Radar';
import { BasketSimilar } from './screens/Similar/BasketSimilar';
import { FootballSimilar } from './screens/Similar/FootballSimilar';
import { TennisSimilar } from './screens/Similar/TennisSimilar';
import { BasketCard } from './screens/Basketball/BasketCard';
import { BasketEvidence } from './screens/Basketball/BasketEvidence';
import { BasketRadar } from './screens/Basketball/BasketRadar';
import { BasketTimeMachine } from './screens/Basketball/BasketTimeMachine';
import { BySport } from './screens/Tennis/BySport';
import { TennisCard } from './screens/Tennis/TennisCard';
import { TennisEvidence } from './screens/Tennis/TennisEvidence';
import { TennisRadar } from './screens/Tennis/TennisRadar';
import { TennisTimeMachine } from './screens/Tennis/TennisTimeMachine';
import { TimeMachine } from './screens/TimeMachine/TimeMachine';

/**
 * The section screens. A later story adds its screen with one line, for example
 * `{ path: 'radar', element: <Radar /> }`. The start redirect and the not-found
 * screen are part of the frame (App.tsx) and need no entry here.
 */
export const screenRoutes: RouteObject[] = [
  { path: 'similar', element: <BySport football={<FootballSimilar />} tennis={<TennisSimilar />} basketball={<BasketSimilar />} /> },
  // Section 01 used to be the blind pick: old links to it open the screen that took its place.
  { path: 'blind', loader: () => redirect('/similar') },
  { path: 'radar', element: <BySport football={<Radar />} tennis={<TennisRadar />} basketball={<BasketRadar />} /> },
  { path: 'tennis/:id', element: <TennisCard /> },
  { path: 'basketball/:id', element: <BasketCard /> },
  { path: 'player/:id', element: <PlayerCard /> },
  { path: 'time-machine', element: <BySport football={<TimeMachine />} tennis={<TennisTimeMachine />} basketball={<BasketTimeMachine />} /> },
  { path: 'evidence', element: <BySport football={<Evidence />} tennis={<TennisEvidence />} basketball={<BasketEvidence />} /> },
  { path: 'account', element: <Account /> },
  { path: 'my-picks', element: <MyPicks /> },
  { path: 'my-picks/report', element: <Report /> },
];
