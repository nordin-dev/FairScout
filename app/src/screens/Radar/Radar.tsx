import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddPickButton } from '../../components/AddPickButton';
import { Button } from '../../components/Button';
import { ChoiceChips } from '../../components/ChoiceChips';
import { DataTable, type Column } from '../../components/DataTable';
import { Flag } from '../../components/Flag';
import { Meter } from '../../components/Meter';
import { EmptyState, ErrorState, LoadingNote, Skeleton } from '../../components/ScreenState';
import { SegmentSwitch } from '../../components/SegmentSwitch';
import { Sheet } from '../../components/Sheet';
import { TierBadge } from '../../components/TierBadge';
import { ValueOutlookPlot } from '../../components/ValueOutlookPlot';
import { useData } from '../../lib/data';
import { monthYear, money, thousands } from '../../lib/format';
import {
  REGIONAL_LEAGUES,
  applyFilters,
  availabilityCounts,
  bosnianPlayers,
  contractCutoff,
  defaultView,
  leagueCounts,
  passportCounts,
  positionCode,
  selectedLeagueCount,
  sortRows,
  titleCounts,
  type Filters,
  type PositionFilter,
  type ViewFilters,
  PASSPORT_YOUNG_AGE,
} from '../../lib/radar';
import { BUDGET_MAX, BUDGET_MIN, BUDGET_STEP, setBudget, setOrigin, useBudget } from '../../lib/store';
import { poolBornFrom } from '../../lib/brief';
import { ratingOf } from '../../lib/rating';
import { radar as t } from '../../lib/text.en';
import type { AppData, Player } from '../../lib/types';
import { PassportView } from './PassportView';
import './Radar.css';

const PAGE = 20;

function Check({ on, label, count, onToggle, disabled = false }: { on: boolean; label: string; count?: number; onToggle: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-disabled={disabled || undefined} disabled={disabled} className={on ? 'check on' : 'check'} onClick={onToggle}>
      <i aria-hidden="true" />
      <span>{label}</span>
      <span className="num">{count ?? ''}</span>
    </button>
  );
}

function flagChips(p: Player) {
  const chips = [];
  if (p.flags.under18) chips.push(<Flag key="u18">{t.flags.under18}</Flag>);
  if (p.flags.born_q4) chips.push(<Flag key="q4">{t.flags.bornQ4}</Flag>);
  const when = monthYear(p.contract_until);
  if (p.flags.contract_ending && when) chips.push(<Flag key="end">{t.flags.contract(when)}</Flag>);
  if (p.flags.limited_position_data) {
    chips.push(
      <Flag key="lim" tip={t.flags.limitedTip}>
        {t.flags.limited}
      </Flag>,
    );
  }
  if (p.flags.low_sample) {
    chips.push(
      <Flag key="low" warning>
        {t.flags.lowSample}
      </Flag>,
    );
  }
  return chips;
}

function RadarLoading() {
  return (
    <div aria-busy="true">
      <p className="kicker">{t.kicker}</p>
      <Skeleton className="sk-h1" />
      <Skeleton className="sk-lede" />
      <div className="r-layout">
        <aside className="rail">
          {[t.budget, t.position, t.league, t.availability].map((label, i) => (
            <div key={label}>
              <span className="label">{label}</span>
              {Array.from({ length: i < 2 ? 1 : i === 2 ? 5 : 2 }, (_, k) => (
                <Skeleton key={k} style={{ display: 'block', height: i < 2 ? 28 : 14, marginBottom: i < 2 ? 0 : 10 }} />
              ))}
            </div>
          ))}
        </aside>
        <div className="r-main">
          <Sheet className="r-table" aria-busy="true">
            {Array.from({ length: 7 }, (_, k) => (
              <Skeleton key={k} style={{ display: 'block', height: 18, margin: '14px 0' }} />
            ))}
          </Sheet>
        </div>
      </div>
      <LoadingNote>{t.loadingNote}</LoadingNote>
    </div>
  );
}

