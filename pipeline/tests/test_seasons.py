"""Tests of the step `seasons`, grouped by the acceptance criterion they prove.

The source tables are small tables built here: no network and no real data folder. The one
exception is the last test: it reads the real tables when they are present, writes into a
temporary folder, and skips itself when they are not.
"""

import gzip
import time
from pathlib import Path

import pandas as pd
import pytest

from fairscout import cli, config, seasons

# The 14 long-history first tiers, written out independently of the package.
FIRST_TIERS = {
    "IT1": "Italy",
    "ES1": "Spain",
    "GB1": "England",
    "FR1": "France",
    "TR1": "Türkiye",
    "L1": "Germany",
    "NL1": "Netherlands",
    "PO1": "Portugal",
    "BE1": "Belgium",
    "RU1": "Russia",
    "GR1": "Greece",
    "SC1": "Scotland",
    "UKR1": "Ukraine",
    "DK1": "Denmark",
}
# Competitions outside them: a first tier with a short history, a domestic cup and an
# international cup.
OTHER_COMPETITIONS = [
    ("KR1", "domestic_league", "Croatia"),
    ("CIT", "domestic_cup", "Italy"),
    ("CL", "international_cup", None),
]
COLUMNS = ("player_id", "season", "league_id", "club_id", "minutes", "matches", "goals", "assists")
KEY = ["player_id", "season", "league_id"]
PLAYER_NAME = "Name That Must Never Be Printed"

# The three source tables as files, with every column and the column order of the real ones.
# Player 10 has two league matches, a cup match and an international match; player 20 has one
# league match and one appearance in match 9, which has no record.
COMPETITIONS_FILE = """\
competition_id,competition_code,name,sub_type,type,country_id,country_name,domestic_league_code,confederation,total_clubs,url
IT1,serie-a,serie-a,first_tier,domestic_league,75,Italy,IT1,europa,20,https://example.org/IT1
ES1,laliga,laliga,first_tier,domestic_league,157,Spain,ES1,europa,20,https://example.org/ES1
CIT,italy-cup,italy-cup,domestic_cup,domestic_cup,75,Italy,IT1,europa,44,https://example.org/CIT
CL,cl,uefa-champions-league,uefa_champions_league,international_cup,-1,,,europa,36,https://example.org/CL
"""
GAMES_FILE = """\
game_id,competition_id,season,round,date,home_club_id,away_club_id,home_club_goals,away_club_goals,competition_type
1,IT1,2025,1. Matchday,2025-08-16,100,101,2,1,domestic_league
2,IT1,2025,2. Matchday,2025-08-23,102,100,0,0,domestic_league
3,CIT,2025,First Round,2025-08-27,100,103,3,0,domestic_cup
4,CL,2025,Group Stage,2025-09-16,100,900,1,1,international_cup
5,ES1,2025,1. Matchday,2025-08-17,200,201,1,0,domestic_league
"""
APPEARANCES_FILE = f"""\
appearance_id,game_id,player_id,player_club_id,player_current_club_id,date,player_name,competition_id,yellow_cards,red_cards,goals,assists,minutes_played
1_10,1,10,100,100,2025-08-16,{PLAYER_NAME},IT1,0,0,1,0,90
2_10,2,10,100,100,2025-08-23,{PLAYER_NAME},IT1,1,0,0,2,45
3_10,3,10,100,100,2025-08-27,{PLAYER_NAME},CIT,0,0,1,0,90
4_10,4,10,100,100,2025-09-16,{PLAYER_NAME},CL,0,0,0,0,90
5_20,5,20,200,200,2025-08-17,{PLAYER_NAME},ES1,0,0,0,0,30
9_20,9,20,200,200,2025-08-30,{PLAYER_NAME},ES1,0,0,2,0,60
"""
SEASONS_FILE = """\
player_id,season,league_id,club_id,minutes,matches,goals,assists
10,2025,IT1,100,135,2,1,2
20,2025,ES1,200,30,1,0,0
"""


def competitions() -> pd.DataFrame:
    """Build the competitions table: the 14 first tiers and three competitions outside them."""
    leagues = [(league, "domestic_league", country) for league, country in FIRST_TIERS.items()]
    return pd.DataFrame(
        [*leagues, *OTHER_COMPETITIONS], columns=["competition_id", "type", "country_name"]
    )


def games(*rows: tuple[int, str, int]) -> pd.DataFrame:
    """Build the games table from rows of match, competition and season."""
    return pd.DataFrame(rows, columns=["game_id", "competition_id", "season"])


def appearances(*rows: tuple[int, int, int, int, int, int]) -> pd.DataFrame:
    """Build the appearances table from rows of match, player, club, minutes, goals, assists."""
    columns = ["game_id", "player_id", "player_club_id", "minutes_played", "goals", "assists"]
    return pd.DataFrame(rows, columns=columns).assign(player_name=PLAYER_NAME)


def rows_of(table: pd.DataFrame) -> list[tuple[object, ...]]:
    """Return the rows of a season table as plain tuples, after checking its columns."""
    assert tuple(table.columns) == COLUMNS
    return list(table.itertuples(index=False, name=None))


