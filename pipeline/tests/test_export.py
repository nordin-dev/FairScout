"""Tests of the step `export` and the fifteen quality checks, grouped by acceptance criterion.

The work files are small tables built here, handed to `run_export` through its `reader`, so no
source table is needed. The step `tiers` is replaced by a fake with the same function for the
flags. The last test reads the real tables when they are present and skips itself when not.
"""

import argparse
import copy
import dataclasses
import json
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd
import pytest

from fairscout import checks, cli, config, contract, export
from fairscout.errors import StepError

NOW = datetime(2026, 11, 12, 9, 0, 0, tzinfo=UTC)
LATER = datetime(2026, 11, 13, 17, 30, 0, tzinfo=UTC)
LAST_DATE = pd.Timestamp("2026-07-06")
SHOWN = "2022/23"
SHOWN_START = 2022
PCT = {
    "pct_output": 50,
    "pct_scoring": 40,
    "pct_creating": 60,
    "pct_involvement": 30,
    "pct_role": 70,
}
MONTHS = [1, 4, 7, 10, 2, 11, 1, 12, 5]
ALL_LEAGUES = [*config.LONG_HISTORY_LEAGUES, *config.SHORT_HISTORY_LEAGUES]
FILES = ("players", "leagues", "evidence", "timemachine", "meta")


def fake_flags(frame: pd.DataFrame, last_date: pd.Timestamp) -> pd.DataFrame:
    """The flags of the real step, reduced to the rules these tests need."""
    born = pd.to_datetime(frame["date_of_birth"], errors="coerce")
    result = pd.DataFrame(index=frame.index)
    result["flag_under18"] = (born + pd.DateOffset(years=18)) > last_date
    result["flag_low_sample"] = frame["minutes"] < 900
    result["flag_contract_ending"] = False
    result["flag_born_q4"] = born.dt.month >= 10
    result["flag_limited_position_data"] = frame["position_group"].isin(["Defender", "Goalkeeper"])
    return result


