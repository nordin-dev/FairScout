import { useMemo } from 'react';
import { useBasket } from '../../lib/basketball/data';
import type { BasketPlayer } from '../../lib/basketball/types';
import type { LookRow } from '../../lib/lookalike';
import { BASKET_LIMITS, setBasketLimit, useSimilarState } from '../../lib/similarStore';
import { similar as t } from '../../lib/similarText';
import { SimilarError, SimilarLoading, SimilarScreen } from './SimilarScreen';

/** A basketball player as a row. He is compared on what he does per 40 minutes; his minutes are the cost. */
export function basketRow(p: BasketPlayer): LookRow {
  const w = t.basketball;
  return {
    id: p.id,
    name: p.name,
    line: `${p.team} · ${p.competition}`,
    group: p.position ?? '',
    scores: [p.pct.scoring, p.pct.impact, p.pct.trust],
    compare: [p.pct.scoring, p.pct.impact],
    cost: p.mpg,
    costText: w.cost(p.mpg.toFixed(1)),
    facts: w.facts(p.position ? w.positions[p.position] : w.noPosition, Math.floor(p.age)),
    tier: p.tier,
    eligible: true,
    adjust: null,
    flags: p.flags.low_sample ? [t.flagLowSample] : [],
  };
}

/** Section 01 for basketball: a player who already gets the minutes, and the three most like him who do not yet. */
export function BasketSimilar() {
  const state = useBasket();
  const { basketLimit } = useSimilarState();
  const players = state.status === 'ready' ? state.data.players : null;
  const rows = useMemo(() => (players ? players.map(basketRow) : []), [players]);
  const w = t.basketball;

  if (state.status === 'error') return <SimilarError question={w.question} file={w.errorFile} reason={state.reason} onRetry={state.retry} />;
  if (!players) return <SimilarLoading question={w.question} />;
  return (
    <SimilarScreen
      sport="basketball"
      rows={rows}
      words={w}
      limit={basketLimit}
      limitText={String(basketLimit)}
      limitOptions={BASKET_LIMITS.map((n) => ({ value: String(n), label: w.limit(String(n)) }))}
      selectedLimit={String(basketLimit)}
      onLimit={(v) => setBasketLimit(Number(v))}
      gap={(ref, row) => w.gap((ref.cost - row.cost).toFixed(1))}
    />
  );
}
