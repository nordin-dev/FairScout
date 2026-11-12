import { BigStatRow } from '../../components/BigStatRow';
import { Button } from '../../components/Button';
import { DetailBlock } from '../../components/DetailBlock';
import { RedactionBar } from '../../components/RedactionBar';
import { Sheet } from '../../components/Sheet';
import { Tag } from '../../components/Tag';
import { TierBadge } from '../../components/TierBadge';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MATTERS, type Matter } from '../../lib/brief';
import { biasSummary, leans, shareGap, signalsOf, SHARE_GAP_PP, SUMMARY_MIN_PICKS, SUMMARY_SOLID_PICKS } from '../../lib/fairness';
import { money, thousands } from '../../lib/format';
import { pickReason, positiveDrivers, reasonSentence, type ReasonRow } from '../../lib/pickreason';
import { useReveal } from '../../lib/keys';
import {
  addBlindPick,
  clearBlindPicks,
  getState,
  nextBlindRound,
  setBlindStep,
  setModelPick,
  setOrigin,
  useBlindPicks,
  useBlindStep,
  useBrief,
  useBudget,
  type BlindPick as BlindPickRecord,
} from '../../lib/store';
import { blind } from '../../lib/text.en';
import type { Trio } from '../../lib/trio';
import type { Player, Tier } from '../../lib/types';
import './Compare.css';

const LETTERS = ['A', 'B', 'C'] as const;
const NAME_WIDTHS = [8.5, 9.5, 10.5] as const;
const CLUB_WIDTHS = [17, 19, 15] as const;
const SCORE: Record<Matter, (p: Player) => number> = {
  creates: (p) => p.pct.creating,
  scores: (p) => p.pct.scoring,
  plays: (p) => p.pct.role,
};

const label = (options: readonly { value: string; label: string }[], value: string): string =>
  options.find((o) => o.value === value)?.label ?? value;

/** The scout's last pick, when the step is "revealed" and that player is one of the three shown. */
function revealedPick(trio: Trio): string | null {
  const { blindStep, blindPicks } = getState();
  const last = blindPicks[blindPicks.length - 1]?.scoutId ?? null;
  return blindStep === 'revealed' && trio.order.some((p) => p.id === last) ? last : null;
}

/** Picks a player: reveals the three and remembers the scout's pick, the model's pick and who was shown. */
function pick(trio: Trio, scoutId: string): void {
  if (revealedPick(trio)) return;
  setBlindStep('revealed');
  setModelPick(trio.modelTop.id);
  addBlindPick({ scoutId, modelId: trio.modelTop.id, shown: trio.order.map((p) => p.id) });
}

/** The easy-to-overlook signs of a revealed player. */
function Signals({ player }: { player: Player }) {
  const signals = signalsOf(player);
  if (signals.length === 0) return null;
  return (
    <div className="signals" aria-label={blind.signalsLabel}>
      <span className="label">{blind.signalsLabel}</span>
      <div className="signal-tags">
        {signals.map((s) => (
          <Tag key={s} variant="signal" title={blind.signalTips[s]}>
            {blind.signals[s]}
          </Tag>
        ))}
      </div>
    </div>
  );
}

function LeanRow({ label, value, strong }: { label: string; value: string; strong: boolean }) {
  return (
    <tr className={strong ? 'lead' : undefined}>
      <th scope="row">{label}</th>
      <td>{value}</td>
    </tr>
  );
}

