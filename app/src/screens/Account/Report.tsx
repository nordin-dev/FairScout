import { useEffect, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Flag } from '../../components/Flag';
import { EmptyState, LoadingNote } from '../../components/ScreenState';
import { TierBadge } from '../../components/TierBadge';
import { useAccount, type PickSport, type SavedPick } from '../../lib/account';
import { myPicks, pickDate } from '../../lib/accountText';
import { useBasket } from '../../lib/basketball/data';
import type { BasketPlayer } from '../../lib/basketball/types';
import { useData } from '../../lib/data';
import { dataText } from '../../lib/dataText';
import { monthYear, money, thousands } from '../../lib/format';
import { shortDate } from '../../lib/i18n';
import { ratingOf } from '../../lib/rating';
import { report as t } from '../../lib/reportText';
import { shortNote } from '../../lib/similar';
import { similar } from '../../lib/similarText';
import { useTennis } from '../../lib/tennis/data';
import type { TennisPlayer } from '../../lib/tennis/types';
import type { Driver, Player, Tier } from '../../lib/types';
import './Account.css';
import './Report.css';

const ORDER: PickSport[] = ['football', 'tennis', 'basketball'];
const isSport = (v: string | null): v is PickSport => ORDER.some((s) => s === v);

type Fig = { label: string; value: string };

type BlockProps = {
  pick: SavedPick;
  name: string;
  sub: string;
  tier: Tier | null;
  figs: Fig[];
  drivers: readonly Pick<Driver, 'sign' | 'text'>[];
  flags: string[];
  note?: string;
};

/** One player of the report: who he is, his figures, what the model counts for and against him. */
function PlayerBlock({ pick, name, sub, tier, figs, drivers, flags, note }: BlockProps) {
  const plus = drivers.filter((d) => d.sign === '+');
  const minus = drivers.filter((d) => d.sign === '-');
  return (
    <article className="report-player" aria-label={name}>
      <header className="rp-head">
        <div>
          <h3 className="rp-name">{name}</h3>
          <p className="rp-sub">{sub}</p>
        </div>
        <div className="rp-tier">
          <span className="label">{t.outlook}</span>
          {tier ? <TierBadge tier={tier} size="xl" /> : <b>{t.noTier}</b>}
        </div>
      </header>
      {figs.length > 0 && (
        <div className="rp-figs">
          {figs.map((f) => (
            <div key={f.label}>
              <span className="label">{f.label}</span>
              <b>{f.value}</b>
            </div>
          ))}
        </div>
      )}
      {drivers.length > 0 && (
        <div className="rp-why">
          {plus.length > 0 && (
            <div>
              <span className="label">{t.plus}</span>
              <ul>{plus.map((d) => <li key={d.text}>{dataText(d.text)}</li>)}</ul>
            </div>
          )}
          {minus.length > 0 && (
            <div>
              <span className="label">{t.minus}</span>
              <ul>{minus.map((d) => <li key={d.text}>{dataText(d.text)}</li>)}</ul>
            </div>
          )}
        </div>
      )}
      {note ? (
        <p className="rp-note">
          <span className="label">{t.note}</span>
          <br />
          {note}
        </p>
      ) : null}
      {flags.length > 0 && (
        <div className="rp-flags">
          {flags.map((f) => (
            <Flag key={f} warning>
              {f}
            </Flag>
          ))}
        </div>
      )}
      <p className="rp-foot">{t.saved(myPicks.from[pick.from], pickDate(pick.added))}</p>
    </article>
  );
}

/** A saved player who is no longer in the data file: what was saved, and that he is missing. */
function Missing({ pick }: { pick: SavedPick }) {
  return <PlayerBlock pick={pick} name={pick.name} sub={`${pick.line} · ${t.missing}`} tier={pick.tier} figs={[]} drivers={[]} flags={[]} />;
}

function Section({ sport, n, children }: { sport: PickSport; n: number; children: ReactNode }) {
  return (
    <section className="report-sport" aria-labelledby={`report-${sport}`}>
      <h2 id={`report-${sport}`}>{myPicks.group(myPicks.sports[sport], n)}</h2>
      {children}
    </section>
  );
}