function RadarScreen({ data }: { data: AppData }) {
  const navigate = useNavigate();
  const sharedBudget = useBudget();
  const [view, setView] = useState<ViewFilters>(defaultView);
  const [showAll, setShowAll] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [which, setWhich] = useState<'budget' | 'passport'>('budget');
  const filters: Filters = useMemo(() => ({ ...view, budget: sharedBudget }), [view, sharedBudget]);
  const players = data.players;

  const rows = useMemo(() => sortRows(applyFilters(players, filters)), [players, filters]);
  const plotRows = useMemo(
    () => sortRows(applyFilters(players, { ...filters, budget: Infinity })),
    [players, filters],
  );
  const { total, tierA } = titleCounts(rows);
  const bosnians = useMemo(() => bosnianPlayers(players), [players]);
  const passport = passportCounts(bosnians, sharedBudget);
  const isPassport = which === 'passport';
  const off = isPassport;
  const counts = useMemo(() => leagueCounts(players, filters), [players, filters]);
  const avail = useMemo(() => availabilityCounts(players, filters), [players, filters]);

  const regional = useMemo(() => {
    const names = new Map(data.leagues.leagues.map((l) => [l.id, l.name]));
    return [...REGIONAL_LEAGUES]
      .map((id) => ({ id, name: names.get(id) ?? id, count: counts[id] ?? 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [data.leagues, counts]);
  const others = useMemo(
    () =>
      data.leagues.leagues
        .filter((l) => !REGIONAL_LEAGUES.includes(l.id))
        .map((l) => ({ id: l.id, name: l.name, count: counts[l.id] ?? 0 }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.leagues, counts],
  );
  const allIds = data.leagues.leagues.map((l) => l.id);
  const selected = selectedLeagueCount(filters, allIds);
  const isDefault = filters.leagues.length === REGIONAL_LEAGUES.length && filters.otherLeagues.length === 0;
  const leagueWords = isDefault
    ? t.regionalLeagues
    : selected >= allIds.length
      ? t.allLeagues(allIds.length)
      : t.someLeagues(selected);
  const bornFrom = poolBornFrom(data.meta.radar_season);
  const cutoff = contractCutoff(data.meta.source_last_date);
  const ages = view.under18Only ? t.agesUnder18 : view.adultOnly ? t.agesAdult : t.agesAll(bornFrom);
  const lede = t.lede(leagueWords, data.meta.radar_season, ages);

  const set = (patch: Partial<ViewFilters>) => {
    setView((v) => ({ ...v, ...patch }));
    setShowAll(false);
  };
  const toggleLeague = (id: string) =>
    set({ leagues: view.leagues.includes(id) ? view.leagues.filter((x) => x !== id) : [...view.leagues, id] });
  const toggleOther = (id: string) =>
    set({ otherLeagues: view.otherLeagues.includes(id) ? view.otherLeagues.filter((x) => x !== id) : [...view.otherLeagues, id] });
  const reset = () => {
    setView(defaultView());
    setListOpen(false);
    setShowAll(false);
  };
  const open = (p: Player) => {
    setOrigin('radar');
    navigate(`/player/${p.id}`);
  };

  const fill = `${((sharedBudget - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100}%`;

  const rail = (
    <aside className="rail" aria-label={t.railLabel}>
      <div>
        <label className="label" htmlFor="radar-budget">
          {t.budget}
        </label>
        <div className="slider" style={{ '--fill': fill } as CSSProperties}>
          <input
            id="radar-budget"
            type="range"
            min={BUDGET_MIN}
            max={BUDGET_MAX}
            step={BUDGET_STEP}
            value={sharedBudget}
            aria-valuetext={t.budgetValue(money(sharedBudget))}
            onChange={(e) => {
              setBudget(Number(e.target.value));
              setShowAll(false);
            }}
          />
        </div>
        <div className="row">
          <span>{money(BUDGET_MIN)}</span>
          <span className="now">{t.budgetValue(money(sharedBudget))}</span>
          <span>{money(BUDGET_MAX)}</span>
        </div>
      </div>
      <div>
        <span className="label">{t.position}</span>
        <ChoiceChips<PositionFilter>
          label={t.position}
          options={t.positions}
          selected={view.position}
          onChange={(position) => set({ position })}
          disabled={off}
        />
      </div>
      <div>
        <span className="label">{t.league}</span>
        {regional.map((l) => (
          <Check key={l.id} on={view.leagues.includes(l.id)} label={l.name} count={l.count} onToggle={() => toggleLeague(l.id)} disabled={off} />
        ))}
        <button
          type="button"
          className={listOpen ? 'more-toggle open' : 'more-toggle'}
          aria-expanded={listOpen}
          aria-controls="radar-more-leagues"
          disabled={off}
          onClick={() => setListOpen((o) => !o)}
        >
          <i aria-hidden="true" />
          <span>{t.moreLeagues(others.length, view.otherLeagues.length)}</span>
        </button>
        <div id="radar-more-leagues" className="more-list" role="group" aria-label={t.moreLeaguesList} hidden={!listOpen}>
          <div className="more-actions">
            <button type="button" disabled={off} onClick={() => set({ otherLeagues: others.map((l) => l.id) })}>
              {t.selectAll}
            </button>
            <button type="button" disabled={off} onClick={() => set({ otherLeagues: [] })}>
              {t.clearAll}
            </button>
          </div>
          {others.map((l) => (
            <Check key={l.id} on={view.otherLeagues.includes(l.id)} label={l.name} count={l.count} onToggle={() => toggleOther(l.id)} disabled={off} />
          ))}
        </div>
      </div>
      <div>
        <span className="label">{t.availability}</span>
        {cutoff ? (
          <Check
            on={view.contractEnding}
            label={t.contractEnds(cutoff)}
            count={avail.contract}
            onToggle={() => set({ contractEnding: !view.contractEnding })}
            disabled={off}
          />
        ) : null}
        <Check
          on={view.adultOnly}
          label={t.adult}
          count={avail.adult}
          onToggle={() => set({ adultOnly: !view.adultOnly, under18Only: false })}
          disabled={off}
        />
        <Check
          on={view.under18Only}
          label={t.under18Only}
          count={avail.under18}
          onToggle={() => set({ under18Only: !view.under18Only, adultOnly: false })}
          disabled={off}
        />
      </div>
    </aside>
  );

  const columns: Column<Player>[] = [
    { key: 'rank', header: t.headers.rank, align: 'right', cell: (_p, i) => <span className="num">{i + 1}</span> },
    {
      key: 'player',
      header: t.headers.player,
      cell: (p) => (
        <>
          <span className="name">{p.name}</span>
          <span className="sub">
            {p.club}
            {' · '}
            {p.league_name}
          </span>
        </>
      ),
    },
    { key: 'pos', header: t.headers.pos, cell: (p) => <span className="num">{positionCode(p)}</span> },
    { key: 'age', header: t.headers.age, align: 'right', cell: (p) => <span className="num">{p.age.toFixed(1)}</span> },
    { key: 'price', header: t.headers.price, align: 'right', cell: (p) => <span className="num">{money(p.value_eur)}</span> },
    { key: 'min', header: t.headers.min, align: 'right', cell: (p) => <span className="num">{thousands(p.minutes)}</span> },
    { key: 'rating', header: t.headers.rating, cell: (p) => <Meter label={t.ratingLabel} value={ratingOf(p)} /> },
    { key: 'outlook', header: t.headers.outlook, cell: (p) => (p.tier ? <TierBadge tier={p.tier} /> : null) },
    { key: 'notes', header: t.headers.notes, cell: (p) => flagChips(p) },
    {
      key: 'pick',
      header: 'My picks',
      hideHeader: true,
      cell: (p) => <AddPickButton compact sport="football" id={p.id} name={p.name} line={`${p.club} · ${p.league_name}`} tier={p.tier} from="radar" />,
    },
  ];
  const shown = showAll ? rows : rows.slice(0, PAGE);

  return (
    <>
      <p className="kicker">{t.kicker}</p>
      <h1>
        {isPassport
          ? t.passportTitle(passport.total, allIds.length)
          : total === 0
            ? t.emptyTitle
            : `${t.title(total)} ${t.tierLine(tierA)}`}
      </h1>
      {isPassport && passport.total === 0 ? null : (
        <p className="lede">{isPassport ? t.passportLede(passport.young, passport.budget, PASSPORT_YOUNG_AGE) : lede}</p>
      )}
      <div className="r-layout">
        {rail}
        <div className="r-main">
          <SegmentSwitch
            label={t.switchLabel}
            value={which}
            onChange={setWhich}
            segments={[
              { value: 'budget', label: t.viewBudget, count: total },
              { value: 'passport', label: t.viewPassport, count: passport.total },
            ]}
          />
          {isPassport ? (
            <PassportView players={bosnians} budget={sharedBudget} onOpen={open} />
          ) : total === 0 ? (
            <EmptyState title={t.emptyBlockTitle} text={t.emptyText} action={<Button onClick={reset}>{t.reset}</Button>} />
          ) : (
            <>
              <ValueOutlookPlot players={plotRows} pool={players} budget={sharedBudget} onOpen={open} />
              <Sheet className="r-table">
              <DataTable columns={columns} rows={shown} rowKey={(p) => p.id} label={t.tableLabel} onRowAction={open} />
              <div className="r-foot">
                <p className="caption">{t.showing(shown.length, total)}</p>
                {shown.length < total ? <Button onClick={() => setShowAll(true)}>{t.showAll}</Button> : null}
              </div>
              </Sheet>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** The radar at /radar: filter rail on the left, ranked table on the right. */
export function Radar() {
  const state = useData();
  if (state.status === 'loading') return <RadarLoading />;
  if (state.status === 'error') {
    return (
      <>
        <p className="kicker">{t.kicker}</p>
        <ErrorState file={state.error.file} reason={t.errorReason} onRetry={state.retry} />
      </>
    );
  }
  return <RadarScreen data={state.data} />;
}
