"""Tests of the step `rating`, grouped by the acceptance criterion they prove.

The tables are small tables built here: no network. The last test reads the real tables when
they are present and skips itself when they are not.
"""

import gzip
from pathlib import Path

import pandas as pd
import pytest

from fairscout import cli, config, leagues, rating, rebuild, seasons, values

FACTORS = pd.DataFrame({"league_id": ["A1", "N1"], "factor": [1.25, 1.0]})


def player(
    pid: int,
    *,
    goals: int = 1,
    assists: int = 0,
    minutes: int = 900,
    league: str = "A1",
    club: int = 1,
    season: int = 2025,
    birth: int = 2005,
    position: str = "Attack",
    value: float = 500_000,
) -> dict[str, object]:
    return {
        "player_id": pid, "season": season, "league_id": league, "club_id": club,
        "minutes": minutes, "matches": 10, "goals": goals, "assists": assists,
        "value_decision": value, "birth": birth, "position": position,
    }  # fmt: skip


def games(league: str, season: int, first: str, count: int = 10) -> pd.DataFrame:
    """`count` matches in which club 1 beats club 2 by 2 to 0, the first on `first`."""
    dates = pd.date_range(first, periods=count, freq="7D").strftime("%Y-%m-%d")
    return pd.DataFrame(
        {
            "competition_id": league, "season": season, "date": dates, "home_club_id": 1,
            "away_club_id": 2, "home_club_goals": 2, "away_club_goals": 0,
        }
    )  # fmt: skip


def rate(
    rows: list[dict[str, object]], match_tables: list[pd.DataFrame] | None = None
) -> pd.DataFrame:
    """Rate hand-made player rows over two leagues; returns the table indexed by player."""
    frame = pd.DataFrame(rows)
    played = match_tables or [games("A1", 2025, "2025-08-01"), games("N1", 2025, "2026-03-01")]
    people = pd.DataFrame(
        {
            "player_id": frame["player_id"],
            "date_of_birth": frame["birth"].astype(str) + "-06-15",
            "position": frame["position"],
        }
    )
    decided = frame.drop(columns=["birth", "position"]).assign(
        value_decision_date="2026-01-01", value_outcome=pd.NA, outcome_known=False, made_it=False
    )
    long = decided[list(seasons.SEASON_COLUMNS)]
    built = rating.build_rated(
        long, long.iloc[0:0], decided, FACTORS, pd.concat(played, ignore_index=True), people
    )
    return built.table.set_index("player_id")


def test_adjusted_output_is_rounded_to_two_decimals() -> None:
    """Criterion 1: 90 * 9 / 1000 = 0.81, divided by the factor 1.25, is 0.648, shown 0.65."""
    table = rate([player(1, goals=6, assists=3, minutes=1000)])
    assert table.loc[1, "ga90"] == pytest.approx(0.81)
    assert table.loc[1, "ga90_adj"] == 0.65
    assert table.loc[1, "league_factor"] == 1.25


def test_role_is_minutes_over_team_matches_times_90() -> None:
    """Criterion 3: 450 minutes in a team with 10 matches is 0.5; more minutes than the team
    played is capped at 1."""
    table = rate([player(1, minutes=450), player(2, minutes=1200)])
    assert table.loc[1, "role"] == 0.5
    assert table.loc[2, "role"] == 1.0
    assert table.loc[1, "team_matches"] == 10


def test_involvement_scales_by_team_goals_and_share_of_minutes_and_never_exceeds_one() -> None:
    """Criterion 2: 3 / (20 team goals * 0.5) is 0.3; 15 / 10 is capped at 1."""
    table = rate([player(1, goals=2, assists=1, minutes=450), player(2, goals=15, minutes=450)])
    assert table.loc[1, "involvement"] == pytest.approx(0.3)
    assert table.loc[2, "involvement"] == 1.0


def test_team_with_zero_goals_gives_empty_involvement_and_no_error() -> None:
    """Criterion 7: club 2 scored nothing; its player's involvement and percentile are empty."""
    table = rate([player(1, club=2), *[player(i) for i in range(2, 5)]])
    assert pd.isna(table.loc[1, "involvement"])
    assert pd.isna(table.loc[1, "pct_involvement"])
    assert not pd.isna(table.loc[1, "pct_output"])
    assert table.loc[2, "team_goals"] == 20


def test_percentiles_are_whole_numbers_exact_on_a_group_of_thirty() -> None:
    """Criterion 4: goals 1 to 30 in one group; value k has 100 * (k - 1 + 0.5) / 30 rounded."""
    table = rate([player(k, goals=k) for k in range(1, 31)])
    assert (table["pct_reference"] == "young").all()
    assert table.loc[1, "pct_scoring"] == 2
    assert table.loc[15, "pct_scoring"] == 48
    assert table.loc[30, "pct_scoring"] == 98
    for column in rating.PERCENTILE_METRICS:
        assert table[column].dropna().between(0, 100).all()
        assert table[column].dtype == "Int64"
    assert table["pct_output"].tolist() == table["pct_scoring"].tolist()


def test_ties_share_a_percentile_and_creating_is_separate_from_scoring() -> None:
    """Criterion 4: equal values get the same number; five groups of six tie in a group of 30."""
    table = rate([player(k, goals=k % 5, assists=k % 3) for k in range(1, 31)])
    tied = table[table["goals"] == 0]
    assert tied["pct_scoring"].nunique() == 1
    assert tied["pct_scoring"].iloc[0] == 10
    assert table["pct_creating"].nunique() > 1
    assert table["pct_scoring"].tolist() != table["pct_creating"].tolist()


