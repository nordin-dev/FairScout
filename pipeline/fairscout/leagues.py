"""Step `leagues`: one factor per league, so that output from different leagues is on one scale.

A factor says how much easier a goal or assist is in the league than on average across the 14
measured leagues: 1.00 is average, lower means a harder league. The 14 long-history leagues are
measured from movers: attackers and midfielders with at least 900 minutes in season S in one
league and at least 900 minutes in season S+1 in another. Per unordered league pair the goals
plus assists and the minutes of the movers are summed on each side (both directions pooled) and
the ratio of the two rates is taken. Pairs with fewer than eight movers are left out. The log
factors come from weighted least squares on the log ratios, weighted by the number of movers,
with the mean log factor fixed at zero. The nine short-history leagues get an estimate from a
straight line of log factor against the median log decision value of the league's players in the
latest season (450 minutes or more); Russia and Ukraine are left out of that fit.
"""

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Final

import numpy as np
import pandas as pd

from fairscout import config, ingest, seasons, values
from fairscout.errors import StepError, require_file

LEAGUES_FILE: Final = "leagues.csv"
EVIDENCE_FILE: Final = "league_evidence.json"
LEAGUE_COLUMNS: Final[tuple[str, ...]] = (
    "league_id",
    "league_name",
    "factor",
    "factor_source",
    "median_value",
    "seasons",
)
MOVES: Final = "moves"
ESTIMATE: Final = "estimate"
MOVER_MINUTES: Final = 900
VALUE_MINUTES: Final = 450
MIN_MOVERS: Final = 8
EXAMPLE_MIN_MOVERS: Final = 20
FACTOR_MIN: Final = 0.3
FACTOR_MAX: Final = 2.5
DECIMALS: Final = 4
POSITIONS: Final[tuple[str, ...]] = ("Attack", "Midfield")
DISTORTED: Final[tuple[str, ...]] = ("RU1", "UKR1")
PAIR_COLUMNS: Final[tuple[str, ...]] = (
    "league_a",
    "league_b",
    "movers",
    "ga_a",
    "minutes_a",
    "ga_b",
    "minutes_b",
)


@dataclass(frozen=True, slots=True)
class Leagues:
    """The factor table, the moves counts, the example pair and the two checks."""

    table: pd.DataFrame
    moves_total: int
    moves_used: int
    example: dict[str, object]
    rank_correlation: float
    lowest_league: str


def find_movers(table: pd.DataFrame, players: pd.DataFrame) -> pd.DataFrame:
    """Return one row per mover: attackers and midfielders with 900 or more minutes in season S
    in league A and in season S+1 in a different league B, both among the 14 long-history
    leagues. A player with 900 minutes in two leagues in one season counts in the league of
    most minutes (ties by league id). Columns: league_a, league_b, ga_a, minutes_a, ga_b,
    minutes_b, one row per player and season S.
    """
    wanted = players.loc[players["position"].isin(POSITIONS), "player_id"]
    rows = table.loc[
        table["player_id"].isin(wanted)
        & table["league_id"].isin(list(config.LONG_HISTORY_LEAGUES))
        & (table["minutes"] >= MOVER_MINUTES),
        ["player_id", "season", "league_id", "minutes", "goals", "assists"],
    ].copy()
    rows["ga"] = rows["goals"] + rows["assists"]
    rows = rows.sort_values(
        ["player_id", "season", "minutes", "league_id"], ascending=[True, True, False, True]
    ).drop_duplicates(["player_id", "season"])
    later = rows.assign(season=rows["season"] - 1)
    joined = rows.merge(later, on=["player_id", "season"], suffixes=("_a", "_b"))
    joined = joined.loc[joined["league_id_a"] != joined["league_id_b"]]
    result = joined.rename(columns={"league_id_a": "league_a", "league_id_b": "league_b"})
    return result[["league_a", "league_b", "ga_a", "minutes_a", "ga_b", "minutes_b"]].reset_index(
        drop=True
    )


def pair_totals(movers: pd.DataFrame) -> pd.DataFrame:
    """Sum the movers per unordered league pair, the lower league id first, both directions
    pooled. Columns of `PAIR_COLUMNS`, sorted by the pair."""
    flip = movers["league_a"] > movers["league_b"]
    first = movers["league_a"].where(~flip, movers["league_b"])
    second = movers["league_b"].where(~flip, movers["league_a"])
    ga_first = movers["ga_a"].where(~flip, movers["ga_b"])
    min_first = movers["minutes_a"].where(~flip, movers["minutes_b"])
    ga_second = movers["ga_b"].where(~flip, movers["ga_a"])
    min_second = movers["minutes_b"].where(~flip, movers["minutes_a"])
    frame = pd.DataFrame(
        {
            "league_a": first,
            "league_b": second,
            "movers": 1,
            "ga_a": ga_first,
            "minutes_a": min_first,
            "ga_b": ga_second,
            "minutes_b": min_second,
        }
    )
    grouped = frame.groupby(["league_a", "league_b"], as_index=False).sum()
    return grouped[list(PAIR_COLUMNS)].reset_index(drop=True)


