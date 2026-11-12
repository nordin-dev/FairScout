"""Step `export`: assemble the five app data files from the work files and write them.

Nothing is typed in by hand: every figure comes from a source table or a work file. The five
files are assembled in memory, the fifteen quality checks of `checks.py` run on them, and only
then are the files written into a temporary folder next to the target, checked against their
schemas there and moved into place. A failure at any point leaves the target folder as it was.
"""

import csv
import gzip
import json
import math
import shutil
import tempfile
from collections import Counter
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from statistics import NormalDist
from typing import Any, Final

import pandas as pd

from fairscout import (
    backtest,
    checks,
    config,
    contract,
    inputs,
    leagues,
    model,
    notes,
    rating,
    rebuild,
    similar,
    tiers,
    values,
)
from fairscout.errors import StepError, require_file
from fairscout.similar import plausible_height

OUT_FOLDER: Final = ("app", "public", "data")
TIERS_FILE: Final = "tiers.csv"
TIER_STATS_FILE: Final = "tier_stats.json"
LISTS_FILE: Final = "timemachine_lists.json"
MAX_TOTAL_BYTES: Final = 2_000_000
HISTORY_POINTS: Final = 12
CITIZENSHIP: Final = "Bosnia-Herzegovina"
SOURCE_NAME: Final = "Open Transfermarkt dataset (dcaribou/transfermarkt-datasets)"
MODEL_TYPE: Final = "logistic_regression"
STATUS: Final = "measured"
DASH: Final = "\N{EN DASH}"
MIN_BRIEF_MATCHES: Final = 3
TEST_LEAGUES: Final[tuple[str, ...]] = ("BE1", "NL1")
TEST_SEASON: Final = config.RADAR_SEASON - 1
SCORE_DECIMALS: Final = 4
SHARE_DECIMALS: Final = 1
PERCENT: Final = 100
CONFIDENCE_CUT: Final = 0.975
DAYS_PER_YEAR: Final = 365.25
type Scalar = str | int | float | bool | None
TIERS: Final[tuple[str, str, str]] = ("A", "B", "C")
STATS_KEYS: Final[tuple[str, ...]] = (
    "share",
    "hits",
    "n",
    "rate",
    "multiple_p25",
    "multiple_p50",
    "multiple_p75",
    "no_later_value",
)
FLAG_COLUMNS: Final[Mapping[str, str]] = {
    "under18": "flag_under18",
    "low_sample": "flag_low_sample",
    "contract_ending": "flag_contract_ending",
    "born_q4": "flag_born_q4",
    "limited_position_data": "flag_limited_position_data",
}

# The brief of the app, mirrored from `app/src/lib/brief.ts`: the five brief positions in the
# order of `POSITIONS`, the first two keys of `MATTERS`, and the mapping from a player's
# position to a brief position (`BY_POSITION`, then `BY_GROUP`).
BRIEF_POSITIONS: Final[tuple[str, ...]] = (
    "winger",
    "striker",
    "midfielder",
    "defender",
    "goalkeeper",
)
BRIEF_MATTERS: Final[tuple[str, str]] = ("creates", "scores")
BRIEF_BY_POSITION: Final[Mapping[str, str]] = {
    "Left Winger": "winger",
    "Right Winger": "winger",
    "Left Midfield": "winger",
    "Right Midfield": "winger",
    "Centre-Forward": "striker",
    "Second Striker": "striker",
    "Attacking Midfield": "midfielder",
    "Central Midfield": "midfielder",
    "Defensive Midfield": "midfielder",
    "Centre-Back": "defender",
    "Left-Back": "defender",
    "Right-Back": "defender",
    "Goalkeeper": "goalkeeper",
}
BRIEF_BY_GROUP: Final[Mapping[str, str]] = {
    "Attack": "striker",
    "Midfield": "midfielder",
    "Defender": "defender",
    "Goalkeeper": "goalkeeper",
}

PCT_KEYS: Final[Mapping[str, str]] = {
    "output": "pct_output",
    "scoring": "pct_scoring",
    "creating": "pct_creating",
    "involvement": "pct_involvement",
    "role": "pct_role",
}
RATED_NEEDED: Final[tuple[str, ...]] = (
    "player_id",
    "season",
    "league_id",
    "club_id",
    "minutes",
    "matches",
    "goals",
    "assists",
    "value_decision",
    "value_decision_date",
    "position_group",
    "young",
    "team_matches",
    "role",
    "ga90",
    "league_factor",
    "ga90_adj",
    "g90_adj",
    "a90_adj",
    "involvement",
    *rating.PERCENTILE_METRICS,
    "in_pool",
)
PLAYER_COLUMNS: Final[tuple[str, ...]] = (
    "player_id",
    "name",
    "date_of_birth",
    "sub_position",
    "foot",
    "height_in_cm",
    "contract_expiration_date",
    "country_of_citizenship",
)


