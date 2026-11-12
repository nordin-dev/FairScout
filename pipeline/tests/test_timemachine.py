"""Tests of the step `timemachine`, grouped by the acceptance criterion they prove.

The tables are small synthetic tables built here: no network. The last test reads the real
tables when they are present and skips itself when they are not.
"""

import copy
import json
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import pytest
from jsonschema import Draft202012Validator
from sklearn.ensemble import HistGradientBoostingClassifier

from fairscout import backtest, cli, config, features, model, rating, timemachine
from fairscout.errors import StepError

PER_SEASON = 90
MIN_ROWS = 20
PICK_KEYS = {
    "rank", "id", "name", "club", "league", "position", "age", "value_then", "value_3y",
    "made_it", "value_peak", "value_latest", "history",
}  # fmt: skip


def synthetic_table() -> pd.DataFrame:
    """Young players of 2012 to 2022: random features, made-it follows a hidden signal."""
    rng = np.random.default_rng(11)
    rows = []
    for season in range(2012, 2023):
        for k in range(PER_SEASON):
            made = bool(rng.random() < 0.3)
            row: dict[str, Any] = {name: float(rng.normal()) for name in features.FEATURES}
            row.update(
                {
                    "player_id": season * 1000 + k, "season": season, "league_id": "IT1",
                    "age": 17 + float(rng.random() * 4), "made_it": made, "outcome_known": True,
                    "value_decision": float(rng.choice([200_000, 400_000, 800_000, 1_500_000])),
                }
            )  # fmt: skip
            row["goals_per90"] = row["assists_per90"] = 0.1
            row["minutes"] = float(rng.integers(100, 3000))
            row["output_percentile"] = float(made) * 0.4 + float(rng.normal())
            rows.append(row)
    return pd.DataFrame(rows)


def synthetic_inputs() -> timemachine.Inputs:
    """The tables of one small world; players with no later value are every third non-hit."""
    table = synthetic_table()
    keys = table[list(features.KEY)].copy()
    rated = keys.assign(
        club_id=1 + keys["player_id"] % 2,
        position_group="Attack",
        value_outcome=np.where(
            table["made_it"], 2_000_000.0, np.where(keys["player_id"] % 3 == 0, np.nan, 100_000.0)
        ),
    )
    ids = table["player_id"]
    players = pd.DataFrame(
        {
            "player_id": ids,
            "name": "Player " + ids.astype(str),
            "sub_position": np.where(ids % 5 == 0, None, "Centre-Forward"),
            "highest_market_value_in_eur": np.where(ids % 7 == 0, np.nan, 3_000_000.0),
            "market_value_in_eur": np.where(ids % 7 == 0, np.nan, 2_500_000.0),
        }
    )
    valuations = pd.concat(
        [
            pd.DataFrame(
                {"player_id": ids, "date": f"{year}-03-01", "market_value_in_eur": 300_000 + k}
            )
            for k, year in enumerate((2013, 2016, 2025))
        ]
    )
    pools, facts = backtest.walk_forward(
        table.merge(
            rated[[*features.KEY, "value_outcome"]].rename(
                columns={"value_outcome": "value_later"}
            ),
            on=list(features.KEY),
        ),
        min_rows=MIN_ROWS,
    )
    expected = backtest.season_entries(pools, facts)
    return timemachine.Inputs(
        table=table,
        rated=rated,
        leagues=pd.DataFrame({"league_id": ["IT1"], "league_name": ["Italy"]}),
        players=players,
        clubs=pd.DataFrame({"club_id": [1, 2], "club_name": ["Club One", "Club Two"]}),
        valuations=valuations,
        expected=expected,
    )


