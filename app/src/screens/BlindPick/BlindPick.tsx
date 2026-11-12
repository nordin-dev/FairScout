import { useEffect, useMemo } from 'react';
import { useData } from '../../lib/data';
import { setBlindStep, useBlindStep, useBrief, useBudget } from '../../lib/store';
import { pickTrio } from '../../lib/trio';
import { Brief } from './Brief';
import { Compare } from './Compare';

/** The blind pick: the brief first, then the three unnamed candidates. */
export function BlindPick() {
  const state = useData();
  const brief = useBrief();
  const budget = useBudget();
  const step = useBlindStep();
  const { matters, position, maxAge } = brief;
  const players = state.status === 'ready' ? state.data.players : null;

  const trio = useMemo(
    () => (players ? pickTrio(players, { position, maxAge, matters, budget }) : null),
    [players, position, maxAge, matters, budget],
  );

  const comparing = step !== 'brief';
  const missing = comparing && players !== null && trio === null;
  useEffect(() => {
    if (missing) setBlindStep('brief');
  }, [missing]);

  if (!comparing || !trio) return <Brief />;
  return <Compare trio={trio} />;
}
