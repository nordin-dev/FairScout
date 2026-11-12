import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AddPickButton } from '../../components/AddPickButton';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { Flag } from '../../components/Flag';
import { Meter } from '../../components/Meter';
import { EmptyState, ErrorState, LoadingNote, Skeleton } from '../../components/ScreenState';
import { Sheet } from '../../components/Sheet';
import { TierBadge } from '../../components/TierBadge';
import {
  RANK_MAX,
  RANK_MIN,
  RANK_STEP,
  applyFilters,
  countryCounts,
  countryList,
  defaultFilters,
  ledeParts,
  sortRows,
  switchCounts,
  titleCounts,
  type TennisFilters,
} from '../../lib/tennis/radar';
import { tennisRadar as t } from '../../lib/tennis/radarText';
import { useTennis } from '../../lib/tennis/data';
import type { TennisFile, TennisPlayer } from '../../lib/tennis/types';
import { setOrigin } from '../../lib/store';
import '../Radar/Radar.css';

const PAGE = 20;

function Check({ on, label, count, onToggle }: { on: boolean; label: string; count?: number; onToggle: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} className={on ? 'check on' : 'check'} onClick={onToggle}>
      <i aria-hidden="true" />
      <span>{label}</span>
      <span className="num">{count ?? ''}</span>
    </button>
  );
}