def usable_pairs(pairs: pd.DataFrame) -> pd.DataFrame:
    """Keep the pairs with at least eight movers and goals plus assists on both sides, and add
    `log_ratio`, the log of the rate in league b over the rate in league a."""
    kept = pairs.loc[
        (pairs["movers"] >= MIN_MOVERS) & (pairs["ga_a"] > 0) & (pairs["ga_b"] > 0)
    ].copy()
    rate_a = kept["ga_a"] / kept["minutes_a"]
    rate_b = kept["ga_b"] / kept["minutes_b"]
    kept["log_ratio"] = np.log(rate_b / rate_a)
    return kept.reset_index(drop=True)


def fit_log_factors(pairs: pd.DataFrame, league_ids: list[str]) -> dict[str, float]:
    """Return the log factor of every league from weighted least squares on the log ratios of
    `pairs` (needs `league_a`, `league_b`, `movers`, `log_ratio`), weighted by the movers, with
    the mean log factor fixed at zero. A league that no pair connects stops the run."""
    index = {league: i for i, league in enumerate(league_ids)}
    size = len(league_ids)
    normal = np.zeros((size, size))
    target = np.zeros(size)
    for first, second, count, log_ratio in zip(
        pairs["league_a"].astype(str),
        pairs["league_b"].astype(str),
        pairs["movers"].astype("float64"),
        pairs["log_ratio"].astype("float64"),
        strict=True,
    ):
        i, j = index[first], index[second]
        weight = float(count)
        normal[i, i] += weight
        normal[j, j] += weight
        normal[i, j] -= weight
        normal[j, i] -= weight
        target[j] += weight * float(log_ratio)
        target[i] -= weight * float(log_ratio)
    # The mean is fixed at zero by adding a matrix of ones: the rows of `normal` sum to zero
    # and so does `target`, so the solution of the sum has a mean of exactly zero.
    system = normal + np.ones((size, size))
    if np.linalg.matrix_rank(system) < size:
        lone = sorted(
            league
            for league in league_ids
            if not ((pairs["league_a"] == league) | (pairs["league_b"] == league)).any()
        )
        named = ", ".join(lone) if lone else "some leagues"
        raise StepError(f"the league pairs do not connect all leagues; not connected: {named}")
    solved = np.linalg.solve(system, target)
    return {league: float(solved[index[league]]) for league in league_ids}


def median_log_values(table: pd.DataFrame) -> dict[str, float]:
    """Return per league the median of the log decision value of its players in the latest
    season of the table, players with 450 or more minutes."""
    latest = int(table["season"].max())
    rows = table.loc[
        (table["season"] == latest)
        & (table["minutes"] >= VALUE_MINUTES)
        & table["value_decision"].notna()
        & (table["value_decision"] > 0)
    ]
    logs = rows["value_decision"].astype("float64").map(math.log)
    medians = logs.groupby(rows["league_id"]).median()
    return {str(league): float(value) for league, value in medians.items()}


def estimate_log_factors(
    measured: dict[str, float], medians: dict[str, float], short: list[str]
) -> dict[str, float]:
    """Fit log factor on median log value over the measured leagues without Russia and Ukraine
    and apply the line to the leagues in `short`."""
    fitted = [league for league in sorted(measured) if league not in DISTORTED]
    slope, intercept = np.polyfit(
        [medians[league] for league in fitted], [measured[league] for league in fitted], 1
    )
    return {league: float(intercept + slope * medians[league]) for league in short}


def check_range(factors: dict[str, float], names: dict[str, str]) -> None:
    """Stop with a `StepError` that names the first league (by id) whose factor lies outside
    0.3 to 2.5."""
    for league in sorted(factors):
        factor = factors[league]
        if not FACTOR_MIN <= factor <= FACTOR_MAX:
            raise StepError(
                f"league factor of {names[league]} is {factor:.4f}, outside the range "
                f"{FACTOR_MIN} to {FACTOR_MAX}"
            )


