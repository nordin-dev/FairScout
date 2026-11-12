"""Step `rating`: adjusted output, goal involvement, role and percentiles for every player-season.

Rows are every player, season and league of the two unfiltered season tables, with the value
columns of `seasons.csv` where a decision value exists. Team goals and team matches come from
`games`: matches with a result only, goals scored by the club at home or away. A league season
starts in the calendar year of its first match, which differs from the label in Norway and
Sweden. A young player started the season at most 21 years after his birth year and played at
least 450 minutes. Percentiles exist only for the young players of the radar season, against
the young players of the same position group in all leagues; a reference group under 30
falls back to every player of that position group with at least 450 minutes that season.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Final

import numpy as np
import pandas as pd

from fairscout import config, ingest, leagues, rebuild, seasons, values
from fairscout.errors import StepError, require_file

RATED_FILE: Final = "rated.csv"
MAX_YOUNG_AGE: Final = 21
MIN_MINUTES: Final = 450
MIN_REFERENCE: Final = 30
BUDGETS: Final[tuple[int, int]] = (1_000_000, 500_000)
POSITION_GROUPS: Final[tuple[str, ...]] = ("Attack", "Midfield", "Defender", "Goalkeeper")
PERCENTILE_METRICS: Final[dict[str, str]] = {
    "pct_output": "ga90_adj",
    "pct_scoring": "g90_adj",
    "pct_creating": "a90_adj",
    "pct_involvement": "involvement",
    "pct_role": "role",
}
RATING_COLUMNS: Final[tuple[str, ...]] = (
    *values.TABLE_COLUMNS,
    "position_group",
    "birth_year",
    "start_year",
    "young",
    "team_goals",
    "team_matches",
    "role",
    "ga90",
    "league_factor",
    "ga90_adj",
    "g90_adj",
    "a90_adj",
    "involvement",
    *PERCENTILE_METRICS,
    "pct_reference",
    "in_pool",
)
GAMES_COLUMNS: Final[tuple[str, ...]] = (
    "competition_id",
    "season",
    "date",
    "home_club_id",
    "away_club_id",
    "home_club_goals",
    "away_club_goals",
)
KEY: Final[list[str]] = list(seasons.SEASON_KEY)


@dataclass(frozen=True, slots=True)
class Rated:
    """The rated table and the lines the command prints."""

    table: pd.DataFrame
    report: list[str]


def team_totals(games: pd.DataFrame) -> pd.DataFrame:
    """Return `team_matches` and `team_goals` per `league_id`, `season` and `club_id`.

    Only matches with a result count; a club's goals are the goals it scored at home or away.
    """
    played = games.dropna(subset=["home_club_goals", "away_club_goals"])
    sides = [
        pd.DataFrame(
            {
                "league_id": played["competition_id"],
                "season": played["season"],
                "club_id": played[f"{side}_club_id"],
                "goals": played[f"{side}_club_goals"],
            }
        )
        for side in ("home", "away")
    ]
    both = pd.concat(sides, ignore_index=True)
    grouped = both.groupby(["league_id", "season", "club_id"], sort=True)["goals"]
    totals = pd.DataFrame({"team_matches": grouped.size(), "team_goals": grouped.sum()})
    result: pd.DataFrame = totals.astype("int64").reset_index()
    return result


def start_years(games: pd.DataFrame) -> pd.DataFrame:
    """Return the calendar year of the first match of every league season as `start_year`.

    The same rule holds for every league: the label of a season is not used.
    """
    dated = pd.DataFrame(
        {
            "league_id": games["competition_id"],
            "season": games["season"],
            "first": pd.to_datetime(games["date"], format="%Y-%m-%d"),
        }
    ).dropna()
    first = dated.groupby(["league_id", "season"], sort=True)["first"].min()
    result: pd.DataFrame = first.dt.year.rename("start_year").astype("int64").reset_index()
    return result


def player_facts(players: pd.DataFrame) -> pd.DataFrame:
    """Return `birth_year` and `position_group` per player; unknown ones stay empty."""
    born = pd.to_datetime(players["date_of_birth"], errors="coerce").dt.year
    group = players["position"].where(players["position"].isin(POSITION_GROUPS))
    return pd.DataFrame(
        {
            "player_id": players["player_id"].astype("int64"),
            "birth_year": born.astype("Int64"),
            "position_group": group,
        }
    ).drop_duplicates("player_id")


def per_90(count: pd.Series, minutes: pd.Series) -> pd.Series:
    """Return 90 * count / minutes, empty where there are no minutes."""
    return 90 * count / minutes.where(minutes > 0)


def add_measures(table: pd.DataFrame) -> pd.DataFrame:
    """Add role, per-90 rates, adjusted rates and goal involvement (unrounded)."""
    out = table.copy()
    raw_role = out["minutes"] / (out["team_matches"].where(out["team_matches"] > 0) * 90)
    out["role"] = raw_role.clip(upper=1)
    out["ga90"] = per_90(out["goals"] + out["assists"], out["minutes"])
    out["ga90_adj"] = out["ga90"] / out["league_factor"]
    out["g90_adj"] = per_90(out["goals"], out["minutes"]) / out["league_factor"]
    out["a90_adj"] = per_90(out["assists"], out["minutes"]) / out["league_factor"]
    share = out["team_goals"].where(out["team_goals"] > 0) * out["role"].where(out["role"] > 0)
    out["involvement"] = ((out["goals"] + out["assists"]) / share).clip(upper=1)
    return out


def mark_young(table: pd.DataFrame) -> pd.Series:
    """Return who is young: age at season start at most 21 and at least 450 minutes.

    A row without birth year, position group or start year is never young.
    """
    age = table["start_year"] - table["birth_year"]
    known = age.notna() & table["position_group"].notna()
    return (known & (age <= MAX_YOUNG_AGE) & (table["minutes"] >= MIN_MINUTES)).astype(bool)


def percentile_of(reference: np.ndarray, own: pd.Series) -> pd.Series:
    """Return 100 * (share below + half the share equal), as whole numbers; empty stays empty."""
    ordered = np.sort(reference)
    left = np.searchsorted(ordered, own.to_numpy(dtype="float64"), side="left")
    right = np.searchsorted(ordered, own.to_numpy(dtype="float64"), side="right")
    score = np.floor(100 * (left + 0.5 * (right - left)) / len(ordered) + 0.5)
    return pd.Series(score, index=own.index).where(own.notna()).astype("Int64")


def add_percentiles(table: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """Add the five percentiles and `pct_reference`; return the table and the fallback count.

    Only the young players of the radar season get a percentile.
    """
    out = table.copy()
    for column in PERCENTILE_METRICS:
        out[column] = pd.array([pd.NA] * len(out), dtype="Int64")
    out["pct_reference"] = pd.array([pd.NA] * len(out), dtype="string")
    radar = out["season"] == config.RADAR_SEASON
    fallbacks = 0
    for group in POSITION_GROUPS:
        in_group = radar & (out["position_group"] == group)
        young = in_group & out["young"]
        if not young.any():
            continue
        small = int(young.sum()) < MIN_REFERENCE
        fallbacks += int(small)
        reference = in_group & (out["minutes"] >= MIN_MINUTES) if small else young
        out.loc[young, "pct_reference"] = "all_ages" if small else "young"
        for column, metric in PERCENTILE_METRICS.items():
            known = out.loc[reference, metric].dropna().to_numpy(dtype="float64")
            if len(known):
                out.loc[young, column] = percentile_of(known, out.loc[young, metric])
    return out, fallbacks


def build_rated(
    long: pd.DataFrame,
    short: pd.DataFrame,
    decided: pd.DataFrame,
    factors: pd.DataFrame,
    games: pd.DataFrame,
    players: pd.DataFrame,
) -> Rated:
    """Build the rated table from the season tables, the value table, the factors and the
    source tables `games` and `players`, sorted by player, season and league."""
    table = pd.concat([long, short], ignore_index=True)
    table = table.merge(decided[[*KEY, *values.VALUE_COLUMNS]], on=KEY, how="left")
    table = table.merge(player_facts(players), on="player_id", how="left")
    table = table.merge(start_years(games), on=["league_id", "season"], how="left")
    totals = team_totals(games)
    table = table.merge(totals, on=["league_id", "season", "club_id"], how="left")
    table = table.merge(
        factors[["league_id", "factor"]].rename(columns={"factor": "league_factor"}),
        on="league_id",
        how="left",
    )
    table = table.sort_values(KEY, kind="stable").reset_index(drop=True)
    measured = add_measures(table)
    capped = int(
        (
            measured["minutes"] > measured["team_matches"].where(measured["team_matches"] > 0) * 90
        ).sum()
    )
    measured["young"] = mark_young(measured)
    never = int((measured["birth_year"].isna() | measured["position_group"].isna()).sum())
    rated, fallbacks = add_percentiles(measured)
    rated["in_pool"] = (
        (rated["season"] == config.RADAR_SEASON)
        & rated["young"]
        & (rated["value_decision"] <= BUDGETS[0])
    ).astype(bool)
    report = describe(rated, fallbacks, capped, never)
    for column in ("ga90_adj", "g90_adj", "a90_adj"):
        rated[column] = rated[column].round(2)
    return Rated(table=rated[list(RATING_COLUMNS)], report=report)


def describe(rated: pd.DataFrame, fallbacks: int, capped: int, never: int) -> list[str]:
    """Return the printed lines: rows, young players, pool sizes, fallbacks, caps, start years."""
    radar_young = rated[(rated["season"] == config.RADAR_SEASON) & rated["young"]]
    lines = [f"{RATED_FILE}: {len(rated)} rows"]
    for group in POSITION_GROUPS:
        lines.append(
            f"young players, {group}: {int((radar_young['position_group'] == group).sum())}"
        )
    for budget in BUDGETS:
        pool = radar_young["value_decision"] <= budget
        lines.append(f"pool at {budget:,} EUR: {int(pool.sum())} players")
    lines.append(f"percentile fallbacks to all ages: {fallbacks} position groups")
    lines.append(f"role capped at 1: {capped} rows")
    lines.append(f"never young, no birth date or no position group: {never} rows")
    pairs = rated.dropna(subset=["start_year"]).loc[:, ["league_id", "season", "start_year"]]
    differs = pairs[pairs["season"] != pairs["start_year"]].drop_duplicates()
    for row in differs.itertuples(index=False):
        lines.append(
            f"start year differs: {row.league_id} label {row.season}, start {row.start_year}"
        )
    return lines


def read_table(path: Path, step: str) -> pd.DataFrame:
    """Read a work table, or stop with a message that names the step that makes it."""
    require_file(path, f"run the step `{step}` first")
    try:
        return pd.read_csv(path, low_memory=False)
    except (pd.errors.ParserError, UnicodeDecodeError) as error:
        raise StepError(f"input file {path} is missing or unreadable: {error}") from error


def read_raw(raw_dir: Path, table: str, columns: tuple[str, ...]) -> pd.DataFrame:
    """Read the columns of a source table that the step needs."""
    path = require_file(raw_dir / config.table_file(table), "run the step `ingest` first")
    return pd.read_csv(path, usecols=list(columns))


def write_rating(raw_dir: Path, work_dir: Path) -> Rated:
    """Read the inputs, build the rated table and write `rated.csv` into the work folder."""
    long = read_table(work_dir / seasons.SEASONS_FILE, "seasons")
    short = read_table(work_dir / rebuild.SEASONS_FILE, "rebuild")
    decided = read_table(work_dir / values.SEASONS_FILE, "values")
    factors = read_table(work_dir / leagues.LEAGUES_FILE, "leagues")
    games = read_raw(raw_dir, "games", GAMES_COLUMNS)
    players = read_raw(raw_dir, "players", ("player_id", "date_of_birth", "position"))
    built = build_rated(long, short, decided, factors, games, players)
    target = work_dir / RATED_FILE
    with ingest.partial_file(target) as partial:
        built.table.to_csv(partial, index=False, lineterminator="\n")
        partial.replace(target)
    return built
