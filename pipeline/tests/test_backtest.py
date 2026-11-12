"""Tests of the step `backtest`, grouped by the acceptance criterion they prove.

The tables are small synthetic tables built here: no network. The last test reads the real
tables when they are present and skips itself when they are not.
"""

import copy
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import pytest

from fairscout import backtest, cli, config, features, model, rating
from fairscout.errors import StepError

PER_SEASON = 80


def synthetic_table(first: int = 2012, last: int = 2022) -> pd.DataFrame:
    """Young players of seasons first..last: random features, a made-it mark that follows the
    first feature, and no later value for part of those who did not make it."""
    rng = np.random.default_rng(7)
    rows = []
    for season in range(first, last + 1):
        for k in range(PER_SEASON):
            made = bool(rng.random() < 0.3)
            row: dict[str, Any] = {name: float(rng.normal()) for name in features.FEATURES}
            row.update(
                {
                    "player_id": season * 1000 + k, "season": season, "league_id": "IT1",
                    "minutes": float(rng.integers(100, 3000)), "age": 17 + float(rng.random() * 4),
                    "made_it": made, "outcome_known": True,
                    "value_decision": float(rng.choice([200_000, 400_000, 800_000, 1_500_000])),
                    "value_later": 2_000_000.0 if made or rng.random() < 0.5 else np.nan,
                }
            )  # fmt: skip
            row["goals_per90"] = float(rng.random())
            row["assists_per90"] = float(rng.random())
            row["output_percentile"] = float(made) + float(rng.normal()) * 0.3
            rows.append(row)
    return pd.DataFrame(rows)


def hand_pool() -> pd.DataFrame:
    """One season, five players, with distinct orders for every rule."""
    return pd.DataFrame(
        {
            "season": 2017,
            "player_id": [5, 4, 3, 2, 1],
            "league_id": "IT1",
            "minutes": [100, 500, 300, 900, 200],
            "goals_assists": [0.1, 0.2, 0.9, 0.3, 0.5],
            "age": [20.0, 19.0, 18.0, 17.0, 21.0],
            "value_decision": [100, 300, 200, 500, 400],
            "score_lr": [0.1, 0.2, 0.3, 0.4, 0.9],
            "score_gb": [0.9, 0.2, 0.3, 0.4, 0.1],
            "made_it": [True, False, True, False, True],
        }
    )


def tops(pool: pd.DataFrame, rule: str, share: float) -> list[int]:
    chosen = backtest.rank_pool(pool, rule).head(backtest.pick_count(len(pool), share))
    return [int(p) for p in chosen["player_id"]]


@pytest.fixture(scope="module")
def walked() -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    return backtest.walk_forward(synthetic_table(), min_rows=20)


def test_each_test_season_trains_only_on_seasons_three_or_more_earlier(
    walked: tuple[pd.DataFrame, list[dict[str, Any]]],
) -> None:
    """Criterion 1: read from what the scoring function reports."""
    _, facts = walked
    assert [f["decision_season"] for f in facts] == list(config.BACKTEST_SEASONS)
    for fact in facts:
        used = fact["training_seasons"]
        assert used and max(used) == fact["decision_season"] - 3
        assert fact["decision_season"] not in used


def test_pool_keeps_players_with_no_later_value_and_they_are_never_hits() -> None:
    """Criterion 2: the pool is everyone within the budget; no later value is no hit."""
    table = synthetic_table()
    pools, _ = backtest.walk_forward(table, min_rows=20)

    first = pools.loc[pools["season"] == 2017]
    expected = table.loc[(table["season"] == 2017) & (table["value_decision"] <= 1_000_000)]
    assert len(first) == len(expected)
    silent = pools.loc[pools["value_later"].isna()]
    assert len(silent) > 0
    assert not silent["made_it"].any()


def test_pick_count_for_several_pool_sizes() -> None:
    """Criterion 3: the share of the pool rounded, at least one, none for an empty pool."""
    assert [backtest.pick_count(n, 0.1) for n in (0, 1, 4, 14, 26, 228)] == [0, 1, 1, 1, 3, 23]
    assert [backtest.pick_count(n, 0.2) for n in (0, 1, 5, 12, 228)] == [0, 1, 1, 2, 46]