def test_group_under_thirty_falls_back_to_all_ages_of_the_position_group() -> None:
    """Criterion 5: 5 young attackers use 25 older attackers too; 30 young ones do not;
    a goalkeeper is never compared with an attacker."""
    older = [player(10 + k, goals=10 + k, birth=1995) for k in range(25)]
    young = [player(k, goals=k) for k in range(1, 6)]
    table = rate([*young, *older, player(99, goals=0, position="Goalkeeper")])
    assert set(table.loc[range(1, 6), "pct_reference"]) == {"all_ages"}
    assert table.loc[1, "pct_scoring"] == 2
    assert table.loc[5, "pct_scoring"] == 15
    assert pd.isna(table.loc[10, "pct_scoring"])
    assert table.loc[99, "pct_reference"] == "all_ages"
    assert table.loc[99, "pct_scoring"] == 50


def test_youth_uses_the_calendar_year_of_the_first_match() -> None:
    """Criterion 6: in N1 the season labelled 2025 starts in 2026, so 2005 is young and 2004 is
    not; in A1 it starts in 2025, so 2004 is young."""
    table = rate(
        [
            player(1, league="N1", birth=2005),
            player(2, league="N1", birth=2004),
            player(3, league="A1", birth=2004),
            player(4, league="A1", birth=2003),
        ]
    )
    assert table["start_year"].tolist() == [2026, 2026, 2025, 2025]
    assert table["young"].tolist() == [True, False, True, False]


def test_minutes_threshold_and_missing_facts_are_never_young() -> None:
    """Criterion 4: 449 minutes is not young, 450 is; no birth date or no position is not."""
    table = rate(
        [
            player(1, minutes=449),
            player(2, minutes=450),
            player(3, birth=1900, position="Missing"),
            player(4, birth=1900),
        ]
    )
    assert table["young"].tolist() == [False, True, False, False]
    assert table["position_group"].isna().tolist() == [False, False, True, False]


def test_pool_needs_radar_season_young_and_value_up_to_one_million() -> None:
    """The pool: radar season, young, value at most 1,000,000."""
    table = rate(
        [
            player(1, value=1_000_000),
            player(2, value=1_000_001),
            player(3, season=2024),
            player(4, birth=2000),
        ],
        [games("A1", 2025, "2025-08-01"), games("A1", 2024, "2024-08-01")],
    )
    assert table["in_pool"].tolist() == [True, False, False, False]
    assert list(table.columns) == list(rating.RATING_COLUMNS)[1:]


def write_inputs(root: Path) -> None:
    (root / "raw").mkdir()
    (root / "work").mkdir()
    rows = pd.DataFrame([player(k, goals=k) for k in range(1, 4)])
    long = rows[list(seasons.SEASON_COLUMNS)]
    long.to_csv(root / "work" / seasons.SEASONS_FILE, index=False)
    long.iloc[0:0].to_csv(root / "work" / rebuild.SEASONS_FILE, index=False)
    rows[[*seasons.SEASON_COLUMNS, "value_decision"]].assign(
        value_decision_date="2026-01-01", value_outcome=pd.NA, outcome_known=False, made_it=False
    ).to_csv(root / "work" / values.SEASONS_FILE, index=False)
    FACTORS.assign(league_name="x").to_csv(root / "work" / leagues.LEAGUES_FILE, index=False)
    with gzip.open(root / "raw" / config.table_file("games"), "wt") as handle:
        games("A1", 2025, "2025-08-01").to_csv(handle, index=False)
    people = pd.DataFrame(
        {"player_id": [1, 2, 3], "date_of_birth": "2005-06-15 00:00:00", "position": "Attack"}
    )
    with gzip.open(root / "raw" / config.table_file("players"), "wt") as handle:
        people.to_csv(handle, index=False)


def test_step_writes_rated_table_and_leaves_inputs_byte_identical(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    write_inputs(tmp_path)
    before = {p: p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}

    assert cli.main(["rating"]) == 0

    after = {p: p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}
    target = tmp_path / "work" / rating.RATED_FILE
    assert after.pop(target) is not None
    assert after == before
    first = target.read_bytes()
    assert cli.main(["rating"]) == 0
    assert target.read_bytes() == first
    written = pd.read_csv(target)
    assert list(written.columns) == list(rating.RATING_COLUMNS)
    assert written["player_id"].tolist() == [1, 2, 3]
    out = capsys.readouterr().out.splitlines()
    assert out[0] == "rated.csv: 3 rows"
    assert "pool at 1,000,000 EUR: 3 players" in out


def test_missing_input_ends_with_one_error_line_and_code_1(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))

    assert cli.main(["rating"]) == 1

    lines = capsys.readouterr().err.strip().splitlines()
    assert len(lines) == 1
    assert lines[0].startswith("error: input file ")
    assert "run the step `seasons` first" in lines[0]


def test_real_tables_give_percentiles_roles_and_a_pool(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    raw = config.raw_dir()
    work = config.work_dir()
    needed = [raw / config.table_file("games"), raw / config.table_file("players")]
    needed += [work / name for name in (seasons.SEASONS_FILE, rebuild.SEASONS_FILE)]
    needed += [work / values.SEASONS_FILE, work / leagues.LEAGUES_FILE]
    if not all(path.is_file() for path in needed):
        pytest.skip("real tables are not present")
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    (tmp_path / "raw").symlink_to(raw)
    (tmp_path / "work").mkdir()
    for path in needed[2:]:
        (tmp_path / "work" / path.name).write_bytes(path.read_bytes())

    assert cli.main(["rating"]) == 0

    table = pd.read_csv(tmp_path / "work" / rating.RATED_FILE, low_memory=False)
    for column in rating.PERCENTILE_METRICS:
        assert table[column].dropna().between(0, 100).all()
    assert table["role"].dropna().max() <= 1
    assert int(table["in_pool"].sum()) > 0
