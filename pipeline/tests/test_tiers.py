"""Tests of the step `tiers`, grouped by the acceptance criterion they prove.

The tables are small hand-made tables: no network. The last test reads the real tables when
they are present and skips itself when they are not.
"""

import copy
import hashlib
import json
from pathlib import Path
from typing import Any

import pandas as pd
import pytest

from fairscout import backtest, cli, config, features, model, rating, tiers
from fairscout.errors import StepError

LAST = pd.Timestamp("2026-06-01")
NAMES = list(features.FEATURES)
REPORT = {
    "budgets": [{"budget_eur": 1_000_000, "rows": [{"rule": "model_lr", "hits": 1, "picks": 1}]}]
}


def facts_of(coefficients: dict[str, float] | None = None) -> dict[str, Any]:
    """Facts with mean 0 and scale 1 for every feature, and the given coefficients."""
    given = coefficients or {}
    return {
        "features": NAMES,
        "coefficients": [given.get(n, 0.0) for n in NAMES],
        "means": [0.0] * len(NAMES),
        "scales": [1.0] * len(NAMES),
        "intercept": 0.0,
        "height_median": 180.0,
    }


def zero_rows(count: int = 1) -> pd.DataFrame:
    """Rows with every feature at zero (the mean)."""
    return pd.DataFrame({n: [0.0] * count for n in NAMES})


def past_pool(size: int, made: list[int], later: list[float | None]) -> pd.DataFrame:
    """One season of `size` past players in rank order with hand-set outcomes."""
    return pd.DataFrame(
        {
            "season": 2017,
            "player_id": range(size),
            "league_id": "IT1",
            "value_decision": 100.0,
            "value_later": later,
            "made_it": [bool(m) for m in made],
            "lr_rank": range(1, size + 1),
        }
    )


def test_cut_sizes_and_ties() -> None:
    """Criterion 1: the cut for several pool sizes; the counts add up; ties go by player id."""
    for size, expected in ((1, (1, 0, 0)), (4, (1, 0, 3)), (10, (1, 1, 8)), (425, (42, 43, 340))):
        labels = tiers.tier_labels(size)
        counts = tuple(labels.count(n) for n in tiers.TIER_NAMES)
        assert counts == expected and sum(counts) == size
    assert tiers.tier_labels(0) == []
    pool = pd.DataFrame({"player_id": [3, 1, 2], "score_lr": [0.5, 0.5, 0.1]})
    ranked = pool.sort_values(["score_lr", "player_id"], ascending=[False, True])
    assert list(ranked["player_id"]) == [1, 3, 2]


def test_rank_percent_bounds() -> None:
    """Criterion 1: the rank percent is a whole number from 0 to 100; the lowest scores 0."""
    pct = tiers.rank_percent(pd.Series([0.1, 0.2, 0.2, 0.9]))
    assert list(pct) == [0, 25, 25, 75]
    assert pct.between(0, 100).all()


def test_past_tier_statistics() -> None:
    """Criterion 2: hits, count, rate, percentiles and players with no later value."""
    later: list[float | None] = [300.0, 50.0, None, 100.0, 200.0, 100.0, 100.0, 100.0, 400.0, None]
    stats = tiers.tier_stats(past_pool(10, [1, 0, 0, 0, 1, 0, 0, 0, 1, 0], later))
    assert stats["A"] == {
        "share": "top 10%",
        "hits": 1,
        "n": 1,
        "rate": 1.0,
        "multiple_p25": 3.0,
        "multiple_p50": 3.0,
        "multiple_p75": 3.0,
        "no_later_value": 0,
        "share_lost_value": 0.0,
    }
    assert stats["B"]["hits"] == 0 and stats["B"]["multiple_p50"] == 0.5
    assert stats["B"]["share_lost_value"] == 1.0
    rest = stats["C"]
    assert (rest["n"], rest["hits"], rest["no_later_value"]) == (8, 2, 2)
    assert (rest["multiple_p25"], rest["multiple_p50"], rest["multiple_p75"]) == (1.0, 1.0, 1.0)
    assert rest["share_lost_value"] == 0.0


def test_tier_a_agrees_with_backtest() -> None:
    """Criterion 2: the A row equals the backtest's top 10%; a difference stops the run."""
    stats = tiers.tier_stats(past_pool(10, [1] + [0] * 9, [300.0] * 10))
    tiers.check_against_backtest(stats, REPORT)
    wrong = copy.deepcopy(REPORT)
    wrong["budgets"][0]["rows"][0]["hits"] = 2
    with pytest.raises(StepError, match="tier A has 1 hits of 1"):
        tiers.check_against_backtest(stats, wrong)


