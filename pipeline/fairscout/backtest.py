"""Step `backtest`: test the model on past seasons against four simple rules.

For each test season (2017/18 to 2022/23) the scoring function of the step `model` trains only
on seasons at least three earlier and scores the pool of that season: every young player with a
decision value up to 1,000,000 EUR. A player with no value three seasons later stays in the
pool and is not a hit. The picks are the top share of each season's pool by the model score or
by a simple rule (most minutes, most goals and assists, youngest, cheapest), ties broken by
player id; hits, picks and pool sizes are summed over the six seasons. The pool of 500,000 EUR
is the same scored pool cut to decision values up to 500,000 and ranked again; nothing is
trained twice. The step only measures: it changes no model setting. It writes `backtest.json`
and `backtest_pools.csv` into the work folder and nothing else.
"""

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final

import pandas as pd

from fairscout import config, features, ingest, model, rating
from fairscout.errors import StepError

REPORT_FILE: Final = "backtest.json"
POOLS_FILE: Final = "backtest_pools.csv"
PICK_SHARE: Final = 0.1
SHARES: Final[tuple[float, float]] = (0.1, 0.2)
BUDGETS: Final[tuple[int, ...]] = (1_000_000, 500_000)
OUTCOME_LAG: Final = model.OUTCOME_LAG
Z_95: Final = 1.96
RULES: Final[tuple[tuple[str, str], ...]] = (
    ("model_lr", "Model, logistic regression"),
    ("model_gb", "Model, gradient boosting"),
    ("most_minutes", "Most minutes played"),
    ("most_goals_assists", "Most goals and assists"),
    ("youngest", "Youngest"),
    ("cheapest", "Cheapest"),
)
# the column each rule orders the pool by, and whether the smallest comes first
RULE_ORDER: Final[dict[str, tuple[str, bool]]] = {
    "model_lr": ("score_lr", False),
    "model_gb": ("score_gb", False),
    "most_minutes": ("minutes", False),
    "most_goals_assists": ("goals_assists", False),
    "youngest": ("age", True),
    "cheapest": ("value_decision", True),
}
POOL_COLUMNS: Final[tuple[str, ...]] = (
    "season",
    "player_id",
    "league_id",
    "value_decision",
    "value_later",
    "made_it",
    "score_lr",
    "score_gb",
    "lr_rank",
)


@dataclass(frozen=True, slots=True)
class BacktestRun:
    """The result of the step: the report, the scored pools of all test seasons, the lines."""

    result: dict[str, Any]
    pools: pd.DataFrame
    report: list[str]


def season_label(season: int) -> str:
    """Return the name of a season by its start year: 2017 is `2017/18`."""
    return f"{season}/{(season + 1) % 100:02d}"


def pick_count(pool_size: int, share: float) -> int:
    """Return the number of picks for a pool: the share of the pool rounded, at least one,
    and none for an empty pool. Rounding is Python's round, as in the prototype."""
    if pool_size <= 0:
        return 0
    return max(1, round(pool_size * share))


def rank_pool(pool: pd.DataFrame, rule: str) -> pd.DataFrame:
    """Return the pool in the order of a rule, best first; ties go by player id, then league."""
    column, ascending = RULE_ORDER[rule]
    return pool.sort_values(
        [column, "player_id", "league_id"], ascending=[ascending, True, True], kind="mergesort"
    )


def pick_hits(pool: pd.DataFrame, rule: str, share: float) -> tuple[int, int]:
    """Return the hits and the picks of a rule on the pool of one season."""
    picks = pick_count(len(pool), share)
    top = rank_pool(pool, rule).head(picks)
    return int(top["made_it"].sum()), picks


