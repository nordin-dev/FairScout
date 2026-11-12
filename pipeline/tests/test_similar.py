"""Tests of the similar players, grouped by acceptance criterion, on hand-made profiles."""

import dataclasses
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd
import pytest

from fairscout import checks, config, export, similar
from tests import test_export as te

PLAIN = {"g90_adj": 0.2, "a90_adj": 0.1, "role": 0.5, "height_in_cm": 180.0, "foot": "right"}


def table(rows: list[dict[str, Any]]) -> pd.DataFrame:
    """One row per player; every part not given is the same for all players (no spread)."""
    return pd.DataFrame(
        [
            {"player_id": i + 1, "position_group": "Attack", **PLAIN, **row}
            for i, row in enumerate(rows)
        ]
    )


def ages(values: list[float]) -> pd.DataFrame:
    return table([{"age": a} for a in values])


# Criterion 1: up to three similar players of the group, most similar first.
def test_three_nearest_in_order_on_a_hand_checked_group() -> None:
    result = similar.find_similar(ages([20, 21, 22, 23, 30]))
    assert [e["id"] for e in result["1"]] == ["2", "3", "4"]
    assert [e["id"] for e in result["5"]] == ["4", "3", "2"]
    assert len(result["3"]) == 3


def test_only_players_of_the_same_group_are_listed() -> None:
    frame = ages([20, 21, 22, 23, 24, 25, 26, 27])
    frame["position_group"] = ["Attack"] * 4 + ["Midfield"] * 4
    result = similar.find_similar(frame)
    assert {e["id"] for e in result["1"]} == {"2", "3", "4"}
    assert {e["id"] for e in result["8"]} == {"5", "6", "7"}


# Criterion 2: never himself.
def test_a_player_is_never_in_his_own_list() -> None:
    result = similar.find_similar(ages([20, 20, 20, 20, 20, 25]))
    assert all(pid not in [e["id"] for e in lst] for pid, lst in result.items())


# Criterion 3: the percentage.
def test_percentage_follows_the_formula_with_a_hand_computed_percentile() -> None:
    result = similar.find_similar(ages([20, 21, 22, 23, 30]))
    # Only age varies, so every distance is the age gap in deviations; the deviation cancels.
    # Pair gaps sorted: 1 1 1 2 2 3 7 8 9 10, the 95th percentile is 9 + 0.55 * 1 = 9.55.
    expected = [round(100 * (1 - gap / 9.55)) for gap in (1, 2, 3)]
    assert [e["similarity"] for e in result["1"]] == expected == [90, 79, 69]


def test_similarity_is_whole_and_never_below_zero() -> None:
    result = similar.find_similar(ages([20, 21, 22, 23, 24, 25, 26, 90]))
    scores = [e["similarity"] for lst in result.values() for e in lst]
    assert all(isinstance(s, int) and 0 <= s <= 100 for s in scores)
    assert similar.similarity_of(50.0, 10.0) == 0


def test_ties_are_broken_by_player_id() -> None:
    result = similar.find_similar(ages([20, 21, 19, 21, 19, 40]))
    assert [e["id"] for e in result["1"]][:4] == ["2", "3", "4"]


# Criterion 5: a small group.
def test_a_group_of_three_gets_empty_lists_and_no_error() -> None:
    assert similar.find_similar(ages([20, 21, 22])) == {"1": [], "2": [], "3": []}


def test_missing_height_and_unknown_foot_and_no_spread() -> None:
    frame = table(
        [
            {"age": 20, "height_in_cm": None, "foot": None},
            {"age": 21, "height_in_cm": 180.0, "foot": "left"},
            {"age": 22, "height_in_cm": 182.0, "foot": "right"},
            {"age": 23, "height_in_cm": 178.0, "foot": float("nan")},
        ]
    )
    result = similar.find_similar(frame)
    assert all(len(lst) == 3 for lst in result.values())
    flat = table([{"age": 20}, {"age": 20}, {"age": 20}, {"age": 20}])
    assert [e["similarity"] for e in similar.find_similar(flat)["1"]] == [100, 100, 100]


