import { useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ChoiceChips } from '../../components/ChoiceChips';
import { DataTable, type Column } from '../../components/DataTable';
import { Flag } from '../../components/Flag';
import { Meter } from '../../components/Meter';
import { EmptyState, ErrorState, LoadingNote, Skeleton } from '../../components/ScreenState';
import { Sheet } from '../../components/Sheet';
import { TierBadge } from '../../components/TierBadge';
import {
  COMPETITIONS,
  MINUTES_MAX,
  MINUTES_MIN,
  MINUTES_STEP,
  applyFilters,
  competitionCounts,
  countryCounts,
  countryList,
  defaultFilters,
  ledeParts,
  positionLetter,
  sortRows,
  titleCounts,
  under20Count,
  type BasketFilters,
  type Competition,
  type PositionFilter,
} from '../../lib/basketball/radar';
import { basketRadar as t } from '../../lib/basketball/radarText';
import { useBasket } from '../../lib/basketball/data';
import type { BasketFile, BasketPlayer } from '../../lib/basketball/types';
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

function flagChips(p: BasketPlayer) {
  const chips = [];
  if (p.flags.under20) chips.push(<Flag key="u20">{t.flags.under20}</Flag>);
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
          {[t.minutesLabel, t.position, t.competition, t.country, t.age].map((label) => (
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

function RadarScreen({ file }: { file: BasketFile }) {
  const navigate = useNavigate();
  const players = file.players;
  const [filters, setFilters] = useState<BasketFilters>(() => defaultFilters(players));
  const [showAll, setShowAll] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const countries = useMemo(() => countryList(players), [players]);
  const counts = useMemo(() => countryCounts(players, filters), [players, filters]);
  const compCounts = useMemo(() => competitionCounts(players, filters), [players, filters]);
  const u20 = useMemo(() => under20Count(players, filters), [players, filters]);
  const rows = useMemo(() => sortRows(applyFilters(players, filters)), [players, filters]);
  const { total, tierA } = titleCounts(rows);
  const parts = ledeParts(file.meta, filters);
  const selected = countries.filter((c) => filters.countries.includes(c.key)).length;

  const set = (patch: Partial<BasketFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setShowAll(false);
  };
  const toggleCountry = (key: string) =>
    set({ countries: filters.countries.includes(key) ? filters.countries.filter((c) => c !== key) : [...filters.countries, key] });
  const toggleCompetition = (c: Competition) =>
    set({ competitions: filters.competitions.includes(c) ? filters.competitions.filter((x) => x !== c) : [...filters.competitions, c] });
  const reset = () => {
    setFilters(defaultFilters(players));
    setListOpen(false);
    setShowAll(false);
  };
  const open = (p: BasketPlayer) => {
    setOrigin('radar');
    navigate(`/basketball/${p.id}`);
  };
  const fill = `${((filters.maxMpg - MINUTES_MIN) / (MINUTES_MAX - MINUTES_MIN)) * 100}%`;

  const rail = (
    <aside className="rail" aria-label={t.railLabel}>
      <div>
        <label className="label" htmlFor="basket-minutes">
          {t.minutesLabel}
        </label>
        <div className="slider" style={{ '--fill': fill } as CSSProperties}>
          <input
            id="basket-minutes"
            type="range"
            min={MINUTES_MIN}
            max={MINUTES_MAX}
            step={MINUTES_STEP}
            value={filters.maxMpg}
            aria-valuetext={t.minutesValue(filters.maxMpg)}
            onChange={(e) => set({ maxMpg: Number(e.target.value) })}
          />
        </div>
        <div className="row">
          <span>{MINUTES_MIN}</span>
          <span className="now">{t.minutesValue(filters.maxMpg)}</span>
          <span>{MINUTES_MAX}</span>
        </div>
      </div>
      <div>
        <span className="label">{t.position}</span>
        <ChoiceChips<PositionFilter> label={t.position} options={t.positions} selected={filters.position} onChange={(position) => set({ position })} />
      </div>
      <div>
        <span className="label">{t.competition}</span>
        {COMPETITIONS.map((c) => (
          <Check key={c} on={filters.competitions.includes(c)} label={c} count={compCounts[c]} onToggle={() => toggleCompetition(c)} />
        ))}
      </div>
      <div>
        <span className="label">{t.country}</span>
        <button
          type="button"
          className={listOpen ? 'more-toggle open' : 'more-toggle'}
          aria-expanded={listOpen}
          aria-controls="basket-countries"
          onClick={() => setListOpen((o) => !o)}
        >
          <i aria-hidden="true" />
          <span>{t.countries(countries.length, selected)}</span>
        </button>
        <div id="basket-countries" className="more-list" role="group" aria-label={t.countriesList} hidden={!listOpen}>
          <div className="more-actions">
            <button type="button" onClick={() => set({ countries: countries.map((c) => c.key) })}>
              {t.selectAll}
            </button>
            <button type="button" onClick={() => set({ countries: [] })}>
              {t.clearAll}
            </button>
          </div>
          {countries.map((c) => (
            <Check key={c.key} on={filters.countries.includes(c.key)} label={c.name} count={counts[c.key] ?? 0} onToggle={() => toggleCountry(c.key)} />
          ))}
        </div>
      </div>
      <div>
        <span className="label">{t.age}</span>
        <Check on={filters.under20Only} label={t.under20Only} count={u20} onToggle={() => set({ under20Only: !filters.under20Only })} />
      </div>
    </aside>
  );

  const columns: Column<BasketPlayer>[] = [
    { key: 'n', header: t.headers.rank, align: 'right', cell: (_p, i) => <span className="num">{i + 1}</span> },
    {
      key: 'player',
      header: t.headers.player,
      cell: (p) => (
        <>
          <span className="name">{p.name}</span>
          <span className="sub">
            {p.team} · {p.competition}
          </span>
        </>
      ),
    },
    { key: 'pos', header: t.headers.pos, cell: (p) => positionLetter(p) ?? t.dash },
    { key: 'age', header: t.headers.age, align: 'right', cell: (p) => <span className="num">{p.age.toFixed(1)}</span> },
    { key: 'min', header: t.headers.min, align: 'right', cell: (p) => <span className="num">{p.mpg.toFixed(1)}</span> },
    { key: 'pts', header: t.headers.pts, align: 'right', cell: (p) => <span className="num">{p.ppg.toFixed(1)}</span> },
    { key: 'index', header: t.headers.index, align: 'right', cell: (p) => <span className="num">{p.pirpg.toFixed(1)}</span> },
    { key: 'rating', header: t.headers.rating, cell: (p) => <Meter label={t.ratingLabel} value={p.rating} /> },
    { key: 'outlook', header: t.headers.outlook, cell: (p) => <TierBadge tier={p.tier} /> },
    { key: 'notes', header: t.headers.notes, cell: flagChips },
  ];
  const shown = showAll ? rows : rows.slice(0, PAGE);

  return (
    <>
      <p className="kicker">{t.kicker}</p>
      <h1>{total === 0 ? t.emptyTitle : `${t.title(total, filters.maxMpg)} ${t.tierLine(tierA)}`}</h1>
      <p className="lede">{t.lede(parts.season, parts.competitions, filters.under20Only)}</p>
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

/** The basketball radar at /radar when the sport is basketball. */
export function BasketRadar() {
  const state = useBasket();
  if (state.status === 'loading') return <RadarLoading />;
  if (state.status === 'error') {
    return (
      <>
        <p className="kicker">{t.kicker}</p>
        <ErrorState file="basketball.json" reason={t.errorReason} onRetry={state.retry} />
      </>
    );
  }
  return <RadarScreen file={state.data} />;
}