@dataclass(frozen=True, slots=True)
class Sources:
    """Every table and work file the export reads."""

    rated: pd.DataFrame
    leagues: pd.DataFrame
    tiers: pd.DataFrame
    pools: pd.DataFrame
    players: pd.DataFrame
    clubs: pd.DataFrame
    valuations: pd.DataFrame
    league_evidence: dict[str, Any]
    backtest: dict[str, Any]
    facts: dict[str, Any]
    tier_stats: dict[str, Any]
    lists: dict[str, Any]
    source_last_date: pd.Timestamp
    source_tables: dict[str, checks.TableInfo]
    minutes_check: dict[str, Any]
    notes: dict[str, Any] | None = None


@dataclass(frozen=True, slots=True)
class Assembled:
    """The five files as data, the pool rows the checks look at and what was left out."""

    files: dict[str, Any]
    pool_rows: pd.DataFrame
    brief_counts: dict[str, int]
    left_out: int


@dataclass(frozen=True, slots=True)
class ExportRun:
    """The result of the step: sizes of the files, counts and the outcome of every check."""

    sizes: dict[str, int]
    pool: int
    outside: int
    left_out: int
    brief: dict[str, Any]
    outcomes: list[checks.Outcome]

    def report(self) -> list[str]:
        """Return the lines the command prints."""
        lines = [f"{name}.json: {size} bytes" for name, size in self.sizes.items()]
        lines.append(f"total: {sum(self.sizes.values())} bytes")
        lines.append(f"radar pool: {self.pool} players")
        lines.append(f"outside the pool, Bosnian citizenship: {self.outside} players")
        lines.append(f"left out, no birth date, club, group or value: {self.left_out} players")
        lines.append(f"default brief: {json.dumps(self.brief, sort_keys=True)}")
        lines.extend(f"check {o.number:2d} {o.name}: {o.verdict.message}" for o in self.outcomes)
        return lines


def is_missing(value: object) -> bool:
    """Tell whether a table cell is empty."""
    return value is None or bool(pd.isna(value))  # type: ignore[call-overload]


def clean(value: object) -> Scalar:
    """Return None for an empty cell and a plain Python number, flag or text otherwise."""
    if is_missing(value):
        return None
    if isinstance(value, str | int | float | bool):
        return value
    item = getattr(value, "item", None)
    scalar: Scalar = item() if callable(item) else str(value)
    return scalar


def whole_or_float(value: object) -> int | float:
    """Return a whole number as an int, so that 150000.0 is written as 150000."""
    number = float(str(value))
    return int(number) if number.is_integer() else number


def date_text(value: object) -> str | None:
    """Return a date as YYYY-MM-DD, or None when it is empty or not a date."""
    stamp = pd.to_datetime(str(value)[:10], errors="coerce") if not is_missing(value) else pd.NaT
    return None if pd.isna(stamp) else f"{stamp:%Y-%m-%d}"


def table_info(raw_dir: Path, table: str) -> checks.TableInfo:
    """Read the header and look for a first data row of a source table, without reading it all."""
    path = require_file(raw_dir / config.table_file(table), "run the step `ingest` first")
    try:
        with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as stream:
            reader = csv.reader(stream)
            header = tuple(next(reader, []))
            return checks.TableInfo(header, next(reader, None) is not None)
    except (OSError, EOFError, csv.Error, UnicodeDecodeError) as error:
        raise StepError(f"table {table} at {path} is unreadable: {error}") from error


def minutes_check(raw_dir: Path) -> dict[str, Any]:
    """Rebuild the minutes of the test leagues from line-ups and compare them with the
    appearances the source holds for the same matches."""
    games = rebuild.read_source(raw_dir, "games")
    test = games.loc[games["competition_id"].isin(TEST_LEAGUES) & (games["season"] == TEST_SEASON)]
    built = rebuild.rebuild_from_files(raw_dir, test)
    appearances = inputs.read_raw_columns(
        raw_dir, "appearances", ("game_id", "player_id", "minutes_played", "goals")
    )
    truth = appearances.loc[appearances["game_id"].isin(test["game_id"])]
    both = truth.merge(built.rows, on=["game_id", "player_id"], how="left", suffixes=("", "_re"))
    count = len(truth)
    if count == 0:
        raise StepError("the appearances table has no rows for the test leagues")
    near = (both["minutes_played"].fillna(0) - both["minutes"]).abs() <= 5
    near &= both["minutes"].notna()
    same = both["goals"].fillna(0) == both["goals_re"]
    return {
        "leagues": [config.LONG_HISTORY_LEAGUES[i] for i in TEST_LEAGUES],
        "season": backtest.season_label(TEST_SEASON),
        "appearances": count,
        "within_5_min": float(near.sum()) / count,
        "goals_exact": float(same.sum()) / count,
    }


