import { useEffect, useMemo } from 'react';
import { ErrorState, LoadingNote, Skeleton } from '../../components/ScreenState';
import { pickTrio } from '../../lib/tennis/blind';
import { backToBrief, useBlindState } from '../../lib/tennis/blindStore';
import { tennisBlind as t } from '../../lib/tennis/blindText';
import { useTennis } from '../../lib/tennis/data';
import { TennisBlindBrief } from './TennisBlindBrief';
import { TennisBlindCompare } from './TennisBlindCompare';

/** The tennis blind pick at /blind: the brief first, then three unnamed players. */
export function TennisBlind() {
  const state = useTennis();
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
  if (step === 'brief' || !trio) return <TennisBlindBrief players={state.data.players} />;
  return <TennisBlindCompare trio={trio} />;
}