const dash = (v: string | null | undefined): string => v ?? t.dash;

function footballBlock(pick: SavedPick, p: Player) {
  const flags: string[] = [];
  if (p.flags.under18) flags.push(t.flags.under18);
  if (p.flags.low_sample) flags.push(t.flags.lowSample);
  if (p.flags.born_q4) flags.push(t.flags.bornLate);
  if (p.flags.contract_ending) flags.push(t.flags.contractEnding);
  return (
    <PlayerBlock
      key={pick.id}
      pick={pick}
      name={p.name}
      sub={`${t.football.facts(dataText(p.position), Math.floor(p.age))} · ${p.club}, ${p.league_name}`}
      tier={p.tier}
      figs={[
        { label: t.football.price, value: money(p.value_eur) },
        { label: t.football.contract, value: dash(monthYear(p.contract_until)) },
        { label: t.football.minutes, value: thousands(p.minutes) },
        { label: t.football.goalsAssists, value: t.football.goalsAssistsFigure(p.goals, p.assists) },
        { label: t.football.rating, value: String(ratingOf(p)) },
      ]}
      drivers={p.drivers}
      flags={flags}
      note={shortNote(p.note)}
    />
  );
}

function FootballSection({ picks }: { picks: SavedPick[] }) {
  const state = useData();
  const byId = new Map(state.status === 'ready' ? state.data.players.map((p) => [p.id, p]) : []);
  return (
    <Section sport="football" n={picks.length}>
      {state.status === 'error' ? (
        <p className="caption">{t.failed}</p>
      ) : state.status !== 'ready' ? (
        <LoadingNote>{t.loading}</LoadingNote>
      ) : (
        picks.map((pick) => {
          const p = byId.get(pick.id);
          return p ? footballBlock(pick, p) : <Missing key={pick.id} pick={pick} />;
        })
      )}
    </Section>
  );
}

function tennisBlock(pick: SavedPick, p: TennisPlayer) {
  const flags: string[] = [];
  if (p.flags.under18) flags.push(t.flags.under18);
  if (p.flags.low_sample) flags.push(t.flags.lowSample);
  return (
    <PlayerBlock
      key={pick.id}
      pick={pick}
      name={p.name}
      sub={t.tennis.facts(p.country, Math.floor(p.age))}
      tier={p.tier}
      figs={[
        { label: t.tennis.ranking, value: t.tennis.rank(p.rank) },
        { label: t.tennis.yearAgo, value: p.rank_year_ago === null ? t.dash : t.tennis.rank(p.rank_year_ago) },
        { label: t.tennis.record, value: `${p.wins}–${p.losses}` },
        { label: t.tennis.top200, value: String(p.top200_wins) },
        { label: t.tennis.chance, value: t.chance(Math.round(p.score * 100)) },
      ]}
      drivers={p.drivers}
      flags={flags}
    />
  );
}

function TennisSection({ picks }: { picks: SavedPick[] }) {
  const state = useTennis();
  const byId = new Map(state.status === 'ready' ? state.data.players.map((p) => [p.id, p]) : []);
  return (
    <Section sport="tennis" n={picks.length}>
      {state.status === 'error' ? (
        <p className="caption">{t.failed}</p>
      ) : state.status !== 'ready' ? (
        <LoadingNote>{t.loading}</LoadingNote>
      ) : (
        picks.map((pick) => {
          const p = byId.get(pick.id);
          return p ? tennisBlock(pick, p) : <Missing key={pick.id} pick={pick} />;
        })
      )}
    </Section>
  );
}

function basketBlock(pick: SavedPick, p: BasketPlayer) {
  const flags: string[] = [];
  if (p.flags.under20) flags.push(t.flags.under20);
  if (p.flags.low_sample) flags.push(t.flags.lowSample);
  const position = p.position ? similar.basketball.positions[p.position] : similar.basketball.noPosition;
  const one = (n: number) => n.toFixed(1);
  return (
    <PlayerBlock
      key={pick.id}
      pick={pick}
      name={p.name}
      sub={`${t.basketball.facts(position, Math.floor(p.age))} · ${p.team}, ${p.competition}`}
      tier={p.tier}
      figs={[
        { label: t.basketball.minutes, value: one(p.mpg) },
        { label: t.basketball.points, value: one(p.ppg) },
        { label: t.basketball.rebounds, value: one(p.rpg) },
        { label: t.basketball.assists, value: one(p.apg) },
        { label: t.basketball.chance, value: t.chance(Math.round(p.score * 100)) },
      ]}
      drivers={p.drivers}
      flags={flags}
    />
  );
}

