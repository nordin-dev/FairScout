import { DetailBlock } from '../../components/DetailBlock';
import { Sheet } from '../../components/Sheet';
import { ValueChart } from '../../components/ValueChart';
import { money } from '../../lib/format';
import { projectionOf, threeYearsLater } from '../../lib/projection';
import { player as t } from '../../lib/text.en';
import type { EvidenceFile, Player } from '../../lib/types';
import './ProjectionPanel.css';

const times = (m: number): string => String(Number(m.toFixed(2)));

/** Where a player of his tier ended three years later, as a range of past outcomes. Draws nothing without a tier or a value. */
export function ProjectionPanel({ p, evidence, lastDate }: { p: Player; evidence: EvidenceFile; lastDate: string }) {
  const pr = projectionOf(p, evidence);
  if (!pr) return null;
  const range = `${money(pr.low)}${t.projDash}${money(pr.high)}`;
  return (
    <Sheet>
      <p className="label">{t.projLabel}</p>
      <div className="proj-head">
        <div>
          <b>{range}</b>
          <span>{t.projRange}</span>
        </div>
        <div>
          <b>{money(pr.typical)}</b>
          <span>{t.projTypical}</span>
        </div>
      </div>
      {p.value_history.length < 2 ? (
        <p className="proj-short">{t.projShort}</p>
      ) : (
        <ValueChart
          history={p.value_history}
          decisionDate={lastDate}
          decisionValue={p.value_eur}
          multiples={pr.multiples}
          outcome={{ date: threeYearsLater(lastDate), value: null }}
          revealed={false}
          madeIt={false}
          label={t.projChart(money(p.value_eur), money(pr.low), money(pr.high), money(pr.typical))}
        />
      )}
      <DetailBlock>
        <p className="caption d-note">
          {t.projDetail(pr.tier, times(pr.multiples.p25), times(pr.multiples.p75), Math.round(pr.noLaterValue * 100))}
        </p>
      </DetailBlock>
    </Sheet>
  );
}
