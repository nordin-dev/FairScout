"""Step `tiers`: cut today's pool into tiers, give every player plain reasons and caution flags.

Inside the radar pool the top 10% by the score of the logistic regression is tier A, the next
10% tier B and the rest tier C (ties by player id). Each tier carries what the backtest found
for the same cut inside each of the six test seasons, summed: hits, count, rate, the 25th, 50th
and 75th percentile of the value multiple three seasons later (later value divided by decision
value, players with a later value only, the lower of the two middle ranks, as the prototype
does it), the players with no later value and `share_lost_value`, the share of the players with
a later value whose multiple is below 1. A reason is a phrase from a fixed dictionary: the
contribution of a feature is its coefficient times its standardised value; up to three for (the
largest above zero) and one against (the lowest below zero). The step reads the work tables and
the raw tables `players` and `games` (only for the source's last date) and writes `tiers.csv`
and `tier_stats.json` into the work folder and nothing else.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final

import numpy as np
import pandas as pd

from fairscout import backtest, config, features, ingest, model, rating
from fairscout.errors import StepError, require_file

TIERS_FILE: Final = "tiers.csv"
STATS_FILE: Final = "tier_stats.json"
TIER_NAMES: Final[tuple[str, str, str]] = ("A", "B", "C")
TIER_SHARES: Final[dict[str, str]] = {"A": "top 10%", "B": "next 10%", "C": "rest"}
CUTS: Final[tuple[float, float]] = (0.1, 0.2)
MAX_FOR: Final = 3
MAX_AGAINST: Final = 1
MIN_REASONS: Final = 2
MAX_WORDS: Final = 4
LOW_SAMPLE_MINUTES: Final = 900
ADULT_AGE: Final = 18
CONTRACT_MONTHS: Final = 12
FLAG_COLUMNS: Final[tuple[str, ...]] = (
    "flag_under18",
    "flag_low_sample",
    "flag_contract_ending",
    "flag_born_q4",
    "flag_limited_position_data",
)
TIERS_COLUMNS: Final[tuple[str, ...]] = (
    "player_id",
    "season",
    "league_id",
    "score",
    "score_gb",
    "score_rank_pct",
    "tier",
    "drivers",
    *FLAG_COLUMNS,
)

# Every model feature: the phrase for a value above the training mean and for a value below it
# (for a mark: set, not set). Each phrase describes the player; the sign of the contribution
# decides whether it counts for or against him.
PHRASES: Final[dict[str, tuple[str, str]]] = {
    "age": ("Older for his level", "Young for his level"),
    "minutes": ("Plays a lot", "Plays little"),
    "role": ("Key part of team", "Fringe role in team"),
    "goals_per90": ("Scores often", "Rarely scores"),
    "assists_per90": ("Creates many goals", "Creates few goals"),
    "output_percentile": ("Output beats peers", "Output trails peers"),
    "log_value": ("Higher market value", "Low market value"),
    "log_change": ("Value rising fast", "Value flat or falling"),
    "change_missing": ("No recent value change", "Recent value change known"),
    "prev_minutes": ("Played a lot before", "Played little before"),
    "team_points": ("Team wins often", "Team wins rarely"),
    "club_median": ("Richer club", "Poorer club"),
    "vs_club": ("Worth more than team", "Worth less than team"),
    "league_median": ("Pricier league", "Cheaper league"),
    "height": ("Tall for his age", "Short for his age"),
    "pos_attack": ("Plays in attack", "Not an attacker"),
    "pos_midfield": ("Plays in midfield", "Not a midfielder"),
    "pos_defender": ("Plays in defence", "Not a defender"),
    "pos_goalkeeper": ("Is a goalkeeper", "Not a goalkeeper"),
}


@dataclass(frozen=True, slots=True)
class TiersRun:
    """The result of the step: the table of the pool, the statistics, the lines printed."""

    table: pd.DataFrame
    stats: dict[str, Any]
    report: list[str]


def tier_labels(size: int) -> list[str]:
    """Return the tier of each place in a ranked pool: the first `pick_count(size, 0.10)` are
    A, the places up to `pick_count(size, 0.20)` in all are B and the rest are C."""
    top = backtest.pick_count(size, CUTS[0])
    upper = max(top, backtest.pick_count(size, CUTS[1]))
    return ["A" if i < top else "B" if i < upper else "C" for i in range(size)]


def rank_percent(scores: pd.Series) -> pd.Series:
    """Return 100 times the share of the pool with a lower score, as a whole number."""
    lower = scores.rank(method="min") - 1
    return (100 * lower / len(scores)).round().astype("int64")


def check_phrases(names: list[str]) -> None:
    """Stop the run when a feature of the model has no phrase, naming it."""
    for name in names:
        if name not in PHRASES:
            raise StepError(f"model feature {name} has no phrase in the dictionary")


def contributions(rows: pd.DataFrame, facts: dict[str, Any]) -> pd.DataFrame:
    """Return coefficient times standardised value for every feature of every row, with a
    missing height replaced by the stored median."""
    names: list[str] = list(facts["features"])
    values = rows[names].copy()
    values["height"] = values["height"].fillna(float(facts["height_median"]))
    scaled = (values.to_numpy(dtype="float64") - np.array(facts["means"])) / np.array(
        facts["scales"]
    )
    return pd.DataFrame(scaled * np.array(facts["coefficients"]), index=rows.index, columns=names)


def reasons_of(
    contribution: dict[str, float], values: dict[str, float], facts: dict[str, Any]
) -> list[dict[str, str]]:
    """Return the reasons of one player: up to three for, then up to one against.

    Ties go to the feature that comes first in the model's order."""
    means = dict(zip(facts["features"], facts["means"], strict=True))
    order = {name: i for i, name in enumerate(contribution)}

    def reason(sign: str, key: str) -> dict[str, str]:
        above = values[key] > means[key]
        return {"sign": sign, "key": key, "text": PHRASES[key][0 if above else 1]}

    positive = sorted(
        (k for k, v in contribution.items() if v > 0), key=lambda k: (-contribution[k], order[k])
    )
    negative = sorted(
        (k for k, v in contribution.items() if v < 0), key=lambda k: (contribution[k], order[k])
    )
    found = [reason("+", k) for k in positive[:MAX_FOR]]
    return found + [reason("-", k) for k in negative[:MAX_AGAINST]]


