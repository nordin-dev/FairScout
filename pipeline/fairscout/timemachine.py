"""Step `timemachine`: the radar run in the past, for the juror who checks the claim.

For each of the six test seasons (2017/18 to 2022/23) the scoring function of the step `model`
(the one today's radar uses) is called with that season and the budget of 1,000,000 EUR. The
list of a season is the top 10% of its pool by the logistic regression score, ties by player
id, misses included. The four latest seasons are written out in full: club, league, position,
age, the value then, the value three seasons later, the made-it mark, the peak, today's value
and the value history. A player with no value three seasons later stays in the list with an
empty later value and is not a hit. Three checks stop the run before anything is written: no
training row from a season later than the shown season minus three, a pool that holds every
young player inside the budget whatever happened later, and a list that is exactly the top
10% of the pool in score order. The hits and picks must equal those in `backtest.json`. The
step reads the work tables and the raw tables `players`, `clubs` and `player_valuations`, and
writes `timemachine_lists.json` into the work folder and nothing else.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final

import pandas as pd

from fairscout import backtest, config, features, ingest, leagues, model, rating, values
from fairscout.errors import StepError, require_file

LISTS_FILE: Final = "timemachine_lists.json"
BACKTEST_FILE: Final = backtest.REPORT_FILE
SHOWN_SEASONS: Final[tuple[int, ...]] = config.BACKTEST_SEASONS[-4:]
OUTCOME_LAG: Final = model.OUTCOME_LAG


@dataclass(frozen=True, slots=True)
class TimeMachineRun:
    """The result of the step: the lists as written to the file and the lines printed."""

    result: dict[str, Any]
    report: list[str]


@dataclass(frozen=True, slots=True)
class Inputs:
    """Every table the step reads, as frames."""

    table: pd.DataFrame
    rated: pd.DataFrame
    leagues: pd.DataFrame
    players: pd.DataFrame
    clubs: pd.DataFrame
    valuations: pd.DataFrame
    expected: list[dict[str, Any]]


def check_training(label: str, season: int, training_seasons: list[int]) -> None:
    """Stop the run when a training season is later than the shown season minus three."""
    late = [s for s in training_seasons if s > season - OUTCOME_LAG]
    if late:
        raise StepError(
            f"season {label} trains on season {max(late)}, later than {season - OUTCOME_LAG}"
        )


def check_pool(label: str, season: int, table: pd.DataFrame, budget: int, pool_size: int) -> None:
    """Stop the run when the pool differs from the young rows of the season inside the budget,
    counted on the feature table, which holds the rows whatever happened later."""
    inside = (table["season"] == season) & (table["value_decision"] <= budget)
    expected = int(inside.sum())
    if pool_size != expected:
        raise StepError(
            f"pool of season {label} has {pool_size} players, expected {expected}: "
            "it was filtered or is incomplete"
        )


def check_list(label: str, pool: pd.DataFrame, listed: pd.DataFrame) -> None:
    """Stop the run when the list is not exactly the top 10% of the pool in score order:
    wrong length, a wrong player or a wrong order."""
    wanted = backtest.pick_count(len(pool), backtest.PICK_SHARE)
    if len(listed) != wanted:
        raise StepError(f"list of season {label} has {len(listed)} players, expected {wanted}")
    order = ["score_lr", "player_id", "league_id"]
    ordered = pool.sort_values(order, ascending=[False, True, True], kind="mergesort")
    keys = ["player_id", "league_id"]
    expected = ordered.head(wanted)[keys].to_records(index=False).tolist()
    found = listed[keys].to_records(index=False).tolist()
    if sorted(found) != sorted(expected):
        raise StepError(f"list of season {label} holds a player who is not in the top 10%")
    if found != expected:
        raise StepError(f"list of season {label} is not in the order of the model score")


def check_backtest(label: str, hits: int, picks: int, expected: list[dict[str, Any]]) -> None:
    """Stop the run when the hits and picks of a season differ from those in `backtest.json`."""
    known = [e for e in expected if e["season"] == label]
    if len(known) != 1:
        raise StepError(f"{BACKTEST_FILE} has no entry for season {label}")
    if (known[0]["hits"], known[0]["picks"]) != (hits, picks):
        raise StepError(
            f"season {label}: {hits} of {picks} differ from {known[0]['hits']} of "
            f"{known[0]['picks']} in {BACKTEST_FILE}"
        )


def list_season(
    table: pd.DataFrame, season: int, budget: int, min_rows: int
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    """Score the season with the scoring function of today's radar and return the pool, the
    list (the top 10% in score order, ties by player id) and the facts. The checks run here."""
    label = backtest.season_label(season)
    scored = model.score_season(table, season, budget, min_rows)
    check_training(label, season, [int(s) for s in scored.facts["training_seasons"]])
    check_pool(label, season, table, budget, len(scored.pool))
    pool = scored.pool.merge(
        table[[*features.KEY, "made_it"]], on=list(features.KEY), how="left", validate="1:1"
    )
    pool["made_it"] = pool["made_it"].astype(bool)
    ranked = backtest.rank_pool(pool, "model_lr")
    listed = ranked.head(backtest.pick_count(len(pool), backtest.PICK_SHARE))
    check_list(label, pool, listed)
    return pool, listed.reset_index(drop=True), scored.facts


def records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    """Return the rows of a frame as dictionaries keyed by column name."""
    return [{str(k): v for k, v in row.items()} for row in frame.to_dict("records")]


def history_of(valuations: pd.DataFrame, player_ids: list[int]) -> dict[int, list[list[Any]]]:
    """Return the valuations of the players as pairs of ISO date and value, oldest first."""
    frame = values.sort_valuations(valuations.loc[valuations["player_id"].isin(player_ids)])
    found: dict[int, list[list[Any]]] = {}
    for player, date, value in zip(frame["player_id"], frame["date"], frame["value"], strict=True):
        found.setdefault(int(player), []).append([f"{date:%Y-%m-%d}", float(value)])
    return found


def optional_float(value: float | None) -> float | None:
    """Return a float, or None when the value is empty."""
    return None if value is None or pd.isna(value) else float(value)


def describe_pick(row: dict[str, Any], rank: int, history: list[list[Any]]) -> dict[str, Any]:
    """Return one pick with the keys of the contract; the peak and today's value come from the
    player's record, and from the history when the record has none."""
    peak = optional_float(row["highest_market_value_in_eur"])
    latest = optional_float(row["market_value_in_eur"])
    return {
        "rank": rank,
        "id": str(int(row["player_id"])),
        "name": str(row["name"]),
        "club": str(row["club_name"]),
        "league": str(row["league_name"]),
        "position": str(row["position"]),
        "age": round(float(row["age"]), 1),
        "value_then": float(row["value_decision"]),
        "value_3y": optional_float(row["value_outcome"]),
        "made_it": bool(row["made_it"]),
        "value_peak": max(v for _, v in history) if peak is None else peak,
        "value_latest": history[-1][1] if latest is None else latest,
        "history": history,
    }


