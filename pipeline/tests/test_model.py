"""Tests of the step `model`, grouped by the acceptance criterion they prove.

The tables are small tables built here: no network. The last test reads the real tables when
they are present and skips itself when they are not.
"""

import gzip
import math
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from fairscout import cli, config, features, model, rating
from fairscout.errors import StepError

# a single valuation of a player who is in no table: the tables then have no value to find
NO_VALUATIONS = pd.DataFrame(
    {"player_id": [99], "date": ["2010-01-01"], "market_value_in_eur": [100_000]}
)
NO_SHARES = pd.DataFrame(
    {
        "league_id": pd.Series(dtype="str"),
        "season": pd.Series(dtype="int64"),
        "lineup_share": pd.Series(dtype="float64"),
    }
)


def rated_row(
    pid: int,
    *,
    season: int = 2020,
    league: str = "IT1",
    club: int = 1,
    minutes: int = 900,
    goals: int = 2,
    assists: int = 1,
    value: float = 1_000_000,
    date: str | None = None,
    young: bool = True,
    made_it: bool = False,
    known: bool = True,
    group: str = "Attack",
) -> dict[str, object]:
    return {
        "player_id": pid, "season": season, "league_id": league, "club_id": club,
        "minutes": minutes, "goals": goals, "assists": assists, "value_decision": value,
        "value_decision_date": date or f"{season + 1}-03-01", "outcome_known": known,
        "made_it": made_it, "position_group": group, "young": young, "role": 0.5,
        "team_matches": 2,
    }  # fmt: skip


def match_table(pairs: list[tuple[str, int]], lineup_games: int = 2) -> pd.DataFrame:
    """Two matches per league season in which club 1 beats club 2 by 2 to 0."""
    rows = []
    for number, (league, season) in enumerate(pairs):
        for k in range(2):
            rows.append(
                {
                    "game_id": 10 * number + k, "competition_id": league, "season": season,
                    "home_club_id": 1, "away_club_id": 2, "home_club_goals": 2,
                    "away_club_goals": 0,
                }
            )  # fmt: skip
    return pd.DataFrame(rows)


def people(ids: list[int], height: float = 185) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "player_id": ids,
            "date_of_birth": "2002-06-30 00:00:00",
            "height_in_cm": height,
        }
    )


def build(
    rows: list[dict[str, object]],
    valuations: pd.DataFrame = NO_VALUATIONS,
    shares: pd.DataFrame = NO_SHARES,
) -> pd.DataFrame:
    rated = pd.DataFrame(rows)
    pairs = sorted({(str(r["league_id"]), int(str(r["season"]))) for r in rows})
    ids = sorted({int(str(r["player_id"])) for r in rows})
    return features.build_features(rated, valuations, match_table(pairs), people(ids), shares)


def one(table: pd.DataFrame, pid: int, season: int = 2020) -> pd.Series:
    return table.loc[(table["player_id"] == pid) & (table["season"] == season)].iloc[0]


def hand_made_rows() -> list[dict[str, object]]:
    return [
        rated_row(1, goals=3, assists=1),
        rated_row(2, goals=0, assists=0, value=4_000_000, young=False),
        rated_row(3, club=3, minutes=450, goals=1, assists=0, value=2_000_000, young=False),
        rated_row(1, season=2019, minutes=600),
    ]


