import { useMemo } from 'react';
import { positionOf } from '../../lib/brief';
import { useData } from '../../lib/data';
import { dataText } from '../../lib/dataText';
import { money } from '../../lib/format';
import type { LookRow } from '../../lib/lookalike';
import { fixed2, isLimitedPosition } from '../../lib/rating';
import { similar as t } from '../../lib/similarText';
import { BRIEF_BUDGETS, setBudget, setModelPick, useBudget } from '../../lib/store';
import { states } from '../../lib/text.en';
import type { Player } from '../../lib/types';
import { SimilarError, SimilarLoading, SimilarScreen } from './SimilarScreen';

const known = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** A football player as a row of the screen. Output before and after the league adjustment is shown where goals say something. */
export function footballRow(p: Player): LookRow {
  const scores = [p.pct.creating, p.pct.scoring, p.pct.role];
  const complete = scores.every(known) && known(p.value_eur);
  const flags: string[] = [];
  if (p.flags.low_sample) flags.push(t.flagLowSample);
  if (p.flags.born_q4) flags.push(t.flagBornLate);
  return {
    id: p.id,
    name: p.name,
    line: `${p.club} · ${p.league_name}`,
    group: positionOf(p),
    scores: complete ? [scores[0], scores[1], scores[2]] : null,
    compare: complete ? scores : null,
    cost: known(p.value_eur) ? p.value_eur : 0,
    costText: known(p.value_eur) ? money(p.value_eur) : t.noTier,
    facts: t.football.facts(dataText(p.position), Math.floor(p.age)),
    tier: p.tier,
    eligible: p.in_pool,
    adjust:
      !isLimitedPosition(p) && known(p.ga90) && known(p.ga90_adj)
        ? { where: p.league_name, raw: fixed2(p.ga90), adjusted: fixed2(p.ga90_adj) }
        : null,
    flags,
  };
}

/** How many times cheaper: whole from 10 up, one decimal below. */
export function timesCheaper(ref: LookRow, row: LookRow): string {
  const times = row.cost > 0 ? ref.cost / row.cost : 0;
  return times >= 10 ? String(Math.round(times)) : String(Math.round(times * 10) / 10);
}

/** Section 01 for football: a player you cannot afford, and the three most like him inside the budget. */
export function FootballSimilar() {
  const state = useData();
  const budget = useBudget();
  const players = state.status === 'ready' ? state.data.players : null;
  const rows = useMemo(() => (players ? players.map(footballRow) : []), [players]);
  const w = t.football;

  if (state.status === 'error') {
    const reason = state.error.kind === 'missing' ? states.errorMissing : states.errorMalformed;
    return <SimilarError question={w.question} file={state.error.file} reason={reason} onRetry={state.retry} />;
  }
  if (!players) return <SimilarLoading question={w.question} />;
  return (
    <SimilarScreen
      sport="football"
      rows={rows}
      words={w}
      limit={budget}
      limitText={money(budget)}
      limitOptions={BRIEF_BUDGETS.map((b) => ({ value: String(b), label: w.limit(money(b)) }))}
      selectedLimit={String(budget)}
      onLimit={(v) => setBudget(Number(v))}
      gap={(ref, row) => w.gap(timesCheaper(ref, row))}
      onTop={setModelPick}
    />
  );
}