# Criterion 4: the sentence.
def pair(**changes: float | str | None) -> dict[str, Any]:
    """The sentence of player 1 against player 2, the others only give the groups some spread."""
    base: list[dict[str, Any]] = [{"age": 20}, {"age": 20}, {"age": 20}, {"age": 20}]
    base[1].update(changes)
    result = similar.find_similar(table(base))
    return next(e for e in result["1"] if e["id"] == "2")


@pytest.mark.parametrize(
    ("changes", "text"),
    [
        ({"age": 21.4}, "older by 1.4 years"),
        ({"age": 19.2}, "younger by 0.8 years"),
        ({"height_in_cm": 186.0}, "taller by 6 cm"),
        ({"height_in_cm": 176.0}, "shorter by 4 cm"),
        ({"g90_adj": 0.32}, "0.12 more goals per 90"),
        ({"a90_adj": 0.02}, "0.08 fewer assists per 90"),
        ({"role": 0.9}, "larger role in his team"),
        ({"role": 0.1}, "smaller role in his team"),
        ({"foot": "left"}, "other foot"),
        ({"foot": None}, "similar overall"),
    ],
)
def test_the_sentence_names_the_largest_difference(changes: dict[str, Any], text: str) -> None:
    diff = pair(**changes)["diff"]
    assert diff == text and len(diff.split()) <= 6


def test_a_filled_height_is_never_reported_as_a_difference() -> None:
    # Player 1 has no height; the filled median would make him far from the very tall player 5.
    heights = [None, 170.0, 171.0, 172.0, 230.0]
    frame = table([{"age": 20, "height_in_cm": h} for h in heights])
    result = similar.find_similar(frame)
    for entry_ in result["1"]:
        assert "cm" not in entry_["diff"]
    for pid in ("2", "3", "4", "5"):
        assert all("cm" not in e["diff"] for e in result[pid] if e["id"] == "1")


def test_an_impossible_height_counts_as_not_known() -> None:
    heights = [19.0, 178.0, 180.0, 182.0, 184.0]
    frame = table([{"age": 20 + i, "height_in_cm": h} for i, h in enumerate(heights)])
    result = similar.find_similar(frame)
    for pid in ("2", "3", "4", "5"):
        assert all("cm" not in e["diff"] for e in result[pid] if e["id"] == "1")
    assert all("cm" not in e["diff"] for e in result["1"])
    # The spread of the group is the same with and without that player.
    group = frame.iloc[1:]
    with_him = similar.numeric_column(frame, "height_in_cm")
    without = similar.numeric_column(group, "height_in_cm")
    assert similar.standardise(with_him[1:]).tolist() == pytest.approx(
        similar.standardise(without).tolist()
    )
    assert (
        similar.known_values(frame, "height_in_cm")[0]
        != similar.known_values(frame, "height_in_cm")[0]
    )


def test_a_missing_age_gives_a_sentence_about_another_part_and_no_nan() -> None:
    ages_ = [None, 21, 22, 23]
    roles = [0.2, 0.6, 0.5, 0.4]
    frame = table([{"age": a, "role": r} for a, r in zip(ages_, roles, strict=True)])
    result = similar.find_similar(frame)
    assert pair_after(frame, "1", "2") == "larger role in his team"
    diffs = [e["diff"] for lst in result.values() for e in lst]
    assert all("nan" not in d for d in diffs)
    assert all("years" not in e["diff"] for e in result["1"])


def pair_after(frame: pd.DataFrame, me: str, other: str) -> str:
    return next(e["diff"] for e in similar.find_similar(frame)[me] if e["id"] == other)


# Criterion 2 and 6: check 10 and the export.
def entry(pid: str) -> dict[str, Any]:
    return {"id": pid, "similarity": 50, "diff": "older by 1.0 years"}


