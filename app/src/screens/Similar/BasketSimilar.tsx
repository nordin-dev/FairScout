import { useMemo } from 'react';
import { useBasket } from '../../lib/basketball/data';
import { useBasketReferences, type BasketReference } from '../../lib/basketball/references';
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

/** A player of basketball_references.json as a row: he can be named, and is never offered as a match or as a player to start from. */
export function basketReferenceRow(p: BasketReference): LookRow {
  const w = t.basketball;
  return {
    id: p.id,
    name: p.name,
    line: `${p.team} · ${p.competition}`,
    group: p.position ?? '',
    scores: [p.scoring, p.impact, p.trust],
    compare: [p.scoring, p.impact],
    cost: p.mpg,
    costText: w.cost(p.mpg.toFixed(1)),
    facts: w.facts(p.position ? w.positions[p.position] : w.noPosition, Math.floor(p.age)),
    tier: null,
    eligible: false,
    adjust: null,
    flags: p.low_sample ? [t.flagLowSample] : [],
    searchOnly: true,
  };
}

/** The rows of the pool, then the players of basketball_references.json that are not among them. */
export function basketRows(players: readonly BasketPlayer[], references: readonly BasketReference[]): LookRow[] {
  const rows = players.map(basketRow);
  const have = new Set(rows.map((r) => r.id));
  for (const p of references) if (!have.has(p.id)) rows.push(basketReferenceRow(p));
  return rows;
}

/** Section 01 for basketball: a player who already gets the minutes, and the three most like him who do not yet. */
export function BasketSimilar() {
  const state = useBasket();
  const { basketLimit } = useSimilarState();
  const players = state.status === 'ready' ? state.data.players : null;
  const references = useBasketReferences();
  const rows = useMemo(() => (players ? basketRows(players, references) : []), [players, references]);
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