function BasketSection({ picks }: { picks: SavedPick[] }) {
  const state = useBasket();
  const byId = new Map(state.status === 'ready' ? state.data.players.map((p) => [p.id, p]) : []);
  return (
    <Section sport="basketball" n={picks.length}>
      {state.status === 'error' ? (
        <p className="caption">{t.failed}</p>
      ) : state.status !== 'ready' ? (
        <LoadingNote>{t.loading}</LoadingNote>
      ) : (
        picks.map((pick) => {
          const p = byId.get(pick.id);
          return p ? basketBlock(pick, p) : <Missing key={pick.id} pick={pick} />;
        })
      )}
    </Section>
  );
}

/** The total price of the football picks that are in the data, or null while it is not known. */
function useFootballPrice(picks: SavedPick[]): number | null {
  const state = useData();
  if (state.status !== 'ready' || picks.length === 0) return null;
  const byId = new Map(state.data.players.map((p) => [p.id, p]));
  return picks.reduce((sum, pick) => sum + (byId.get(pick.id)?.value_eur ?? 0), 0);
}

/**
 * The report of My picks at /my-picks/report: every saved player with his figures and the model's
 * reasons, laid out for paper. "Save as PDF" opens the browser's print window, which saves it as a PDF
 * with the app's own fonts, so every language prints correctly. `?sport=` limits it to one sport.
 */
export function Report() {
  const who = useAccount();
  const [params] = useSearchParams();
  const only = params.get('sport');
  const today = shortDate(new Date());
  const picks = (who?.picks ?? [])
    .filter((p) => !isSport(only) || p.sport === only)
    .sort((a, b) => b.added.localeCompare(a.added));
  const bySport = (s: PickSport) => picks.filter((p) => p.sport === s);
  const football = bySport('football');
  const price = useFootballPrice(football);
  const fileName = who ? t.fileName(who.name, today) : null;

  useEffect(() => {
    if (!fileName) return;
    const before = document.title;
    document.title = fileName;
    return () => {
      document.title = before;
    };
  }, [fileName]);

  if (!who || picks.length === 0) {
    return (
      <>
        <Link className="back" to="/my-picks">
          {t.back}
        </Link>
        <EmptyState title={who ? t.empty : t.signedOut} text={myPicks.emptyText} />
      </>
    );
  }

  const tierA = picks.filter((p) => p.tier === 'A').length;
  return (
    <div className="report">
      <div className="report-tools">
        <Link className="back" to="/my-picks">
          {t.back}
        </Link>
        <Button onClick={() => window.print()}>{t.save}</Button>
        <p className="caption">{t.saveHint}</p>
      </div>
      <header className="report-head">
        <div>
          <p className="kicker">{t.kicker}</p>
          <h1>{t.title(picks.length)}</h1>
          <p className="lede">{t.meta(who.name, today)}</p>
        </div>
        <div className="report-sum">
          <div>
            <span className="label">{t.sumPlayers}</span>
            <b>{picks.length}</b>
          </div>
          <div>
            <span className="label">{t.sumTierA}</span>
            <b>{tierA}</b>
          </div>
          {price !== null && (
            <div>
              <span className="label">{t.sumPrice}</span>
              <b>{money(price)}</b>
            </div>
          )}
        </div>
      </header>
      {football.length > 0 && <FootballSection picks={football} />}
      {bySport('tennis').length > 0 && <TennisSection picks={bySport('tennis')} />}
      {bySport('basketball').length > 0 && <BasketSection picks={bySport('basketball')} />}
      <footer className="report-end">
        <p className="caption">{t.footer}</p>
      </footer>
    </div>
  );
}
