"""The five sample files match their schemas, and wrong files are refused with a clear message."""

import copy
import json
from pathlib import Path
from typing import Any

import pytest

from fairscout import contract
from fairscout.contract import FILES, ContractError, contract_dir, validate, validate_file


def _players() -> list[dict[str, Any]]:
    data: list[dict[str, Any]] = json.loads(
        (contract_dir() / "samples" / "players.json").read_text(encoding="utf-8")
    )
    return copy.deepcopy(data)


@pytest.mark.parametrize("name", FILES)
def test_sample_passes_its_schema(name: str) -> None:
    validate_file(name, contract_dir() / "samples" / f"{name}.json")


def test_missing_required_field_names_file_and_field() -> None:
    players = _players()
    del players[1]["minutes"]
    with pytest.raises(ContractError, match=r"players\.json.*1\.minutes"):
        validate("players", players)


def test_tier_d_fails_and_names_the_field() -> None:
    players = _players()
    players[0]["tier"] = "D"
    with pytest.raises(ContractError, match=r"players\.json.*0\.tier"):
        validate("players", players)


def test_player_outside_pool_may_leave_tier_empty() -> None:
    player = _players()[0]
    player.update(
        in_pool=False,
        tier=None,
        score=None,
        score_rank_pct=None,
        note=None,
        note_source=None,
        drivers=[],
        similar=[],
    )
    validate("players", [player])


def test_player_in_pool_without_tier_fails() -> None:
    player = _players()[0]
    del player["tier"]
    with pytest.raises(ContractError, match=r"players\.json.*0\.tier"):
        validate("players", [player])


def test_misspelt_key_is_caught() -> None:
    player = _players()[0]
    player["minuts"] = player.pop("minutes")
    with pytest.raises(ContractError, match=r"players\.json"):
        validate("players", [player])


def test_unknown_file_name_is_refused() -> None:
    with pytest.raises(ContractError, match="unknown data file"):
        validate("clubs", {})


def _outside_pool() -> dict[str, Any]:
    return next(p for p in _players() if not p["in_pool"])


def test_sample_holds_a_bosnian_record_outside_the_pool() -> None:
    player = _outside_pool()
    assert player["citizenship"] == "Bosnia-Herzegovina"
    assert player["age"] > 21
    assert player["value_eur"] > 1_000_000
    validate("players", [player])


def test_outside_pool_record_with_a_tier_fails() -> None:
    player = _outside_pool()
    player["tier"] = "A"
    with pytest.raises(ContractError, match=r"players\.json.*0\.tier"):
        validate("players", [player])


def test_outside_pool_record_with_a_score_fails() -> None:
    player = _outside_pool()
    player["score"] = 0.4
    with pytest.raises(ContractError, match=r"players\.json.*0\.score"):
        validate("players", [player])


def test_outside_pool_record_with_a_reason_fails() -> None:
    player = _outside_pool()
    player["drivers"] = [{"sign": "+", "key": "age", "text": "Young"}]
    with pytest.raises(ContractError, match=r"players\.json.*0\.drivers"):
        validate("players", [player])


def test_outside_pool_record_with_a_similar_player_fails() -> None:
    player = _outside_pool()
    player["similar"] = [{"id": "sample-a", "similarity": 80, "diff": "Older."}]
    with pytest.raises(ContractError, match=r"players\.json.*0\.similar"):
        validate("players", [player])


def test_failure_message_is_short_and_holds_no_whole_record() -> None:
    player = _players()[0]
    player["note"] = "long text " * 100
    player["tier"] = "D"
    with pytest.raises(ContractError) as caught:
        validate("players", [player])
    message = str(caught.value)
    assert "0.tier" in message
    assert len(message) < 600
    assert player["name"] not in message
    assert player["note"] not in message


def test_only_five_problems_are_listed_with_the_number_of_the_rest() -> None:
    players = [_players()[0] for _ in range(8)]
    for player in players:
        player["tier"] = "D"
    with pytest.raises(ContractError, match=r"and 11 more"):
        validate("players", players)


def test_checker_is_built_once_for_two_validations(monkeypatch: pytest.MonkeyPatch) -> None:
    contract._build_validator.cache_clear()
    reads: list[Path] = []
    original = Path.read_text

    def counting(self: Path, encoding: str) -> str:
        if self.name == "meta.schema.json":
            reads.append(self)
        return original(self, encoding=encoding)

    monkeypatch.setattr(Path, "read_text", counting)
    path = contract_dir() / "samples" / "meta.json"
    validate_file("meta", path)
    validate_file("meta", path)
    assert len(reads) == 1
