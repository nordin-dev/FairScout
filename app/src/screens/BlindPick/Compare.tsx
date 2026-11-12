import { BigStatRow } from '../../components/BigStatRow';
import { Button } from '../../components/Button';
import { DetailBlock } from '../../components/DetailBlock';
import { RedactionBar } from '../../components/RedactionBar';
import { Sheet } from '../../components/Sheet';
import { Tag } from '../../components/Tag';
import { TierBadge } from '../../components/TierBadge';
import { useNavigate } from 'react-router-dom';
import { MATTERS, type Matter } from '../../lib/brief';
import { money, thousands } from '../../lib/format';
import { pickReason, positiveDrivers, reasonSentence, type ReasonRow } from '../../lib/pickreason';
import { useReveal } from '../../lib/keys';
import {
  addBlindPick,
  getState,
  setBlindStep,
  setModelPick,
  setOrigin,
  useBlindPicks,
  useBlindStep,
  useBrief,
  useBudget,
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

/** Picks a player: reveals the three and remembers the scout's pick and the model's pick. */
function pick(trio: Trio, scoutId: string): void {
  if (revealedPick(trio)) return;
  setBlindStep('revealed');
  setModelPick(trio.modelTop.id);
  addBlindPick({ scoutId, modelId: trio.modelTop.id });
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

/** Step two of the blind pick: three dossiers without names, then the reveal and the verdict. */
export function Compare({ trio }: { trio: Trio }) {
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
          <Button
            onClick={() => {
              setOrigin('blind');
              navigate(`/player/${trio.modelTop.id}`);
            }}
          >
            {blind.seeWhy}
          </Button>
        </Sheet>
      )}
      <DetailBlock>
        <p className="caption detail-cap">{blind.detailCaption}</p>
      </DetailBlock>
    </>
  );
}