def build_drivers(rows: pd.DataFrame, facts: dict[str, Any]) -> list[str]:
    """Return the reasons of every row as JSON text, after the dictionary check."""
    check_phrases(list(facts["features"]))
    parts = contributions(rows, facts)
    filled = rows[list(facts["features"])].copy()
    filled["height"] = filled["height"].fillna(float(facts["height_median"]))
    found = (
        reasons_of(
            {str(k): float(v) for k, v in parts.loc[i].items()},
            {str(k): float(v) for k, v in filled.loc[i].items()},
            facts,
        )
        for i in rows.index
    )
    return [json.dumps(item, ensure_ascii=False) for item in found]


def compute_flags(players: pd.DataFrame, last_date: pd.Timestamp) -> pd.DataFrame:
    """Return the five caution flags (true or false) of any table of players.

    Needed columns: `date_of_birth` and `contract_expiration_date` (dates or date text, empty
    allowed), `minutes` and `position_group`. `last_date` is the source's last date. The
    result has the index of `players` and the columns of `FLAG_COLUMNS`.
    """
    born = pd.to_datetime(players["date_of_birth"], errors="coerce")
    ends = pd.to_datetime(players["contract_expiration_date"], errors="coerce")
    limit = last_date + pd.DateOffset(months=CONTRACT_MONTHS)
    flags = pd.DataFrame(index=players.index)
    flags["flag_under18"] = (born + pd.DateOffset(years=ADULT_AGE)) > last_date
    flags["flag_low_sample"] = players["minutes"] < LOW_SAMPLE_MINUTES
    flags["flag_contract_ending"] = (ends >= last_date) & (ends <= limit)
    flags["flag_born_q4"] = born.dt.month >= 10
    flags["flag_limited_position_data"] = players["position_group"].isin(["Defender", "Goalkeeper"])
    return flags.fillna(False).astype(bool)