def test_each_rule_picks_the_expected_players() -> None:
    """Criterion 3: the four simple rules and the two models on a hand-made pool."""
    pool = hand_pool()
    assert tops(pool, "model_lr", 0.4) == [1, 2]
    assert tops(pool, "model_gb", 0.4) == [5, 2]
    assert tops(pool, "most_minutes", 0.4) == [2, 4]
    assert tops(pool, "most_goals_assists", 0.4) == [3, 1]
    assert tops(pool, "youngest", 0.4) == [2, 3]
    assert tops(pool, "cheapest", 0.4) == [5, 3]


def test_ties_go_by_player_id() -> None:
    """Criterion 3: equal values are ordered by player id, whatever the row order."""
    pool = hand_pool()
    pool["minutes"] = 500
    assert tops(pool, "most_minutes", 0.6) == [1, 2, 3]
    assert tops(pool.iloc[::-1], "most_minutes", 0.6) == [1, 2, 3]


def test_the_half_million_pool_is_the_scored_pool_cut_and_ranked_again(
    walked: tuple[pd.DataFrame, list[dict[str, Any]]],
) -> None:
    """Criterion 3: no second training; the cut pool is a subset ranked inside itself."""
    pools, facts = walked
    result = backtest.build_result(pools, facts)
    big, small = result["budgets"]

    cut = pools.loc[pools["value_decision"] <= 500_000]
    assert small["budget_eur"] == 500_000
    assert small["players"] == len(cut) < big["players"]
    assert small["base_hits"] == int(cut["made_it"].sum())
    expected = sum(backtest.pick_hits(g, "model_lr", 0.1)[0] for _, g in cut.groupby("season"))
    assert small["rows"][0]["hits"] == expected
    assert small["picks_per_rule"] == sum(
        backtest.pick_count(n, 0.1) for n in small["season_pools"].values()
    )


def test_hits_plus_misses_equal_picks_in_every_row(
    walked: tuple[pd.DataFrame, list[dict[str, Any]]],
) -> None:
    """Criterion 4 and 5: every row of both budgets and both shares, and the rule ids."""
    result = backtest.build_result(*walked)
    for entry in result["budgets"]:
        for rows in (entry["rows"], entry["rows_top20"]):
            assert [r["rule"] for r in rows] == [r for r, _ in backtest.RULES]
            for row in rows:
                assert row["hits"] + row["misses"] == row["picks"]
                assert 0 <= row["rate"] <= 1


def test_by_season_holds_all_six_seasons_also_one_with_zero_hits() -> None:
    """Criterion 4: the weakest season is listed, even with no hit."""
    pools, facts = backtest.walk_forward(synthetic_table(), min_rows=20)
    weak = pools["season"] == 2019
    pools.loc[weak, "made_it"] = False
    result = backtest.build_result(pools, facts)

    seasons = {s["season"]: s for s in result["by_season"]}
    assert list(seasons) == ["2017/18", "2018/19", "2019/20", "2020/21", "2021/22", "2022/23"]
    assert seasons["2019/20"]["hits"] == 0
    assert seasons["2019/20"]["picks"] > 0
    assert all(s["training_rows"] > 0 and s["pool"] > 0 for s in seasons.values())


def test_margin_of_error_is_the_95_percent_margin_of_the_pool_rate() -> None:
    """Criterion 3: 1.96 standard errors in percentage points, as in the prototype."""
    assert backtest.margin_pp(0.296, 133) == pytest.approx(7.8, abs=0.05)
    assert backtest.margin_pp(0.5, 100) == pytest.approx(9.8)
    assert backtest.margin_pp(0.3, 0) == 0