/** What drove the scout's picks so far: shown from the third pick on. */
function PickSummary({ picks, players }: { picks: readonly BlindPickRecord[]; players: readonly Player[] }) {
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const summary = biasSummary(picks, byId);
  if (!summary) {
    return <p className="caption summary-wait">{blind.summaryWaiting(Math.min(picks.length, SUMMARY_MIN_PICKS), SUMMARY_MIN_PICKS)}</p>;
  }
  const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((100 * a) / b));
  const earlyGap = shareGap(summary.bornEarly);
  const overlookedGap = shareGap(summary.overlooked);
  const lead = leans(summary.output)
    ? blind.summaryLead.output
    : leans(summary.minutes)
      ? blind.summaryLead.minutes
      : earlyGap >= SHARE_GAP_PP
        ? blind.summaryLead.early
        : overlookedGap <= -SHARE_GAP_PP
          ? blind.summaryLead.overlookedLow
          : blind.summaryLead.balanced;
  const s = summary;
  return (
    <Sheet className="pick-summary" aria-label={blind.summaryTitle}>
      <header className="summary-head">
        <span className="label">{blind.summaryTitle}</span>
        <button type="button" className="chip" onClick={clearBlindPicks}>
          {blind.summaryClear}
        </button>
      </header>
      <p className="summary-lead">{lead}</p>
      {s.picks < SUMMARY_SOLID_PICKS && <p className="caption">{blind.summaryHint(s.picks)}</p>}
      <table className="summary-table">
        <tbody>
          <LeanRow label={blind.summaryRows.model} value={blind.summaryLean(s.model.hits, s.picks, s.model.chance)} strong={false} />
          <LeanRow label={blind.summaryRows.output} value={blind.summaryLean(s.output.hits, s.picks, s.output.chance)} strong={leans(s.output)} />
          <LeanRow label={blind.summaryRows.minutes} value={blind.summaryLean(s.minutes.hits, s.picks, s.minutes.chance)} strong={leans(s.minutes)} />
          <LeanRow
            label={blind.summaryRows.early}
            value={blind.summaryShare(pct(s.bornEarly.picked, s.bornEarly.pickedOf), pct(s.bornEarly.shown, s.bornEarly.shownOf))}
            strong={earlyGap >= SHARE_GAP_PP}
          />
          <LeanRow
            label={blind.summaryRows.overlooked}
            value={blind.summaryShare(pct(s.overlooked.picked, s.overlooked.pickedOf), pct(s.overlooked.shown, s.overlooked.shownOf))}
            strong={overlookedGap <= -SHARE_GAP_PP}
          />
        </tbody>
      </table>
      {s.passedOverlooked.length > 0 && <p className="summary-passed">{blind.summaryPassed(s.passedOverlooked.length)}</p>}
      <p className="caption">{blind.summaryWhy}</p>
    </Sheet>
  );
}

type DossierProps = {
  player: Player;
  index: number;
  trio: Trio;
  order: readonly Matter[];
  matters: readonly Matter[];
  position: string;
  revealed: boolean;
  picked: boolean;
};

function Dossier({ player, index, trio, order, matters, position, revealed, picked }: DossierProps) {
  const letter = LETTERS[index];
  return (
    <Sheet className={picked ? 'dossier picked' : 'dossier'} aria-label={blind.candidate(letter)}>
      {picked && <span className="picked-mark">{blind.yourPick}</span>}
      <header className="dossier-head">
        <span className="label">{blind.candidate(letter)}</span>
        {revealed && player.id === trio.modelTop.id && <Tag variant="model">{blind.tagModel}</Tag>}
        {revealed && player.id === trio.rawTop.id && <Tag variant="goals">{blind.tagGoals}</Tag>}
      </header>
      <div className="ident">
        <div className="ident-name">
          <RedactionBar text={player.name} width={NAME_WIDTHS[index]} revealed={revealed} />
        </div>
        <div className="ident-sub">
          <RedactionBar text={`${player.club} · ${player.league_name}`} width={CLUB_WIDTHS[index]} revealed={revealed} />
        </div>
      </div>
      <div className="score">
        {order.map((m) => (
          <BigStatRow key={m} label={blind.dimLabels[m]} value={SCORE[m](player)} dim={!matters.includes(m)} />
        ))}
      </div>
      <p className="facts">{blind.facts(position, Math.floor(player.age))}</p>
      {revealed ? (
        <div className="after">
          <div>
            <span className="label">{blind.labelPrice}</span>
            <b>{money(player.value_eur)}</b>
          </div>
          <div>
            <span className="label">{blind.labelGoals}</span>
            <b>{player.goals}</b>
          </div>
          <div>
            <span className="label">{blind.labelOutlook}</span>
            {player.tier ? <TierBadge tier={player.tier} size="xl" /> : <b>{blind.noTier}</b>}
          </div>
          <Signals player={player} />
        </div>
      ) : (
        <Button aria-label={blind.pickLabel(letter)} onClick={() => pick(trio, player.id)}>
          {blind.pick}
        </Button>
      )}
    </Sheet>
  );
}

function cell(row: ReasonRow, value: ReasonRow['model']): string {
  if (value === null) return blind.noTier;
  if (row.key === 'price') return money(value as number);
  if (row.key === 'minutes') return thousands(value as number);
  return String(value);
}

type ReasonProps = { model: Player; scout: Player; modelLetter: string; scoutLetter: string };