def past_tiers(pools: pd.DataFrame) -> pd.DataFrame:
    """Return the past pool players with their tier: the same cut inside every season, by
    `lr_rank`."""
    parts: list[pd.DataFrame] = []
    for _, season_pool in pools.groupby("season"):
        ordered = season_pool.sort_values("lr_rank", kind="mergesort").copy()
        ordered["tier"] = tier_labels(len(ordered))
        parts.append(ordered)
    return pd.concat(parts, ignore_index=True)


def tier_entry(rows: pd.DataFrame, name: str) -> dict[str, Any]:
    """Return the statistics of one past tier."""
    later = rows["value_later"]
    known = rows.loc[later.notna() & (later > 0)]
    multiples = np.sort((known["value_later"] / known["value_decision"]).to_numpy())

    def percentile(fraction: float) -> float | None:
        if len(multiples) == 0:
            return None
        return round(float(multiples[int(fraction * (len(multiples) - 1))]), 2)

    hits = int(rows["made_it"].sum())
    lost = round(float((multiples < 1).mean()), 3) if len(multiples) else None
    return {
        "share": TIER_SHARES[name],
        "hits": hits,
        "n": len(rows),
        "rate": hits / len(rows) if len(rows) else 0.0,
        "multiple_p25": percentile(0.25),
        "multiple_p50": percentile(0.5),
        "multiple_p75": percentile(0.75),
        "no_later_value": len(rows) - len(known),
        "share_lost_value": lost,
    }


def tier_stats(pools: pd.DataFrame) -> dict[str, Any]:
    """Return the statistics of the three past tiers, the six seasons summed."""
    tiered = past_tiers(pools)
    return {name: tier_entry(tiered.loc[tiered["tier"] == name], name) for name in TIER_NAMES}


def check_against_backtest(stats: dict[str, Any], report: dict[str, Any]) -> None:
    """Stop the run when tier A differs from the backtest's top 10% of the logistic regression."""
    entry = next(b for b in report["budgets"] if b["budget_eur"] == config.BACKTEST_BUDGET)
    row = next(r for r in entry["rows"] if r["rule"] == "model_lr")
    if stats["A"]["hits"] != row["hits"] or stats["A"]["n"] != row["picks"]:
        raise StepError(
            f"tier A has {stats['A']['hits']} hits of {stats['A']['n']} but the backtest has "
            f"{row['hits']} of {row['picks']}"
        )


def pool_table(
    scores: pd.DataFrame,
    table: pd.DataFrame,
    rated: pd.DataFrame,
    players: pd.DataFrame,
    facts: dict[str, Any],
    last_date: pd.Timestamp,
) -> pd.DataFrame:
    """Return the table written to `tiers.csv`, one row per pool player, best score first."""
    key = list(features.KEY)
    pool = scores.sort_values(["score_lr", "player_id"], ascending=[False, True]).reset_index(
        drop=True
    )
    pool = pool.merge(table[[*key, *features.FEATURES]], on=key, how="left", validate="1:1")
    pool = pool.merge(rated[[*key, "position_group"]], on=key, how="left", validate="1:1").merge(
        players, on="player_id", how="left", validate="m:1"
    )
    pool["minutes"] = pool["minutes"].astype("float64")
    pool["tier"] = tier_labels(len(pool))
    pool["score_rank_pct"] = rank_percent(pool["score_lr"])
    pool["drivers"] = build_drivers(pool, facts)
    pool = pool.rename(columns={"score_lr": "score"})
    return pd.concat([pool, compute_flags(pool, last_date)], axis=1)[list(TIERS_COLUMNS)]


