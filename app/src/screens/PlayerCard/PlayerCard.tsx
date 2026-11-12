import { dataText } from '../../lib/dataText';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AddPickButton } from '../../components/AddPickButton';
import { Button } from '../../components/Button';
import { DotRow } from '../../components/DotRow';
import { DetailBlock } from '../../components/DetailBlock';
import { FactTile } from '../../components/FactTile';
import { Flag } from '../../components/Flag';
import { Meter } from '../../components/Meter';
import { RatingSteps, type RatingStep } from '../../components/RatingSteps';
import { EmptyState, ErrorState, LoadingNote, Skeleton } from '../../components/ScreenState';
import { Sheet } from '../../components/Sheet';
import { NotePanel } from './NotePanel';
import { SimilarPanel } from './SimilarPanel';
import { useData } from '../../lib/data';
import { FLAG_ORDER, bornLateTimes, outlookOf, pickDrivers } from '../../lib/outlook';
import { monthYear, money, thousands } from '../../lib/format';
import { adjustmentPercent, fixed2, isLimitedPosition, ratingOf, signedPercent } from '../../lib/rating';
import { useOrigin, type Origin } from '../../lib/store';
import { player as t } from '../../lib/text.en';
import type { EvidenceFile, Player } from '../../lib/types';
import { ProjectionPanel } from './ProjectionPanel';
import './PlayerCard.css';

const BACK: Record<Origin, { to: string; text: () => string }> = {
  blind: { to: '/blind', text: () => t.backToBlind },
  radar: { to: '/radar', text: () => t.backToRadar },
};

const pct = (fraction: number): number => Math.round(fraction * 100);

function BackLink() {
  const origin = useOrigin();
  return (
    <Link className="back" to={BACK[origin].to}>
      {BACK[origin].text()}
    </Link>
  );
}

function Header({ p }: { p: Player }) {
  const finite = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
  const contract = monthYear(p.contract_until);
  return (
    <div className="p-head">
      <div>
        <BackLink />
        <h1>{p.name}</h1>
        <p className="lede">{t.headline(dataText(p.position), Math.floor(p.age), p.club, p.league_name)}</p>
        <AddPickButton sport="football" id={p.id} name={p.name} line={`${p.club} · ${p.league_name}`} tier={p.tier} from="card" />
      </div>
      <div className="tiles">
        <FactTile label={t.tilePrice} value={finite(p.value_eur) ? money(p.value_eur) : null} caption={t.priceCaption} />
        <FactTile
          label={t.tileContract}
          value={contract}
          caption={p.flags.contract_ending ? t.contractFinal : t.contractEnd}
        />
        <FactTile
          label={t.tileMinutes}
          value={finite(p.minutes) ? thousands(p.minutes) : null}
          caption={finite(p.role) ? t.minutesCaption(pct(p.role)) : t.unknown}
        />
      </div>
    </div>
  );
}

function attackSteps(p: Player): RatingStep[] {
  const group = t.groups[p.position_group];
  const factor = fixed2(p.league_factor);
  const easier = p.league_factor >= 1;
  const adj = adjustmentPercent(p.league_factor);
  return [
    {
      label: t.stepDid,
      figure: fixed2(p.ga90),
      caption: t.didCaption,
      tip: t.didTip(p.goals, p.assists, thousands(p.minutes)),
    },
    {
      label: t.stepLeague,
      figure: signedPercent(adj),
      caption: t.leagueCaption(p.league_name, easier),
      tip: t.leagueTip(factor, p.league_name, Math.abs(adj), easier, p.league_factor_source === 'estimate'),
    },
    { label: t.stepScale, figure: fixed2(p.ga90_adj), caption: t.scaleCaption, tip: t.scaleTip(fixed2(p.ga90), factor) },
    {
      label: t.stepRating,
      figure: (
        <>
          {ratingOf(p)}
          <small>{t.outOf}</small>
        </>
      ),
      caption: t.ratingCaption(ratingOf(p), group),
      tip: t.ratingTip(group),
      final: true,
    },
  ];
}

function limitedSteps(p: Player): RatingStep[] {
  const group = t.groups[p.position_group];
  return [
    { label: t.stepPlays, figure: `${pct(p.role)}%`, caption: t.playsCaption },
    {
      label: t.stepRatingLimited,
      figure: (
        <>
          {ratingOf(p)}
          <small>{t.outOf}</small>
        </>
      ),
      caption: t.ratingLimitedCaption(ratingOf(p), group),
      tip: t.ratingLimitedTip(group),
      final: true,
    },
  ];
}

function OutlookPanel({ p, evidence, retry }: { p: Player; evidence: EvidenceFile; retry: () => void }) {
  if (!p.in_pool || p.tier === null) {
    return (
      <Sheet>
        <p className="label">{t.outlookLabel}</p>
        <p className="lede">{t.notRated}</p>
      </Sheet>
    );
  }
  const o = outlookOf(evidence, p.tier);
  if (!o) return <ErrorState file="evidence.json" reason={t.outlookErrorReason} onRetry={retry} />;
  const like = t.outlookLike(o.like);
  const average = t.outlookAverage(o.average);
  return (
    <Sheet>
      <p className="label">{t.outlookLabel}</p>
      <span className="hero-fig">{t.tierFigure(o.tier)}</span>
      <DotRow filled={o.like} strong={like[0]} rest={like[1]} />
      <DotRow filled={o.average} context strong={average[0]} rest={average[1]} />
      <DetailBlock>
        <p className="caption d-note">
          {t.outlookDetail(o.tier, o.tierHits, o.tierN, thousands(o.poolHits), thousands(o.poolPlayers), o.madeIt)}
        </p>
      </DetailBlock>
    </Sheet>
  );
}