def test_training_check_stops_on_own_season_or_a_late_training_season() -> None:
    """Criterion 5: a test season in its own training set, or one later than season - 3."""
    good = [{"season": "2020/21", "training_seasons": [2012, 2017]}]
    backtest.check_training(good)

    own = [{"season": "2020/21", "training_seasons": [2012, 2020]}]
    with pytest.raises(StepError, match="own training set"):
        backtest.check_training(own)
    late = [{"season": "2020/21", "training_seasons": [2012, 2018]}]
    with pytest.raises(StepError, match="later than 2017"):
        backtest.check_training(late)


def test_row_checks_stop_on_hits_plus_misses_or_on_the_pick_count(
    walked: tuple[pd.DataFrame, list[dict[str, Any]]],
) -> None:
    """Criterion 5: a row whose hits plus misses differ from picks, or whose picks differ from
    the sum of the pick counts."""
    budgets = backtest.build_result(*walked)["budgets"]
    backtest.check_rows(budgets)

    broken = copy.deepcopy(budgets)
    broken[1]["rows_top20"][3]["misses"] += 1
    with pytest.raises(StepError, match="hits plus misses differ from picks"):
        backtest.check_rows(broken)
    shifted = copy.deepcopy(budgets)
    shifted[0]["rows"][2]["picks"] += 1
    shifted[0]["rows"][2]["misses"] += 1
    with pytest.raises(StepError, match="expected"):
        backtest.check_rows(shifted)


def write_world(work: Path) -> None:
    work.mkdir(parents=True)
    table = synthetic_table().drop(columns=["value_later"])
    for column in ("value_date", "prev_value_date"):
        table[column] = "2020-01-01"
    table.to_csv(work / model.FEATURES_FILE, index=False)
    later = synthetic_table()[[*features.KEY, "value_later"]]
    later.rename(columns={"value_later": "value_outcome"}).to_csv(
        work / rating.RATED_FILE, index=False
    )


def test_step_is_deterministic_writes_two_files_and_keeps_inputs_byte_identical(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Criterion 6 and the house rules: only the two files, inputs untouched, same bytes twice."""
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    write_world(tmp_path / "work")
    before = {p: p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}

    assert cli.main(["backtest"]) == 0

    out = capsys.readouterr().out
    assert "budget up to 1,000,000 EUR: pool" in out
    after = {p: p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}
    work = tmp_path / "work"
    written = {work / backtest.REPORT_FILE, work / backtest.POOLS_FILE}
    assert set(after) - set(before) == written
    assert all(after[p] == before[p] for p in before)
    first = {p: p.read_bytes() for p in written}
    assert cli.main(["backtest"]) == 0
    assert {p: p.read_bytes() for p in written} == first
    pools = pd.read_csv(work / backtest.POOLS_FILE)
    assert list(pools.columns) == list(backtest.POOL_COLUMNS)
    top = pools.loc[pools["season"] == 2017].sort_values("lr_rank")
    assert top["score_lr"].is_monotonic_decreasing
    assert json.loads((work / backtest.REPORT_FILE).read_text())["pick_share"] == 0.1


def test_missing_input_ends_with_one_error_line_and_code_1(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))

    assert cli.main(["backtest"]) == 1

    lines = capsys.readouterr().err.strip().splitlines()
    assert len(lines) == 1
    assert lines[0].startswith("error: input file ")
    assert "run the step `model` first" in lines[0]


def test_real_tables_six_seasons_and_picks_equal_the_sum_of_pick_counts() -> None:
    """Criterion 1 to 3 on the real tables."""
    work = config.work_dir()
    if not all((work / name).is_file() for name in (model.FEATURES_FILE, rating.RATED_FILE)):
        pytest.skip("real tables are not present")

    run = backtest.run_backtest(work)

    assert len(run.result["test_seasons"]) == 6
    assert len(run.result["by_season"]) == 6
    first = run.result["budgets"][0]
    sizes = [s["pool"] for s in run.result["by_season"]]
    assert first["picks_per_rule"] == sum(backtest.pick_count(n, 0.1) for n in sizes)
    for entry in run.result["budgets"]:
        for row in [*entry["rows"], *entry["rows_top20"]]:
            assert 0 <= row["rate"] <= 1