function flagChips(p: TennisPlayer) {
  const chips = [];
  if (p.flags.under18) chips.push(<Flag key="u18">{t.flags.under18}</Flag>);
  if (p.flags.low_sample) {
    chips.push(
      <Flag key="low" warning>
        {t.flags.lowSample}
      </Flag>,
    );
  }
  if (p.top200_wins >= 3) chips.push(<Flag key="t200">{t.flags.top200(p.top200_wins)}</Flag>);
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
          {[t.rankLabel, t.country, t.age, t.plays].map((label) => (
            <div key={label}>
              <span className="label">{label}</span>
              <Skeleton style={{ display: 'block', height: 20 }} />
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

function RadarScreen({ file }: { file: TennisFile }) {
  const navigate = useNavigate();
  const players = file.players;
  const [filters, setFilters] = useState<TennisFilters>(() => defaultFilters(players));
  const [showAll, setShowAll] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const countries = useMemo(() => countryList(players), [players]);
  const counts = useMemo(() => countryCounts(players, filters), [players, filters]);
  const sw = useMemo(() => switchCounts(players, filters), [players, filters]);
  const rows = useMemo(() => sortRows(applyFilters(players, filters)), [players, filters]);
  const { total, tierA } = titleCounts(rows);
  const parts = ledeParts(file.meta, filters);
  const selected = countries.filter((c) => filters.countries.includes(c.code)).length;

  const set = (patch: Partial<TennisFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setShowAll(false);
  };
  const toggleCountry = (code: string) =>
    set({ countries: filters.countries.includes(code) ? filters.countries.filter((c) => c !== code) : [...filters.countries, code] });
  const reset = () => {
    setFilters(defaultFilters(players));
    setListOpen(false);
    setShowAll(false);
  };
  const open = (p: TennisPlayer) => {
    setOrigin('radar');
    navigate(`/tennis/${p.id}`);
  };
  const fill = `${((filters.minRank - RANK_MIN) / (RANK_MAX - RANK_MIN)) * 100}%`;

  const rail = (
    <aside className="rail" aria-label={t.railLabel}>
      <div>
        <label className="label" htmlFor="tennis-rank">
          {t.rankLabel}
        </label>
        <div className="slider" style={{ '--fill': fill } as CSSProperties}>
          <input
            id="tennis-rank"
            type="range"
            min={RANK_MIN}
            max={RANK_MAX}
            step={RANK_STEP}
            value={filters.minRank}
            aria-valuetext={t.rankValue(filters.minRank)}
            onChange={(e) => set({ minRank: Number(e.target.value) })}
          />
        </div>
        <div className="row">
          <span>{RANK_MIN}</span>
          <span className="now">{t.rankValue(filters.minRank)}</span>
          <span>{RANK_MAX}</span>
        </div>
      </div>
      <div>
        <span className="label">{t.country}</span>
        <button
          type="button"
          className={listOpen ? 'more-toggle open' : 'more-toggle'}
          aria-expanded={listOpen}
          aria-controls="tennis-countries"
          onClick={() => setListOpen((o) => !o)}
        >
          <i aria-hidden="true" />
          <span>{t.countries(countries.length, selected)}</span>
        </button>
        <div id="tennis-countries" className="more-list" role="group" aria-label={t.countriesList} hidden={!listOpen}>
          <div className="more-actions">
            <button type="button" onClick={() => set({ countries: countries.map((c) => c.code) })}>
              {t.selectAll}
            </button>
            <button type="button" onClick={() => set({ countries: [] })}>
              {t.clearAll}
            </button>
          </div>
          {countries.map((c) => (
            <Check key={c.code} on={filters.countries.includes(c.code)} label={c.name} count={counts[c.code] ?? 0} onToggle={() => toggleCountry(c.code)} />
          ))}
        </div>
      </div>
      <div>
        <span className="label">{t.age}</span>
        <Check on={filters.under18Only} label={t.under18Only} count={sw.under18} onToggle={() => set({ under18Only: !filters.under18Only })} />
      </div>
      <div>
        <span className="label">{t.plays}</span>
        <Check on={filters.leftOnly} label={t.leftOnly} count={sw.left} onToggle={() => set({ leftOnly: !filters.leftOnly })} />
      </div>
    </aside>
  );

  const columns: Column<TennisPlayer>[] = [
    { key: 'n', header: t.headers.rank, align: 'right', cell: (_p, i) => <span className="num">{i + 1}</span> },
    {
      key: 'player',
      header: t.headers.player,
      cell: (p) => (
        <>
          <span className="name">{p.name}</span>
          <span className="sub">{p.country}</span>
        </>
      ),
    },
    { key: 'age', header: t.headers.age, align: 'right', cell: (p) => <span className="num">{p.age.toFixed(1)}</span> },
    { key: 'rank', header: t.headers.ranking, align: 'right', cell: (p) => <span className="num">{p.rank}</span> },
    { key: 'ago', header: t.headers.yearAgo, align: 'right', cell: (p) => <span className="num">{p.rank_year_ago ?? t.dash}</span> },
    { key: 'wl', header: t.headers.record, align: 'right', cell: (p) => <span className="num">{t.record(p.wins, p.losses)}</span> },
    { key: 'rating', header: t.headers.rating, cell: (p) => <Meter label={t.ratingLabel} value={p.rating} /> },
    { key: 'outlook', header: t.headers.outlook, cell: (p) => <TierBadge tier={p.tier} /> },
    { key: 'notes', header: t.headers.notes, cell: flagChips },
    {
      key: 'pick',
      header: 'My picks',
      hideHeader: true,
      cell: (p) => <AddPickButton compact sport="tennis" id={p.id} name={p.name} line={p.country} tier={p.tier} from="radar" />,
    },
  ];
  const shown = showAll ? rows : rows.slice(0, PAGE);

  return (
    <>
      <p className="kicker">{t.kicker}</p>
      <h1>{total === 0 ? t.emptyTitle : `${t.title(total, filters.minRank)} ${t.tierLine(tierA)}`}</h1>
      <p className="lede">{t.lede(parts.date, parts.from, parts.to, filters.under18Only)}</p>
      <div className="r-layout">
        {rail}
        <div className="r-main">
          {total === 0 ? (
            <EmptyState title={t.emptyBlockTitle} text={t.emptyText} action={<Button onClick={reset}>{t.reset}</Button>} />
          ) : (
            <Sheet className="r-table">
              <DataTable columns={columns} rows={shown} rowKey={(p) => p.id} label={t.tableLabel} onRowAction={open} />
              <div className="r-foot">
                <p className="caption">{t.showing(shown.length, total)}</p>
                {shown.length < total ? <Button onClick={() => setShowAll(true)}>{t.showAll}</Button> : null}
              </div>
            </Sheet>
          )}
          <p className="caption" style={{ marginTop: 24 }}>
            {t.evidenceLine(file.meta.backtest.rules.find((r) => r.key === 'model')?.hits ?? 0, file.meta.backtest.picked, file.meta.backtest.pool_rate_pct)}{' '}
            <Link to="/evidence">{t.evidenceLink}</Link>
          </p>
        </div>
      </div>
    </>
  );
}

/** The tennis radar at /radar when the sport is tennis. */
export function TennisRadar() {
  const state = useTennis();
  if (state.status === 'loading') return <RadarLoading />;
  if (state.status === 'error') {
    return (
      <>
        <p className="kicker">{t.kicker}</p>
        <ErrorState file="tennis.json" reason={t.errorReason} onRetry={state.retry} />
      </>
    );
  }
  return <RadarScreen file={state.data} />;
}
