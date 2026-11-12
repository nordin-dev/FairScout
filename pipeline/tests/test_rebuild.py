"""Tests of the step `rebuild`, grouped by the acceptance criterion they prove.

The rules are tested on one small made-up match. The last test reads the real tables when they
are present and skips itself when they are not. No network.
"""

import time
from pathlib import Path

import pandas as pd
import pytest

from fairscout import cli, config, rebuild, seasons

LEAGUES = {"PL1"}
PLAYER_NAME = "Name That Must Never Be Printed"
GAME_COLUMNS = ["game_id", "competition_id", "season"]
EVENT_COLUMNS = [
    "game_id",
    "minute",
    "type",
    "player_id",
    "description",
    "player_in_id",
    "player_assist_id",
]

# Match 1 of league PL1, club 100: players 1 to 4 start, 5 to 7 are substitutes. Match 2 of
# PL1 has no line-up. Match 3 belongs to another league.
GAMES = pd.DataFrame([(1, "PL1", 2024), (2, "PL1", 2024), (3, "ES1", 2024)], columns=GAME_COLUMNS)
LINEUPS = pd.DataFrame(
    [
        (1, 1, 100, "starting_lineup"),
        (1, 2, 100, "starting_lineup"),
        (1, 3, 100, "starting_lineup"),
        (1, 4, 100, "starting_lineup"),
        (1, 5, 100, "substitutes"),
        (1, 6, 100, "substitutes"),
        (1, 7, 100, "substitutes"),
        (3, 8, 300, "starting_lineup"),
    ],
    columns=["game_id", "player_id", "club_id", "type"],
)
EVENTS = pd.DataFrame(
    [
        (1, 60, "Substitutions", 2, "", 5, None),  # 5 comes on for 2 at minute 60
        (1, 30, "Cards", 3, "Red card , serious foul", None, None),  # 3 sent off at 30
        (1, 120, "Substitutions", 4, "", 7, None),  # past minute 90: 4 stays 90, 7 gets 0
        (1, 70, "Goals", 1, "Right-footed shot", None, 5),  # goal of 1, assist of 5
        (1, 80, "Goals", 4, "Own-goal", None, 2),  # own goal: nobody is credited
        (3, 10, "Goals", 8, "Header", None, None),
    ],
    columns=EVENT_COLUMNS,
).astype({"player_id": "Int64", "player_in_id": "Int64", "player_assist_id": "Int64"})


def rebuilt() -> dict[int, tuple[int, int, int]]:
    """Return player -> (minutes, goals, assists) of match 1 rebuilt from the fixture."""
    result = rebuild.rebuild_matches(GAMES, LINEUPS, EVENTS, LEAGUES)
    rows = result.rows
    assert set(rows["game_id"]) == {1}
    return {
        int(r.player_id): (int(r.minutes), int(r.goals), int(r.assists)) for r in rows.itertuples()
    }


# Criterion 4 and the rules of minutes.


def test_starter_plays_from_the_start_and_substitute_from_his_entry() -> None:
    players = rebuilt()

    assert players[1][0] == 90
    assert players[2][0] == 60  # substituted off at 60
    assert players[5][0] == 30  # on at 60
    assert 6 not in players  # an unused substitute did not play


def test_red_card_ends_the_match_for_the_player() -> None:
    assert rebuilt()[3][0] == 30


def test_minutes_are_capped_at_90_and_no_player_exceeds_them() -> None:
    players = rebuilt()

    assert players[4][0] == 90  # event at minute 120
    assert players[7][0] == 0  # came on at the cap
    assert max(minutes for minutes, _, _ in players.values()) <= 90


def test_own_goal_is_not_credited_and_goal_and_assist_are() -> None:
    players = rebuilt()

    assert players[4][1] == 0
    assert players[2][2] == 0  # the assist named in the own goal is not credited either
    assert players[1][1] == 1
    assert players[5][2] == 1
    assert sum(goals for _, goals, _ in players.values()) == 1


# Criterion 5.


