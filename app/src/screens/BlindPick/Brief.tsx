import { useEffect } from 'react';
import { ChoiceChips } from '../../components/ChoiceChips';
import { Button } from '../../components/Button';
import { ErrorState, Skeleton } from '../../components/ScreenState';
import { Sheet } from '../../components/Sheet';
import { MATTERS, MAX_AGES, POSITIONS, poolBornFrom, canShowThree, countMatches } from '../../lib/brief';
import { useData } from '../../lib/data';
import {
  BUDGETS,
  setBlindStep,
  setBudget,
  setMaxAge,
  setPosition,
  toggleMatter,
  useBlindStep,
  useBrief,
  useBudget,
} from '../../lib/store';
import { blind, states } from '../../lib/text.en';
import './Brief.css';

const isInteractive = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(t.tagName));

/** Step one of the blind pick: the scout states the need before he sees anyone. */
export function Brief() {
  const state = useData();
  const brief = useBrief();
  const budget = useBudget();
  const step = useBlindStep();

  const count = state.status === 'ready' ? countMatches(state.data.players, { ...brief, budget }) : null;
  const enabled = count !== null && canShowThree(count, brief.matters);

  useEffect(() => {
    if (step !== 'brief') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.ctrlKey || e.altKey || e.metaKey || isInteractive(e.target)) return;
      if (enabled) setBlindStep('compare');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step, enabled]);

  const head = (
    <>
      <p className="kicker">{blind.kicker}</p>
      <h1>{blind.question}</h1>
    </>
  );

  if (state.status === 'error') {
    const reason = state.error.kind === 'missing' ? states.errorMissing : states.errorMalformed;
    return (
      <>
        {head}
        <ErrorState file={state.error.file} reason={reason} onRetry={state.retry} />
      </>
    );
  }

  return (
    <>
      {head}
      <Sheet className="brief" aria-busy={count === null}>
        <div className="b-row">
          <span className="label">{blind.positionLabel}</span>
          <ChoiceChips label={blind.positionLabel} options={blind.positions} selected={brief.position} onChange={(v) => setPosition(POSITIONS.find((p) => p === v) ?? brief.position)} />
        </div>
        <div className="b-row">
          <span className="label">{blind.ageLabel}</span>
          <ChoiceChips label={blind.ageLabel} options={blind.ages(poolBornFrom(state.status === 'ready' ? state.data.meta.radar_season : null))} selected={String(brief.maxAge)} onChange={(v) => setMaxAge(MAX_AGES.find((a) => String(a) === v) ?? brief.maxAge)} />
        </div>
        <div className="b-row">
          <span className="label">{blind.budgetLabel}</span>
          <ChoiceChips
            label={blind.budgetLabel}
            options={blind.budgets}
            selected={String(budget)}
            onChange={(v) => setBudget(BUDGETS.find((b) => String(b) === v) ?? budget)}
          />
        </div>
        <div className="b-row">
          <span className="label">
            {blind.mattersLabel}
            <small>{blind.mattersHint}</small>
          </span>
          <ChoiceChips
            multiple
            label={blind.mattersLabel}
            options={blind.matters}
            selected={brief.matters}
            onChange={(v) => toggleMatter(MATTERS.find((m) => m === v) ?? MATTERS[0])}
          />
        </div>
        <div className="b-foot">
          {count === null ? (
            <p className="b-count">
              <Skeleton />
              <span role="status">{blind.loadingPlayers}</span>
            </p>
          ) : (
            <p className="b-count" aria-live="polite">
              <b>{count}</b>
              <span>{count >= 3 ? blind.countPlural : blind.tooFew(count)}</span>
            </p>
          )}
          <Button disabled={!enabled} onClick={() => setBlindStep('compare')}>
            {blind.showThree}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
