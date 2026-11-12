import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddPickButton } from '../../components/AddPickButton';
import { BigStatRow } from '../../components/BigStatRow';
import { ChoiceChips, type ChoiceOption } from '../../components/ChoiceChips';
import { DetailBlock } from '../../components/DetailBlock';
import { Flag } from '../../components/Flag';
import { EmptyState, ErrorState, LoadingNote, Skeleton } from '../../components/ScreenState';
import { Sheet } from '../../components/Sheet';
import { TierBadge } from '../../components/TierBadge';
import { cardPath } from '../../lib/account';
import { useReveal } from '../../lib/keys';
import { lookalikes, searchRows, suggestions, type LookMatch, type LookRow } from '../../lib/lookalike';
import { setRef, useSimilarState } from '../../lib/similarStore';
import { similar as t } from '../../lib/similarText';
import { setOrigin, type Sport } from '../../lib/store';
import './Similar.css';

/** The words that differ by sport. */
export type SimilarWords = {
  question: string;
  title: (name: string, limit: string) => string;
  limitLabel: string;
  costLabel: string;
  scores: readonly string[];
  detail: string;
};

type Props = {
  sport: Sport;
  rows: readonly LookRow[];
  words: SimilarWords;
  /** The limit as a cost: matches cost at most this. */
  limit: number;
  /** The limit as the headline says it: "€500k", "300", "10". */
  limitText: string;
  limitOptions: readonly ChoiceOption<string>[];
  selectedLimit: string;
  onLimit: (value: string) => void;
  /** How much further within reach a match is than the named player: "73× cheaper". */
  gap: (ref: LookRow, row: LookRow) => string;
  /** Told the id of the best match, or null: the frame uses it for the right-arrow key. */
  onTop?: (id: string | null) => void;
};

function Scores({ row, labels }: { row: LookRow; labels: readonly string[] }) {
  return (
    <div className="score sim-scores">
      {(row.scores ?? []).map((v, i) => (
        <BigStatRow key={labels[i]} label={labels[i]} value={v} />
      ))}
    </div>
  );
}

function Adjust({ row }: { row: LookRow }) {
  if (!row.adjust) return null;
  return (
    <p className="sim-adjust">
      <span className="label">{t.adjustLabel(row.adjust.where)}</span>
      <span>
        <b>{row.adjust.raw}</b> {t.adjustRaw} → <b>{row.adjust.adjusted}</b> {t.adjustAdjusted}
      </span>
    </p>
  );
}

type CardProps = { sport: Sport; match: LookMatch; refRow: LookRow; words: SimilarWords; gap: Props['gap'] };

function MatchCard({ sport, match, refRow, words, gap }: CardProps) {
  const navigate = useNavigate();
  const { row } = match;
  return (
    <Sheet className="sim-card" aria-label={t.matchLabel(row.name)}>
      <header className="sim-card-head">
        <span className="sim-pct">
          <b>{t.percent(match.similarity)}</b>
          {t.similarWord}
        </span>
        {row.tier ? <TierBadge tier={row.tier} size="xl" /> : null}
      </header>
      <div className="sim-id">
        <span className="sim-name">{row.name}</span>
        <span className="sim-sub">{row.line}</span>
      </div>
      <div className="sim-price">
        <div className="sim-cost">
          <span className="label">{words.costLabel}</span>
          <b>{row.costText}</b>
        </div>
        <span className="sim-gap">{gap(refRow, row)}</span>
      </div>
      <Scores row={row} labels={words.scores} />
      <Adjust row={row} />
      <p className="sim-facts">{row.facts}</p>
      {row.flags.length > 0 && (
        <div className="sim-flags">
          {row.flags.map((f) => (
            <Flag key={f} warning>
              {f}
            </Flag>
          ))}
        </div>
      )}
      <div className="sim-actions">
        <AddPickButton sport={sport} id={row.id} name={row.name} line={row.line} tier={row.tier} from="similar" />
        <button
          type="button"
          className="sim-open"
          onClick={() => {
            setOrigin('similar');
            navigate(cardPath({ sport, id: row.id }));
          }}
        >
          {t.openCard}
        </button>
      </div>
    </Sheet>
  );
}