def place_sources(raw: Path) -> None:
    """Put the three source tables the step reads into a raw folder, as `ingest` leaves them."""
    raw.mkdir(parents=True)
    tables = {
        "competitions": COMPETITIONS_FILE,
        "games": GAMES_FILE,
        "appearances": APPEARANCES_FILE,
    }
    for table, text in tables.items():
        (raw / f"{table}.csv.gz").write_bytes(gzip.compress(text.encode("utf-8"), mtime=0))


def state_of(folder: Path) -> dict[str, tuple[bytes, int]]:
    """Record content and time of last change of every file in a folder."""
    return {path.name: (path.read_bytes(), path.stat().st_mtime_ns) for path in folder.iterdir()}


# Criterion 1: one row per player, season and league holds minutes, goals, assists, matches
# and the main club.


def test_each_player_season_and_league_is_one_row_with_its_totals() -> None:
    matches = games((1, "IT1", 2024), (2, "IT1", 2024), (3, "IT1", 2025), (4, "ES1", 2025))
    played = appearances(
        (1, 10, 100, 90, 1, 0),
        (2, 10, 100, 45, 0, 2),
        (3, 10, 100, 30, 2, 1),  # the same player a season later
        (4, 10, 200, 60, 0, 0),  # and in another league in that season
        (3, 20, 100, 0, 0, 0),  # another player: a match without a full minute is a match
    )

    built = seasons.build_seasons(played, matches, competitions())

    assert seasons.SEASON_COLUMNS == COLUMNS
    assert rows_of(built.table) == [
        (10, 2024, "IT1", 100, 135, 2, 1, 2),
        (10, 2025, "ES1", 200, 60, 1, 0, 0),
        (10, 2025, "IT1", 100, 30, 1, 2, 1),
        (20, 2025, "IT1", 100, 0, 1, 0, 0),
    ]
    assert not built.table.duplicated(KEY).any()


# Criterion 2: total minutes per league and season equal the total in the source
# appearances table.


def test_minutes_per_league_and_season_equal_the_source_total() -> None:
    matches = games(
        (1, "IT1", 2024), (2, "IT1", 2024), (3, "IT1", 2025), (4, "ES1", 2024), (5, "CIT", 2024)
    )
    played = appearances(
        (1, 10, 100, 90, 0, 0),
        (1, 11, 100, 77, 0, 0),
        (1, 12, 300, 13, 0, 0),
        (2, 10, 300, 64, 0, 0),  # player 10 changed club: these minutes are in the total too
        (2, 12, 300, 90, 0, 0),
        (3, 10, 300, 90, 0, 0),
        (3, 11, 100, 1, 0, 0),
        (4, 20, 200, 88, 0, 0),
        (4, 21, 200, 2, 0, 0),
        (5, 10, 100, 120, 0, 0),  # a cup match: in no league total
    )

    built = seasons.build_seasons(played, matches, competitions())

    assert built.table.groupby(["league_id", "season"])["minutes"].sum().to_dict() == {
        ("IT1", 2024): 90 + 77 + 13 + 64 + 90,
        ("IT1", 2025): 90 + 1,
        ("ES1", 2024): 88 + 2,
    }


# Criterion 3: a player with two clubs in one league season gets the club where he played
# most minutes.


def test_player_with_two_clubs_gets_the_club_with_most_minutes() -> None:
    matches = games(*((game_id, "GB1", 2023) for game_id in range(1, 6)))
    played = appearances(
        # player 7: club 400 comes first and last and has more matches, club 500 more minutes
        (1, 7, 400, 30, 0, 0),
        (2, 7, 500, 90, 1, 0),
        (3, 7, 500, 90, 0, 0),
        (4, 7, 400, 30, 0, 1),
        (5, 7, 400, 40, 0, 0),
        # player 8: the same with the clubs exchanged, so the club id decides nothing
        (1, 8, 500, 30, 0, 0),
        (2, 8, 400, 90, 0, 0),
        (3, 8, 400, 90, 0, 2),
        (4, 8, 500, 30, 0, 0),
        (5, 8, 500, 40, 3, 0),
    )

    built = seasons.build_seasons(played, matches, competitions())

    assert rows_of(built.table) == [
        (7, 2023, "GB1", 500, 280, 5, 1, 1),
        (8, 2023, "GB1", 400, 280, 5, 3, 2),
    ]


# Criterion 4: an appearance in a competition outside the 14 first tiers, or without a match
# record, is left out and counted. That the counts are printed is proved under criterion 5.


def test_appearance_outside_the_14_first_tiers_is_left_out_and_counted() -> None:
    inside = [(game_id, league, 2025) for game_id, league in enumerate(FIRST_TIERS, start=1)]
    # the last one is a competition the competitions table has no record of
    outside = [(21, "KR1", 2025), (22, "CIT", 2025), (23, "CL", 2025), (24, "ZZ9", 2025)]
    played = appearances(*((game_id, 10, 100, 90, 1, 0) for game_id, _, _ in [*inside, *outside]))

    built = seasons.build_seasons(played, games(*inside, *outside), competitions())

    assert dict(config.LONG_HISTORY_LEAGUES) == FIRST_TIERS
    assert rows_of(built.table) == sorted(
        (10, 2025, league, 100, 90, 1, 1, 0) for league in FIRST_TIERS
    )
    assert (built.outside_leagues, built.without_match) == (4, 0)