function Reason({ model, scout, modelLetter, scoutLetter }: ReasonProps) {
  const reason = pickReason(model, scout);
  const drivers = positiveDrivers(model);
  return (
    <div className="reason">
      <table className="reason-table">
        <caption className="sr-only">{blind.reasonLabel(model.name, scout.name)}</caption>
        <thead>
          <tr>
            <td />
            <th scope="col">{blind.reasonCandidate(modelLetter, model.name)}</th>
            <th scope="col">{blind.reasonCandidate(scoutLetter, scout.name)}</th>
          </tr>
        </thead>
        <tbody>
          {reason.rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{blind.reasonRows[row.key]}</th>
              {(['model', 'scout'] as const).map((side) => (
                <td key={side} className={row.ahead === side ? 'lead' : undefined}>
                  {row.key === 'tier' && row[side] ? (
                    <TierBadge tier={row[side] as Tier} />
                  ) : (
                    <span>{cell(row, row[side])}</span>
                  )}
                  {row.ahead === side && (
                    <>
                      {' '}
                      <span aria-hidden="true">{blind.reasonAheadMark}</span>
                      <span className="sr-only"> {blind.reasonAheadWord}</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="reason-why">{reasonSentence(reason, model.name, scout.name)}</p>
      {drivers.length > 0 && <p className="reason-drivers">{blind.reasonDrivers(model.name, drivers)}</p>}
      <p className="caption">{blind.reasonAheadNote}</p>
    </div>
  );
}

type CompareProps = {
  trio: Trio;
  /** The open round, from 0. */
  round?: number;
  /** Matching players not shown yet, after this round. */
  left?: number;
  /** The brief key the rounds belong to. */
  roundKey?: string;
  /** Every player, for the summary of earlier picks; without it only the three shown are known. */
  players?: readonly Player[];
};

/** Step two of the blind pick: three dossiers without names, then the reveal, the verdict and the next round. */
export function Compare({ trio, round = 0, left = 0, roundKey, players }: CompareProps) {
  const brief = useBrief();
  const budget = useBudget();
  const step = useBlindStep();
  const picks = useBlindPicks();
  const navigate = useNavigate();
  const last = picks[picks.length - 1]?.scoutId ?? null;
  const scoutId = step === 'revealed' && trio.order.some((p) => p.id === last) ? last : null;
  const revealed = scoutId !== null;

  const order: Matter[] = [...brief.matters, ...MATTERS.filter((m) => !brief.matters.includes(m))];
  const positionLabel = label(blind.positions, brief.position);
  const summary = blind.summary(
    positionLabel,
    blind.ageWords(brief.maxAge),
    money(budget),
    brief.matters.map((m) => blind.matterWords[m]),
  );

  useReveal(() => {
    if (!revealedPick(trio)) pick(trio, trio.order[1].id);
  });

  const scoutIndex = trio.order.findIndex((p) => p.id === scoutId);
  const modelIndex = trio.order.findIndex((p) => p.id === trio.modelTop.id);
  const agree = scoutId === trio.modelTop.id;

  return (
    <>
      <h1>{blind.title(blind.plurals[brief.position])}</h1>
      <div className="b-summary">
        <span>{summary}</span>
        <button
          type="button"
          className="chip"
          onClick={() => {
            setBlindStep('brief');
            setModelPick(null);
          }}
        >
          {blind.change}
        </button>
      </div>
      <p className="round-line">
        <b>{blind.roundLine(round + 1, left)}</b>
        <span>{round === 0 ? blind.firstRoundNote : blind.laterRoundNote}</span>
      </p>
      <div className="trio">
        {trio.order.map((p, i) => (
          <Dossier key={p.id} player={p} index={i} trio={trio} order={order} matters={brief.matters} position={positionLabel} revealed={revealed} picked={p.id === scoutId} />
        ))}
      </div>
      <p className="caption trio-cap">{blind.caption}</p>
      {revealed && scoutIndex >= 0 && (
        <Sheet className="verdict" aria-live="polite">
          <div>
            <p className="verdict-line">
              {agree ? blind.verdictAgree(LETTERS[modelIndex]) : blind.verdictDisagree(LETTERS[scoutIndex], LETTERS[modelIndex])}
            </p>
            <p className="verdict-sub">{agree ? blind.verdictAgreeSub : blind.verdictDisagreeSub}</p>
            {!agree && (
              <Reason
                model={trio.modelTop}
                scout={trio.order[scoutIndex]}
                modelLetter={LETTERS[modelIndex]}
                scoutLetter={LETTERS[scoutIndex]}
              />
            )}
          </div>
          <div className="verdict-actions">
            <Button
              onClick={() => {
                setOrigin('blind');
                navigate(`/player/${trio.modelTop.id}`);
              }}
            >
              {blind.seeWhy}
            </Button>
            {roundKey !== undefined &&
              (left >= 3 ? (
                <Button onClick={() => nextBlindRound(roundKey, trio.order.map((p) => p.id))}>{blind.nextThree}</Button>
              ) : (
                <p className="caption">{blind.noneLeft}</p>
              ))}
          </div>
        </Sheet>
      )}
      {revealed && <PickSummary picks={picks} players={players ?? trio.order} />}
      <DetailBlock>
        <p className="caption detail-cap">{blind.detailCaption}</p>
      </DetailBlock>
    </>
  );
}