def pick_details(inputs: Inputs, listed: pd.DataFrame) -> pd.DataFrame:
    """Attach to the list the columns of the pick that the feature table does not hold."""
    keys = list(features.KEY)
    rated = inputs.rated[[*keys, "club_id", "position_group", "value_outcome"]]
    rows = listed.merge(rated, on=keys, how="left", validate="1:1")
    rows = rows.merge(inputs.table[[*keys, "age", "value_decision"]], on=keys, how="left")
    rows = rows.merge(inputs.leagues, on="league_id", how="left", validate="m:1")
    rows = rows.merge(inputs.clubs, on="club_id", how="left", validate="m:1")
    rows = rows.merge(inputs.players, on="player_id", how="left", validate="m:1")
    for column in ("league_name", "club_name", "name"):
        if rows[column].isna().any():
            raise StepError(f"a listed player has no {column.replace('_', ' ')} in the inputs")
    rows["position"] = rows["sub_position"].fillna(rows["position_group"])
    return rows


def shown_picks(inputs: Inputs, listed: pd.DataFrame) -> list[dict[str, Any]]:
    """Return the picks of one season in the order of the list."""
    rows = records(pick_details(inputs, listed))
    history = history_of(inputs.valuations, [int(r["player_id"]) for r in rows])
    picks: list[dict[str, Any]] = []
    for rank, row in enumerate(rows, start=1):
        trail = history.get(int(row["player_id"]), [])
        if not trail:
            raise StepError(f"player {int(row['player_id'])} has no valuation in the source")
        picks.append(describe_pick(row, rank, trail))
    return picks