def test_the_nineteen_features_in_order_on_a_hand_checked_row() -> None:
    """Criterion 3: the table holds the 19 features, in their fixed order, with their values."""
    valuations = pd.DataFrame(
        {"player_id": [1], "date": ["2020-03-01"], "market_value_in_eur": [500_000]}
    )
    table = build(hand_made_rows(), valuations)
    row = one(table, 1)

    assert len(features.FEATURES) == 19
    assert list(table.columns) == list(features.FEATURE_COLUMNS)
    expected = {
        "age": 6940 / 365.25, "minutes": 900, "role": 0.5, "goals_per90": 0.3,
        "assists_per90": 0.1, "output_percentile": 2 / 3, "log_value": math.log(1e6),
        "log_change": math.log(2), "change_missing": 0, "prev_minutes": 600,
        "team_points": 3.0, "club_median": math.log(2e6), "vs_club": -math.log(2),
        "league_median": math.log(2e6), "height": 185, "pos_attack": 1, "pos_midfield": 0,
        "pos_defender": 0, "pos_goalkeeper": 0,
    }  # fmt: skip
    assert list(expected) == list(features.FEATURES)
    for name, value in expected.items():
        assert row[name] == pytest.approx(value), name
    assert row["prev_value_date"] == "2020-03-01"
    assert row["value_date"] == "2021-03-01"
    assert list(table["player_id"]) == [1, 1]
    assert list(table["season"]) == [2019, 2020]


def test_missing_previous_value_gives_zero_change_and_the_mark() -> None:
    """Criterion 3: no previous value is a change of 0 and a mark of 1."""
    row = one(build(hand_made_rows()), 1)

    assert row["log_change"] == 0
    assert row["change_missing"] == 1
    assert pd.isna(row["prev_value_date"])


def test_previous_minutes_are_divided_by_the_share_of_matches_with_line_ups() -> None:
    """Criterion 6: 450 minutes in a league with half the line-ups count 900; 0 with no row."""
    rows = [
        rated_row(1, season=2024, league="PL1", minutes=450),
        rated_row(1, season=2024, league="IT1", minutes=900),
        rated_row(1, season=2025, league="IT1"),
        rated_row(2, season=2025, league="IT1"),
    ]
    games = match_table([("PL1", 2024)])
    shares = features.lineup_shares(games, {int(games["game_id"].iloc[0])})

    table = build(rows, shares=shares)

    assert shares["lineup_share"].tolist() == [0.5]
    assert one(table, 1, 2025)["prev_minutes"] == pytest.approx(450 / 0.5 + 900)
    assert one(table, 2, 2025)["prev_minutes"] == 0


def test_share_is_one_for_a_long_history_league_and_counts_matches_with_a_result() -> None:
    """Criterion 6: a long-history league has no share row and counts as 1."""
    games = pd.concat(
        [
            match_table([("PL1", 2024), ("IT1", 2024)]),
            match_table([("SE1", 2024)]).assign(game_id=[90, 91]),
        ]
    )
    games.loc[games["game_id"] == 91, ["home_club_goals", "away_club_goals"]] = np.nan
    shares = features.lineup_shares(games, {90})

    assert shares.to_dict("records") == [
        {"league_id": "PL1", "season": 2024, "lineup_share": 0.0},
        {"league_id": "SE1", "season": 2024, "lineup_share": 1.0},
    ]
    table = pd.DataFrame({"league_id": ["IT1", "SE1"], "season": [2024, 2024], "minutes": [1, 1]})
    assert features.share_of(table, shares).tolist() == [1.0, 1.0]


def synthetic_table(count: int = 60) -> pd.DataFrame:
    """A feature table over seasons 2014 to 2021 with a label that follows the features."""
    generator = np.random.default_rng(7)
    frame = pd.DataFrame(
        generator.normal(size=(count, len(features.FEATURES))), columns=list(features.FEATURES)
    )
    frame["age"] = generator.uniform(16, 22, count)
    frame["player_id"] = np.arange(count)
    frame["season"] = 2014 + np.arange(count) % 8
    frame["league_id"] = "IT1"
    frame["value_decision"] = 500_000.0
    frame["made_it"] = (frame["log_value"] + generator.normal(size=count) > 0).to_numpy()
    frame["outcome_known"] = True
    frame["height"] = 180.0 + np.arange(count) % 5
    return frame


