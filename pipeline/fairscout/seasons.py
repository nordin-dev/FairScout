"""Step `seasons`: one row per player, season and league for the 14 long-history leagues.

An appearance belongs to the season and the league of its match: the match record in `games`
names both. It is kept when `competitions` holds that league as a domestic league and it is
one of the 14 in `config.LONG_HISTORY_LEAGUES`. Every other appearance is left out and
counted: the ones in another competition, and the ones whose match has no record.
"""

from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Final

import pandas as pd

from fairscout import config, ingest
from fairscout.errors import require_file

# The columns of the season table, in their order. A season is named by its start year
# (season 2025 is 2025/26), `club_id` is the main club, and `matches` counts appearances.
SEASON_COLUMNS: Final[tuple[str, ...]] = (
    "player_id",
    "season",
    "league_id",
    "club_id",
    "minutes",
    "matches",
    "goals",
    "assists",
)
SEASON_KEY: Final[tuple[str, ...]] = SEASON_COLUMNS[:3]
SEASONS_FILE: Final = "seasons_long.csv"

DOMESTIC_LEAGUE: Final = "domestic_league"

# The columns the step reads from each source table, and the type each one is read as. An
# empty cell or a cell that is not a whole number stops the read of an `int64` column.
SOURCE_TYPES: Final[Mapping[str, Mapping[str, str]]] = MappingProxyType(
    {
        "appearances": {
            "game_id": "int64",
            "player_id": "int64",
            "player_club_id": "int64",
            "minutes_played": "int64",
            "goals": "int64",
            "assists": "int64",
        },
        "games": {"game_id": "int64", "competition_id": "str", "season": "int64"},
        "competitions": {"competition_id": "str", "type": "str"},
    }
)


@dataclass(frozen=True, slots=True)
class Seasons:
    """The season table and the number of appearances left out of it, by reason."""

    table: pd.DataFrame
    outside_leagues: int
    without_match: int


def season_table(kept: pd.DataFrame) -> pd.DataFrame:
    """Aggregate rows of `player_id`, `season`, `league_id`, `club_id`, `minutes`, `game_id`,
    `goals` and `assists`, one per appearance, to the season table in `SEASON_COLUMNS`.

    The main club is the one with most minutes; between equal minutes the one with more
    appearances, then the lower id. The table is sorted by player, season and league.
    """
    key = list(SEASON_KEY)
    per_club = kept.groupby([*key, "club_id"], as_index=False).agg(
        minutes=("minutes", "sum"),
        matches=("game_id", "size"),
        goals=("goals", "sum"),
        assists=("assists", "sum"),
    )
    main_club_first = per_club.sort_values(
        [*key, "minutes", "matches", "club_id"],
        ascending=[True, True, True, False, False, True],
    )
    table = main_club_first.groupby(key, as_index=False).agg(
        club_id=("club_id", "first"),
        minutes=("minutes", "sum"),
        matches=("matches", "sum"),
        goals=("goals", "sum"),
        assists=("assists", "sum"),
    )
    return table[list(SEASON_COLUMNS)]


def build_seasons(
    appearances: pd.DataFrame, games: pd.DataFrame, competitions: pd.DataFrame
) -> Seasons:
    """Aggregate the appearances into one row per player, season and league.

    The row holds the totals of the player in that league season over all his clubs, and as
    main club the one he played most minutes for. Between clubs with equal minutes the one
    with more appearances is taken, then the one with the lower id, so the choice never
    depends on the order of the rows. The table is sorted by player, season and league.

    Stops with pandas' MergeError when a match or a competition has more than one record,
    because the join would then count an appearance more than once.
    """
    first_tiers = competitions.loc[
        (competitions["type"] == DOMESTIC_LEAGUE)
        & competitions["competition_id"].isin(list(config.LONG_HISTORY_LEAGUES)),
        ["competition_id"],
    ]
    with_match = appearances[list(SOURCE_TYPES["appearances"])].merge(
        games[list(SOURCE_TYPES["games"])], on="game_id", validate="many_to_one"
    )
    kept = with_match.merge(first_tiers, on="competition_id", validate="many_to_one").rename(
        columns={
            "competition_id": "league_id",
            "player_club_id": "club_id",
            "minutes_played": "minutes",
        }
    )
    table = season_table(kept)
    return Seasons(
        table=table,
        outside_leagues=len(with_match) - len(kept),
        without_match=len(appearances) - len(with_match),
    )


def read_source(raw_dir: Path, table: str) -> pd.DataFrame:
    """Read from the raw folder the columns of a source table that the step needs."""
    types = SOURCE_TYPES[table]
    path = require_file(raw_dir / config.table_file(table), "run the step `ingest` first")
    return pd.read_csv(path, usecols=list(types), dtype=dict(types))


def write_seasons(raw_dir: Path, work_dir: Path) -> Seasons:
    """Build the season table from the source tables and write it into the work folder.

    The source tables are only read. The table is written next to its place and moved there
    when it is complete, so the work folder never holds a partial season table.
    """
    seasons = build_seasons(
        appearances=read_source(raw_dir, "appearances"),
        games=read_source(raw_dir, "games"),
        competitions=read_source(raw_dir, "competitions"),
    )
    target = work_dir / SEASONS_FILE
    with ingest.partial_file(target) as partial:
        seasons.table.to_csv(partial, index=False, lineterminator="\n")
        partial.replace(target)
    return seasons