const reasonsOf = (p: Player) => (p.in_pool ? pickDrivers(p) : []);
const flagsOf = (p: Player) => FLAG_ORDER.filter((key) => p.flags[key]);

function WhyPanel({ p, evidence }: { p: Player; evidence: EvidenceFile }) {
  const reasons = reasonsOf(p);
  const flags = flagsOf(p);
  if (reasons.length === 0 && flags.length === 0) return null;
  const tip = (key: (typeof FLAG_ORDER)[number]): string => {
    const tips = t.flagTips;
    return key === 'born_q4' ? tips.born_q4(bornLateTimes(evidence)) : tips[key];
  };
  return (
    <Sheet>
      <p className="label">{t.whyLabel}</p>
      {reasons.length > 0 ? (
        <ul className="drivers">
          {reasons.map((d) => (
            <li key={d.key} className={d.sign === '+' ? 'plus' : 'minus'}>
              <span className="sign" aria-hidden="true">
                {d.sign === '+' ? t.plusSign : t.minusSign}
              </span>
              <span>
                <span className="sr-only">{d.sign === '+' ? t.plusLabel : t.minusLabel}: </span>
                {dataText(d.text)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {flags.length > 0 ? (
        <p className="p-flags">
          {flags.map((key) => (
            <Flag key={key} size="large" warning={key === 'low_sample'} tip={tip(key)}>
              {t.flagLabels[key]}
            </Flag>
          ))}
        </p>
      ) : null}
    </Sheet>
  );
}

function Card({
  p,
  players,
  evidence,
  lastDate,
  retry,
}: {
  p: Player;
  players: Player[];
  evidence: EvidenceFile;
  lastDate: string;
  retry: () => void;
}) {
  const limited = isLimitedPosition(p);
  const estimate = p.league_factor_source === 'estimate';
  return (
    <>
      <Header p={p} />
      <Sheet>
        <p className="label">{t.flowTitle}</p>
        {limited ? (
          <p className="p-limited">
            <Flag size="large" warning tip={t.limitedTip}>
              {t.limitedFlag}
            </Flag>
          </p>
        ) : null}
        <RatingSteps steps={limited ? limitedSteps(p) : attackSteps(p)} />
        <DetailBlock>
          <div className="d-note">
            <div className="meters" style={{ maxWidth: 520 }}>
              <Meter label={t.meterGoals(pct(p.involvement))} value={p.pct.involvement} />
              <Meter label={t.meterTime(pct(p.role))} value={p.pct.role} />
            </div>
            <p className="caption" style={{ marginTop: 12 }}>
              {t.meterNote(p.league_name, fixed2(p.league_factor), estimate)}
            </p>
          </div>
        </DetailBlock>
      </Sheet>
      <div className={p.in_pool ? 'p-row2' : 'p-row2 solo'}>
        <OutlookPanel p={p} evidence={evidence} retry={retry} />
        {p.in_pool ? <ProjectionPanel p={p} evidence={evidence} lastDate={lastDate} /> : null}
      </div>
      {p.in_pool ? (
        <div className="p-row3">
          <WhyPanel p={p} evidence={evidence} />
          <SimilarPanel p={p} players={players} />
          <NotePanel p={p} />
        </div>
      ) : reasonsOf(p).length + flagsOf(p).length > 0 ? (
        <div className="p-row3 solo">
          <WhyPanel p={p} evidence={evidence} />
        </div>
      ) : null}
    </>
  );
}

function CardLoading() {
  return (
    <div aria-busy="true">
      <div className="p-head">
        <div>
          <BackLink />
          <Skeleton className="sk-name" />
          <Skeleton className="sk-sub" />
        </div>
        <div className="tiles">
          {[t.tilePrice, t.tileContract, t.tileMinutes].map((label) => (
            <div className="tile" key={label}>
              <span className="label">{label}</span>
              <Skeleton style={{ width: 90, height: 30 }} />
            </div>
          ))}
        </div>
      </div>
      <Sheet aria-busy="true">
        <p className="label">{t.flowTitle}</p>
        <RatingSteps
          steps={[t.stepDid, t.stepLeague, t.stepScale, t.stepRating].map((label, i) => ({
            label,
            figure: <Skeleton className="sk-fig" />,
            caption: [],
            final: i === 3,
          }))}
        />
      </Sheet>
      <LoadingNote>{t.loadingNote}</LoadingNote>
    </div>
  );
}

/** The player card at /player/:id: header, three facts and the rating laid out step by step. */
export function PlayerCard() {
  const { id } = useParams();
  const state = useData();
  const navigate = useNavigate();

  if (state.status === 'loading') return <CardLoading />;
  if (state.status === 'error') {
    return (
      <>
        <BackLink />
        <ErrorState file={state.error.file} reason={t.errorReason} onRetry={state.retry} />
      </>
    );
  }
  const p = state.data.players.find((x) => x.id === id);
  if (!p) {
    return (
      <EmptyState
        title={t.notFoundTitle}
        text={t.notFoundText}
        action={<Button onClick={() => navigate('/radar')}>{t.notFoundButton}</Button>}
      />
    );
  }
  return (
    <Card
      p={p}
      players={state.data.players}
      evidence={state.data.evidence}
      lastDate={state.data.meta.source_last_date}
      retry={state.retry}
    />
  );
}