def test_training_set_rules() -> None:
    """Criterion 1 and 2: seasons up to S-3, known outcome, 14 leagues, value up to 5 million;
    a row without a later value is in it as a negative example."""
    table = synthetic_table().iloc[:8].copy().reset_index(drop=True)
    table["season"] = 2020
    table.loc[1, "season"] = 2021  # too late for decision season 2023
    table.loc[2, "outcome_known"] = False  # outcome not known
    table.loc[3, "league_id"] = "PL1"  # not a long-history league
    table.loc[4, "value_decision"] = 5_000_001.0  # too dear
    table.loc[5, "value_decision"] = 5_000_000.0  # exactly the limit stays
    table.loc[6, "made_it"] = False  # a negative example stays

    chosen = model.training_rows(table, 2023)

    assert chosen["player_id"].tolist() == [0, 5, 6, 7]
    assert len(model.training_rows(table, 2024)) == 5


def test_pool_is_the_season_within_the_budget_in_every_league() -> None:
    """Criterion 5: the pool of a season is its rows up to the budget, whatever the league."""
    table = synthetic_table()
    pool_rows = table["season"] == 2021
    table.loc[pool_rows, "league_id"] = ["PL1", "SE1", "IT1", "IT1", "IT1", "IT1", "IT1", "IT1"][
        : int(pool_rows.sum())
    ]
    cheap = table.index[pool_rows][:4]
    table.loc[pool_rows, "value_decision"] = 2_000_000.0
    table.loc[cheap, "value_decision"] = 900_000.0

    scored = model.score_season(table, 2021, min_rows=4)

    assert set(scored.pool["player_id"]) == set(table.loc[cheap, "player_id"])
    assert list(scored.pool.columns) == [*features.KEY, "score_lr", "score_gb"]
    assert scored.pool[["score_lr", "score_gb"]].stack().between(0, 1).all()
    assert scored.facts["training_seasons"] == [2014, 2015, 2016, 2017, 2018]
    assert 0 < scored.facts["positive_share"] < 1


def test_two_runs_give_identical_scores_for_both_models() -> None:
    """Criterion 4: fixed seeds make two runs the same, to the last digit."""
    table = synthetic_table(400)

    first = model.score_season(table, 2021)
    second = model.score_season(table, 2021)

    pd.testing.assert_frame_equal(first.pool, second.pool, check_exact=True)
    assert first.facts == second.facts
    assert first.pool["score_lr"].nunique() > 1
    assert first.pool["score_gb"].nunique() > 1


def test_scaling_uses_the_training_rows_and_the_facts_hold_the_reasons() -> None:
    """Criterion 4: the standardiser's means and scales are the training rows' mean and
    standard deviation; the facts hold 19 coefficients, the intercept and the names."""
    table = synthetic_table(400)
    train = model.training_rows(table, 2021)

    facts = model.score_season(table, 2021).facts

    matrix = model.matrix(train, facts["height_median"])
    assert facts["means"] == pytest.approx(matrix.mean(axis=0).tolist())
    assert facts["scales"] == pytest.approx(matrix.std(axis=0).tolist())
    assert facts["features"] == list(features.FEATURES)
    assert len(facts["coefficients"]) == 19
    assert isinstance(facts["intercept"], float)
    assert facts["training_rows"] == len(train)


