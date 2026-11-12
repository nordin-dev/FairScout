import { useEffect, useMemo } from 'react';
import { ErrorState, LoadingNote, Skeleton } from '../../components/ScreenState';
import { pickTrio } from '../../lib/basketball/blind';
import { backToBrief, useBlindState } from '../../lib/basketball/blindStore';
import { basketBlind as t } from '../../lib/basketball/blindText';
import { useBasket } from '../../lib/basketball/data';
import { BasketBlindBrief } from './BasketBlindBrief';
import { BasketBlindCompare } from './BasketBlindCompare';

/** The basketball blind pick at /blind: the brief first, then three unnamed players. */
export function BasketBlind() {
  const state = useBasket();
  const { brief, step } = useBlindState();
  const players = state.status === 'ready' ? state.data.players : null;
  const trio = useMemo(() => (players ? pickTrio(players, brief) : null), [players, brief]);
  const missing = step !== 'brief' && players !== null && trio === null;
  useEffect(() => {
    if (missing) backToBrief();
  }, [missing]);

  if (state.status === 'error') {
    return (
      <>
        <p className="kicker">{t.kicker}</p>
        <h1>{t.question}</h1>
        <ErrorState file={t.errorFile} reason={state.reason} onRetry={state.retry} />
      </>
    );
  }
  if (state.status === 'loading') {
    return (
      <div aria-busy="true">
        <p className="kicker">{t.kicker}</p>
        <h1>{t.question}</h1>
        <Skeleton className="sk-line" />
        <LoadingNote>{t.loadingPlayers}</LoadingNote>
      </div>
    );
  }
  if (step === 'brief' || !trio) return <BasketBlindBrief players={state.data.players} />;
  return <BasketBlindCompare trio={trio} minutes={state.data.meta.target_minutes} />;
}