def write_world(root: Path, inputs: timemachine.Inputs) -> None:
    """Write the inputs as the files the step reads."""
    work, raw = root / "work", root / "raw"
    work.mkdir(parents=True)
    raw.mkdir()
    inputs.table.to_csv(work / model.FEATURES_FILE, index=False)
    inputs.rated.to_csv(work / rating.RATED_FILE, index=False)
    inputs.leagues.to_csv(work / "leagues.csv", index=False)
    (work / backtest.REPORT_FILE).write_text(json.dumps({"by_season": inputs.expected}))
    inputs.players.to_csv(raw / config.table_file("players"), index=False)
    inputs.clubs.rename(columns={"club_name": "name"}).to_csv(
        raw / config.table_file("clubs"), index=False
    )
    inputs.valuations.to_csv(raw / config.table_file("player_valuations"), index=False)


@pytest.fixture(scope="module", autouse=True)
def quick_challenger() -> Iterator[None]:
    """The challenger model is not used by the step; make it trivial so the tests are fast."""
    patch = pytest.MonkeyPatch()
    patch.setattr(model, "boosting_model", lambda: HistGradientBoostingClassifier(max_iter=2))
    yield
    patch.undo()


@pytest.fixture(scope="module")
def inputs() -> timemachine.Inputs:
    return synthetic_inputs()


@pytest.fixture(scope="module")
def built(inputs: timemachine.Inputs) -> timemachine.TimeMachineRun:
    return timemachine.build_lists(inputs, min_rows=MIN_ROWS)


def test_four_seasons_listed_six_in_the_totals_with_the_weakest_included(
    inputs: timemachine.Inputs, built: timemachine.TimeMachineRun
) -> None:
    """Criteria 4 and 6: four listed seasons, six in the totals, no season dropped."""
    result = built.result
    assert [s["season"] for s in result["seasons"]] == ["2019/20", "2020/21", "2021/22", "2022/23"]
    six = result["six_seasons"]
    assert list(six["by_season"]) == [backtest.season_label(s) for s in config.BACKTEST_SEASONS]
    assert six["tier_a_hits"] == sum(e["hits"] for e in inputs.expected)
    assert six["tier_a_picks"] == sum(e["picks"] for e in inputs.expected)
    assert six["pool_players"] == sum(e["pool"] for e in inputs.expected)
    assert six["pool_hits"] == sum(e["pool_hits"] for e in inputs.expected)
    assert (
        six["by_season"]["2017/18"] == f"{inputs.expected[0]['hits']}/{inputs.expected[0]['picks']}"
    )
    for shown, known in zip(result["seasons"], inputs.expected[2:], strict=True):
        assert (shown["hits"], len(shown["picks"]), shown["pool"]) == (
            known["hits"], known["picks"], known["pool"],
        )  # fmt: skip
        assert shown["training_rows"] == known["training_rows"]
    assert len(built.report) == 6


def test_a_list_is_the_top_tenth_in_score_order_with_ties_by_player_id(
    inputs: timemachine.Inputs,
) -> None:
    """Criteria 1 and 2: the list comes from the scoring function, called with the season."""
    pool, listed, _ = timemachine.list_season(inputs.table, 2020, 1_000_000, MIN_ROWS)
    scored = model.score_season(inputs.table, 2020, 1_000_000, MIN_ROWS).pool
    assert len(listed) == backtest.pick_count(len(pool), 0.1)
    assert listed["score_lr"].is_monotonic_decreasing
    assert pool["score_lr"].tolist() == scored["score_lr"].tolist()
    ties = pool.assign(score_lr=0.5)
    flat = backtest.rank_pool(ties, "model_lr").head(len(listed))
    assert flat["player_id"].tolist() == sorted(ties["player_id"])[: len(listed)]
    timemachine.check_list("2020/21", ties, flat)


def test_player_with_no_later_value_stays_with_an_empty_value_and_is_not_a_hit(
    built: timemachine.TimeMachineRun,
) -> None:
    """Criterion 5."""
    picks = [p for s in built.result["seasons"] for p in s["picks"]]
    silent = [p for p in picks if p["value_3y"] is None]
    assert silent
    assert not any(p["made_it"] for p in silent)
    assert all(p["value_3y"] is not None for p in picks if p["made_it"])