def season_entry(
    season: int, pool: pd.DataFrame, facts: dict[str, Any], picks: list[dict[str, Any]]
) -> dict[str, Any]:
    """Return the entry of one shown season, with the keys of the contract."""
    trained = facts["training_seasons"]
    first, last = backtest.season_label(min(trained)), backtest.season_label(max(trained))
    return {
        "season": backtest.season_label(season),
        "decision_date": f"{season + 1}-06-30",
        "outcome_date": f"{season + 1 + OUTCOME_LAG}-06-30",
        "trained_on": f"{first}\u2013{last}",
        "training_rows": int(facts["training_rows"]),
        "pool": len(pool),
        "pool_rate": float(pool["made_it"].mean()),
        "hits": sum(1 for p in picks if p["made_it"]),
        "picks": picks,
    }


def build_lists(
    inputs: Inputs, budget: int = config.BACKTEST_BUDGET, min_rows: int = model.MIN_TRAINING_ROWS
) -> TimeMachineRun:
    """Call the scoring function for the six test seasons, check them and build the output."""
    totals = {"hits": 0, "picks": 0, "pool_hits": 0, "pool_players": 0}
    by_season: dict[str, str] = {}
    shown: list[dict[str, Any]] = []
    report: list[str] = []
    for season in config.BACKTEST_SEASONS:
        label = backtest.season_label(season)
        pool, listed, facts = list_season(inputs.table, season, budget, min_rows)
        hits, picks = int(listed["made_it"].sum()), len(listed)
        check_backtest(label, hits, picks, inputs.expected)
        totals["hits"] += hits
        totals["picks"] += picks
        totals["pool_hits"] += int(pool["made_it"].sum())
        totals["pool_players"] += len(pool)
        by_season[label] = f"{hits}/{picks}"
        if season in SHOWN_SEASONS:
            shown.append(season_entry(season, pool, facts, shown_picks(inputs, listed)))
        report.append(
            f"{label}  {hits} of {picks}  pool {len(pool)} ({pool['made_it'].mean():.1%})"
            f"  training rows {facts['training_rows']}"
        )
    six = {
        "tier_a_hits": totals["hits"],
        "tier_a_picks": totals["picks"],
        "pool_hits": totals["pool_hits"],
        "pool_players": totals["pool_players"],
        "by_season": by_season,
    }
    as_of = f"{pd.to_datetime(inputs.valuations['date']).max():%Y-%m-%d}"
    return TimeMachineRun(
        result={"as_of": as_of, "six_seasons": six, "seasons": shown}, report=report
    )


def read_backtest(work_dir: Path) -> list[dict[str, Any]]:
    """Read the hits and picks of the test seasons from `backtest.json`."""
    path = require_file(work_dir / BACKTEST_FILE, "run the step `backtest` first")
    try:
        entries: list[dict[str, Any]] = json.loads(path.read_text(encoding="utf-8"))["by_season"]
    except (json.JSONDecodeError, KeyError, UnicodeDecodeError) as error:
        raise StepError(f"input file {path} is missing or unreadable: {error}") from error
    return entries


def read_inputs(raw_dir: Path, work_dir: Path) -> Inputs:
    """Read the work tables and the three raw tables the step needs."""
    table = rating.read_table(work_dir / model.FEATURES_FILE, "model")
    rated = rating.read_table(work_dir / rating.RATED_FILE, "rating")
    factors = rating.read_table(work_dir / leagues.LEAGUES_FILE, "leagues")
    players = rating.read_raw(
        raw_dir,
        "players",
        ("player_id", "name", "sub_position", "highest_market_value_in_eur", "market_value_in_eur"),
    )
    clubs = rating.read_raw(raw_dir, "clubs", ("club_id", "name"))
    valuations = rating.read_raw(raw_dir, "player_valuations", values.VALUATIONS_COLUMNS)
    return Inputs(
        table=table,
        rated=rated,
        leagues=factors[["league_id", "league_name"]],
        players=players,
        clubs=clubs.rename(columns={"name": "club_name"}),
        valuations=valuations,
        expected=read_backtest(work_dir),
    )


def run_timemachine(
    raw_dir: Path, work_dir: Path, min_rows: int = model.MIN_TRAINING_ROWS
) -> TimeMachineRun:
    """Read the inputs and build the lists; nothing is written."""
    return build_lists(read_inputs(raw_dir, work_dir), config.BACKTEST_BUDGET, min_rows)


def write_timemachine(
    raw_dir: Path, work_dir: Path, min_rows: int = model.MIN_TRAINING_ROWS
) -> TimeMachineRun:
    """Run the step and write `timemachine_lists.json` into the work folder."""
    run = run_timemachine(raw_dir, work_dir, min_rows)
    target = work_dir / LISTS_FILE
    with ingest.partial_file(target) as partial:
        partial.write_text(
            json.dumps(run.result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        partial.replace(target)
    return run