def test_appearance_without_a_match_record_is_left_out_and_counted() -> None:
    played = appearances((1, 10, 100, 90, 1, 0), (2, 10, 100, 90, 3, 3), (3, 11, 100, 45, 0, 0))

    built = seasons.build_seasons(played, games((1, "IT1", 2025)), competitions())

    assert rows_of(built.table) == [(10, 2025, "IT1", 100, 90, 1, 1, 0)]
    assert (built.outside_leagues, built.without_match) == (0, 2)


# Criterion 5: the step writes one season table under data/work and changes no source table.
# The log holds the row count and the two left-out counts, and never a name.


def test_command_writes_one_season_table_and_changes_no_source_table(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    place_sources(tmp_path / "raw")
    before = state_of(tmp_path / "raw")

    assert cli.main(["seasons"]) == 0

    assert state_of(tmp_path / "raw") == before
    assert sorted(path.name for path in tmp_path.iterdir()) == ["raw", "work"]
    assert [path.name for path in (tmp_path / "work").iterdir()] == ["seasons_long.csv"]
    assert (tmp_path / "work" / "seasons_long.csv").read_text(encoding="utf-8") == SEASONS_FILE
    printed = capsys.readouterr()
    assert printed.out.splitlines() == [
        "seasons_long.csv: 2 rows",
        "left out, competition outside the 14 first tiers: 2 appearances",
        "left out, no match record: 1 appearances",
    ]
    assert printed.err == ""
    assert PLAYER_NAME not in printed.out


# Quality target: the same input gives the same table.


def test_same_input_gives_the_same_table_whatever_the_row_order(tmp_path: Path) -> None:
    matches = games((1, "IT1", 2025), (2, "IT1", 2025), (3, "ES1", 2024), (4, "IT1", 2024))
    played = appearances(
        (1, 30, 500, 45, 0, 0),  # player 30 has equal minutes and matches at two clubs
        (2, 30, 400, 45, 1, 0),
        (3, 20, 200, 90, 0, 0),
        (4, 30, 400, 10, 0, 0),
        (1, 10, 400, 90, 0, 1),
    )

    first = seasons.build_seasons(played, matches, competitions())
    again = seasons.build_seasons(played, matches, competitions())
    reordered = seasons.build_seasons(
        played.iloc[::-1], matches.iloc[::-1], competitions().iloc[::-1]
    )

    assert rows_of(first.table) == [
        (10, 2025, "IT1", 400, 90, 1, 0, 1),
        (20, 2024, "ES1", 200, 90, 1, 0, 0),
        (30, 2024, "IT1", 400, 10, 1, 0, 0),
        (30, 2025, "IT1", 400, 90, 2, 1, 0),
    ]
    pd.testing.assert_frame_equal(again.table, first.table)
    pd.testing.assert_frame_equal(reordered.table, first.table)

    place_sources(tmp_path / "raw")
    seasons.write_seasons(tmp_path / "raw", tmp_path / "one")
    seasons.write_seasons(tmp_path / "raw", tmp_path / "two")
    written = [(tmp_path / run / "seasons_long.csv").read_bytes() for run in ("one", "two")]
    assert written[0] == written[1] == SEASONS_FILE.encode("utf-8")


# The real tables, when they are on this machine: criterion 2 for every league and season,
# and the quality target of two minutes for the whole step.


def test_real_tables_keep_every_minute_and_are_built_within_two_minutes(tmp_path: Path) -> None:
    raw = config.raw_dir()
    files = {table: raw / f"{table}.csv.gz" for table in ("appearances", "games", "competitions")}
    if not all(path.is_file() for path in files.values()):
        pytest.skip("the source tables are not in the data folder of this machine")

    started = time.monotonic()
    built = seasons.write_seasons(raw, tmp_path)
    elapsed = time.monotonic() - started

    source = pd.read_csv(files["appearances"], usecols=["game_id", "minutes_played"])
    match = pd.read_csv(files["games"], usecols=["game_id", "competition_id", "season"])
    match = match.set_index("game_id")
    source["league_id"] = source["game_id"].map(match["competition_id"])
    source["season"] = source["game_id"].map(match["season"])
    in_first_tiers = source[source["league_id"].isin(list(FIRST_TIERS))]
    in_source = in_first_tiers.groupby(["league_id", "season"])["minutes_played"].sum().to_dict()
    written = pd.read_csv(tmp_path / "seasons_long.csv")

    assert written.groupby(["league_id", "season"])["minutes"].sum().to_dict() == in_source
    assert {league for league, _ in in_source} == set(FIRST_TIERS)
    assert tuple(written.columns) == COLUMNS
    assert not written.duplicated(KEY).any()
    assert written["matches"].sum() + built.outside_leagues + built.without_match == len(source)
    assert elapsed < 120
