import { dataText } from '../../lib/dataText';
import { BarRanking, type BarRankingRow } from '../../components/BarRanking';
import { DataTable, type Column } from '../../components/DataTable';
import { DetailBlock } from '../../components/DetailBlock';
import { FactTile } from '../../components/FactTile';
import { NumberPair } from '../../components/NumberPair';
import { ErrorState, LoadingNote, Skeleton } from '../../components/ScreenState';
import { Sheet } from '../../components/Sheet';
import { useBasket } from '../../lib/basketball/data';
import { evidenceOf, weightLines, type Evidence, type YearRow, seasonOf } from '../../lib/basketball/evidence';
import { basketEvidence as t } from '../../lib/basketball/evidenceText';
import type { BasketFile } from '../../lib/basketball/types';
import '../Evidence/Evidence.css';

function Head({ e }: { e?: Evidence }) {
  return (
    <>
      <p className="kicker">{t.kicker}</p>
      {e ? <h1>{t.title(e)}</h1> : null}
      {e ? <p className="lede">{t.lede(e)}</p> : null}
    </>
  );
}

function Rules({ e }: { e: Evidence }) {
  const rows: BarRankingRow[] = e.rules.map((r) => ({
    key: r.key,
    label: r.label,
    value: e.picked > 0 ? r.hits / e.picked : 0,
    printed: t.printed(r.hits, e.picked, r.percent),
    tip: t.tip(r.label, r.hits, e.picked),
    emphasis: r.key === 'model',
  }));
  return (
    <Sheet>
      <p className="chart-title">{t.rulesTitle}</p>
      <BarRanking
        rows={rows}
        reference={{ value: e.poolRatePct / 100, label: t.poolLine(e.poolRatePct) }}
        title={t.chartTitle}
        size="small"
        labelWidth={140}
      />
      <p className="find-cap">{t.honest(e)}</p>
    </Sheet>
  );
}

function Tiers({ e }: { e: Evidence }) {
  if (e.tiers.length === 0) return null;
  return (
    <Sheet>
      <p className="chart-title">{t.tiersTitle}</p>
      <div className="finds4" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        {e.tiers.map((x) => (
          <FactTile key={x.tier} label={t.tierLabel(x.tier)} value={`${x.percent}%`} caption={t.tierCaption(x.hits, x.n, x.percent)} />
        ))}
      </div>
    </Sheet>
  );
}

function Years({ e }: { e: Evidence }) {
  if (e.byYear.length === 0) return null;
  const columns: Column<YearRow>[] = [
    { key: 'year', header: t.headers.year, cell: (r) => <span className="num">{seasonOf(r.year)}</span> },
    { key: 'pool', header: t.headers.pool, align: 'right', cell: (r) => <span className="num">{r.pool}</span> },
    { key: 'reached', header: t.headers.reached, align: 'right', cell: (r) => <span className="num">{r.poolHits}</span> },
    { key: 'model', header: t.headers.model, align: 'right', cell: (r) => <span className="num">{t.ofCount(r.modelHits, r.picked)}</span> },
    { key: 'rank', header: t.headers.rank, align: 'right', cell: (r) => <span className="num">{t.ofCount(r.rankHits, r.picked)}</span> },
  ];
  return (
    <Sheet>
      <p className="chart-title">{t.yearsTitle}</p>
      <DataTable columns={columns} rows={e.byYear} rowKey={(r) => String(r.year)} label={t.yearsLabel} />
      <p className="find-cap">{t.tally(e.tally)}</p>
    </Sheet>
  );
}

function Method({ e, file }: { e: Evidence; file: BasketFile }) {
  const meta = file.meta;
  const inputs = weightLines(meta.weights).map((w) => {
    const [name, plus, minus] = t.inputs[w.key] ?? [w.key, '', ''];
    return { key: w.key, name, words: w.positive ? plus : minus };
  });
  return (
    <div className="d-grid">
      <Sheet>
        <p className="chart-title" style={{ fontSize: 16 }}>{t.methodTitle}</p>
        <ul className="plain">
          {t.method(e, meta.trained_on.players, dataText(meta.pool_rule), dataText(meta.outcome)).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Sheet>
      <Sheet>
        <p className="chart-title" style={{ fontSize: 16 }}>{t.inputsTitle}</p>
        <ul className="plain">
          {inputs.map((i) => (
            <li key={i.key}><strong>{i.name}: </strong>{t.inputLine(i.words)}</li>
          ))}
        </ul>
      </Sheet>
      <Sheet>
        <p className="chart-title" style={{ fontSize: 16 }}>{t.limitsTitle}</p>
        <ul className="plain">
          {t.limits.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Sheet>
      <p className="caption d-wide">{meta.source}</p>
    </div>
  );
}

function Ready({ file }: { file: BasketFile }) {
  const e = evidenceOf(file.meta.backtest);
  return (
    <>
      <Head e={e} />
      <div className="e-stack">
        <Sheet>
          <NumberPair
            first={{ figure: `${e.modelPercent}%`, label: t.heroFirst(e) }}
            second={{ figure: `${e.poolRatePct}%`, label: t.heroSecond(e) }}
          />
        </Sheet>
        <Rules e={e} />
        <Tiers e={e} />
        <Years e={e} />
      </div>
      <DetailBlock>
        <Method e={e} file={file} />
      </DetailBlock>
    </>
  );
}

function Loading() {
  return (
    <div aria-busy="true">
      <Head />
      <Skeleton className="sk-h1" />
      <Skeleton className="sk-lede" />
      <div className="e-stack">
        <Sheet aria-busy="true">
          <div className="e-sk-list">
            {[62, 54, 30, 28].map((w) => (
              <Skeleton key={w} style={{ width: `${w}%`, height: 24 }} />
            ))}
          </div>
        </Sheet>
      </div>
      <LoadingNote>{t.loadingNote}</LoadingNote>
    </div>
  );
}

/** The basketball evidence at /evidence when the sport is basketball. */
export function BasketEvidence() {
  const state = useBasket();
  if (state.status === 'loading') return <Loading />;
  if (state.status === 'error') {
    return (
      <>
        <Head />
        <ErrorState file="basketball.json" reason={t.errorReason} onRetry={state.retry} />
      </>
    );
  }
  return <Ready file={state.data} />;
}
