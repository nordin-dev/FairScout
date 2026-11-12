import { Button } from '../../components/Button';
import { ChoiceChips } from '../../components/ChoiceChips';
import { Sheet } from '../../components/Sheet';
import { AGE_LIMITS, BASKET_MATTERS, canShowThree, countMatches, HIDDEN_LIMITS, POSITIONS } from '../../lib/basketball/blind';
import { setHidden, setMaxAge, setPosition, setStep, toggleMatter, useBlindState } from '../../lib/basketball/blindStore';
import { basketBlind as t } from '../../lib/basketball/blindText';
import type { BasketPlayer } from '../../lib/basketball/types';
import '../BlindPick/Brief.css';

/** Step one: the scout states the need before he sees anyone. */
export function BasketBlindBrief({ players }: { players: readonly BasketPlayer[] }) {
  const { brief } = useBlindState();
  const count = countMatches(players, brief);
  const enabled = canShowThree(count);
  return (
    <>
      <p className="kicker">{t.kicker}</p>
      <h1>{t.question}</h1>
      <Sheet className="brief">
        <div className="b-row">
          <span className="label">{t.positionLabel}</span>
          <ChoiceChips
            label={t.positionLabel}
            options={t.positions}
            selected={brief.position}
            onChange={(v) => setPosition(POSITIONS.find((x) => x === v) ?? brief.position)}
          />
        </div>
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
            onChange={(v) => toggleMatter(BASKET_MATTERS.find((m) => m === v) ?? BASKET_MATTERS[0])}
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