def one_big_group() -> export.Sources:
    sources = te.make_sources()
    rated = sources.rated.copy()
    rated.loc[rated["in_pool"], "position_group"] = "Midfield"
    return dataclasses.replace(sources, rated=rated)


@pytest.mark.parametrize(
    ("kind", "message"),
    [
        ("self", "himself"),
        ("outside", "not in the pool"),
        ("fourth", "at most 3"),
        ("score", "whole number"),
        ("nan", "not a number"),
        ("height", "height"),
    ],
)
def test_check_10_fails_on_self_outside_pool_fourth_entry_and_bad_score(
    kind: str, message: str
) -> None:
    sources = one_big_group()
    assembled = export.assemble(sources, te.NOW)
    first = assembled.files["players"][0]
    same = next(e["id"] for e in first["similar"])
    entries = {
        "self": [entry(first["id"])],
        "outside": [entry("7")],
        "fourth": [entry(same)] * 4,
        "score": [{**entry(same), "similarity": 101}],
        "nan": [{**entry(same), "diff": "younger by nan years"}],
        "height": [{**entry(same), "diff": "taller by 6 cm"}],
    }[kind]
    first["height_cm"] = None
    first["similar"] = entries
    data = export.check_data(sources, assembled)
    verdict = checks.check_10_not_similar_to_self(data)
    assert not verdict.passed and first["id"] in verdict.message and message in verdict.message


def test_export_fills_similar_for_the_pool_only_and_changes_nothing_else(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sources = one_big_group()
    with_lists = export.assemble(sources, te.NOW).files["players"]
    monkeypatch.setattr(export.similar, "find_similar", lambda pool: {})
    without = export.assemble(sources, te.NOW).files["players"]
    assert [{**r, "similar": []} for r in with_lists] == without
    assert all(r["similar"] == [] for r in with_lists if not r["in_pool"])
    pool_ids = {r["id"] for r in with_lists if r["in_pool"]}
    listed = [e["id"] for r in with_lists for e in r["similar"]]
    assert listed and set(listed) <= pool_ids


def test_two_runs_give_identical_lists() -> None:
    first = export.assemble(one_big_group(), te.NOW).files["players"]
    second = export.assemble(one_big_group(), te.NOW).files["players"]
    assert [r["similar"] for r in first] == [r["similar"] for r in second]


def test_the_schema_says_a_display_scale() -> None:
    text = (Path(__file__).parents[2] / "contract" / "players.schema.json").read_text("utf-8")
    assert "a display scale, not a probability" in text


# The real tables.
def test_real_tables_every_pool_player_of_a_big_group_has_three() -> None:
    work, raw = config.work_dir(), config.raw_dir()
    needed = [work / export.TIERS_FILE, work / export.TIER_STATS_FILE, work / export.LISTS_FILE]
    if not raw.is_dir() or not all(p.is_file() for p in needed):
        pytest.skip("the real tables or the three parallel inputs are not present")
    src = export.read_sources(raw, work)
    assembled = export.assemble(src, datetime(2026, 11, 12, tzinfo=UTC))
    pool = [p for p in assembled.files["players"] if p["in_pool"]]
    sizes = pd.Series([p["position_group"] for p in pool]).value_counts()
    for record in pool:
        want = 3 if sizes[record["position_group"]] >= similar.MIN_GROUP else 0
        assert len(record["similar"]) == want
    data = export.check_data(src, assembled)
    assert checks.check_10_not_similar_to_self(data).passed


def test_a_height_is_known_only_as_a_number_inside_the_bounds() -> None:
    assert similar.plausible_height(similar.MIN_HEIGHT_CM) == float(similar.MIN_HEIGHT_CM)
    assert similar.plausible_height(similar.MAX_HEIGHT_CM) == float(similar.MAX_HEIGHT_CM)
    assert similar.plausible_height("183") == 183.0
    below, above = similar.MIN_HEIGHT_CM - 1, similar.MAX_HEIGHT_CM + 1
    for unknown in (below, above, 19, "tall", None, float("nan")):
        assert similar.plausible_height(unknown) is None

