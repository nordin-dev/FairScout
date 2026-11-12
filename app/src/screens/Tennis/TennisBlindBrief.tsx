import { Button } from '../../components/Button';
import { ChoiceChips } from '../../components/ChoiceChips';
import { Sheet } from '../../components/Sheet';
import { AGE_LIMITS, canShowThree, countMatches, HIDDEN_LIMITS, TENNIS_MATTERS } from '../../lib/tennis/blind';
import { setHidden, setMaxAge, setStep, toggleMatter, useBlindState } from '../../lib/tennis/blindStore';
import { tennisBlind as t } from '../../lib/tennis/blindText';
import type { TennisPlayer } from '../../lib/tennis/types';
import '../BlindPick/Brief.css';

/** Step one: the scout states the need before he sees anyone. */
export function TennisBlindBrief({ players }: { players: readonly TennisPlayer[] }) {
  const { brief } = useBlindState();
  const count = countMatches(players, brief);
  const enabled = canShowThree(count);
  return (
    <>
      <p className="kicker">{t.kicker}</p>
      <h1>{t.question}</h1>
      <Sheet className="brief">
        <div className="b-row">
          <span className="label">{t.ageLabel}</span>
          <ChoiceChips
            label={t.ageLabel}
            options={t.ages}
            selected={String(brief.maxAge)}
            onChange={(v) => setMaxAge(AGE_LIMITS.find((a) => String(a) === v) ?? brief.maxAge)}
          />
        </div>
        <div className="b-row">
          <span className="label">{t.hiddenLabel}</span>
          <ChoiceChips
            label={t.hiddenLabel}
            options={t.hiddens}
            selected={String(brief.hidden)}
            onChange={(v) => setHidden(HIDDEN_LIMITS.find((h) => String(h) === v) ?? brief.hidden)}
          />
        </div>
        <div className="b-row">
          <span className="label">
            {t.mattersLabel}
            <small>{t.mattersHint}</small>
          </span>
          <ChoiceChips
            multiple
            label={t.mattersLabel}
            options={t.matters}
            selected={brief.matters}
            onChange={(v) => toggleMatter(TENNIS_MATTERS.find((m) => m === v) ?? TENNIS_MATTERS[0])}
          />
        </div>
        <div className="b-foot">
          <p className="b-count" aria-live="polite">
            <b>{count}</b>
            <span>{count >= 3 ? t.countPlural : t.tooFew(count)}</span>
          </p>
          <Button disabled={!enabled} onClick={() => setStep('compare')}>
            {t.showThree}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