def test_match_without_lineups_is_skipped_and_counted_and_the_run_goes_on() -> None:
    result = rebuild.rebuild_matches(GAMES, LINEUPS, EVENTS, LEAGUES)

    assert result.skipped_no_lineups == 1
    assert not result.rows.empty
    assert tuple(result.rows.columns) == rebuild.MATCH_COLUMNS


# Criterion 1.


def test_season_table_has_the_columns_and_order_of_the_14_league_table() -> None:
    rows = rebuild.rebuild_matches(GAMES, LINEUPS, EVENTS, LEAGUES).rows
    table = rebuild.aggregate_seasons(rows, GAMES)

    assert tuple(table.columns) == seasons.SEASON_COLUMNS
    assert table[["player_id", "season", "league_id"]].values.tolist() == sorted(
        table[["player_id", "season", "league_id"]].values.tolist()
    )
    five = table.loc[table["player_id"] == 5].iloc[0]
    assert (five["season"], five["league_id"], five["club_id"]) == (2024, "PL1", 100)
    assert (five["minutes"], five["matches"], five["goals"], five["assists"]) == (30, 1, 0, 1)


def test_nine_short_leagues_are_disjoint_from_the_14_long_ones() -> None:
    assert len(config.SHORT_HISTORY_LEAGUES) == 9
    assert not set(config.SHORT_HISTORY_LEAGUES) & set(config.LONG_HISTORY_LEAGUES)


# Criterion 6 and the quality target on the printed log.


def test_command_writes_only_its_own_file_and_prints_counts_without_names(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    raw, work = tmp_path / "raw", tmp_path / "work"
    raw.mkdir()
    work.mkdir()
    (work / "seasons_long.csv").write_text("the long table\n", encoding="utf-8")
    games = GAMES.assign(date="2024-08-01")
    games.to_csv(raw / "games.csv.gz", index=False)
    LINEUPS.assign(player_name=PLAYER_NAME).to_csv(raw / "game_lineups.csv.gz", index=False)
    EVENTS.to_csv(raw / "game_events.csv.gz", index=False)
    monkeypatch.setattr(config, "SHORT_HISTORY_LEAGUES", {"PL1": "Poland"})

    assert cli.main(["rebuild"]) == 0

    assert (work / "seasons_long.csv").read_text(encoding="utf-8") == "the long table\n"
    assert sorted(path.name for path in work.iterdir()) == ["seasons_long.csv", "seasons_short.csv"]
    printed = capsys.readouterr()
    assert printed.out.splitlines() == [
        "seasons_short.csv: 6 rows",
        "skipped, match without line-ups: 1 matches",
    ]
    assert PLAYER_NAME not in printed.out + printed.err


# Criteria 2 and 3 on the real tables, and the five-minute target for the whole step.


def test_real_belgium_and_netherlands_2024_match_the_appearances_table(tmp_path: Path) -> None:
    raw = config.raw_dir()
    needed = ("games", "appearances", "game_lineups", "game_events")
    if not all((raw / config.table_file(table)).is_file() for table in needed):
        pytest.skip("the source tables are not in the data folder of this machine")

    games = rebuild.read_source(raw, "games")
    test_games = games.loc[games["competition_id"].isin(["BE1", "NL1"]) & (games["season"] == 2024)]
    started = time.monotonic()
    result = rebuild.rebuild_from_files(raw, test_games)
    appearances = pd.read_csv(
        raw / config.table_file("appearances"),
        usecols=["game_id", "player_id", "minutes_played", "goals"],
    )
    official = appearances.loc[appearances["game_id"].isin(test_games["game_id"])]
    joined = official.merge(result.rows, on=["game_id", "player_id"], validate="one_to_one")
    assert len(joined) > 10_000

    within_five = ((joined["minutes_played"] - joined["minutes"]).abs() <= 5).mean()
    same_goals = (joined["goals_x"] == joined["goals_y"]).mean()
    rebuild.write_short_seasons(raw, tmp_path)
    elapsed = time.monotonic() - started

    assert within_five >= 0.99
    assert same_goals >= 0.995
    assert joined["minutes"].max() <= 90
    assert elapsed < 300
