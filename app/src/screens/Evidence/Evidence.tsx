import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BarRanking } from '../../components/BarRanking';
import { DetailBlock } from '../../components/DetailBlock';
import { DotScale, type DotItem } from '../../components/DotScale';
import { MonthColumns } from '../../components/MonthColumns';
import { NumberPair } from '../../components/NumberPair';
import { ErrorState, LoadingNote, Skeleton } from '../../components/ScreenState';
import { Sheet } from '../../components/Sheet';
import { ValueChart } from '../../components/ValueChart';
import { useData } from '../../lib/data';
import {
  budgetEntry, chartForBudget, edgeOverMinutes, MAIN_BUDGET_EUR, risers, riserLink, riserTotals, SMALL_BUDGET_EUR, type Riser,
} from '../../lib/evidence';
import { money, thousands } from '../../lib/format';
import { evidence as t } from '../../lib/text.en';
import { madeIt, yearOf } from '../../lib/timemachine';
import type { BudgetBacktest, EvidenceFile, LeaguesFile, TimeMachineFile } from '../../lib/types';
import './Evidence.css';

function Head({ lede }: { lede?: boolean }) {
  return (
    <>
      <p className="kicker">{t.kicker}</p>
      <h1>{t.title}</h1>
      {lede ? <p className="lede">{t.lede}</p> : null}
    </>
  );
}

/** The detail caption, composed from the file; a clause whose number the file does not hold is left out. */
function caption(file: EvidenceFile, main: BudgetBacktest): string {
  const { test_seasons: seasons, pick_share: share } = file.backtest;
  const first = seasons[0];
  const last = seasons[seasons.length - 1];
  const parts: string[] = [];
  if (first !== undefined && last !== undefined) parts.push(t.captionSeasons(seasons.length, first, last), t.captionMethod);
  if (Number.isFinite(share)) parts.push(t.captionPick(Math.round(share * 100), money(main.budget_eur)));
  parts.push(`${t.captionPlayers(thousands(main.players))}, ${t.captionPicks(thousands(main.picks_per_rule))}, ${t.captionMargin(main.margin_pp)}`);
  parts.push(t.captionRange);
  return parts.join(' ');
}

function Chart({ budget, small }: { budget: BudgetBacktest; small?: boolean }) {
  const { bars, reference } = chartForBudget(budget, small);
  return (
    <BarRanking
      rows={bars}
      reference={reference}
      size={small ? 'small' : 'normal'}
      labelWidth={small ? 120 : 200}
    />
  );
}

function Tile({ riser, asOf }: { riser: Riser; asOf: string }) {
  const { season, pick, showToday } = riser;
  return (
    <Link className="find" to={riserLink(season.season, pick.id)} title={t.riserTip(pick.rank, season.picks.length, yearOf(season.decision_date))}>
      <span className="label">{season.season}</span>
      <span className="nm">{pick.name}</span>
      <span className="cl">{pick.club} · {pick.league}</span>
      <ValueChart
        size="compact"
        history={pick.history}
        decisionDate={season.decision_date}
        decisionValue={pick.value_then}
        multiples={{ p25: 1, p50: 1, p75: 1 }}
        outcome={{ date: season.outcome_date, value: pick.value_3y }}
        today={showToday ? { date: asOf, value: pick.value_latest } : undefined}
        revealed
        madeIt={madeIt(pick)}
      />
      <span className="big">
        {money(pick.value_then)}<i>{t.arrow}</i>{pick.value_3y === null ? '' : money(pick.value_3y)}
      </span>
      <span className="now">{showToday ? t.today(money(pick.value_latest)) : t.inThreeYears}</span>
    </Link>
  );
}

function Risers({ tm, onRetry }: { tm: TimeMachineFile | null; onRetry: () => void }) {
  if (!tm) return <ErrorState file="timemachine.json" reason={t.risersErrorReason} onRetry={onRetry} />;
  const shown = risers(tm);
  if (shown.length === 0) return null;
  const totals = riserTotals(shown);
  return (
    <Sheet>
      <p className="label">{t.risersLabel}</p>
      <div className="finds4">
        {shown.map((r) => (
          <Tile key={r.season.season} riser={r} asOf={tm.as_of} />
        ))}
      </div>
      <p className="find-cap">{t.risersFoot(totals.picks, shown.length, money(totals.then), money(totals.later), totals.missed)}</p>
      <DetailBlock>
        <p className="caption d-note">{t.risersNote(totals.noLater)}</p>
      </DetailBlock>
    </Sheet>
  );
}

function Cannot() {
  return (
    <Sheet>
      <p className="label">{t.cantLabel}</p>
      <div className="cant">
        {t.cantChips.map((c) => (
          <span className="chip lg" key={c}>{c}</span>
        ))}
      </div>
      <p className="find-cap cant-line">{t.cantSentence}</p>
    </Sheet>
  );
}

function Limits({ main }: { main: BudgetBacktest | null }) {
  const edge = main ? edgeOverMinutes(main) : null;
  return (
    <Sheet className="d-wide">
      <p className="chart-title" style={{ fontSize: 16 }}>{t.limitsTitle}</p>
      <ul className="plain">
        {t.limits.map((l) => (
          <li key={l.lead}><strong>{l.lead}</strong>{l.text}</li>
        ))}
        {edge ? (
          <li><strong>{t.edgeLead}</strong>{edge.within ? t.edgeWithin(edge.points, edge.margin) : t.edgeLarger(edge.points, edge.margin)}</li>
        ) : null}
      </ul>
    </Sheet>
  );
}

/** A league's factor counts only when it is a positive number. */
function hasFactor(factor: unknown): factor is number {
  return typeof factor === 'number' && Number.isFinite(factor) && factor > 0;
}