def test_contributions_pick_three_for_one_against() -> None:
    """Criterion 3: coefficient times standardised value; three for and one against."""
    coefficients = {
        "age": -0.5,
        "minutes": 0.4,
        "role": 0.3,
        "goals_per90": 0.2,
        "log_change": -0.1,
        "pos_attack": 1.0,
    }
    facts = facts_of(coefficients)
    facts["means"][NAMES.index("minutes")] = 10.0
    facts["scales"][NAMES.index("minutes")] = 2.0
    rows = zero_rows()
    rows["age"] = -2.0  # contribution +1.0, below the mean
    rows["minutes"] = 14.0  # standardised 2, contribution 0.8
    rows["role"] = 1.0  # 0.3
    rows["goals_per90"] = 1.0  # 0.2, the fourth best, left out
    rows["log_change"] = 3.0  # -0.3, against
    rows["height"] = float("nan")
    parts = tiers.contributions(rows, facts)
    assert parts.loc[0, "minutes"] == pytest.approx(0.8)
    drivers = json.loads(tiers.build_drivers(rows, facts)[0])
    assert [(d["sign"], d["key"]) for d in drivers] == [
        ("+", "age"),
        ("+", "minutes"),
        ("+", "role"),
        ("-", "log_change"),
    ]
    assert drivers[0]["text"] == "Young for his level"
    assert drivers[1]["text"] == "Plays a lot"
    assert drivers[3]["text"] == "Value rising fast"


def test_every_phrase_is_short_and_complete() -> None:
    """Criterion 3: both phrases of every model feature, four words or fewer."""
    assert set(tiers.PHRASES) == set(features.FEATURES)
    assert sum(len(pair) for pair in tiers.PHRASES.values()) == 38
    for pair in tiers.PHRASES.values():
        for phrase in pair:
            assert 1 <= len(phrase.split()) <= tiers.MAX_WORDS


def test_feature_without_phrase_stops_the_run(monkeypatch: pytest.MonkeyPatch) -> None:
    """Criterion 5: a feature without a phrase stops the run and is named."""
    monkeypatch.delitem(tiers.PHRASES, "assists_per90")
    with pytest.raises(StepError, match="assists_per90"):
        tiers.build_drivers(zero_rows(), facts_of())


def test_tier_a_player_with_one_reason_stops_the_run() -> None:
    """Criterion 3: a tier A or B player with one reason stops the run and is named."""
    one = [{"sign": "+", "key": "age", "text": "Young for his level"}]
    two = [*one, {"sign": "-", "key": "role", "text": "Fringe role in team"}]
    table = pd.DataFrame(
        {"player_id": [7, 8], "tier": ["B", "C"], "drivers": [json.dumps(two), json.dumps(one)]}
    )
    tiers.check_table(table)
    table.loc[0, "drivers"] = json.dumps(one)
    with pytest.raises(StepError, match="player 7"):
        tiers.check_table(table)
    with pytest.raises(StepError, match="do not add up"):
        tiers.check_table(pd.DataFrame({"player_id": [1], "tier": ["D"], "drivers": ["[]"]}))


def flag(column: str, **row: str | int | None) -> bool:
    """Return one flag of a one-player table built from safe defaults and the changes."""
    base: dict[str, Any] = {
        "date_of_birth": "2000-05-05",
        "contract_expiration_date": None,
        "minutes": 2000,
        "position_group": "Attack",
    }
    base.update(row)
    return bool(tiers.compute_flags(pd.DataFrame([base]), LAST).loc[0, column])


def test_flags_on_both_sides_of_their_limit() -> None:
    """Criterion 4: each of the five flags, on both sides of its limit, always true or false."""
    assert flag("flag_under18", date_of_birth="2008-06-02")
    assert not flag("flag_under18", date_of_birth="2008-06-01")
    assert flag("flag_low_sample", minutes=899)
    assert not flag("flag_low_sample", minutes=900)
    assert flag("flag_contract_ending", contract_expiration_date="2027-06-01")
    assert not flag("flag_contract_ending", contract_expiration_date="2027-06-02")
    assert not flag("flag_contract_ending", contract_expiration_date="2026-05-31")
    assert not flag("flag_contract_ending", contract_expiration_date=None)
    assert flag("flag_born_q4", date_of_birth="2005-10-01")
    assert not flag("flag_born_q4", date_of_birth="2005-09-30")
    assert flag("flag_limited_position_data", position_group="Goalkeeper")
    assert flag("flag_limited_position_data", position_group="Defender")
    assert not flag("flag_limited_position_data", position_group="Midfield")
    empty = pd.DataFrame(
        [
            {
                "date_of_birth": None,
                "contract_expiration_date": None,
                "minutes": 5,
                "position_group": None,
            }
        ]
    )
    result = tiers.compute_flags(empty, LAST)
    assert result.dtypes.eq(bool).all() and list(result.columns) == list(tiers.FLAG_COLUMNS)


