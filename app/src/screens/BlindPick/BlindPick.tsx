import { useEffect, useMemo } from 'react';
import { useData } from '../../lib/data';
import { setBlindStep, useBlindRounds, useBlindStep, useBrief, useBudget } from '../../lib/store';
import { briefKey, drawTrio, pickTrio, unseenCount } from '../../lib/trio';
import { Brief } from './Brief';
import { Compare } from './Compare';

/**
 * The blind pick: the brief first, then rounds of three unnamed candidates. The first round is the
 * model's top, the top scorer and the best fit; every later round draws three not shown before.
 */
export function BlindPick() {
  const state = useData();
  const brief = useBrief();
  const budget = useBudget();
  const step = useBlindStep();
  const rounds = useBlindRounds();
  const { matters, position, maxAge } = brief;
  const players = state.status === 'ready' ? state.data.players : null;

  const key = briefKey({ position, maxAge, matters, budget });
  const own = rounds?.key === key ? rounds : null;
  const round = own?.round ?? 0;
  const seen = own?.seen;

  const view = useMemo(() => {
    if (!players) return null;
    const criteria = { position, maxAge, matters, budget };
    const seenSet = new Set(seen ?? []);
    const trio = round === 0 ? pickTrio(players, criteria) : drawTrio(players, criteria, seenSet, round);
    if (!trio) return null;
    for (const p of trio.order) seenSet.add(p.id);
    return { trio, left: unseenCount(players, criteria, seenSet) };
  }, [players, position, maxAge, matters, budget, round, seen]);

  const comparing = step !== 'brief';
  const missing = comparing && players !== null && view === null;
  useEffect(() => {
    if (missing) setBlindStep('brief');
  }, [missing]);

  if (!comparing || !view) return <Brief />;
  return <Compare trio={view.trio} round={round} left={view.left} roundKey={key} players={players ?? undefined} />;
}