def test_height_is_imputed_with_the_median_of_the_training_rows_only() -> None:
    """Criterion 5: a missing height takes the training rows' median, not the pool's."""
    table = synthetic_table(400)
    table["height"] = 180.0
    training = table["season"] <= 2018
    count = int(training.sum())
    table.loc[training, "height"] = np.where(np.arange(count) < count // 2, 170.0, 190.0)
    table.loc[table["season"] == 2021, "height"] = np.nan
    table.loc[table["season"] == 2019, "height"] = 250.0

    scored = model.score_season(table, 2021)

    assert scored.facts["height_median"] == 180.0
    assert not scored.pool[["score_lr", "score_gb"]].isna().any().any()


def test_too_few_training_rows_stop_with_the_season_and_the_count() -> None:
    """Criterion 7: below the minimum the call stops and names the season and the count."""
    table = synthetic_table(60)

    with pytest.raises(StepError, match=r"decision season 2021 has 39 training rows"):
        model.score_season(table, 2021)
    assert model.score_season(table, 2021, min_rows=39).facts["training_rows"] == 39
    assert model.MIN_TRAINING_ROWS == 200


def test_timing_check_stops_on_a_late_value_date_or_a_wrong_previous_season() -> None:
    """Criterion 3: a value dated after the season's end, or minutes of a wrong season, stop."""
    valuations = pd.DataFrame(
        {"player_id": [1], "date": ["2020-03-01"], "market_value_in_eur": [500_000]}
    )
    table = build(hand_made_rows(), valuations)
    features.check_timing(table)

    late = table.assign(value_date="2021-07-01")
    late_previous = table.assign(prev_value_date="2020-07-01")
    wrong = table.assign(prev_min_season=table["season"] - 2)

    with pytest.raises(StepError, match="decision value dated after the end of its season"):
        features.check_timing(late)
    with pytest.raises(StepError, match="previous value dated after"):
        features.check_timing(late_previous)
    with pytest.raises(StepError, match="not the one before"):
        features.check_timing(wrong)


def test_features_of_a_season_are_the_same_when_later_data_is_cut_off() -> None:
    """Criterion 3: the rows of season S built from inputs that end with S equal those built
    from the full inputs, so no feature can use anything later."""
    rows = [
        rated_row(1, season=2019), rated_row(1, season=2020, goals=4),
        rated_row(1, season=2021, goals=9, value=9_000_000),
        rated_row(2, season=2019, club=3), rated_row(2, season=2020, club=3, value=3e6),
        rated_row(2, season=2021, club=3, value=8e6),
        rated_row(3, season=2020, league="PL1", club=3, minutes=700),
        rated_row(3, season=2021, league="PL1", club=3, minutes=100),
    ]  # fmt: skip
    valuations = pd.DataFrame(
        {
            "player_id": [1, 1, 1, 2, 2],
            "date": ["2020-02-01", "2021-03-01", "2021-09-01", "2020-04-01", "2021-10-01"],
            "market_value_in_eur": [400_000, 1_000_000, 9_000_000, 2_000_000, 8_000_000],
        }
    )
    pairs = [("IT1", 2019), ("IT1", 2020), ("IT1", 2021), ("PL1", 2020), ("PL1", 2021)]
    games = match_table(pairs)
    full_shares = features.lineup_shares(games, {30, 40})
    ids = [1, 2, 3]

    def make(season_limit: int, date_limit: str) -> pd.DataFrame:
        rated = pd.DataFrame(rows)
        cut_games = games.loc[games["season"] <= season_limit]
        shares = full_shares.loc[full_shares["season"] <= season_limit]
        valued = valuations.loc[valuations["date"] <= date_limit]
        return features.build_features(
            rated.loc[rated["season"] <= season_limit], valued, cut_games, people(ids), shares
        )

    full = make(2021, "2099-01-01")
    cut = make(2020, "2021-06-30")
    names = [*features.KEY, *features.FEATURES, "value_decision", "value_date", "prev_value_date"]

    pd.testing.assert_frame_equal(
        full.loc[full["season"] == 2020, names].reset_index(drop=True),
        cut.loc[cut["season"] == 2020, names].reset_index(drop=True),
    )
    assert len(cut) < len(full)


def write_world(root: Path) -> None:
    """Raw and work tables with 240 young players in 2019 and 12 in 2025."""
    (root / "raw").mkdir()
    (root / "work").mkdir()
    ids = list(range(1, 253))
    rows = [
        rated_row(i, season=2019, club=1 + i % 3, goals=i % 5, made_it=i % 3 == 0, minutes=600 + i)
        for i in ids[:240]
    ]
    rows += [rated_row(i, season=2025, club=1 + i % 3, goals=i % 4) for i in ids[240:]]
    pd.DataFrame(rows).to_csv(root / "work" / rating.RATED_FILE, index=False)
    games = match_table([("IT1", 2019), ("IT1", 2025)])
    tables = {
        "games": games,
        "game_lineups": pd.DataFrame({"game_id": [0, 1, 20], "player_id": 1}),
        "player_valuations": pd.DataFrame(
            {"player_id": [1, 2], "date": "2019-12-05", "market_value_in_eur": 300_000}
        ),
        "players": people(ids),
    }
    for name, frame in tables.items():
        with gzip.open(root / "raw" / config.table_file(name), "wt") as handle:
            frame.to_csv(handle, index=False)


def test_step_writes_three_files_and_leaves_inputs_byte_identical(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Criterion 1, 5 and 7: the step prints the counts, writes only its three files, and
    two runs write the same bytes."""
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    write_world(tmp_path)
    before = {p: p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}

    assert cli.main(["model"]) == 0

    after = {p: p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}
    work = tmp_path / "work"
    written = {work / name for name in (model.FEATURES_FILE, model.SCORES_FILE, model.FACTS_FILE)}
    assert set(after) - set(before) == written
    assert all(after[p] == before[p] for p in before)
    first = {p: p.read_bytes() for p in written}
    assert cli.main(["model"]) == 0
    assert {p: p.read_bytes() for p in written} == first
    out = capsys.readouterr().out.splitlines()
    assert out[0] == "features.csv: 252 rows"
    assert out[1] == "training rows, decision season 2025: 240"
    assert out[2] == "share of positives in training: 0.3333"
    assert out[3] == "pool size: 12 players"
    scores = pd.read_csv(work / model.SCORES_FILE)
    assert list(scores.columns) == list(model.SCORE_COLUMNS)
    assert scores["score_lr"].is_monotonic_decreasing


def test_too_few_rows_in_the_step_end_with_one_error_line(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Criterion 7: the step stops with one error line and writes no scores."""
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    write_world(tmp_path)
    rated = pd.read_csv(tmp_path / "work" / rating.RATED_FILE)
    rated.loc[~((rated["season"] == 2019) & (rated["player_id"] > 50))].to_csv(
        tmp_path / "work" / rating.RATED_FILE, index=False
    )

    assert cli.main(["model"]) == 1

    lines = capsys.readouterr().err.strip().splitlines()
    assert lines == ["error: decision season 2025 has 50 training rows, fewer than 200"]
    assert not (tmp_path / "work" / model.SCORES_FILE).exists()


def test_missing_input_ends_with_one_error_line_and_code_1(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))

    assert cli.main(["model"]) == 1

    lines = capsys.readouterr().err.strip().splitlines()
    assert len(lines) == 1
    assert lines[0].startswith("error: input file ")
    assert "run the step `rating` first" in lines[0]


def test_real_tables_train_on_seasons_up_to_2022_and_score_the_radar_pool() -> None:
    """Criterion 1 and 5: the radar call on the real tables."""
    raw = config.raw_dir()
    needed = [raw / config.table_file(name) for name in config.TABLES]
    needed.append(config.work_dir() / rating.RATED_FILE)
    if not all(path.is_file() for path in needed):
        pytest.skip("real tables are not present")

    run = model.run_model(raw, config.work_dir())

    rated = rating.read_table(config.work_dir() / rating.RATED_FILE, "rating")
    wanted = rated.loc[rated["in_pool"], list(features.KEY)]
    pool = run.scored.pool
    assert (
        pool[list(features.KEY)]
        .sort_values(list(features.KEY))
        .reset_index(drop=True)
        .equals(wanted.sort_values(list(features.KEY)).reset_index(drop=True))
    )
    assert max(run.scored.facts["training_seasons"]) == 2022
    assert run.scored.facts["training_rows"] > model.MIN_TRAINING_ROWS
    assert pool[["score_lr", "score_gb"]].stack().between(0, 1).all()