def walk_forward(
    table: pd.DataFrame,
    seasons: tuple[int, ...] = config.BACKTEST_SEASONS,
    budget: int = config.BACKTEST_BUDGET,
    min_rows: int = model.MIN_TRAINING_ROWS,
) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    """Score every test season with the scoring function and return the pools and the facts.

    The pools of all seasons are one table with the scores, the labels and the columns the
    simple rules order by; the facts are those the scoring function reports for each season.
    """
    parts: list[pd.DataFrame] = []
    facts: list[dict[str, Any]] = []
    columns = ["minutes", "goals_per90", "assists_per90", "age", "made_it", "value_decision"]
    for season in seasons:
        scored = model.score_season(table, season, budget, min_rows)
        extra = table[[*features.KEY, *columns, "value_later"]]
        part = scored.pool.merge(extra, on=list(features.KEY), how="left", validate="1:1")
        parts.append(part)
        facts.append(scored.facts)
    pools = pd.concat(parts, ignore_index=True)
    pools["goals_assists"] = pools["goals_per90"] + pools["assists_per90"]
    pools["made_it"] = pools["made_it"].astype(bool)
    return pools, facts


def evaluate_rules(pool: pd.DataFrame, share: float) -> list[dict[str, Any]]:
    """Return one row per rule: hits, misses, picks and rate, summed over the seasons."""
    rows: list[dict[str, Any]] = []
    pool_hits = int(pool["made_it"].sum())
    for rule, label in RULES:
        hits = picks = 0
        for _, season_pool in pool.groupby("season"):
            found, chosen = pick_hits(season_pool, rule, share)
            hits += found
            picks += chosen
        rows.append(
            {
                "rule": rule,
                "label": label,
                "hits": hits,
                "picks": picks,
                "rate": hits / picks if picks else 0.0,
                "base_hits": pool_hits,
                "misses": picks - hits,
            }
        )
    return rows


def margin_pp(rate: float, picks: int) -> float:
    """Return the 95% margin of error of a rate over `picks` picks, in percentage points."""
    if picks == 0:
        return 0.0
    return 100 * Z_95 * math.sqrt(rate * (1 - rate) / picks)


def budget_entry(pools: pd.DataFrame, budget: int) -> dict[str, Any]:
    """Return the result for one budget: the pool cut to it, ranked again, and measured."""
    pool = pools.loc[pools["value_decision"] <= budget]
    sizes = {season_label(int(str(s))): len(g) for s, g in pool.groupby("season")}
    top10 = evaluate_rules(pool, SHARES[0])
    picks = top10[0]["picks"]
    base_rate = float(pool["made_it"].mean()) if len(pool) else 0.0
    return {
        "budget_eur": budget,
        "players": len(pool),
        "picks_per_rule": picks,
        "margin_pp": margin_pp(base_rate, picks),
        "base_rate": base_rate,
        "base_hits": int(pool["made_it"].sum()),
        "season_pools": sizes,
        "rows": top10,
        "rows_top20": evaluate_rules(pool, SHARES[1]),
    }