def read_sources(raw_dir: Path, work_dir: Path, with_notes: bool = True) -> Sources:
    """Read the work files and the source tables the export needs, checking their columns.

    `with_notes=False` leaves `notes.json` unread, so the step `notes` can replace a broken file.
    """
    rated = inputs.read_csv_table(work_dir / rating.RATED_FILE, "rating", RATED_NEEDED)
    league_table = inputs.read_csv_table(
        work_dir / leagues.LEAGUES_FILE,
        "leagues",
        ("league_id", "league_name", "factor", "factor_source", "seasons"),
    )
    tier_table = inputs.read_csv_table(
        work_dir / TIERS_FILE,
        "tiers",
        (
            "player_id",
            "season",
            "league_id",
            "score",
            "score_rank_pct",
            "tier",
            "drivers",
            *FLAG_COLUMNS.values(),
        ),
    )
    pools = inputs.read_csv_table(
        work_dir / backtest.POOLS_FILE, "backtest", ("season", "player_id", "lr_rank")
    )
    stats = inputs.read_json_file(work_dir / TIER_STATS_FILE, "tiers", TIERS)
    lists = inputs.read_json_file(
        work_dir / LISTS_FILE, "timemachine", ("as_of", "six_seasons", "seasons")
    )
    last_date = tiers.source_last_date(raw_dir)
    valuations = inputs.read_raw_columns(
        raw_dir, "player_valuations", ("player_id", "date", "market_value_in_eur")
    )
    return Sources(
        rated=rated,
        leagues=league_table,
        tiers=tier_table,
        pools=pools,
        players=inputs.read_raw_columns(raw_dir, "players", PLAYER_COLUMNS),
        clubs=inputs.read_raw_columns(raw_dir, "clubs", ("club_id", "name")),
        valuations=valuations,
        league_evidence=inputs.read_json_file(
            work_dir / leagues.EVIDENCE_FILE,
            "leagues",
            ("league_moves", "same_players_two_leagues", "rank_correlation"),
        ),
        backtest=inputs.read_json_file(
            work_dir / backtest.REPORT_FILE,
            "backtest",
            ("test_seasons", "pick_share", "budgets", "by_season"),
        ),
        facts=inputs.read_json_file(
            work_dir / model.FACTS_FILE,
            "model",
            ("features", "training_rows", "training_seasons"),
        ),
        tier_stats=stats,
        lists=lists,
        source_last_date=last_date,
        source_tables={t: table_info(raw_dir, t) for t in config.TABLES},
        minutes_check=minutes_check(raw_dir),
        notes=notes.read_notes(work_dir) if with_notes else None,
    )


def one_per_player(rows: pd.DataFrame) -> pd.DataFrame:
    """Keep the row with the most minutes of every player; a tie goes to the league id."""
    ordered = rows.sort_values(["minutes", "league_id"], ascending=[False, True], kind="mergesort")
    return ordered.drop_duplicates("player_id", keep="first").sort_values("player_id")


def compute_flags(frame: pd.DataFrame, last_date: pd.Timestamp) -> pd.DataFrame:
    """Set the five flags of a table of players with the function of the step `tiers`."""
    return tiers.compute_flags(frame, last_date)


def latest_valuations(valuations: pd.DataFrame) -> pd.DataFrame:
    """Return the latest valuation of every player as `latest_value` and `latest_date`."""
    ordered = valuations.dropna(subset=["market_value_in_eur"]).sort_values(
        ["player_id", "date"], kind="mergesort"
    )
    last = ordered.groupby("player_id").tail(1)
    return pd.DataFrame(
        {
            "player_id": last["player_id"],
            "latest_value": last["market_value_in_eur"],
            "latest_date": last["date"],
        }
    )


def histories(valuations: pd.DataFrame, ids: Iterable[int]) -> dict[int, list[list[Any]]]:
    """Return the last twelve valuations of the players as [date, value] pairs, oldest first."""
    wanted = valuations.loc[
        valuations["player_id"].isin(list(ids)) & valuations["market_value_in_eur"].notna()
    ].sort_values(["player_id", "date"], kind="mergesort")
    result: dict[int, list[list[Any]]] = {}
    for player, rows in wanted.groupby("player_id"):
        recent = rows.tail(HISTORY_POINTS)
        result[int(str(player))] = [
            [str(d)[:10], whole_or_float(v)]
            for d, v in zip(recent["date"], recent["market_value_in_eur"], strict=True)
        ]
    return result