def choose_example(pairs: pd.DataFrame, names: dict[str, str]) -> dict[str, object]:
    """Pick the same-players example by rule: among pairs with at least 20 movers, the one with
    the largest absolute log ratio (ties by league ids). Report both league names, the number
    of players and the two rates per 90 minutes."""
    big = pairs.loc[
        (pairs["movers"] >= EXAMPLE_MIN_MOVERS) & (pairs["ga_a"] > 0) & (pairs["ga_b"] > 0)
    ]
    if big.empty:
        raise StepError("no league pair has 20 or more movers; no example can be chosen")
    ratio = (big["ga_b"] / big["minutes_b"]) / (big["ga_a"] / big["minutes_a"])
    order = big.assign(size=ratio.map(lambda value: abs(math.log(value)))).sort_values(
        ["size", "league_a", "league_b"], ascending=[False, True, True]
    )
    top = order.iloc[0]
    return {
        "league_a": names[str(top["league_a"])],
        "league_b": names[str(top["league_b"])],
        "players": int(top["movers"]),
        "ga90_a": round(90 * float(top["ga_a"]) / float(top["minutes_a"]), 3),
        "ga90_b": round(90 * float(top["ga_b"]) / float(top["minutes_b"]), 3),
    }


def build_leagues(appearances: pd.DataFrame, table: pd.DataFrame, players: pd.DataFrame) -> Leagues:
    """Compute the 23 league factors. Movers come from `appearances`, the long-history season
    table without any value condition; the median values behind the estimates come from
    `table`, the season table with decision values; `players` gives the position."""
    names = {**config.LONG_HISTORY_LEAGUES, **config.SHORT_HISTORY_LEAGUES}
    long_ids = sorted(config.LONG_HISTORY_LEAGUES)
    short_ids = sorted(config.SHORT_HISTORY_LEAGUES)
    movers = find_movers(appearances, players)
    pairs = pair_totals(movers)
    used = usable_pairs(pairs)
    measured = fit_log_factors(used, long_ids)
    medians = median_log_values(table)
    absent = [league for league in long_ids + short_ids if league not in medians]
    if absent:
        raise StepError(
            "no player with a value and 450 minutes in the latest season for: "
            + ", ".join(names[league] for league in absent)
        )
    estimated = estimate_log_factors(measured, medians, short_ids)
    factors = {league: math.exp(log) for league, log in {**measured, **estimated}.items()}
    check_range(factors, names)
    season_count = table.groupby("league_id")["season"].nunique()
    ids = sorted(factors)
    result = pd.DataFrame(
        {
            "league_id": ids,
            "league_name": [names[league] for league in ids],
            "factor": [round(factors[league], DECIMALS) for league in ids],
            "factor_source": [MOVES if league in measured else ESTIMATE for league in ids],
            "median_value": [round(math.exp(medians[league])) for league in ids],
            "seasons": [int(season_count.get(league, 0)) for league in ids],
        }
    )[list(LEAGUE_COLUMNS)]
    measured_rows = result.loc[result["factor_source"] == MOVES]
    correlation = float(measured_rows["factor"].rank().corr(measured_rows["median_value"].rank()))
    lowest = str(measured_rows.sort_values(["factor", "league_id"]).iloc[0]["league_name"])
    return Leagues(
        table=result,
        moves_total=len(movers),
        moves_used=int(used["movers"].sum()),
        example=choose_example(pairs, names),
        rank_correlation=correlation,
        lowest_league=lowest,
    )


def read_inputs(raw_dir: Path, work_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Read the long-history season table (for the movers), the season table with values and
    the players table."""
    long_path = require_file(work_dir / seasons.SEASONS_FILE, "run the step `seasons` first")
    values_path = require_file(work_dir / values.SEASONS_FILE, "run the step `values` first")
    players_path = require_file(
        raw_dir / config.table_file("players"), "run the step `ingest` first"
    )
    frames = []
    for path in (long_path, values_path):
        try:
            frames.append(pd.read_csv(path))
        except (pd.errors.ParserError, UnicodeDecodeError) as error:
            raise StepError(f"input file {path} is missing or unreadable: {error}") from error
    if "value_decision" not in frames[1].columns:
        raise StepError(
            f"input file {values_path} has no decision values; run the step `values` first"
        )
    players = pd.read_csv(players_path, usecols=["player_id", "position"])
    return frames[0], frames[1], players


def write_leagues(raw_dir: Path, work_dir: Path) -> Leagues:
    """Read the inputs, compute the factors and write `leagues.csv` and `league_evidence.json`
    into the work folder, each through a temporary file. The season table is not touched."""
    appearances, table, players = read_inputs(raw_dir, work_dir)
    built = build_leagues(appearances, table, players)
    target = work_dir / LEAGUES_FILE
    with ingest.partial_file(target) as partial:
        built.table.to_csv(partial, index=False, lineterminator="\n")
        partial.replace(target)
    evidence = {
        "league_moves": {"total": built.moves_total, "used_for_factors": built.moves_used},
        "same_players_two_leagues": built.example,
        "rank_correlation": round(built.rank_correlation, DECIMALS),
        "lowest_league": built.lowest_league,
    }
    evidence_target = work_dir / EVIDENCE_FILE
    with ingest.partial_file(evidence_target) as partial:
        partial.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
        partial.replace(evidence_target)
    return built