@pytest.fixture(autouse=True)
def fake_tiers_step(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(export.tiers, "compute_flags", fake_flags)


def rated_row(pid: int, **changes: object) -> dict[str, Any]:
    row: dict[str, Any] = {
        "player_id": pid, "season": 2025, "league_id": "KR1", "club_id": 100 + pid,
        "minutes": 1000, "matches": 15, "goals": 3, "assists": 2,
        "value_decision": 300_000.0, "value_decision_date": "2026-03-01",
        "position_group": "Midfield", "young": True, "team_matches": 30,
        "role": 0.5, "ga90": 0.45, "league_factor": 1.2, "ga90_adj": 0.38, "g90_adj": 0.25,
        "a90_adj": 0.13, "involvement": 0.3, "in_pool": True, **PCT,
    }  # fmt: skip
    row.update(changes)
    return row


def outcome_ranges() -> dict[str, Any]:
    stats = {
        "share": "top 10%", "hits": 5, "n": 10, "rate": 0.5, "multiple_p25": 1.0,
        "multiple_p50": 2.0, "multiple_p75": 4.0, "no_later_value": 2, "share_lost_value": 0.2,
    }  # fmt: skip
    return {tier: dict(stats) for tier in "ABC"}


def backtest_report() -> dict[str, Any]:
    row = {"rule": "model_lr", "label": "Model", "hits": 3, "picks": 5, "rate": 0.6, "misses": 2}
    budget = {
        "budget_eur": 1_000_000, "players": 50, "picks_per_rule": 5, "margin_pp": 7.5,
        "base_rate": 0.3, "rows": [dict(row)], "rows_top20": [dict(row)], "base_hits": 9,
    }  # fmt: skip
    seasons = [f"{y}/{(y + 1) % 100:02d}" for y in range(2017, 2023)]
    return {
        "test_seasons": seasons,
        "pick_share": 0.1,
        "budgets": [dict(budget), {**budget, "budget_eur": 500_000}],
        "by_season": [
            {
                "season": label, "hits": 1, "picks": 1, "pool": 4, "pool_hits": 1,
                "training_seasons": list(range(2012, 2012 + i + 1)), "training_rows": 100,
            }
            for i, label in enumerate(seasons)
        ],
        "extra_key_the_contract_does_not_allow": 1,
    }  # fmt: skip


def pick(pid: int) -> dict[str, Any]:
    return {
        "rank": 1, "id": str(pid), "name": "Pick", "club": "Club", "league": "Italy",
        "position": "Centre-Back", "age": 19.5, "value_then": 500000.0, "value_3y": None,
        "made_it": False, "value_peak": 600000.0, "value_latest": 500000.0,
        "history": [["2022-06-30", 500000.0]],
    }  # fmt: skip


def make_sources() -> export.Sources:
    """Six pool players, three Bosnian players (one under 450 minutes), one test season."""
    kinds = ["Right Winger", "Central Midfield", "Central Midfield", "Central Midfield",
             "Central Midfield", "Left-Back"]  # fmt: skip
    groups = ["Attack", "Midfield", "Midfield", "Midfield", "Midfield", "Defender"]
    pool = [
        rated_row(i + 1, position_group=groups[i], value_decision=100_000.0 * (i + 1))
        for i in range(6)
    ]
    outside = [
        rated_row(7, position_group="Defender", young=False, in_pool=False, minutes=1500,
                  value_decision=3_000_000.0, **{k: float("nan") for k in PCT}),
        rated_row(8, position_group="Defender", young=False, in_pool=False, minutes=300,
                  value_decision=float("nan"), **{k: float("nan") for k in PCT}),
        rated_row(9, position_group="Attack", in_pool=False, value_decision=3_000_000.0),
    ]  # fmt: skip
    shown = [
        rated_row(10 + i, season=SHOWN_START, value_decision=200_000.0, in_pool=False)
        for i in range(1, 5)
    ]
    people = []
    for pid in range(1, 10):
        people.append(
            {
                "player_id": pid, "name": f"Player {pid}",
                "date_of_birth": f"2006-{MONTHS[pid - 1]:02d}-15",
                "sub_position": kinds[pid - 1] if pid <= 6 else "Centre-Back", "foot": "left",
                "height_in_cm": 180.0, "contract_expiration_date": "2028-06-30",
                "country_of_citizenship": "Bosnia-Herzegovina" if pid >= 7 else "Croatia",
            }
        )  # fmt: skip
    people += [
        {"player_id": 10 + i, "name": f"Old {i}", "date_of_birth": f"2004-0{i}-01",
         "sub_position": "Centre-Back", "foot": None, "height_in_cm": float("nan"),
         "contract_expiration_date": None, "country_of_citizenship": "Italy"}
        for i in range(1, 5)
    ]  # fmt: skip
    valuations = [
        {"player_id": 1, "date": f"2025-{m:02d}-01", "market_value_in_eur": 100_000.0 + m}
        for m in range(1, 13)
    ] + [
        {"player_id": 1, "date": f"2026-0{m}-01", "market_value_in_eur": 200_000.0 + m}
        for m in range(1, 4)
    ]
    valuations += [
        {"player_id": pid, "date": "2026-02-01", "market_value_in_eur": 100_000.0}
        for pid in range(2, 10)
    ]
    tiers = pd.DataFrame(
        [
            {
                "player_id": i + 1, "season": 2025, "league_id": "KR1", "score": 0.9 - i * 0.1,
                "score_rank_pct": 100 - i * 10, "tier": "ABCCCC"[i],
                "drivers": json.dumps([{"sign": "+", "key": "age", "text": "Young for his level"}]),
                "flag_under18": False, "flag_low_sample": False, "flag_contract_ending": False,
                "flag_born_q4": False, "flag_limited_position_data": False,
            }
            for i in range(6)
        ]
    )  # fmt: skip
    league_rows = [
        {"league_id": lid, "league_name": f"Name {lid}", "factor": 1.0 + 0.01 * i,
         "factor_source": "moves" if lid in config.LONG_HISTORY_LEAGUES else "estimate",
         "seasons": 14 if lid in config.LONG_HISTORY_LEAGUES else 2}
        for i, lid in enumerate(ALL_LEAGUES)
    ]  # fmt: skip
    league_table = pd.DataFrame(league_rows)
    league_table.loc[league_table["league_id"] == "GB1", "factor"] = 0.6
    lists = {
        "as_of": "2026-06-12",
        "six_seasons": {"tier_a_hits": 6, "tier_a_picks": 6, "pool_hits": 6, "pool_players": 24,
                        "by_season": {SHOWN: "1/1"}},
        "seasons": [
            {"season": SHOWN, "decision_date": "2023-06-30", "outcome_date": "2026-06-30",
             "trained_on": f"2012/13{export.DASH}2019/20", "training_rows": 100, "pool": 4,
             "pool_rate": 0.25, "hits": 0, "picks": [pick(11)]}
        ],
    }  # fmt: skip
    pools = pd.DataFrame(
        {"season": SHOWN_START, "player_id": [11, 12, 13, 14], "lr_rank": [1, 2, 3, 4]}
    )
    return export.Sources(
        rated=pd.DataFrame([*pool, *outside, *shown]),
        leagues=league_table,
        tiers=tiers,
        pools=pools,
        players=pd.DataFrame(people),
        clubs=pd.DataFrame({"club_id": range(100, 120), "name": [f"Club {i}" for i in range(20)]}),
        valuations=pd.DataFrame(valuations),
        league_evidence={
            "league_moves": {"total": 30, "used_for_factors": 20},
            "same_players_two_leagues": {"league_a": "Italy", "league_b": "Spain", "players": 9,
                                         "ga90_a": 0.5, "ga90_b": 0.3},
            "rank_correlation": -0.88,
        },
        backtest=backtest_report(),
        facts={"features": ["a", "b", "c"], "training_rows": 4890,
               "training_seasons": [2012, 2013, 2014]},
        tier_stats={tier: outcome_ranges()[tier] for tier in "ABC"},
        lists=lists,
        source_last_date=LAST_DATE,
        source_tables={
            t: checks.TableInfo(config.EXPECTED_COLUMNS[t], True) for t in config.TABLES
        },
        minutes_check={"leagues": ["Belgium", "Netherlands"], "season": "2024/25",
                       "appearances": 100, "within_5_min": 0.999, "goals_exact": 1.0},
    )  # fmt: skip


def run(out: Path, sources: export.Sources | None = None, now: datetime = NOW) -> export.ExportRun:
    chosen = sources or make_sources()
    return export.run_export(Path("raw"), Path("work"), out, now, lambda _r, _w: chosen)


def read_players(out: Path) -> list[dict[str, Any]]:
    data: list[dict[str, Any]] = json.loads((out / "players.json").read_text(encoding="utf-8"))
    return data


def snapshot(folder: Path) -> dict[str, bytes]:
    return {p.name: p.read_bytes() for p in sorted(folder.iterdir())}


# Criterion 1: all five files are written and each passes its schema.
def test_five_files_are_written_and_pass_their_schemas(tmp_path: Path) -> None:
    result = run(tmp_path / "data")
    for name in FILES:
        contract.validate_file(name, tmp_path / "data" / f"{name}.json")
    assert [o.number for o in result.outcomes] == list(range(1, 16))
    assert sorted(p.name for p in (tmp_path).iterdir()) == ["data"]


# Criterion 3: the pool and the Bosnian players outside it.
def test_pool_record_and_outside_record_have_the_right_shape(tmp_path: Path) -> None:
    run(tmp_path)
    records = {r["id"]: r for r in read_players(tmp_path)}
    pool, outside = records["1"], records["7"]
    assert pool["in_pool"] and pool["tier"] == "A" and pool["score"] == 0.9
    assert pool["drivers"] and pool["citizenship"] == "Croatia"
    assert not outside["in_pool"] and outside["citizenship"] == "Bosnia-Herzegovina"
    assert (
        outside["tier"] is None and outside["score"] is None and outside["score_rank_pct"] is None
    )
    assert outside["drivers"] == [] and outside["similar"] == [] and outside["note"] is None
    assert outside["flags"]["limited_position_data"] is True
    assert all(isinstance(v, int) for v in outside["pct"].values())


def test_bosnian_player_under_450_minutes_is_left_out(tmp_path: Path) -> None:
    run(tmp_path)
    ids = {r["id"] for r in read_players(tmp_path)}
    assert "8" not in ids
    assert {"7", "9"} <= ids


def test_one_record_per_player_with_most_minutes(tmp_path: Path) -> None:
    sources = make_sources()
    extra = pd.DataFrame([rated_row(1, league_id="IT1", minutes=2000)])
    tiers = pd.concat(
        [sources.tiers, sources.tiers.iloc[[0]].assign(league_id="IT1")], ignore_index=True
    )
    changed = dataclasses.replace(
        sources, rated=pd.concat([sources.rated, extra], ignore_index=True), tiers=tiers
    )
    run(tmp_path, changed)
    first = [r for r in read_players(tmp_path) if r["id"] == "1"]
    assert len(first) == 1 and first[0]["league_id"] == "IT1" and first[0]["minutes"] == 2000


def test_value_history_holds_twelve_points_oldest_first(tmp_path: Path) -> None:
    run(tmp_path)
    history = {r["id"]: r for r in read_players(tmp_path)}["1"]["value_history"]
    dates = [point[0] for point in history]
    assert len(history) == 12 and dates == sorted(dates)
    assert dates[-1] == "2026-03-01"


# Criterion 6: the default brief by rule, and meta from the data.
def test_default_brief_follows_the_rule(tmp_path: Path) -> None:
    run(tmp_path)
    meta = json.loads((tmp_path / "meta.json").read_text(encoding="utf-8"))
    assert meta["default_brief"] == {
        "position": "midfielder", "max_age": 21, "budget_eur": 500000,
        "matters": ["creates", "scores"],
    }  # fmt: skip
    assert meta["pool"] == {"up_to_1m": 6, "up_to_500k": 5, "regional_up_to_500k": 5}
    assert meta["leagues"] == 23 and meta["model"]["training_rows"] == 4890
    assert meta["source_last_date"] == "2026-07-06" and meta["built"] == "2026-11-12T09:00:00Z"


def record(position: str, group: str, value: float = 100_000, age: float = 20.0) -> dict[str, Any]:
    return {"in_pool": True, "position": position, "position_group": group,
            "value_eur": value, "age": age}  # fmt: skip


def test_default_brief_falls_back_when_fewer_than_three_match() -> None:
    winger = [record("Right Winger", "Attack") for _ in range(3)]
    striker = [record("Centre-Forward", "Attack") for _ in range(2)]
    brief, counts = export.default_brief([*winger, *striker])
    assert brief["position"] == "winger" and counts["striker"] == 2
    expensive = [record("Right Winger", "Attack", value=900_000) for _ in range(5)]
    middle = [record("Central Midfield", "Midfield") for _ in range(3)]
    fallback, _ = export.default_brief([*expensive, *striker, *middle])
    assert fallback["position"] == "midfielder"
    with pytest.raises(StepError, match="no brief position"):
        export.default_brief(striker)


# Criterion 5: a failed check stops the export, names the check, leaves the files alone.
def test_failing_check_stops_the_export_and_leaves_files_untouched(tmp_path: Path) -> None:
    out = tmp_path / "data"
    run(out)
    before = snapshot(out)
    sources = make_sources()
    league_table = sources.leagues.copy()
    league_table.loc[league_table["league_id"] == "GB1", "factor"] = 1.9
    with pytest.raises(StepError, match=r"quality check 6 \(England lowest\)"):
        run(out, dataclasses.replace(sources, leagues=league_table), LATER)
    assert snapshot(out) == before


def test_schema_failure_stops_the_write_and_leaves_files_untouched(tmp_path: Path) -> None:
    out = tmp_path / "data"
    assembled = export.assemble(make_sources(), NOW)
    export.write_files(assembled.files, out)
    before = snapshot(out)
    broken = copy.deepcopy(assembled.files)
    broken["meta"]["leagues"] = "many"
    with pytest.raises(StepError, match=r"schema check failed: meta\.json"):
        export.write_files(broken, out)
    assert snapshot(out) == before
    assert sorted(p.name for p in tmp_path.iterdir()) == ["data"]


def test_schema_failure_in_the_assembled_data_fails_check_12() -> None:
    sources = make_sources()
    assembled = export.assemble(sources, NOW)
    assembled.files["players"][0]["height_cm"] = "tall"
    with pytest.raises(StepError, match=r"quality check 12 \(schema\).*players\.json"):
        checks.run_checks(export.check_data(sources, assembled))


# Criterion 2: the size limit.
def test_size_limit_stops_the_export_and_leaves_files_untouched(tmp_path: Path) -> None:
    out = tmp_path / "data"
    assembled = export.assemble(make_sources(), NOW)
    sizes = export.write_files(assembled.files, out)
    before = snapshot(out)
    with pytest.raises(StepError, match="not under"):
        export.write_files(assembled.files, out, limit=sum(sizes.values()))
    assert snapshot(out) == before
    assert sum(sizes.values()) < export.MAX_TOTAL_BYTES


# Criterion 7: identical files apart from the build date.
def test_two_runs_give_identical_files_apart_from_the_build_date(tmp_path: Path) -> None:
    run(tmp_path / "one", now=NOW)
    run(tmp_path / "two", now=LATER)
    for name in ("players", "leagues", "timemachine"):
        assert (tmp_path / "one" / f"{name}.json").read_bytes() == (
            tmp_path / "two" / f"{name}.json"
        ).read_bytes()

    def stripped(folder: Path, name: str, key: str) -> dict[str, Any]:
        data: dict[str, Any] = json.loads((folder / f"{name}.json").read_text(encoding="utf-8"))
        data.pop(key)
        return data

    for name, key in (("meta", "built"), ("evidence", "generated")):
        assert stripped(tmp_path / "one", name, key) == stripped(tmp_path / "two", name, key)


def test_missing_input_gives_one_error_line(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv(config.DATA_ENV, str(tmp_path / "nothing"))
    code = cli.main(["export", "--out", str(tmp_path / "out")])
    captured = capsys.readouterr()
    assert code == 1
    assert captured.err.startswith("error: ") and len(captured.err.strip().splitlines()) == 1
    assert not (tmp_path / "out").exists()


def test_missing_column_gives_one_error_line(tmp_path: Path) -> None:
    from fairscout import inputs

    path = tmp_path / "rated.csv"
    path.write_text("player_id,season\n1,2025\n", encoding="utf-8")
    with pytest.raises(StepError, match="lacks the columns minutes"):
        inputs.read_csv_table(path, "rating", ("player_id", "minutes"))


# The checks: each fails on a fixture that breaks its rule.
def data_after(change: "Change") -> checks.CheckData:
    sources = make_sources()
    assembled = export.assemble(sources, NOW)
    changed = change(sources, assembled) or sources
    return export.check_data(changed, assembled)


def drop_column(sources: export.Sources, assembled: export.Assembled) -> export.Sources:
    tables = dict(sources.source_tables)
    tables["games"] = checks.TableInfo(("game_id",), True)
    return dataclasses.replace(sources, source_tables=tables)


def empty_table(sources: export.Sources, assembled: export.Assembled) -> export.Sources:
    tables = dict(sources.source_tables)
    tables["clubs"] = checks.TableInfo(config.EXPECTED_COLUMNS["clubs"], False)
    return dataclasses.replace(sources, source_tables=tables)


def poor_minutes(sources: export.Sources, assembled: export.Assembled) -> export.Sources:
    return dataclasses.replace(
        sources, minutes_check={**sources.minutes_check, "within_5_min": 0.9}
    )


def long_season(sources: export.Sources, assembled: export.Assembled) -> export.Sources:
    rated = sources.rated.copy()
    rated.loc[0, "minutes"] = 5000
    return dataclasses.replace(sources, rated=rated)


def no_birth_date(sources: export.Sources, assembled: export.Assembled) -> None:
    assembled.pool_rows.loc[assembled.pool_rows.index[0], "date_of_birth"] = None


def wild_factor(sources: export.Sources, assembled: export.Assembled) -> export.Sources:
    table = sources.leagues.copy()
    table.loc[0, "factor"] = 3.1
    return dataclasses.replace(sources, leagues=table)


def weak_correlation(sources: export.Sources, assembled: export.Assembled) -> export.Sources:
    return dataclasses.replace(
        sources, league_evidence={**sources.league_evidence, "rank_correlation": -0.5}
    )


def trained_on_test(sources: export.Sources, assembled: export.Assembled) -> export.Sources:
    report = copy.deepcopy(sources.backtest)
    report["by_season"][0]["training_seasons"].append(2017)
    return dataclasses.replace(sources, backtest=report)


def bad_rows(sources: export.Sources, assembled: export.Assembled) -> export.Sources:
    report = copy.deepcopy(sources.backtest)
    report["budgets"][0]["rows"][0]["misses"] = 9
    return dataclasses.replace(sources, backtest=report)


def lost_tier(sources: export.Sources, assembled: export.Assembled) -> None:
    assembled.files["players"][0]["tier"] = "B"
    assembled.files["meta"]["pool"]["up_to_1m"] = 7


def self_similar(sources: export.Sources, assembled: export.Assembled) -> None:
    first = assembled.files["players"][0]
    first["similar"] = [{"id": first["id"], "similarity": 99, "diff": "none"}]


def foreign_number(sources: export.Sources, assembled: export.Assembled) -> None:
    first = assembled.files["players"][0]
    first["note"], first["note_source"] = "Scored 77777 goals", "template"


def late_training(sources: export.Sources, assembled: export.Assembled) -> None:
    assembled.files["timemachine"]["seasons"][0]["trained_on"] = f"2012/13{export.DASH}2021/22"


def short_pool(sources: export.Sources, assembled: export.Assembled) -> None:
    assembled.files["timemachine"]["seasons"][0]["pool"] = 3


def wrong_pick(sources: export.Sources, assembled: export.Assembled) -> None:
    assembled.files["timemachine"]["seasons"][0]["picks"][0]["id"] = "12"


Change = Callable[[export.Sources, export.Assembled], export.Sources | None]
FAILING: list[tuple[int, Change]] = [
    (1, drop_column), (1, empty_table), (2, poor_minutes), (3, long_season),
    (4, no_birth_date), (5, wild_factor), (6, weak_correlation), (7, trained_on_test),
    (8, bad_rows), (9, lost_tier), (10, self_similar), (11, foreign_number),
    (13, late_training), (14, short_pool), (15, wrong_pick),
]  # fmt: skip


@pytest.mark.parametrize(("number", "change"), FAILING, ids=lambda v: str(v)[:24])
def test_each_check_fails_on_data_that_breaks_its_rule(number: int, change: Change) -> None:
    data = data_after(change)
    name = next(n for i, n, _ in checks.CHECKS if i == number)
    with pytest.raises(StepError, match=rf"quality check {number} \({name}\) failed"):
        checks.run_checks(data)


def test_check_6_names_england_when_another_league_is_lowest() -> None:
    sources = make_sources()
    table = sources.leagues.copy()
    table.loc[table["league_id"] == "IT1", "factor"] = 0.5
    data = export.check_data(
        dataclasses.replace(sources, leagues=table), export.assemble(sources, NOW)
    )
    with pytest.raises(StepError, match="IT1"):
        checks.run_checks(data)


def test_the_fifteen_checks_are_numbered_in_order() -> None:
    assert [number for number, _, _ in checks.CHECKS] == list(range(1, 16))


# The `all` command.
def test_all_runs_the_steps_in_order(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    called: list[str] = []

    def fake(name: str) -> Callable[[argparse.Namespace], None]:
        def step(options: argparse.Namespace) -> None:
            called.append(name)
            if name == "export":
                (options.out / "meta.json").write_text(
                    '{"pool":{"up_to_1m":423}}', encoding="utf-8"
                )

        return step

    names = [name for name, _ in cli.pipeline_steps()]
    assert names == ["ingest", "seasons", "rebuild", "values", "leagues", "rating", "model",
                     "backtest", "tiers", "timemachine", "notes", "export"]  # fmt: skip
    tmp_path.mkdir(exist_ok=True)
    monkeypatch.setattr(cli, "pipeline_steps", lambda: [(n, fake(n)) for n in names])
    assert cli.main(["all", "--out", str(tmp_path)]) == 0
    assert called == names
    assert capsys.readouterr().out.strip().splitlines()[-1] == "pool size: 423"


# The real tables.
def test_real_tables_export(tmp_path: Path) -> None:
    work, raw = config.work_dir(), config.raw_dir()
    needed = [work / export.TIERS_FILE, work / export.TIER_STATS_FILE, work / export.LISTS_FILE]
    if not raw.is_dir() or not all(p.is_file() for p in needed):
        pytest.skip("the real tables or the three parallel inputs are not present")
    result = export.run_export(raw, work, tmp_path / "data", NOW)
    for name in FILES:
        contract.validate_file(name, tmp_path / "data" / f"{name}.json")
    assert sum(result.sizes.values()) < export.MAX_TOTAL_BYTES
    assert result.pool > 0 and len(result.outcomes) == 15


def test_failed_move_restores_the_previous_files(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    assembled = export.assemble(make_sources(), NOW)
    calls = {"n": 0}
    real = export.move_file

    def third_fails(source: Path, destination: Path) -> None:
        calls["n"] += 1
        if calls["n"] == 3:
            raise OSError("disk full")
        real(source, destination)

    full, empty = tmp_path / "full", tmp_path / "empty"
    export.write_files(assembled.files, full)
    before = snapshot(full)
    newer = copy.deepcopy(assembled.files)
    newer["meta"]["status"] = "changed"
    newer["players"] = newer["players"][:3]
    monkeypatch.setattr(export, "move_file", third_fails)
    for folder in (full, empty):
        calls["n"] = 0
        with pytest.raises(StepError, match=r"evidence\.json was not written"):
            export.write_files(newer, folder)
    assert snapshot(full) == before
    assert not list(empty.iterdir())
    assert sorted(p.name for p in tmp_path.iterdir()) == ["empty", "full"]


def test_pool_player_without_value_fails_check_4_and_writes_nothing(tmp_path: Path) -> None:
    sources = make_sources()
    rated = sources.rated.copy()
    rated.loc[rated["player_id"] == 3, "value_decision"] = float("nan")
    rated.loc[rated["player_id"] == 3, "value_decision_date"] = None
    sources = dataclasses.replace(sources, rated=rated)
    out = tmp_path / "data"
    with pytest.raises(StepError, match=r"quality check 4 \(pool basics\) failed"):
        run(out, sources)
    assert not out.exists()


def test_nan_in_a_record_stops_the_write_and_names_the_file(tmp_path: Path) -> None:
    assembled = export.assemble(make_sources(), NOW)
    assembled.files["players"][0]["ga90"] = float("nan")
    with pytest.raises(StepError, match=r"players\.json cannot be written"):
        export.write_files(assembled.files, tmp_path / "data")
    assert not (tmp_path / "data").exists() or not list((tmp_path / "data").iterdir())


def test_an_impossible_height_is_exported_as_null() -> None:
    src = make_sources()
    people = src.players.copy()
    people.loc[people["player_id"] == 1, "height_in_cm"] = 19.0
    people.loc[people["player_id"] == 2, "height_in_cm"] = 190.0
    built, _, _ = export.build_players(dataclasses.replace(src, players=people))
    heights = {r["id"]: r["height_cm"] for r in built}
    assert heights["1"] is None and heights["2"] == 190
    assert heights["3"] == 180