def fill_percentiles(frame: pd.DataFrame, radar: pd.DataFrame) -> pd.DataFrame:
    """Give the five percentiles to the players who have none: against every player of the
    position group with the minimum minutes in the radar season, whatever his age."""
    out = frame.copy()
    missing = out["pct_output"].isna()
    for group in rating.POSITION_GROUPS:
        rows = missing & (out["position_group"] == group)
        reference = radar.loc[
            (radar["position_group"] == group) & (radar["minutes"] >= rating.MIN_MINUTES)
        ]
        if not rows.any():
            continue
        for column, metric in rating.PERCENTILE_METRICS.items():
            known = reference[metric].dropna().to_numpy(dtype="float64")
            if len(known):
                out.loc[rows, column] = rating.percentile_of(known, out.loc[rows, metric])
    return out


def candidate_rows(src: Sources) -> pd.DataFrame:
    """Return the radar pool and the Bosnian players outside it, one row per player."""
    radar = src.rated.loc[src.rated["season"] == config.RADAR_SEASON]
    pool = radar.loc[radar["in_pool"].astype(bool)]
    key = ["player_id", "season", "league_id"]
    tier_columns = [*key, "score", "score_rank_pct", "tier", "drivers", *FLAG_COLUMNS.values()]
    pool = one_per_player(pool).merge(src.tiers[tier_columns], on=key, how="left")
    bosnian = src.players.loc[src.players["country_of_citizenship"] == CITIZENSHIP, "player_id"]
    outside = radar.loc[
        radar["player_id"].isin(bosnian)
        & (radar["minutes"] >= rating.MIN_MINUTES)
        & ~radar["player_id"].isin(pool["player_id"])
    ]
    both = pd.concat(
        [pool.assign(in_pool=True), one_per_player(outside).assign(in_pool=False)],
        ignore_index=True,
    )
    return fill_percentiles(both, radar)


def player_frame(src: Sources) -> pd.DataFrame:
    """Join the candidates with the player, club, league and latest valuation tables."""
    frame = candidate_rows(src)
    frame = frame.merge(src.players, on="player_id", how="left")
    clubs = src.clubs.rename(columns={"name": "club"})
    frame = frame.merge(clubs.drop_duplicates("club_id"), on="club_id", how="left")
    names = src.leagues[["league_id", "league_name", "factor_source"]].rename(
        columns={"factor_source": "league_factor_source"}
    )
    frame = frame.merge(names, on="league_id", how="left")
    frame = frame.merge(latest_valuations(src.valuations), on="player_id", how="left")
    later = ~frame["in_pool"]
    frame["value_eur"] = frame["value_decision"].where(
        ~later, frame["value_decision"].fillna(frame["latest_value"])
    )
    frame["value_date"] = frame["value_decision_date"].where(
        ~later, frame["value_decision_date"].fillna(frame["latest_date"])
    )
    return frame.reset_index(drop=True)