def check_table(table: pd.DataFrame) -> None:
    """Stop the run on tier counts that do not add up, or a tier A or B player with fewer
    than two reasons."""
    counts = table["tier"].value_counts()
    if int(counts.sum()) != len(table) or set(table["tier"]) - set(TIER_NAMES):
        raise StepError("the tier counts do not add up to the pool size")
    for row in table.loc[table["tier"].isin(["A", "B"])].itertuples(index=False):
        if len(json.loads(str(row.drivers))) < MIN_REASONS:
            raise StepError(
                f"player {row.player_id} in tier {row.tier} has fewer than {MIN_REASONS} reasons"
            )


def read_facts(work_dir: Path) -> dict[str, Any]:
    """Read the facts of the model."""
    path = require_file(work_dir / model.FACTS_FILE, "run the step `model` first")
    facts: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return facts


def read_backtest(work_dir: Path) -> dict[str, Any]:
    """Read the report of the backtest."""
    path = require_file(work_dir / backtest.REPORT_FILE, "run the step `backtest` first")
    report: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return report


def source_last_date(raw_dir: Path) -> pd.Timestamp:
    """Return the source's last date: the latest match date in the raw table `games`."""
    dates = rating.read_raw(raw_dir, "games", ("date",))
    latest = pd.to_datetime(dates["date"], errors="coerce").max()
    if pd.isna(latest):
        raise StepError("the table games has no match date")
    return pd.Timestamp(latest)


def report_lines(table: pd.DataFrame, stats: dict[str, Any], last_date: pd.Timestamp) -> list[str]:
    """Return the lines printed: pool and tier counts, each tier's statistics, the flags."""
    counts = table["tier"].value_counts()
    lines = [
        f"flags reference date (latest match): {last_date:%Y-%m-%d}",
        f"pool size: {len(table)} players",
        "tiers today: " + ", ".join(f"{n} {int(counts.get(n, 0))}" for n in TIER_NAMES),
    ]
    for name in TIER_NAMES:
        s = stats[name]
        lines.append(
            f"past tier {name} ({s['share']}): {s['hits']} of {s['n']} made it ({s['rate']:.1%}), "
            f"multiple p25 {s['multiple_p25']} p50 {s['multiple_p50']} p75 {s['multiple_p75']}, "
            f"no later value {s['no_later_value']}, lost value {s['share_lost_value']}"
        )
    lines.extend(f"{flag}: {int(table[flag].sum())} players" for flag in FLAG_COLUMNS)
    return lines


def run_tiers(raw_dir: Path, work_dir: Path) -> TiersRun:
    """Read the inputs, cut the tiers of the pool, attach the past statistics and check."""
    scores = rating.read_table(work_dir / model.SCORES_FILE, "model")
    table = rating.read_table(work_dir / model.FEATURES_FILE, "model")
    rated = rating.read_table(work_dir / rating.RATED_FILE, "rating")
    pools = rating.read_table(work_dir / backtest.POOLS_FILE, "backtest")
    facts = read_facts(work_dir)
    report = read_backtest(work_dir)
    players = rating.read_raw(
        raw_dir, "players", ("player_id", "date_of_birth", "contract_expiration_date")
    )
    last_date = source_last_date(raw_dir)
    stats = tier_stats(pools)
    check_against_backtest(stats, report)
    result = pool_table(scores, table, rated, players, facts, last_date)
    check_table(result)
    return TiersRun(table=result, stats=stats, report=report_lines(result, stats, last_date))


def write_tiers(raw_dir: Path, work_dir: Path) -> TiersRun:
    """Run the step and write `tiers.csv` and `tier_stats.json` into the work folder."""
    run = run_tiers(raw_dir, work_dir)
    outputs = (
        (TIERS_FILE, run.table.to_csv(index=False, lineterminator="\n")),
        (STATS_FILE, json.dumps(run.stats, indent=2) + "\n"),
    )
    for name, text in outputs:
        target = work_dir / name
        with ingest.partial_file(target) as partial:
            partial.write_text(text, encoding="utf-8")
            partial.replace(target)
    return run
