"""Tests of the step `leagues`, grouped by the acceptance criterion they prove.

The tables are small tables built here: no network. The last test reads the real tables when
they are present and skips itself when they are not.
"""

import json
import math
from pathlib import Path

import pandas as pd
import pytest

from fairscout import cli, config, leagues, seasons
from fairscout.errors import StepError

NAMES = {**config.LONG_HISTORY_LEAGUES, **config.SHORT_HISTORY_LEAGUES}


def pair_row(a: str, b: str, movers: int, ratio: float) -> dict[str, object]:
    """A pair of leagues whose rate in b is `ratio` times the rate in a."""
    return {
        "league_a": a,
        "league_b": b,
        "movers": movers,
        "ga_a": 10 * movers,
        "minutes_a": 900 * movers,
        "ga_b": 10 * movers * ratio,
        "minutes_b": 900 * movers,
    }


def synthetic_pairs() -> pd.DataFrame:
    """Three leagues with factors 0.5, 1.0 and 2.0 over a perfectly consistent set of pairs."""
    return pd.DataFrame(
        [pair_row("A", "B", 10, 2.0), pair_row("A", "C", 10, 4.0), pair_row("B", "C", 10, 2.0)]
    )


def mover_rows(a: str, b: str, count: int, ga_a: int = 10, ga_b: int = 5) -> pd.DataFrame:
    return pd.DataFrame(
        [{"league_a": a, "league_b": b, "ga_a": ga_a, "minutes_a": 1000, "ga_b": ga_b,
          "minutes_b": 1000}] * count
    )  # fmt: skip


def season_row(
    player: int, season: int, league: str, minutes: int, goals: int, value: int
) -> dict[str, object]:
    return {
        "player_id": player,
        "season": season,
        "league_id": league,
        "club_id": 1,
        "matches": 30,
        "minutes": minutes,
        "goals": goals,
        "assists": 2,
        "value_decision": value,
    }


def synthetic_inputs() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """A season table with movers among the 14 leagues in a chain, values for all 23 leagues."""
    long_ids = sorted(config.LONG_HISTORY_LEAGUES)
    rows: list[dict[str, object]] = []
    player = 0
    for k, league in enumerate(long_ids):
        other = long_ids[(k + 1) % len(long_ids)]
        for _ in range(21):
            player += 1
            for season, where, goals in ((2023, league, 10), (2024, other, 6 + k % 3)):
                rows.append(season_row(player, season, where, 1000, goals, 1_000_000))
    for k, league in enumerate(long_ids + sorted(config.SHORT_HISTORY_LEAGUES)):
        for i in range(3):
            player += 1
            rows.append(season_row(player, 2025, league, 900, 1, 100_000 * (k + 1) + i))
    players = pd.DataFrame({"player_id": range(1, player + 1), "position": "Attack"})
    table = pd.DataFrame(rows)
    return table.loc[table["season"] < 2025, list(seasons.SEASON_COLUMNS)], table, players


def test_hand_made_moves_recover_known_factors() -> None:
    """Criterion 1: the fit recovers the known factors from consistent pairs, mean log zero."""
    pairs = leagues.usable_pairs(synthetic_pairs())
    fitted = leagues.fit_log_factors(pairs, ["A", "B", "C"])
    assert math.exp(fitted["A"]) == pytest.approx(0.5, abs=1e-9)
    assert math.exp(fitted["B"]) == pytest.approx(1.0, abs=1e-9)
    assert math.exp(fitted["C"]) == pytest.approx(2.0, abs=1e-9)
    assert sum(fitted.values()) == pytest.approx(0.0, abs=1e-9)


def test_pair_with_seven_movers_is_ignored() -> None:
    """Criterion 1: a pair with fewer than eight movers is left out; eight is kept."""
    movers = pd.concat([mover_rows("A", "B", 7), mover_rows("B", "C", 8)], ignore_index=True)
    kept = leagues.usable_pairs(leagues.pair_totals(movers))
    assert list(zip(kept["league_a"], kept["league_b"], strict=True)) == [("B", "C")]


def test_factor_outside_range_stops_with_league_named() -> None:
    """Criterion 4: a factor outside 0.3 to 2.5 raises a StepError that names the league."""
    with pytest.raises(StepError, match="England"):
        leagues.check_range({"GB1": 0.29, "ES1": 1.0}, NAMES)
    with pytest.raises(StepError, match="Spain"):
        leagues.check_range({"GB1": 1.0, "ES1": 2.51}, NAMES)
    leagues.check_range({"GB1": 0.3, "ES1": 2.5}, NAMES)


def test_sources_are_marked_and_counts_are_kept() -> None:
    """Criteria 1, 3 and 5: fourteen marked moves, nine marked estimate, counts and example."""
    appearances, table, players = synthetic_inputs()
    built = leagues.build_leagues(appearances, table, players)
    sources = built.table.set_index("league_id")["factor_source"]
    assert (sources[list(config.LONG_HISTORY_LEAGUES)] == "moves").all()
    assert (sources[list(config.SHORT_HISTORY_LEAGUES)] == "estimate").all()
    assert len(built.table) == 23
    assert built.moves_total == 14 * 21
    assert built.moves_used == 14 * 21
    assert built.example["players"] == 21


