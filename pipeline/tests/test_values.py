"""Tests of the step `values`, grouped by the acceptance criterion they prove.

The tables are small tables built here: no network. The last test reads the real tables when
they are present and skips itself when they are not.
"""

import gzip
from pathlib import Path

import pandas as pd
import pytest

from fairscout import cli, config, rebuild, seasons, values

LATEST = "2026-06-12"


def season_rows(*keys: tuple[int, int]) -> pd.DataFrame:
    """Season rows of (player_id, season) in league `L1`, other columns filled with ones."""
    return pd.DataFrame(
        [
            {"player_id": p, "season": s, "league_id": "L1", "club_id": 1}
            | dict.fromkeys(("minutes", "matches", "goals", "assists"), 1)
            for p, s in keys
        ]
    )[list(seasons.SEASON_COLUMNS)]


def prices(*rows: tuple[int, str, int]) -> pd.DataFrame:
    """Valuations of (player_id, date, value); a closing row fixes the latest date."""
    frame = pd.DataFrame(rows, columns=["player_id", "date", "market_value_in_eur"])
    last = pd.DataFrame([(999, LATEST, 1)], columns=frame.columns)
    return pd.concat([frame, last], ignore_index=True)


def attach(*rows: tuple[int, str, int], key: tuple[int, int] = (1, 2015)) -> pd.Series:  # type: ignore[type-arg]
    built = values.attach_values(season_rows(key), prices(*rows))
    return built.table.iloc[0]


def test_window_edges_decide_which_valuations_count() -> None:
    """Criterion 1: 1 December and 30 June count, 30 November and 1 July do not."""
    inside = attach((1, "2015-12-01", 100), (1, "2016-06-30", 200))
    assert inside["value_decision"] == 200
    assert inside["value_decision_date"] == "2016-06-30"
    first_day = attach((1, "2015-11-30", 50), (1, "2015-12-01", 100), (1, "2016-07-01", 900))
    assert first_day["value_decision"] == 100
    only_outside = values.attach_values(
        season_rows((1, 2015)), prices((1, "2015-11-30", 50), (1, "2016-07-01", 900))
    )
    assert only_outside.excluded == 1


def test_last_valuation_in_the_window_wins_whatever_the_input_order() -> None:
    """Criterion 1 and the quality target: no later value, the same table for any order."""
    rows = [(1, "2016-02-01", 300), (1, "2015-12-10", 100), (1, "2016-05-05", 400)]
    table = values.attach_values(season_rows((1, 2015)), prices(*rows)).table
    shuffled = values.attach_values(season_rows((1, 2015)), prices(*reversed(rows))).table
    assert table["value_decision"].tolist() == [400]
    pd.testing.assert_frame_equal(table, shuffled)


def test_outcome_uses_the_window_three_seasons_later() -> None:
    """Criterion 2."""
    row = attach(
        (1, "2016-03-01", 1_000_000),
        (1, "2018-12-01", 2_500_000),
        (1, "2019-06-30", 3_000_000),
        (1, "2019-07-01", 9_000_000),
        (1, "2017-03-01", 8_000_000),
    )
    assert row["value_outcome"] == 3_000_000
    assert row["outcome_known"]
    assert row["made_it"]


def test_empty_outcome_keeps_the_row_and_is_not_made_it() -> None:
    """Criteria 2, 4 and 5."""
    built = values.attach_values(season_rows((1, 2015)), prices((1, "2016-03-01", 5_000_000)))
    row = built.table.iloc[0]
    assert len(built.table) == 1
    assert pd.isna(row["value_outcome"])
    assert row["outcome_known"]
    assert not row["made_it"]


def test_made_it_needs_twice_the_value_and_one_million() -> None:
    """Criterion 4."""
    cases = [
        (400_000, 800_000, False),
        (600_000, 1_200_000, True),
        (3_000_000, 5_999_999, False),
        (3_000_000, 6_000_000, True),
        (1_000_000, 1_000_000, False),
        (500_000, 1_000_000, True),
    ]
    for decision, outcome, expected in cases:
        row = attach((1, "2016-03-01", decision), (1, "2019-03-01", outcome))
        assert bool(row["made_it"]) is expected, (decision, outcome)