def drop_unusable(frame: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Drop the players outside the pool who lack a birth date, club, group or value.

    A pool player is never dropped: the checks report him. Return the frame and the count.
    """
    needed = ["date_of_birth", "club", "position_group", "value_eur", "name"]
    unusable = ~frame["in_pool"] & frame[needed].isna().any(axis=1)
    return frame.loc[~unusable].reset_index(drop=True), int(unusable.sum())


def attach_flags(frame: pd.DataFrame, last_date: pd.Timestamp) -> pd.DataFrame:
    """Set the flags of the players outside the pool; the pool keeps the flags of `tiers.csv`."""
    out = frame.copy()
    outside = ~out["in_pool"]
    if outside.any():
        flags = compute_flags(out.loc[outside], last_date)
        for column in FLAG_COLUMNS.values():
            out[column] = out[column].astype("object")
            out.loc[outside, column] = flags[column]
    return out


def record_of(
    row: Mapping[str, Any], history: list[list[Any]], last_date: pd.Timestamp
) -> dict[str, Any]:
    """Turn one row of the player frame into a record with every key of the schema."""
    born = pd.to_datetime(row["date_of_birth"], errors="coerce")
    in_pool = bool(row["in_pool"])
    height = plausible_height(row["height_in_cm"])
    return {
        "id": str(int(row["player_id"])),
        "name": clean(row["name"]),
        "club": clean(row["club"]),
        "league_id": row["league_id"],
        "league_name": clean(row["league_name"]),
        "position_group": clean(row["position_group"]),
        "position": clean(row["sub_position"]) or clean(row["position_group"]),
        "age": None if pd.isna(born) else round((last_date - born).days / DAYS_PER_YEAR, 1),
        "birth_quarter": None if pd.isna(born) else (born.month - 1) // 3 + 1,
        "height_cm": None if height is None else whole_or_float(height),
        "foot": clean(row["foot"]),
        "value_eur": None if is_missing(row["value_eur"]) else whole_or_float(row["value_eur"]),
        "value_date": date_text(row["value_date"]),
        "contract_until": date_text(row["contract_expiration_date"]),
        "minutes": int(row["minutes"]),
        "matches": int(row["matches"]),
        "goals": int(row["goals"]),
        "assists": int(row["assists"]),
        "ga90": round(float(row["ga90"]), 2),
        "league_factor": clean(row["league_factor"]),
        "league_factor_source": row["league_factor_source"],
        "ga90_adj": clean(row["ga90_adj"]),
        "involvement": round_or_none(row["involvement"], 2),
        "role": round_or_none(row["role"], 2),
        "pct": {
            key: None if is_missing(row[column]) else int(row[column])
            for key, column in PCT_KEYS.items()
        },
        "score": round_or_none(row["score"], SCORE_DECIMALS) if in_pool else None,
        "score_rank_pct": rank_or_none(row["score_rank_pct"]) if in_pool else None,
        "tier": clean(row["tier"]) if in_pool else None,
        "drivers": drivers_of(row["drivers"]) if in_pool else [],
        "flags": {key: bool(row[column]) for key, column in FLAG_COLUMNS.items()},
        "similar": [],
        "note": None,
        "note_source": None,
        "citizenship": clean(row["country_of_citizenship"]),
        "value_history": history,
        "in_pool": in_pool,
    }


def round_or_none(value: object, digits: int) -> float | None:
    """Round a number, or return None for an empty cell."""
    return None if is_missing(value) else round(float(str(value)), digits)


def rank_or_none(value: object) -> int | None:
    """Return a whole number, or None for an empty cell."""
    return None if is_missing(value) else int(float(str(value)))


def drivers_of(value: object) -> list[dict[str, str]]:
    """Read the reasons of a pool player from the JSON text of `tiers.csv`."""
    if is_missing(value):
        return []
    try:
        parsed: list[dict[str, str]] = json.loads(str(value))
    except json.JSONDecodeError as error:
        raise StepError(f"{TIERS_FILE} holds reasons that are not valid JSON: {error}") from error
    return parsed


def sort_key(record: Mapping[str, Any]) -> tuple[bool, float, str]:
    """Order the records: the pool first by score, highest first, then the rest, by id."""
    return (not record["in_pool"], -(record["score"] or 0.0), str(record["id"]))


def add_similar(
    records: Sequence[dict[str, Any]], pool_rows: pd.DataFrame, last_date: pd.Timestamp
) -> None:
    """Fill `similar` of the pool records; every other field and every other record stays."""
    table = pool_rows.copy()
    born = pd.to_datetime(table["date_of_birth"], errors="coerce")
    table["age"] = (last_date - born).dt.days / DAYS_PER_YEAR
    lists = similar.find_similar(table)
    for record in records:
        if record["in_pool"]:
            record["similar"] = lists.get(record["id"], [])


def build_players(src: Sources) -> tuple[list[dict[str, Any]], pd.DataFrame, int]:
    """Build the records of players.json, the pool rows for the checks and the count left out."""
    frame, left_out = drop_unusable(player_frame(src))
    frame = attach_flags(frame, src.source_last_date)
    history = histories(src.valuations, frame["player_id"].astype(int).tolist())
    records = [
        record_of(row, history.get(int(row["player_id"]), []), src.source_last_date)
        for row in (
            {str(key): value for key, value in raw.items()} for raw in frame.to_dict("records")
        )
    ]
    pool_rows = frame.loc[frame["in_pool"]].copy()
    add_similar(records, pool_rows, src.source_last_date)
    notes.apply_notes(records, src.tier_stats, src.notes)
    pool_rows["value_eur"] = pool_rows["value_eur"].astype("float64")
    return sorted(records, key=sort_key), pool_rows, left_out


def brief_position(record: Mapping[str, Any]) -> str:
    """Return the brief position of a player as `brief.ts` maps it: his position, else his group."""
    return BRIEF_BY_POSITION.get(record["position"]) or BRIEF_BY_GROUP.get(
        record["position_group"], ""
    )


def affordable(record: Mapping[str, Any], budget: int) -> bool:
    """Tell whether a record has a value of at most the budget; a missing value does not."""
    value = record["value_eur"]
    return value is not None and bool(value <= budget)


def matches_brief(record: Mapping[str, Any], position: str, max_age: int, budget: int) -> bool:
    """Tell whether a pool player fits a brief position, the age limit and the budget."""
    return (
        bool(record["in_pool"])
        and brief_position(record) == position
        and record["age"] is not None
        and record["age"] < max_age + 1
        and affordable(record, budget)
    )


def default_brief(
    records: Sequence[Mapping[str, Any]],
) -> tuple[dict[str, Any], dict[str, int]]:
    """Choose the default brief by rule and return it with the match count of every position.

    The position is the one with the most pool players of the age limit and the budget; when
    it has fewer than three, the next position by count is taken.
    """
    max_age, budget = rating.MAX_YOUNG_AGE, rating.BUDGETS[1]
    counts = {
        position: sum(1 for r in records if matches_brief(r, position, max_age, budget))
        for position in BRIEF_POSITIONS
    }
    ranked = sorted(BRIEF_POSITIONS, key=lambda p: (-counts[p], BRIEF_POSITIONS.index(p)))
    for position in ranked:
        if counts[position] >= MIN_BRIEF_MATCHES:
            brief = {
                "position": position,
                "max_age": max_age,
                "budget_eur": budget,
                "matters": list(BRIEF_MATTERS),
            }
            return brief, counts
    raise StepError(f"no brief position has {MIN_BRIEF_MATCHES} matching players: {counts}")


def build_leagues(src: Sources, records: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Build leagues.json: factor, source, seasons and the pool counts at both budgets."""
    pool = [r for r in records if r["in_pool"]]
    rows = []
    for row in src.leagues.sort_values("league_id").to_dict("records"):
        here = [r for r in pool if r["league_id"] == row["league_id"]]
        rows.append(
            {
                "id": row["league_id"],
                "name": row["league_name"],
                "seasons": int(row["seasons"]),
                "factor": float(row["factor"]),
                "factor_source": row["factor_source"],
                "pool_1m": len(here),
                "pool_500k": sum(1 for r in here if affordable(r, rating.BUDGETS[1])),
            }
        )
    return {"leagues": rows}


def definitions() -> dict[str, str]:
    """Return the definitions shown in the evidence screen, with the figures of the rules."""
    return {
        "young_player": (
            f"Season start year minus birth year is at most {rating.MAX_YOUNG_AGE}, and at "
            f"least {rating.MIN_MINUTES} league minutes in the season"
        ),
        "decision_value": "Last valuation between 1 December of the season and 30 June at its end",
        "outcome": (
            f"Last valuation between 1 December and 30 June {values.OUTCOME_LAG} seasons later"
        ),
        "hit": (
            f"Outcome is at least {values.MADE_IT_FACTOR} times the decision value and at "
            f"least {values.MADE_IT_MINIMUM:,} EUR"
        ),
        "no_later_value": (
            f"A player with no valuation {values.OUTCOME_LAG} seasons later counts as not made it"
        ),
        "birth_quarter_young": (
            "Odds ratio of a birth in the fourth quarter against the first, young players "
            "against all other players of the 23 leagues; the interval is the 95% Woolf interval"
        ),
    }


def backtest_part(report: Mapping[str, Any]) -> dict[str, Any]:
    """Return the backtest of `backtest.json` with the keys of the contract only."""
    row_keys = ("rule", "label", "hits", "picks", "rate")
    budget_keys = ("budget_eur", "players", "picks_per_rule", "margin_pp", "base_rate")
    budgets = []
    for budget in report["budgets"]:
        entry = {key: budget[key] for key in budget_keys}
        for rows in ("rows", "rows_top20"):
            entry[rows] = [{key: row[key] for key in row_keys} for row in budget[rows]]
        budgets.append(entry)
    return {
        "test_seasons": list(report["test_seasons"]),
        "pick_share": report["pick_share"],
        "budgets": budgets,
        "by_season": [
            {key: entry[key] for key in ("season", "hits", "picks")}
            for entry in report["by_season"]
        ],
    }


def quarter_counts(born: pd.Series) -> list[int]:
    """Return how many of the birth dates fall into each quarter of the year."""
    quarters = Counter(int((m - 1) // 3 + 1) for m in born.dt.month)
    return [quarters[q] for q in (1, 2, 3, 4)]


def birth_evidence(src: Sources) -> tuple[dict[str, Any], dict[str, Any]]:
    """Compute `birth_months` for every player of the leagues and `birth_quarter_young` for
    the young players from the birth dates, as the prototype's `qdist` does."""
    born = pd.to_datetime(src.players.set_index("player_id")["date_of_birth"], errors="coerce")
    born = born[~born.index.duplicated()]
    everyone = born.reindex(src.rated["player_id"].unique()).dropna()
    young_ids = src.rated.loc[src.rated["young"].astype(bool), "player_id"].unique()
    young = born.reindex(young_ids).dropna()
    rest = everyone.drop(index=young.index, errors="ignore")
    months = Counter(int(m) for m in everyone.dt.month)
    total = len(everyone)
    quarters = quarter_counts(everyone)
    on_first = int(((everyone.dt.month == 1) & (everyone.dt.day == 1)).sum())
    months_part = {
        "players": total,
        "pct_by_month": [round(PERCENT * months[m] / total, SHARE_DECIMALS) for m in range(1, 13)],
        "pct_by_quarter": [round(PERCENT * q / total, SHARE_DECIMALS) for q in quarters],
        "born_on_1_jan_pct": round(PERCENT * on_first / total, SHARE_DECIMALS),
    }
    return months_part, odds_part(quarter_counts(young), quarter_counts(rest))


def odds_part(young: list[int], rest: list[int]) -> dict[str, Any]:
    """Return the young players by quarter and the odds ratio of the fourth quarter against
    the first for them against the rest, with its 95% Woolf interval."""
    cells = (young[3], young[0], rest[0], rest[3])
    if min(cells) == 0:
        raise StepError("a birth quarter has no players: the odds ratio cannot be computed")
    ratio = (young[3] * rest[0]) / (young[0] * rest[3])
    spread = NormalDist().inv_cdf(CONFIDENCE_CUT) * math.sqrt(sum(1 / c for c in cells))
    low, high = math.exp(math.log(ratio) - spread), math.exp(math.log(ratio) + spread)
    return {
        "players_by_quarter": young,
        "odds_ratio_q4_vs_q1": round(ratio, 2),
        "ci95": [round(low, 2), round(high, 2)],
    }


def build_evidence(src: Sources, generated: str) -> dict[str, Any]:
    """Build evidence.json from the work files, the birth dates and the minutes check."""
    months, young = birth_evidence(src)
    return {
        "generated": generated,
        "definitions": definitions(),
        "backtest": backtest_part(src.backtest),
        "tiers": {tier: {k: src.tier_stats[tier][k] for k in STATS_KEYS} for tier in TIERS},
        "league_moves": {
            key: src.league_evidence["league_moves"][key] for key in ("total", "used_for_factors")
        },
        "same_players_two_leagues": src.league_evidence["same_players_two_leagues"],
        "birth_months": months,
        "birth_quarter_young": young,
        "minutes_check": src.minutes_check,
    }


def build_timemachine(src: Sources) -> dict[str, Any]:
    """Build timemachine.json: the lists of the step plus the outcome ranges of the tiers."""
    ranges = {}
    for tier in TIERS:
        stats = src.tier_stats[tier]
        ranges[tier] = {
            "n": stats["n"],
            "hits": stats["hits"],
            "rate": stats["rate"],
            "unknown_outcome": stats["no_later_value"],
            "multiple_p25": stats["multiple_p25"],
            "multiple_p50": stats["multiple_p50"],
            "multiple_p75": stats["multiple_p75"],
            "share_lost_value": stats["share_lost_value"],
        }
    return {
        "as_of": src.lists["as_of"],
        "six_seasons": src.lists["six_seasons"],
        "outcome_ranges": ranges,
        "seasons": src.lists["seasons"],
    }


def season_range(starts: Sequence[int]) -> str:
    """Return the first and last season of a list of start years, joined by an en dash."""
    return f"{backtest.season_label(min(starts))}{DASH}{backtest.season_label(max(starts))}"


def build_meta(
    src: Sources, records: Sequence[Mapping[str, Any]], brief: dict[str, Any], built: str
) -> dict[str, Any]:
    """Build meta.json from the data: dates, counts, pool sizes, model facts and the brief."""
    pool = [r for r in records if r["in_pool"]]
    cheap = [r for r in pool if affordable(r, rating.BUDGETS[1])]
    tested = src.backtest["test_seasons"]
    return {
        "built": built,
        "source": SOURCE_NAME,
        "source_last_date": f"{src.source_last_date:%Y-%m-%d}",
        "leagues": len(src.leagues),
        "seasons": season_range([int(s) for s in src.rated["season"].unique()]),
        "radar_season": backtest.season_label(config.RADAR_SEASON),
        "pool": {
            "up_to_1m": len(pool),
            "up_to_500k": len(cheap),
            "regional_up_to_500k": sum(
                1 for r in cheap if r["league_id"] in config.SHORT_HISTORY_LEAGUES
            ),
        },
        "model": {
            "type": MODEL_TYPE,
            "features": len(src.facts["features"]),
            "training_rows": int(src.facts["training_rows"]),
            "trained_on_seasons": season_range([int(s) for s in src.facts["training_seasons"]]),
        },
        "validation": f"Walk-forward backtest, test seasons {tested[0]}{DASH}{tested[-1]}",
        "status": STATUS,
        "default_brief": brief,
    }


def assemble(src: Sources, now: datetime) -> Assembled:
    """Assemble the five files in memory."""
    records, pool_rows, left_out = build_players(src)
    brief, counts = default_brief(records)
    files = {
        "players": records,
        "leagues": build_leagues(src, records),
        "evidence": build_evidence(src, f"{now:%Y-%m-%d}"),
        "timemachine": build_timemachine(src),
        "meta": build_meta(src, records, brief, f"{now:%Y-%m-%dT%H:%M:%SZ}"),
    }
    return Assembled(files=files, pool_rows=pool_rows, brief_counts=counts, left_out=left_out)


def check_data(src: Sources, assembled: Assembled) -> checks.CheckData:
    """Put what the checks look at together."""
    return checks.CheckData(
        source_tables=src.source_tables,
        minutes_check=src.minutes_check,
        rated=src.rated,
        leagues=src.leagues,
        league_evidence=src.league_evidence,
        backtest=src.backtest,
        pools=src.pools,
        pool_rows=assembled.pool_rows,
        files=assembled.files,
        tier_stats=src.tier_stats,
    )


def dump(data: object) -> str:
    """Write data as compact JSON with sorted keys, so that equal data gives equal text."""
    return json.dumps(
        data, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
    )


def stage_files(files: Mapping[str, Any], stage: Path, limit: int) -> dict[str, int]:
    """Write the files into the stage folder, check the total size and every schema."""
    sizes: dict[str, int] = {}
    for name in contract.FILES:
        try:
            text = dump(files[name])
        except ValueError as error:
            raise StepError(f"{name}.json cannot be written: {error}") from error
        path = stage / f"{name}.json"
        path.write_text(text, encoding="utf-8")
        sizes[name] = path.stat().st_size
    if sum(sizes.values()) >= limit:
        raise StepError(f"the five files are {sum(sizes.values())} bytes, not under {limit}")
    for name in contract.FILES:
        try:
            contract.validate_file(name, stage / f"{name}.json")
        except contract.ContractError as error:
            raise StepError(f"schema check failed: {error}") from error
    return sizes


def write_files(
    files: Mapping[str, Any], target: Path, limit: int = MAX_TOTAL_BYTES
) -> dict[str, int]:
    """Write the five files into a temporary folder next to `target`, check size and schemas
    there, and move them into place only when everything passed. Return the sizes in bytes.

    On any failure the files in `target` are left as they were.
    """
    target.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".export-", dir=target.parent))
    kept = Path(tempfile.mkdtemp(prefix=".export-kept-", dir=target.parent))
    try:
        sizes = stage_files(files, stage, limit)
        move_into_place(stage, target, kept)
    finally:
        shutil.rmtree(stage, ignore_errors=True)
        shutil.rmtree(kept, ignore_errors=True)
    return sizes


def move_into_place(stage: Path, target: Path, kept: Path) -> None:
    """Move the five staged files into `target`, all or none.

    The previous files are kept aside first. When a move fails, every previous file is put
    back, a new file without a predecessor is removed, and a `StepError` names the failed file.
    """
    target.mkdir(exist_ok=True)
    existing = [n for n in contract.FILES if (target / f"{n}.json").is_file()]
    try:
        for name in existing:
            shutil.copy2(target / f"{name}.json", kept / f"{name}.json")
    except OSError as error:
        raise StepError(f"the previous files could not be kept: {error}") from error
    moved: list[str] = []
    for name in contract.FILES:
        try:
            move_file(stage / f"{name}.json", target / f"{name}.json")
        except OSError as error:
            restore(target, kept, existing, moved)
            raise StepError(f"{name}.json was not written: {error}") from error
        moved.append(name)


def move_file(source: Path, destination: Path) -> None:
    """Move one file, replacing the destination."""
    source.replace(destination)


def restore(target: Path, kept: Path, existing: list[str], moved: list[str]) -> None:
    """Put the previous files back and remove the new files that had no predecessor."""
    for name in moved:
        path = target / f"{name}.json"
        if name in existing:
            shutil.copy2(kept / f"{name}.json", path)
        else:
            path.unlink(missing_ok=True)


def default_out_dir() -> Path:
    """Return the folder the app reads its data from."""
    return config.repository_root().joinpath(*OUT_FOLDER)


def run_export(
    raw_dir: Path,
    work_dir: Path,
    out_dir: Path,
    now: datetime | None = None,
    reader: Callable[[Path, Path], Sources] = read_sources,
) -> ExportRun:
    """Assemble the files, run the fifteen checks and write the files into `out_dir`."""
    src = reader(raw_dir, work_dir)
    assembled = assemble(src, now or datetime.now(UTC))
    outcomes = checks.run_checks(check_data(src, assembled))
    sizes = write_files(assembled.files, out_dir)
    records = assembled.files["players"]
    pool = sum(1 for r in records if r["in_pool"])
    return ExportRun(
        sizes=sizes,
        pool=pool,
        outside=len(records) - pool,
        left_out=assembled.left_out,
        brief=assembled.files["meta"]["default_brief"],
        outcomes=outcomes,
    )


def last_pool_size(out_dir: Path) -> int:
    """Return the radar pool size that the written `meta.json` in `out_dir` states."""
    path = require_file(out_dir / "meta.json", "run the step `export` first")
    try:
        size: int = json.loads(path.read_text(encoding="utf-8"))["pool"]["up_to_1m"]
    except (json.JSONDecodeError, KeyError, UnicodeDecodeError) as error:
        raise StepError(f"{path} holds no pool size: {error}") from error
    return size
