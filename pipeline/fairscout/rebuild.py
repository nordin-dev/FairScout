"""Step `rebuild`: season numbers for the nine short-history leagues, rebuilt from line-ups.

These leagues have no `appearances` table, so the minutes, goals and assists of every player
in every match are rebuilt from `game_lineups` and `game_events` with the rules below, and
then aggregated to the same season table as the 14 long-history leagues.

* A starter plays from minute 0, a substitute from the minute of his entry; a substitute who
  never enters did not play and has no row.
* A player leaves at the minute he is substituted off or sent off (a red card or a second
  yellow card), else at minute 90. No event minute counts beyond 90, so no player has more
  than 90 minutes in a match.
* A goal counts for the scorer and an assist for the player named in it, when both were in
  the match. An own goal is credited to nobody.
* A match without any line-up row is skipped and counted; it never stops the run.
"""

from collections.abc import Mapping, Set
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Final

import pandas as pd

from fairscout import config, ingest, seasons
from fairscout.errors import require_file

MATCH_COLUMNS: Final[tuple[str, ...]] = (
    "player_id",
    "game_id",
    "club_id",
    "minutes",
    "goals",
    "assists",
)
SEASONS_FILE: Final = "seasons_short.csv"
MATCH_LENGTH: Final = 90
LINEUP_CHUNK: Final = 500_000

STARTER: Final = "starting_lineup"
OWN_GOAL: Final = r"own[- ]goal"
RED_CARD: Final = r"red|second yellow"

SOURCE_TYPES: Final[Mapping[str, Mapping[str, str]]] = MappingProxyType(
    {
        "games": {"game_id": "int64", "competition_id": "str", "season": "int64"},
        "game_lineups": {
            "game_id": "int64",
            "player_id": "int64",
            "club_id": "int64",
            "type": "str",
        },
        "game_events": {
            "game_id": "int64",
            "minute": "int64",
            "type": "str",
            "player_id": "Int64",
            "description": "str",
            "player_in_id": "Int64",
            "player_assist_id": "Int64",
        },
    }
)


@dataclass(frozen=True, slots=True)
class MatchRows:
    """One row per player and match in `MATCH_COLUMNS`, and the matches left out."""

    rows: pd.DataFrame
    skipped_no_lineups: int


@dataclass(frozen=True, slots=True)
class ShortSeasons:
    """The written season table, how many player-match rows it rests on, the matches skipped."""

    table: pd.DataFrame
    player_matches: int
    skipped_no_lineups: int


def _pairs(frame: pd.DataFrame, player: str) -> pd.DataFrame:
    """Return the (game_id, player_id) pairs of a column that may hold missing players."""
    kept = frame.loc[frame[player].notna(), ["game_id", player]]
    return pd.DataFrame({"game_id": kept["game_id"], "player_id": kept[player].astype("int64")})


