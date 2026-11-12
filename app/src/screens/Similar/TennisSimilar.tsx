import { useMemo } from 'react';
import type { LookRow } from '../../lib/lookalike';
import { setTennisLimit, TENNIS_LIMITS, useSimilarState } from '../../lib/similarStore';
import { similar as t } from '../../lib/similarText';
import { useTennis } from '../../lib/tennis/data';
import type { TennisPlayer } from '../../lib/tennis/types';
import { SimilarError, SimilarLoading, SimilarScreen } from './SimilarScreen';

/** A tennis player as a row. The cost is the ranking turned round: a better ranking is further out of reach. */
export function tennisRow(p: TennisPlayer): LookRow {
  const scores = [p.pct.wins, p.pct.level, p.pct.rise] as const;
  return {
    id: p.id,
    name: p.name,
    line: p.country,
    group: '',
    scores,
    compare: scores,
    cost: -p.rank,
    costText: t.tennis.cost(p.rank),
    facts: t.tennis.facts(Math.floor(p.age)),
    tier: p.tier,
    eligible: true,
    adjust: null,
    flags: p.flags.low_sample ? [t.flagLowSample] : [],
  };
}

/** Section 01 for tennis: a player everyone watches, and the three most like him further down the ranking. */
export function TennisSimilar() {
  const state = useTennis();
  const { tennisLimit } = useSimilarState();
  const players = state.status === 'ready' ? state.data.players : null;
  const rows = useMemo(() => (players ? players.map(tennisRow) : []), [players]);
  const w = t.tennis;

  if (state.status === 'error') return <SimilarError question={w.question} file={w.errorFile} reason={state.reason} onRetry={state.retry} />;
  if (!players) return <SimilarLoading question={w.question} />;
  return (
    <SimilarScreen
      sport="tennis"
      rows={rows}
      words={w}
      limit={-tennisLimit}
      limitText={String(tennisLimit)}
      limitOptions={TENNIS_LIMITS.map((n) => ({ value: String(n), label: w.limit(String(n)) }))}
      selectedLimit={String(tennisLimit)}
      onLimit={(v) => setTennisLimit(Number(v))}
      gap={(ref, row) => w.gap(String(ref.cost - row.cost))}
    />
  );
}