def test_example_pair_is_chosen_by_the_rule() -> None:
    """Criterion 5: the largest absolute log ratio among pairs with 20 or more movers."""
    pairs = pd.DataFrame(
        [
            pair_row("GB1", "ES1", 25, 1.5),
            pair_row("IT1", "L1", 20, 0.4),
            pair_row("FR1", "NL1", 19, 9.0),
            pair_row("PO1", "BE1", 30, 1.1),
        ]
    )
    example = leagues.choose_example(pairs, NAMES)
    assert (example["league_a"], example["league_b"], example["players"]) == (
        "Italy",
        "Germany",
        20,
    )
    assert example["ga90_a"] == pytest.approx(1.0)
    assert example["ga90_b"] == pytest.approx(0.4)


def write_inputs(
    root: Path, appearances: pd.DataFrame, table: pd.DataFrame, players: pd.DataFrame
) -> None:
    (root / "raw").mkdir()
    (root / "work").mkdir()
    appearances.to_csv(root / "work" / "seasons_long.csv", index=False)
    table.to_csv(root / "work" / "seasons.csv", index=False)
    players.to_csv(root / "raw" / "players.csv.gz", index=False)


def test_step_writes_files_and_leaves_season_table_untouched(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Criteria 5 and 6: files written, counts kept, the season table byte-identical."""
    write_inputs(tmp_path, *synthetic_inputs())
    monkeypatch.setenv(config.DATA_ENV, str(tmp_path))
    before = (tmp_path / "work" / "seasons.csv").read_bytes()
    assert cli.main(["leagues"]) == 0
    assert (tmp_path / "work" / "seasons.csv").read_bytes() == before
    written = pd.read_csv(tmp_path / "work" / "leagues.csv")
    assert list(written.columns) == list(leagues.LEAGUE_COLUMNS)
    assert list(written["league_id"]) == sorted(written["league_id"])
    evidence = json.loads((tmp_path / "work" / "league_evidence.json").read_text())
    assert evidence["league_moves"] == {"total": 294, "used_for_factors": 294}
    assert set(evidence["same_players_two_leagues"]) == {
        "league_a", "league_b", "players", "ga90_a", "ga90_b"
    }  # fmt: skip
    assert "rank_correlation" in evidence
    assert "lowest_league" in evidence
    assert "moves found: 294" in capsys.readouterr().out


def test_movers_without_decision_values_still_count() -> None:
    """A mover whose seasons have no decision value is found from the unfiltered table."""
    appearances, table, players = synthetic_inputs()
    kept = table.loc[table["player_id"] != 1]
    assert 1 in set(appearances["player_id"])
    built = leagues.build_leagues(appearances, kept, players)
    assert built.moves_total == 14 * 21


def test_missing_input_gives_one_error_line(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """The step without its inputs ends with one error line that names the step to run."""
    monkeypatch.setenv(config.DATA_ENV, str(tmp_path))
    assert cli.main(["leagues"]) == 1
    error = capsys.readouterr().err.strip().splitlines()
    assert len(error) == 1
    assert error[0].startswith("error:")
    assert "run the step `seasons` first" in error[0]


def test_missing_values_table_gives_one_error_line(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """With the long table present and the value table missing the error names `values`."""
    write_inputs(tmp_path, *synthetic_inputs())
    (tmp_path / "work" / "seasons.csv").unlink()
    monkeypatch.setenv(config.DATA_ENV, str(tmp_path))
    assert cli.main(["leagues"]) == 1
    error = capsys.readouterr().err.strip().splitlines()
    assert len(error) == 1
    assert "run the step `values` first" in error[0]


def test_same_input_gives_same_factors() -> None:
    """Quality target: the same input, in another row order, gives the same factors."""
    appearances, table, players = synthetic_inputs()
    first = leagues.build_leagues(appearances, table, players).table
    shuffled = appearances.sample(frac=1.0, random_state=3)
    second = leagues.build_leagues(shuffled, table, players).table
    pd.testing.assert_frame_equal(first, second)


def test_real_tables_give_england_lowest_and_a_strong_correlation() -> None:
    """Criteria 2 and 4 on the real tables; skipped when they are not present."""
    raw, work = config.raw_dir(), config.work_dir()
    needed = (raw / "players.csv.gz", work / "seasons.csv", work / "seasons_long.csv")
    if not all(path.is_file() for path in needed):
        pytest.skip("real tables are not present")
    appearances, table, players = leagues.read_inputs(raw, work)
    built = leagues.build_leagues(appearances, table, players)
    assert len(built.table) == 23
    assert built.lowest_league == "England"
    assert built.rank_correlation <= -0.7
    assert built.table["factor"].between(0.3, 2.5).all()
