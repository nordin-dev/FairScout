import { useNavigate } from 'react-router-dom';
import { AddPickButton } from '../../components/AddPickButton';
import { BigStatRow } from '../../components/BigStatRow';
import { Button } from '../../components/Button';
import { RedactionBar } from '../../components/RedactionBar';
import { Sheet } from '../../components/Sheet';
import { Tag } from '../../components/Tag';
import { TierBadge } from '../../components/TierBadge';
import { setOrigin } from '../../lib/store';
import { pctOf, pickReason, positiveDrivers, reasonSentence, TENNIS_MATTERS, type TennisMatter, type TennisTrio } from '../../lib/tennis/blind';
import { backToBrief, getBlindState, pickPlayer, useBlindState } from '../../lib/tennis/blindStore';
import { tennisBlind as t } from '../../lib/tennis/blindText';
import type { TennisPlayer } from '../../lib/tennis/types';
import '../BlindPick/Compare.css';

const LETTERS = ['A', 'B', 'C'] as const;
const NAME_WIDTHS = [8.5, 9.5, 10.5] as const;
const COUNTRY_WIDTHS = [7, 8, 6] as const;

function pick(trio: TennisTrio, scoutId: string): void {
  if (getBlindState().step === 'revealed') return;
  pickPlayer(scoutId, trio.modelTop.id);
}

type DossierProps = {
  player: TennisPlayer;
  index: number;
  trio: TennisTrio;
  order: readonly TennisMatter[];
  matters: readonly TennisMatter[];
  revealed: boolean;
  picked: boolean;
};

function Dossier({ player, index, trio, order, matters, revealed, picked }: DossierProps) {
  const letter = LETTERS[index];
  return (
    <Sheet className={picked ? 'dossier picked' : 'dossier'} aria-label={t.candidate(letter)}>
      {picked && <span className="picked-mark">{t.yourPick}</span>}
      <header className="dossier-head">
        <span className="label">{t.candidate(letter)}</span>
        {revealed && player.id === trio.modelTop.id && <Tag variant="model">{t.tagModel}</Tag>}
        {revealed && player.id === trio.bestRanked.id && <Tag variant="goals">{t.tagRanking}</Tag>}
      </header>
      <div className="ident">
        <div className="ident-name">
          <RedactionBar text={player.name} width={NAME_WIDTHS[index]} revealed={revealed} />
        </div>
        <div className="ident-sub">
          <RedactionBar text={player.country} width={COUNTRY_WIDTHS[index]} revealed={revealed} />
        </div>
      </div>
      <div className="score">
        {order.map((m) => (
          <BigStatRow key={m} label={t.dimLabels[m]} value={pctOf(player, m)} dim={!matters.includes(m)} />
        ))}
      </div>
      <p className="facts">{t.facts(Math.floor(player.age), player.hand)}</p>
      {revealed ? (
        <>
        <div className="after">
          <div>
            <span className="label">{t.labelRanking}</span>
            <b>{t.ranking(player.rank)}</b>
          </div>
          <div>
            <span className="label">{t.labelRecord}</span>
            <b>{t.record(player.wins, player.losses)}</b>
          </div>
          <div>
            <span className="label">{t.labelOutlook}</span>
            <TierBadge tier={player.tier} size="xl" />
          </div>
        </div>
        <AddPickButton sport="tennis" id={player.id} name={player.name} line={player.country} tier={player.tier} from="blind" />
        </>
      ) : (
        <Button aria-label={t.pickLabel(letter)} onClick={() => pick(trio, player.id)}>
          {t.pick}
        </Button>
      )}
    </Sheet>
  );
}

type ReasonProps = { model: TennisPlayer; scout: TennisPlayer; modelLetter: string; scoutLetter: string };

function Reason({ model, scout, modelLetter, scoutLetter }: ReasonProps) {
  const reason = pickReason(model, scout);
  const drivers = positiveDrivers(model);
  return (
    <div className="reason">
      <table className="reason-table">
        <caption className="sr-only">{t.reasonLabel(model.name, scout.name)}</caption>
        <thead>
          <tr>
            <td />
            <th scope="col">{t.reasonCandidate(modelLetter, model.name)}</th>
            <th scope="col">{t.reasonCandidate(scoutLetter, scout.name)}</th>
          </tr>
        </thead>
        <tbody>
          {reason.rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{t.reasonRows[row.key]}</th>
              {(['model', 'scout'] as const).map((side) => {
                const value = row[side];
                return (
                  <td key={side} className={row.ahead === side ? 'lead' : undefined}>
                    {row.key === 'tier' && value ? (
                      <TierBadge tier={value as 'A' | 'B' | 'C'} />
                    ) : (
                      <span>{value === null ? t.noValue : String(value)}</span>
                    )}
                    {row.ahead === side && (
                      <>
                        {' '}
                        <span aria-hidden="true">{t.reasonAheadMark}</span>
                        <span className="sr-only"> {t.reasonAheadWord}</span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="reason-why">{reasonSentence(reason, model.name, scout.name)}</p>
      {drivers.length > 0 && <p className="reason-drivers">{t.reasonDrivers(model.name, drivers)}</p>}
      <p className="caption">{t.reasonAheadNote}</p>
    </div>
  );
}

/** Step two: three dossiers without names, then the reveal and the verdict. */
export function TennisBlindCompare({ trio }: { trio: TennisTrio }) {
  const { brief, step, lastPick } = useBlindState();
  const navigate = useNavigate();
  const scoutId = step === 'revealed' && trio.order.some((p) => p.id === lastPick?.scoutId) ? (lastPick?.scoutId ?? null) : null;
  const revealed = scoutId !== null;
  const order: TennisMatter[] = [...brief.matters, ...TENNIS_MATTERS.filter((m) => !brief.matters.includes(m))];
  const summary = t.summary(t.ageWords(brief.maxAge), brief.hidden, brief.matters.map((m) => t.matterWords[m]));
  const scoutIndex = trio.order.findIndex((p) => p.id === scoutId);
  const modelIndex = trio.order.findIndex((p) => p.id === trio.modelTop.id);
  const agree = scoutId === trio.modelTop.id;

  return (
    <>
      <h1>{t.title}</h1>
      <div className="b-summary">
        <span>{summary}</span>
        <button type="button" className="chip" onClick={backToBrief}>
          {t.change}
        </button>
      </div>
      <div className="trio">
        {trio.order.map((p, i) => (
          <Dossier key={p.id} player={p} index={i} trio={trio} order={order} matters={brief.matters} revealed={revealed} picked={p.id === scoutId} />
        ))}
      </div>
      <p className="caption trio-cap">{t.caption}</p>
      {revealed && scoutIndex >= 0 && (
        <Sheet className="verdict" aria-live="polite">
          <div>
            <p className="verdict-line">
              {agree ? t.verdictAgree(LETTERS[modelIndex]) : t.verdictDisagree(LETTERS[scoutIndex], LETTERS[modelIndex])}
            </p>
            <p className="verdict-sub">{agree ? t.verdictAgreeSub : t.verdictDisagreeSub}</p>
            {!agree && (
              <Reason model={trio.modelTop} scout={trio.order[scoutIndex]} modelLetter={LETTERS[modelIndex]} scoutLetter={LETTERS[scoutIndex]} />
            )}
          </div>
          <Button
            onClick={() => {
              setOrigin('blind');
              navigate(`/tennis/${trio.modelTop.id}`);
            }}
          >
            {t.seeWhy}
          </Button>
        </Sheet>
      )}
    </>
  );
}