function LeagueDifficulty({ file, leagues }: { file: EvidenceFile; leagues: LeaguesFile | null }) {
  const all = leagues?.leagues ?? [];
  const items: DotItem[] = all
    .filter((l) => hasFactor(l.factor))
    .map((l) => ({
      key: l.id,
      label: l.name,
      value: l.factor,
      mark: l.factor_source === 'estimate' ? 'hollow' : 'filled',
      tip: t.dotTip(l.name, l.factor.toFixed(2), l.factor_source === 'estimate'),
    }));
  const left = all.length - items.length;
  const same = file.same_players_two_leagues;
  const moves = file.league_moves?.total;
  return (
    <Sheet>
      <p className="chart-title" style={{ fontSize: 16 }}>{t.leagueTitle}</p>
      {items.length === 0 ? (
        <p className="caption">{t.noFigures}</p>
      ) : (
        <>
          <p className="chart-sub">{Number.isFinite(moves) ? t.leagueSub(thousands(moves)) : t.leagueSubPlain}</p>
          <DotScale items={items} reference={{ value: 1, label: t.averageLabel }} />
          <p className="caption" style={{ marginTop: 10 }}>
            {[
              t.hollowNote,
              same ? t.samePlayers(same.players, same.league_a, same.ga90_a.toFixed(2), same.league_b, same.ga90_b.toFixed(2)) : '',
              left > 0 ? t.noFactor(left) : '',
            ].filter(Boolean).join(' ')}
          </p>
        </>
      )}
    </Sheet>
  );
}

export function BirthMonths({ file, leagues }: { file: EvidenceFile; leagues: LeaguesFile | null }) {
  const months = file.birth_months;
  const shares = months?.pct_by_month;
  const quarters = months?.pct_by_quarter;
  const complete = Array.isArray(shares) && shares.length === 12 && shares.every(Number.isFinite)
    && Array.isArray(quarters) && quarters.length === 4 && quarters.every(Number.isFinite);
  return (
    <Sheet>
      <p className="chart-title" style={{ fontSize: 16 }}>{t.birthTitle}</p>
      {complete ? (
        <>
          <p className="chart-sub">
            {leagues ? t.birthSub(thousands(months.players), leagues.leagues.length) : t.birthSubPlain(thousands(months.players))}
          </p>
          <NumberPair
            first={{ figure: `${Math.round(quarters[0])}%`, label: t.bornEarly }}
            second={{ figure: `${Math.round(quarters[3])}%`, label: t.bornLate }}
          />
          <MonthColumns shares={shares} months={t.monthNames} />
        </>
      ) : (
        <p className="caption">{t.noFigures}</p>
      )}
    </Sheet>
  );
}

function Ready({ file, main, tm, leagues, onRetry }: { file: EvidenceFile; main: BudgetBacktest; tm: TimeMachineFile | null; leagues: LeaguesFile | null; onRetry: () => void }) {
  const small = budgetEntry(file, SMALL_BUDGET_EUR);
  return (
    <>
      <Head lede />
      <div className="e-stack">
        <Sheet>
          <p className="chart-title">{t.chartTitle}</p>
          <Chart budget={main} />
          <DetailBlock>
            <p className="caption d-note">{caption(file, main)}</p>
          </DetailBlock>
        </Sheet>
        <div className="e-row">
          <Risers tm={tm} onRetry={onRetry} />
          <Cannot />
        </div>
      </div>
      <DetailBlock>
        <div className="d-grid">
          {small ? (
            <Sheet>
              <p className="chart-title" style={{ fontSize: 16 }}>
                {t.smallTitle}
              </p>
              <p className="chart-sub">
                {t.smallSub(money(small.budget_eur), thousands(small.players), thousands(small.picks_per_rule), small.margin_pp)}
              </p>
              <Chart budget={small} small />
            </Sheet>
          ) : null}
          <LeagueDifficulty file={file} leagues={leagues} />
          <BirthMonths file={file} leagues={leagues} />
          <Limits main={main} />
        </div>
      </DetailBlock>
    </>
  );
}

function Loading(): ReactNode {
  return (
    <div aria-busy="true">
      <Head lede />
      <div className="e-stack">
        <Sheet aria-busy="true">
          <p className="chart-title">{t.chartTitle}</p>
          <div className="e-sk-list">
            {[t.rows.model, t.rows.most_minutes, t.rows.most_goals_assists, t.rows.youngest, t.rows.cheapest].map((label, i) => (
              <div className="e-bars-sk" key={label}>
                <span>{label}</span>
                <Skeleton style={{ width: `${[62, 54, 46, 46, 22][i]}%`, height: 24 }} />
              </div>
            ))}
          </div>
        </Sheet>
      </div>
      <LoadingNote>{t.loadingNote}</LoadingNote>
    </div>
  );
}

/** The evidence screen at /evidence: the model against four simple rules, tested on past seasons. */
export function Evidence() {
  const state = useData();
  if (state.status === 'loading') return <Loading />;
  const loaded = state.status === 'ready' ? state.data : state.error.loaded;
  if (state.status === 'error' && !loaded.evidence) {
    return (
      <>
        <Head />
        <ErrorState file={state.error.file} reason={t.errorReason} onRetry={state.retry} />
      </>
    );
  }
  const evidenceFile = loaded.evidence as EvidenceFile;
  const main = budgetEntry(evidenceFile, MAIN_BUDGET_EUR);
  if (!main) {
    return (
      <>
        <Head />
        <div className="sheet state-block">
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyText}</p>
          <p className="file">{t.emptyFile}</p>
        </div>
      </>
    );
  }
  return <Ready file={evidenceFile} main={main} tm={loaded.timemachine ?? null} leagues={loaded.leagues ?? null} onRetry={state.retry} />;
}