def test_source_last_date_is_latest_match(tmp_path: Path) -> None:
    """The reference date of the flags is the latest match date of the table `games`."""
    pd.DataFrame({"date": ["2026-07-06", "2025-01-01", "2026-06-12"]}).to_csv(
        tmp_path / config.table_file("games"), index=False
    )
    assert tiers.source_last_date(tmp_path) == pd.Timestamp("2026-07-06")


def test_missing_input_gives_one_error_line(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """A missing input gives one `error:` line and exit code 1."""
    monkeypatch.setenv(config.DATA_ENV, str(tmp_path))
    assert cli.main(["tiers"]) == 1
    err = capsys.readouterr().err.strip().splitlines()
    assert len(err) == 1 and err[0].startswith("error: ")


def digest(folder: Path) -> dict[str, str]:
    """Return the hash of every file under a folder."""
    return {
        str(p): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(folder.rglob("*"))
        if p.is_file()
    }


def small_data(root: Path) -> tuple[Path, Path]:
    """Write a complete small data folder: 20 pool players and the tables the step reads."""
    raw, work = root / "raw", root / "work"
    raw.mkdir(parents=True)
    work.mkdir()
    size = 20
    ids = list(range(1, size + 1))
    key = {"player_id": ids, "season": 2025, "league_id": "IT1"}
    scores = pd.DataFrame({**key, "score_lr": [0.01 * i for i in ids], "score_gb": 0.5})
    shape = [(i * 7) % 11 / 10 for i in range(size)]
    feats = pd.DataFrame({**key, **{n: [v + j for v in shape] for j, n in enumerate(NAMES)}})
    feats["height"] = float("nan")
    rated = pd.DataFrame({**key, "position_group": ["Defender", "Attack"] * 10})
    past_pool(10, [1, 0, 0, 0, 1, 0, 0, 0, 1, 0], [300.0] * 10).to_csv(
        work / backtest.POOLS_FILE, index=False
    )
    scores.to_csv(work / model.SCORES_FILE, index=False)
    feats.to_csv(work / model.FEATURES_FILE, index=False)
    rated.to_csv(work / rating.RATED_FILE, index=False)
    facts = facts_of({n: 0.1 * (-1) ** i for i, n in enumerate(NAMES)})
    (work / model.FACTS_FILE).write_text(json.dumps(facts), encoding="utf-8")
    (work / backtest.REPORT_FILE).write_text(json.dumps(REPORT), encoding="utf-8")
    people = pd.DataFrame(
        {
            "player_id": ids,
            "date_of_birth": "2007-11-11",
            "contract_expiration_date": "2027-01-01",
        }
    )
    people.to_csv(raw / config.table_file("players"), index=False)
    pd.DataFrame({"date": ["2026-05-01", "2026-06-01"]}).to_csv(
        raw / config.table_file("games"), index=False
    )
    return raw, work


def test_step_is_repeatable_and_leaves_inputs_alone(tmp_path: Path) -> None:
    """Criterion 6: only the two work files are written; two runs give identical files."""
    raw, work = small_data(tmp_path)
    before = digest(tmp_path)
    first = tiers.write_tiers(raw, work)
    after = digest(tmp_path)
    new = set(after) - set(before)
    assert {Path(p).name for p in new} == {tiers.TIERS_FILE, tiers.STATS_FILE}
    assert all(after[p] == before[p] for p in before)
    assert [first.table["tier"].tolist().count(n) for n in tiers.TIER_NAMES] == [2, 2, 16]
    assert first.table["flag_under18"].dtype == bool
    tiers.write_tiers(raw, work)
    assert digest(tmp_path) == after


def test_real_tables() -> None:
    """Criteria 1 and 3 on the real tables; skips itself when the data folder is missing."""
    work = config.work_dir()
    needed = [model.SCORES_FILE, tiers.TIERS_FILE, tiers.STATS_FILE]
    if not all((work / name).is_file() for name in needed):
        pytest.skip("real tables not present")
    table = pd.read_csv(work / tiers.TIERS_FILE)
    assert table["tier"].value_counts().sum() == len(pd.read_csv(work / model.SCORES_FILE))
    top = table.loc[table["tier"].isin(["A", "B"]), "drivers"]
    assert all(len(json.loads(d)) >= 2 for d in top)
    assert set(table.columns) == set(tiers.TIERS_COLUMNS)