/** Section 01 for one sport: name a player out of reach, see the three most like him within reach. */
export function SimilarScreen({ sport, rows, words, limit, limitText, limitOptions, selectedLimit, onLimit, gap, onTop }: Props) {
  const chosen = useSimilarState().ref[sport];
  const [query, setQuery] = useState('');
  const refRow = rows.find((r) => r.id === chosen && r.compare) ?? null;
  const picks = query.trim() ? searchRows(rows, query) : suggestions(rows);
  const matches = refRow ? lookalikes(refRow, rows, limit) : [];
  const topId = matches[0]?.row.id ?? null;
  const firstPick = picks[0]?.id ?? null;

  useReveal(() => {
    if (!refRow && firstPick) setRef(sport, firstPick);
  });
  useEffect(() => {
    onTop?.(topId);
  }, [onTop, topId]);

  return (
    <>
      <p className="kicker">{t.kicker}</p>
      <h1>{refRow ? words.title(refRow.name, limitText) : words.question}</h1>
      <div className="sim-controls">
        <span className="label">{words.limitLabel}</span>
        <ChoiceChips label={words.limitLabel} options={limitOptions} selected={selectedLimit} onChange={onLimit} />
      </div>
      {refRow ? (
        <>
          <Sheet className="sim-ref" aria-label={`${t.wanted}: ${refRow.name}`}>
            <div className="sim-ref-id">
              <span className="label">{t.wanted}</span>
              <span className="sim-name">{refRow.name}</span>
              <span className="sim-sub">{refRow.line}</span>
              <Adjust row={refRow} />
            </div>
            <div className="sim-cost">
              <span className="label">{words.costLabel}</span>
              <b>{refRow.costText}</b>
            </div>
            <Scores row={refRow} labels={words.scores} />
            <button type="button" className="chip" onClick={() => setRef(sport, null)}>
              {t.change}
            </button>
          </Sheet>
          {matches.length === 0 ? (
            <EmptyState title={t.emptyTitle} text={t.emptyText} />
          ) : (
            <div className="sim-trio">
              {matches.map((m) => (
                <MatchCard key={m.row.id} sport={sport} match={m} refRow={refRow} words={words} gap={gap} />
              ))}
            </div>
          )}
          <p className="caption sim-cap">{t.caption}</p>
        </>
      ) : (
        <Sheet className="sim-find">
          <label className="label" htmlFor="sim-search">
            {t.searchLabel}
          </label>
          <input
            id="sim-search"
            className="sim-search"
            type="search"
            autoComplete="off"
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {picks.length === 0 ? (
            <p className="sim-none" role="status">
              {t.noneFound}
            </p>
          ) : (
            <div className="sim-picks" role="group" aria-label={t.suggestionsLabel}>
              {picks.map((r) => (
                <button key={r.id} type="button" className="sim-pick" onClick={() => setRef(sport, r.id)}>
                  <b>{r.name}</b>
                  <span className="sim-pick-cost">{r.costText}</span>
                  <span className="sim-pick-line">{r.line}</span>
                </button>
              ))}
            </div>
          )}
        </Sheet>
      )}
      <DetailBlock>
        <p className="caption sim-detail">{words.detail}</p>
      </DetailBlock>
    </>
  );
}

/** The screen while its file loads. */
export function SimilarLoading({ question }: { question: string }) {
  return (
    <div aria-busy="true">
      <p className="kicker">{t.kicker}</p>
      <h1>{question}</h1>
      <Skeleton className="sk-line" />
      <LoadingNote>{t.loadingPlayers}</LoadingNote>
    </div>
  );
}

/** The screen when its file did not load. */
export function SimilarError({ question, file, reason, onRetry }: { question: string; file: string; reason: string; onRetry: () => void }) {
  return (
    <>
      <p className="kicker">{t.kicker}</p>
      <h1>{question}</h1>
      <ErrorState file={file} reason={reason} onRetry={onRetry} />
    </>
  );
}