def test_no_decision_value_drops_the_row_and_counts_it() -> None:
    """Criterion 3 and the column order of criterion 5."""
    table = season_rows((1, 2015), (2, 2015))
    built = values.attach_values(table, prices((1, "2016-03-01", 100)))
    assert built.table["player_id"].tolist() == [1]
    assert built.excluded == 1
    assert tuple(built.table.columns) == values.TABLE_COLUMNS
    assert values.TABLE_COLUMNS[: len(seasons.SEASON_COLUMNS)] == seasons.SEASON_COLUMNS


def test_outcome_is_not_known_while_its_window_has_not_ended() -> None:
    """A season three years back from the latest valuation cannot be judged yet."""
    row = attach((1, "2024-03-01", 100), (1, "2027-03-01", 9_000_000), key=(1, 2023))
    assert pd.isna(row["value_outcome"])
    assert not row["outcome_known"]
    assert not row["made_it"]


def test_outcome_becomes_known_on_1_june_of_the_year_the_window_ends() -> None:
    """The edge of the rule: 31 May gives not known, 1 June gives known."""
    rows = season_rows((1, 2015))
    for latest, known in (("2019-05-31", False), ("2019-06-01", True)):
        frame = pd.DataFrame(
            [
                (1, "2016-03-01", 100),
                (1, "2019-03-01", 5_000_000),
                (999, latest, 1),
            ],
            columns=["player_id", "date", "market_value_in_eur"],
        )
        row = values.attach_values(rows, frame).table.iloc[0]
        assert bool(row["outcome_known"]) is known, latest
        assert pd.isna(row["value_outcome"]) is not known, latest


def write_csv(path: Path, frame: pd.DataFrame) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)


def test_step_writes_seasons_csv_and_prints_the_counts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    write_csv(tmp_path / "work" / seasons.SEASONS_FILE, season_rows((1, 2015), (2, 2015)))
    write_csv(tmp_path / "work" / rebuild.SEASONS_FILE, season_rows((3, 2015)))
    raw = tmp_path / "raw" / config.table_file("player_valuations")
    raw.parent.mkdir(parents=True)
    body = prices((1, "2016-03-01", 100), (1, "2019-03-01", 1_000_000), (3, "2016-01-01", 5))
    with gzip.open(raw, "wt") as handle:
        body.to_csv(handle, index=False)

    assert cli.main(["values"]) == 0

    written = pd.read_csv(tmp_path / "work" / values.SEASONS_FILE)
    assert written["player_id"].tolist() == [1, 3]
    assert written["made_it"].tolist() == [True, False]
    assert capsys.readouterr().out.splitlines() == [
        "seasons.csv: 2 rows",
        "left out, no decision value: 1 player-seasons",
        "outcome known: 2 rows",
        "outcome empty: 1 rows",
        "made it: 1 rows",
        "latest valuation in the source: 2026-06-12",
        "latest season with a known outcome: 2015",
    ]


@pytest.mark.parametrize("step", ["seasons", "rebuild", "values"])
def test_missing_input_ends_with_one_error_line_and_code_1(
    step: str,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))

    assert cli.main([step]) == 1

    lines = capsys.readouterr().err.strip().splitlines()
    assert len(lines) == 1
    assert lines[0].startswith("error: input file ")
    assert str(tmp_path) in lines[0]
    if step == "values":
        assert "run the step `seasons` first" in lines[0]


def test_real_tables_give_values_inside_their_windows(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    raw = config.raw_dir()
    work = config.work_dir()
    needed = [
        raw / config.table_file("player_valuations"),
        work / seasons.SEASONS_FILE,
        work / rebuild.SEASONS_FILE,
    ]
    if not all(path.is_file() for path in needed):
        pytest.skip("real tables are not present")
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    (tmp_path / "raw").symlink_to(raw)
    (tmp_path / "work").mkdir()
    for name in (seasons.SEASONS_FILE, rebuild.SEASONS_FILE):
        (tmp_path / "work" / name).write_bytes((work / name).read_bytes())

    assert cli.main(["values"]) == 0

    table = pd.read_csv(tmp_path / "work" / values.SEASONS_FILE)
    start = pd.to_datetime(table["season"].astype(str) + "-12-01")
    end = pd.to_datetime((table["season"] + 1).astype(str) + "-06-30")
    dated = pd.to_datetime(table["value_decision_date"])
    assert len(table) > 0
    assert ((dated >= start) & (dated <= end)).all()
    assert table["value_decision"].notna().all()
    assert not (table["made_it"] & ~table["outcome_known"]).any()