def test_pool_filtered_by_outcome_stops_the_run(
    inputs: timemachine.Inputs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Criterion 3, check 2."""
    real = model.score_season

    def filtered(table: pd.DataFrame, season: int, budget: int, min_rows: int) -> model.Scored:
        scored = real(table, season, budget, min_rows)
        pool = scored.pool.merge(table[[*features.KEY, "made_it"]], on=list(features.KEY))
        return model.Scored(
            pool=pool.loc[pool["made_it"]].drop(columns="made_it"), facts=scored.facts
        )

    monkeypatch.setattr(model, "score_season", filtered)
    with pytest.raises(StepError, match=r"pool of season 2017/18 has \d+ players, expected \d+"):
        timemachine.build_lists(inputs, min_rows=MIN_ROWS)


def test_training_row_from_a_season_too_close_stops_the_run(
    inputs: timemachine.Inputs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Criterion 3, check 1."""
    real = model.score_season

    def leaky(table: pd.DataFrame, season: int, budget: int, min_rows: int) -> model.Scored:
        scored = real(table, season, budget, min_rows)
        facts = {
            **scored.facts,
            "training_seasons": [*scored.facts["training_seasons"], season - 2],
        }
        return model.Scored(pool=scored.pool, facts=facts)

    monkeypatch.setattr(model, "score_season", leaky)
    with pytest.raises(StepError, match="season 2017/18 trains on season 2015, later than 2014"):
        timemachine.build_lists(inputs, min_rows=MIN_ROWS)
    with pytest.raises(StepError):
        timemachine.check_training("2019/20", 2019, [2016, 2017])
    timemachine.check_training("2019/20", 2019, [2015, 2016])


def test_list_that_is_not_the_top_tenth_stops_the_run(inputs: timemachine.Inputs) -> None:
    """Criterion 3, check 3: wrong length, a wrong player and a wrong order."""
    scored = model.score_season(inputs.table, 2020, 1_000_000, MIN_ROWS).pool
    pool = scored.merge(inputs.table[[*features.KEY, "made_it"]], on=list(features.KEY))
    good = backtest.rank_pool(pool, "model_lr").head(backtest.pick_count(len(pool), 0.1))
    timemachine.check_list("2020/21", pool, good)
    swapped = pd.concat([good.iloc[[1, 0]], good.iloc[2:]])
    outsider = pd.concat([good.iloc[:-1], backtest.rank_pool(pool, "model_lr").tail(1)])
    for broken, message in (
        (good.iloc[:-1], "has .* players, expected"),
        (outsider, "not in the top 10%"),
        (swapped, "not in the order of the model score"),
    ):
        with pytest.raises(StepError, match=message):
            timemachine.check_list("2020/21", pool, broken)


def test_run_stops_when_the_list_is_in_the_wrong_order(
    inputs: timemachine.Inputs, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Criterion 3, check 3 inside the run: a ranking that puts the best last is caught."""
    real: Callable[[pd.DataFrame, str], pd.DataFrame] = backtest.rank_pool
    monkeypatch.setattr(backtest, "rank_pool", lambda pool, rule: real(pool, rule).iloc[::-1])
    with pytest.raises(StepError, match="list of season 2017/18"):
        timemachine.build_lists(inputs, min_rows=MIN_ROWS)


def test_hits_that_differ_from_the_backtest_stop_the_run(inputs: timemachine.Inputs) -> None:
    """Criterion 4: the hits and picks equal those in `backtest.json`."""
    wrong = copy.deepcopy(inputs.expected)
    wrong[3]["hits"] += 1
    with pytest.raises(StepError, match=r"season 2020/21: \d+ of \d+ differ from \d+ of \d+"):
        timemachine.check_backtest("2020/21", wrong[3]["hits"] - 1, wrong[3]["picks"], wrong)
    timemachine.check_backtest("2020/21", wrong[3]["hits"], wrong[3]["picks"], wrong)


def test_decision_and_outcome_dates_and_the_trained_on_label(
    built: timemachine.TimeMachineRun,
) -> None:
    """Criterion 4."""
    first = built.result["seasons"][0]
    assert first["decision_date"] == "2020-06-30"
    assert first["outcome_date"] == "2023-06-30"
    assert first["trained_on"] == "2012/13\u20132016/17"
    last = built.result["seasons"][-1]
    assert (last["decision_date"], last["outcome_date"]) == ("2023-06-30", "2026-06-30")
    assert built.result["as_of"] == "2025-03-01"
    assert 0 < first["pool_rate"] < 1


def test_every_pick_holds_every_key_of_the_contract(built: timemachine.TimeMachineRun) -> None:
    """Criterion 1."""
    for season in built.result["seasons"]:
        assert set(season) == {
            "season", "decision_date", "outcome_date", "trained_on", "training_rows",
            "pool", "pool_rate", "hits", "picks",
        }  # fmt: skip
        assert [p["rank"] for p in season["picks"]] == list(range(1, len(season["picks"]) + 1))
        for pick in season["picks"]:
            assert set(pick) == PICK_KEYS
            assert pick["club"] in {"Club One", "Club Two"}
            assert pick["league"] == "Italy"
            assert pick["history"] == sorted(pick["history"])
            assert pick["history"][-1][0] == "2025-03-01"
    pick = built.result["seasons"][0]["picks"][0]
    assert isinstance(pick["id"], str)
    assert pick["age"] == round(pick["age"], 1)


def test_step_is_deterministic_writes_one_file_and_keeps_inputs_byte_identical(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    inputs: timemachine.Inputs,
    built: timemachine.TimeMachineRun,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """Criterion 6 and the house rules."""
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    write_world(tmp_path, inputs)
    before = {p: p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}

    assert cli.main(["timemachine"]) == 0

    lines = capsys.readouterr().out.strip().splitlines()
    assert len(lines) == 6 and lines[0].startswith("2017/18  ")
    after = {p: p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}
    target = tmp_path / "work" / timemachine.LISTS_FILE
    assert set(after) - set(before) == {target}
    assert all(after[p] == before[p] for p in before)
    again = json.dumps(built.result, indent=2, ensure_ascii=False) + "\n"
    assert target.read_text(encoding="utf-8") == again
    assert set(json.loads(again)) == {"as_of", "six_seasons", "seasons"}


def test_missing_input_ends_with_one_error_line_and_code_1(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))

    assert cli.main(["timemachine"]) == 1

    lines = capsys.readouterr().err.strip().splitlines()
    assert len(lines) == 1
    assert lines[0].startswith("error: input file ")
    assert "run the step `model` first" in lines[0]


def test_real_tables_lists_validate_against_the_contract_and_equal_the_backtest() -> None:
    """Criteria 1 and 4 on the real tables."""
    work, raw = config.work_dir(), config.raw_dir()
    needed = [work / n for n in (model.FEATURES_FILE, rating.RATED_FILE, backtest.REPORT_FILE)]
    needed.append(raw / config.table_file("player_valuations"))
    if not all(path.is_file() for path in needed):
        pytest.skip("real tables are not present")

    run = timemachine.run_timemachine(raw, work)

    schema = json.loads((config.repository_root() / "contract/timemachine.schema.json").read_text())
    part = {"type": "array", "items": schema["properties"]["seasons"]["items"]}
    Draft202012Validator(part).validate(run.result["seasons"])
    expected = {
        e["season"]: e for e in json.loads((work / backtest.REPORT_FILE).read_text())["by_season"]
    }
    assert len(run.result["seasons"]) == 4
    for season in run.result["seasons"]:
        known = expected[season["season"]]
        assert (season["hits"], len(season["picks"])) == (known["hits"], known["picks"])
