import type { KeyboardEvent } from "react";
import { money } from "../lib/format";
import {
  logPosition,
  outlookPosition,
  priceDomain,
  priceTicks,
} from "../lib/scales";
import { plot as t } from "../lib/text.en";
import type { Player } from "../lib/types";
import { Sheet } from "./Sheet";
import "./ValueOutlookPlot.css";

type Props = {
  /** The players to draw, in the order of the ranked list. */
  players: readonly Player[];
  /** The whole pool; the tier A line sits at its lowest tier A outlook. */
  pool: readonly Player[];
  budget: number;
  /** A click or Enter on a dot. */
  onOpen: (player: Player) => void;
};

const W = 960;
const H = 308;
const M = { l: 52, r: 20, t: 26, b: 38 };
const PW = W - M.l - M.r;
const PH = H - M.t - M.b;
const LABEL_W = 130;

const drawable = (p: Player) => p.value_eur > 0 && p.score_rank_pct !== null;

/** Price against outlook, one dot per player; cheap and promising is the top-left corner. */
export function ValueOutlookPlot({
  players,
  pool,
  budget,
  onOpen,
}: Props) {
  const dots = players.filter(drawable);
  const heading = (
    <>
      <p className="chart-title">{t.title}</p>
      <p className="chart-sub">{t.sub}</p>
    </>
  );
  if (dots.length < 2) {
    return (
      <Sheet className="plot-sheet plot" id="radarScatter">
        {heading}
        <p className="plot-none">{t.tooFew}</p>
      </Sheet>
    );
  }

  const { min, max } = priceDomain(dots.map((p) => p.value_eur));
  const x = (v: number) => M.l + PW * logPosition(v, min, max);
  const y = (s: number) => M.t + PH * (1 - outlookPosition(s));
  const tierAScores = pool
    .filter((p) => p.in_pool && p.tier === "A" && p.score_rank_pct !== null)
    .map((p) => p.score_rank_pct as number);
  const threshold = tierAScores.length > 0 ? Math.min(...tierAScores) : null;
  const tierACount = dots.filter((p) => p.tier === "A").length;

  const bx = x(budget);
  const anchor =
    bx - LABEL_W / 2 < M.l
      ? "start"
      : bx + LABEL_W / 2 > W - M.r
        ? "end"
        : "middle";
  const ty = threshold === null ? 0 : y(threshold);
  const tierLabelY = ty - 6 < M.t + 8 ? ty + 14 : ty - 6;

  const keyDown = (e: KeyboardEvent, p: Player) => {
    if (e.key === "Enter") onOpen(p);
  };

  return (
    <Sheet className="plot-sheet plot" id="radarScatter">
      {heading}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label={t.alt(
          dots.length,
          tierACount,
          players.length - dots.length,
        )}
      >
        {[0, 50, 100].map((s) => (
          <g key={s}>
            <line className="grid" x1={M.l} x2={W - M.r} y1={y(s)} y2={y(s)} />
            <text x={M.l - 8} y={y(s) + 4} textAnchor="end">
              {s}
            </text>
          </g>
        ))}
        {priceTicks(min, max).map((k) => (
          <text
            key={k.value}
            x={x(k.value)}
            y={H - M.b + 18}
            textAnchor="middle"
          >
            {k.label}
          </text>
        ))}
        <text x={M.l} y={H - 4}>
          {t.priceAxis}
        </text>
        <text
          x={12}
          y={M.t + 4}
          transform={`rotate(-90 12 ${M.t + 4})`}
          textAnchor="end"
        >
          {t.outlookAxis}
        </text>
        {threshold !== null ? (
          <g data-testid="plot-tier-line">
            <line className="mark" x1={M.l} x2={W - M.r} y1={ty} y2={ty} />
            <text className="dl" x={W - M.r} y={tierLabelY} textAnchor="end">
              {t.tierA}
            </text>
          </g>
        ) : null}
        <g data-testid="plot-budget-line">
          <line className="mark" x1={bx} x2={bx} y1={M.t} y2={H - M.b} />
          <text
            className="dl"
            x={anchor === "start" ? M.l : anchor === "end" ? W - M.r : bx}
            y={M.t - 8}
            textAnchor={anchor}
          >
            {t.budgetLine(money(budget))}
          </text>
        </g>
        {dots.map((p) => {
          const label = `${p.name}, ${money(p.value_eur)}, ${t.tier(p.tier)}`;
          const cls = [
            "dot",
            p.tier === "A" ? "dot-a" : "",
            p.value_eur > budget ? "dot-over" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <circle
              key={p.id}
              className={cls}
              cx={x(p.value_eur)}
              cy={y(p.score_rank_pct as number)}
              r={p.tier === "A" ? 6 : 4}
              tabIndex={0}
              role="button"
              aria-label={label}
              data-tip={label}
              data-over={p.value_eur > budget ? "true" : undefined}
              onClick={() => onOpen(p)}
              onKeyDown={(e) => keyDown(e, p)}
            />
          );
        })}
      </svg>
    </Sheet>
  );
}