def season_entries(pools: pd.DataFrame, facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return one entry per test season: the logistic regression top 10% at the first budget."""
    entries: list[dict[str, Any]] = []
    for fact in facts:
        season = int(fact["decision_season"])
        pool = pools.loc[pools["season"] == season]
        hits, picks = pick_hits(pool, "model_lr", PICK_SHARE)
        entries.append(
            {
                "season": season_label(season),
                "hits": hits,
                "picks": picks,
                "pool": len(pool),
                "pool_hits": int(pool["made_it"].sum()),
                "training_seasons": fact["training_seasons"],
                "training_rows": fact["training_rows"],
            }
        )
    return entries


def check_training(by_season: list[dict[str, Any]]) -> None:
    """Stop the run when a test season is in its own training set or a training season is
    later than the test season minus three."""
    for entry in by_season:
        season = int(str(entry["season"]).split("/")[0])
        used = [int(s) for s in entry["training_seasons"]]
        if season in used:
            raise StepError(f"test season {entry['season']} is in its own training set")
        late = [s for s in used if s > season - OUTCOME_LAG]
        if late:
            raise StepError(
                f"test season {entry['season']} trains on season {max(late)}, "
                f"later than {season - OUTCOME_LAG}"
            )


def check_rows(budgets: list[dict[str, Any]]) -> None:
    """Stop the run when hits plus misses differ from picks in any row, or when the picks of
    a row differ from the sum of the pick counts of the season pools."""
    for entry in budgets:
        for rows, share in ((entry["rows"], SHARES[0]), (entry["rows_top20"], SHARES[1])):
            expected = sum(pick_count(n, share) for n in entry["season_pools"].values())
            for row in rows:
                name = f"{entry['budget_eur']} EUR, {row['rule']}, top {share:.0%}"
                if row["hits"] + row["misses"] != row["picks"]:
                    raise StepError(f"hits plus misses differ from picks in {name}")
                if row["picks"] != expected:
                    raise StepError(f"picks of {name} are {row['picks']}, expected {expected}")


def build_result(pools: pd.DataFrame, facts: list[dict[str, Any]]) -> dict[str, Any]:
    """Measure both budgets and every season, run the checks and return the report."""
    result: dict[str, Any] = {
        "test_seasons": [season_label(s) for s in config.BACKTEST_SEASONS],
        "pick_share": PICK_SHARE,
        "budgets": [budget_entry(pools, budget) for budget in BUDGETS],
        "by_season": season_entries(pools, facts),
    }
    check_training(result["by_season"])
    check_rows(result["budgets"])
    for entry in result["by_season"]:
        if entry["picks"] != pick_count(entry["pool"], PICK_SHARE):
            raise StepError(f"picks of season {entry['season']} differ from the pick count")
    return result


def pool_table(pools: pd.DataFrame) -> pd.DataFrame:
    """Return the table written to `backtest_pools.csv`: the scored 1,000,000 pools with the
    rank of the logistic regression inside each season."""
    ranked = pools.sort_values(
        ["season", "score_lr", "player_id", "league_id"],
        ascending=[True, False, True, True],
        kind="mergesort",
    ).copy()
    ranked["lr_rank"] = ranked.groupby("season").cumcount() + 1
    return ranked[list(POOL_COLUMNS)].reset_index(drop=True)


def report_lines(result: dict[str, Any]) -> list[str]:
    """Return the plain-table report: each budget, then the six seasons."""
    lines: list[str] = []
    for entry in result["budgets"]:
        lines.append(
            f"budget up to {entry['budget_eur']:,} EUR: pool {entry['players']} players, "
            f"pool rate {entry['base_rate']:.1%} ({entry['base_hits']} made it), "
            f"margin of error +/-{entry['margin_pp']:.1f} pp on {entry['picks_per_rule']} picks"
        )
        for title, rows in (("top 10%", entry["rows"]), ("top 20%", entry["rows_top20"])):
            for row in rows:
                lines.append(
                    f"  {title}  {row['label']:<28} {row['hits']:>4} of {row['picks']:>4}"
                    f"  {row['rate']:>6.1%}"
                )
    lines.append("logistic regression, top 10% by season, budget up to 1,000,000 EUR:")
    for item in result["by_season"]:
        lines.append(
            f"  {item['season']}  {item['hits']:>3} of {item['picks']:>3}  pool {item['pool']:>4}"
            f"  pool hits {item['pool_hits']:>4}  training rows {item['training_rows']}"
        )
    return lines


def run_backtest(
    work_dir: Path, min_rows: int = model.MIN_TRAINING_ROWS, budget: int = config.BACKTEST_BUDGET
) -> BacktestRun:
    """Read the feature and rated tables, walk forward over the test seasons and measure."""
    table = rating.read_table(work_dir / model.FEATURES_FILE, "model")
    rated = rating.read_table(work_dir / rating.RATED_FILE, "rating")
    later = rated[[*features.KEY, "value_outcome"]].rename(columns={"value_outcome": "value_later"})
    table = table.merge(later, on=list(features.KEY), how="left", validate="1:1")
    pools, facts = walk_forward(table, config.BACKTEST_SEASONS, budget, min_rows)
    result = build_result(pools, facts)
    return BacktestRun(result=result, pools=pool_table(pools), report=report_lines(result))


def write_backtest(work_dir: Path, min_rows: int = model.MIN_TRAINING_ROWS) -> BacktestRun:
    """Run the step and write `backtest.json` and `backtest_pools.csv` into the work folder."""
    run = run_backtest(work_dir, min_rows)
    outputs = (
        (REPORT_FILE, json.dumps(run.result, indent=2) + "\n"),
        (POOLS_FILE, run.pools.to_csv(index=False, lineterminator="\n")),
    )
    for name, text in outputs:
        target = work_dir / name
        with ingest.partial_file(target) as partial:
            partial.write_text(text, encoding="utf-8")
            partial.replace(target)
    return run