def rebuild_matches(
    games: pd.DataFrame,
    lineups: pd.DataFrame,
    events: pd.DataFrame,
    league_ids: Set[str],
) -> MatchRows:
    """Rebuild minutes, goals and assists per player and match for the matches of the leagues.

    `games` needs `game_id` and `competition_id`; `lineups` `game_id`, `player_id`,
    `club_id` and `type`; `events` `game_id`, `minute`, `type`, `player_id`, `description`,
    `player_in_id` and `player_assist_id`. Matches of other leagues are ignored. A wanted
    match without a row in `lineups` is skipped and counted.
    """
    wanted = games.loc[games["competition_id"].isin(list(league_ids)), "game_id"].unique()
    squad = lineups.loc[lineups["game_id"].isin(wanted)].drop_duplicates(["game_id", "player_id"])
    played = squad["game_id"].unique()
    skipped = len(wanted) - len(played)
    ev = events.loc[events["game_id"].isin(played)].copy()
    ev["minute"] = ev["minute"].clip(lower=0, upper=MATCH_LENGTH)

    swaps = ev.loc[ev["type"] == "Substitutions"]
    entered = _pairs(swaps, "player_in_id").assign(start=swaps["minute"])
    entries = entered.groupby(["game_id", "player_id"], as_index=False)["start"].min()
    sent_off = ev.loc[
        (ev["type"] == "Cards")
        & ev["description"].fillna("").str.contains(RED_CARD, case=False, regex=True)
    ]
    exits = (
        pd.concat(
            [
                _pairs(swaps, "player_id").assign(stop=swaps["minute"]),
                _pairs(sent_off, "player_id").assign(stop=sent_off["minute"]),
            ]
        )
        .groupby(["game_id", "player_id"], as_index=False)["stop"]
        .min()
    )

    rows = squad.merge(entries, on=["game_id", "player_id"], how="left", validate="one_to_one")
    rows.loc[rows["type"] == STARTER, "start"] = 0
    rows = rows.loc[rows["start"].notna()].merge(
        exits, on=["game_id", "player_id"], how="left", validate="one_to_one"
    )
    rows["minutes"] = (
        (rows["stop"].fillna(MATCH_LENGTH) - rows["start"]).clip(lower=0, upper=MATCH_LENGTH)
    ).astype("int64")

    scored = ev.loc[
        (ev["type"] == "Goals")
        & ~ev["description"].fillna("").str.contains(OWN_GOAL, case=False, regex=True)
    ]
    for column, source in (("goals", "player_id"), ("assists", "player_assist_id")):
        tally = _pairs(scored, source).groupby(["game_id", "player_id"]).size()
        counts = tally.rename(column).reset_index()
        rows = rows.merge(counts, on=["game_id", "player_id"], how="left", validate="one_to_one")
        rows[column] = rows[column].fillna(0).astype("int64")
    return MatchRows(
        rows=rows[list(MATCH_COLUMNS)].reset_index(drop=True), skipped_no_lineups=skipped
    )


def aggregate_seasons(rows: pd.DataFrame, games: pd.DataFrame) -> pd.DataFrame:
    """Aggregate the player-match rows to the season table, columns and order as in the
    14-league table (`seasons.SEASON_COLUMNS`).

    `games` gives the season and the league of every match; a match with more than one record
    stops the run with pandas' MergeError, because it would be counted twice.
    """
    match = games[["game_id", "competition_id", "season"]].rename(
        columns={"competition_id": "league_id"}
    )
    kept = rows.merge(match, on="game_id", validate="many_to_one")
    return seasons.season_table(kept)


def read_source(raw_dir: Path, table: str, game_ids: Set[int] | None = None) -> pd.DataFrame:
    """Read the needed columns of a source table; with `game_ids`, keep only those matches.

    The line-ups table is read in chunks and filtered while reading, so the full table is
    never in memory at once.
    """
    types = SOURCE_TYPES[table]
    path = require_file(raw_dir / config.table_file(table), "run the step `ingest` first")
    chunks = pd.read_csv(
        path,
        usecols=list(types),
        dtype=dict(types),
        chunksize=LINEUP_CHUNK,
    )
    wanted = None if game_ids is None else list(game_ids)
    parts = [
        chunk if wanted is None else chunk.loc[chunk["game_id"].isin(wanted)] for chunk in chunks
    ]
    return pd.concat(parts, ignore_index=True)


def short_history_games(raw_dir: Path) -> pd.DataFrame:
    """Return the matches of the nine short-history leagues."""
    games = read_source(raw_dir, "games")
    return games.loc[games["competition_id"].isin(list(config.SHORT_HISTORY_LEAGUES))]


def rebuild_from_files(raw_dir: Path, games: pd.DataFrame) -> MatchRows:
    """Read line-ups and events of the given matches from the raw folder and rebuild them."""
    ids = set(games["game_id"].tolist())
    return rebuild_matches(
        games,
        read_source(raw_dir, "game_lineups", ids),
        read_source(raw_dir, "game_events", ids),
        set(games["competition_id"].tolist()),
    )


def write_short_seasons(raw_dir: Path, work_dir: Path) -> ShortSeasons:
    """Rebuild the nine leagues and write their season table into the work folder.

    The source tables are only read. The table is written next to its place and moved there
    when it is complete.
    """
    games = short_history_games(raw_dir)
    built = rebuild_from_files(raw_dir, games)
    table = aggregate_seasons(built.rows, games)
    target = work_dir / SEASONS_FILE
    with ingest.partial_file(target) as partial:
        table.to_csv(partial, index=False, lineterminator="\n")
        partial.replace(target)
    return ShortSeasons(
        table=table, player_matches=len(built.rows), skipped_no_lineups=built.skipped_no_lineups
    )
