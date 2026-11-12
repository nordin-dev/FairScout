"""Tests of the scout notes, grouped by acceptance criterion; the program is a fake script."""

import dataclasses
import json
import stat
import sys
from pathlib import Path
from typing import Any

import pytest

from fairscout import checks, export, notes
from tests import test_export as te

MARK = "SECRET-OUTPUT-OF-THE-PROGRAM"
HEAD = f"#!{sys.executable}\nimport json, sys, time\n"
READ = "batch = json.loads(sys.stdin.read().splitlines()[-1])\n"
GOOD = (
    "notes = [{'id': r['id'], 'note': f\"Scored {r['goals']} goals in {r['minutes']} minutes.\"}"
    " for r in batch]\n"
)
ANSWER = "print(json.dumps({'structured_output': {'notes': notes}}))\n"


@pytest.fixture(autouse=True)
def fake_fixtures(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv(notes.ENV_SETTING, raising=False)
    monkeypatch.setenv("PATH", str(tmp_path / "none"))


def install(tmp_path: Path, monkeypatch: pytest.MonkeyPatch, body: str) -> None:
    """Put a fake `claude` on the path; it reads the batch and then runs `body`."""
    folder = tmp_path / "bin"
    folder.mkdir()
    program = folder / "claude"
    program.write_text(HEAD + READ + body, encoding="utf-8")
    program.chmod(program.stat().st_mode | stat.S_IEXEC)
    monkeypatch.setenv("PATH", str(folder))


def records() -> list[dict[str, Any]]:
    built, _, _ = export.build_players(te.make_sources())
    return built


def inputs() -> list[dict[str, Any]]:
    return notes.pool_inputs(records(), te.make_sources().tier_stats)


def entry(note: str, source: str, pid: str) -> dict[str, str]:
    """A notes.json entry with the stamp of the player's current input record."""
    rec = next(r for r in inputs() if r["id"] == pid)
    return {"note": note, "source": source, "input": notes.input_stamp(rec)}


def sources_of(entries: dict[str, Any] | None) -> export.Sources:
    return dataclasses.replace(te.make_sources(), notes=entries)


# Criterion 3: the program gives model notes, and each note records its source.
def test_a_good_answer_gives_model_notes(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    install(tmp_path, monkeypatch, GOOD + ANSWER)
    run = notes.make_notes(inputs())
    assert len(run.entries) == 6
    assert {e["source"] for e in run.entries.values()} == {"model"}
    assert run.entries["1"]["note"].startswith("Scored ")
    assert run.fallbacks == 0 and not run.reasons


def test_the_numbers_of_the_card_in_its_forms_pass_the_check() -> None:
    rec = inputs()[0]
    price = rec["price"]
    share = rec["share_of_past_players_of_this_tier_who_made_it_pct"]
    for text in (
        f"Priced at {price}, tier {rec['outlook_tier']}.",
        f"Priced at {rec['price'][1:]} and {share}% of his tier made it.",
        f"{rec['age']}-year-old with {rec['minutes']:,} minutes.",
    ):
        assert notes.note_problem(text, rec) is None, text


# Criterion 4: every way the program can fail gives template sentences and a counted reason.
def test_program_missing_gives_templates_and_the_reason() -> None:
    run = notes.make_notes(inputs())
    assert {e["source"] for e in run.entries.values()} == {"template"}
    assert run.reasons == {notes.REASON_MISSING: 6}


@pytest.mark.parametrize(
    ("body", "reason"),
    [
        (f"print('{MARK}', file=sys.stderr); sys.exit(1)\n", notes.REASON_FAILED),
        (f"print('{MARK} Not logged in'); sys.exit(1)\n", notes.REASON_NOT_SIGNED_IN),
        (
            "print(json.dumps({'is_error': True, 'result': 'Please run /login'}))\n",
            notes.REASON_NOT_SIGNED_IN,
        ),
        ("time.sleep(10)\n", notes.REASON_TIMED_OUT),
        (f"print('{MARK} not json')\n", notes.REASON_UNUSABLE),
        ("print(json.dumps({'structured_output': {'other': 1}}))\n", notes.REASON_UNUSABLE),
    ],
    ids=["exit", "signed-out-exit", "signed-out-json", "timeout", "not-json", "wrong-shape"],
)
def test_a_failing_program_gives_templates_and_the_run_goes_on(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, body: str, reason: str
) -> None:
    install(tmp_path, monkeypatch, body)
    run = notes.make_notes(inputs(), timeout=1)
    assert len(run.entries) == 6
    assert {e["source"] for e in run.entries.values()} == {"template"}
    assert run.reasons == {reason: 6}


def test_an_answer_with_a_missing_player_gives_a_template_for_him_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    install(tmp_path, monkeypatch, GOOD + "notes = notes[1:]\n" + ANSWER)
    run = notes.make_notes(inputs())
    assert run.entries["1"]["source"] == "template"
    assert {run.entries[str(i)]["source"] for i in range(2, 7)} == {"model"}
    assert run.reasons == {notes.REASON_NO_NOTE: 1}


# Criterion 5: a note that fails a check is replaced.
@pytest.mark.parametrize(
    ("text", "reason"),
    [
        ("Scored 77777 goals.", notes.REASON_NUMBERS),
        ("Has three goals.", notes.REASON_NUMBERS),
        ("One. Two. Three.", notes.REASON_LENGTH),
        (" ".join(["word"] * 30), notes.REASON_LENGTH),
    ],
    ids=["foreign-number", "number-word", "three-sentences", "thirty-words"],
)
def test_a_note_that_fails_a_check_is_replaced_by_the_template(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, text: str, reason: str
) -> None:
    install(
        tmp_path,
        monkeypatch,
        f"notes = [{{'id': r['id'], 'note': {text!r}}} for r in batch]\n" + ANSWER,
    )
    run = notes.make_notes(inputs())
    assert {e["source"] for e in run.entries.values()} == {"template"}
    assert run.reasons == {reason: 6}
    assert run.entries["1"]["note"] == notes.template_note(inputs()[0])


def test_a_decimal_inside_a_sentence_does_not_end_it() -> None:
    assert notes.length_problem("Averages 0.6 per match. Young for his level.") is None
    assert notes.length_problem("Averages 0.6 per match. Good. Young.") == notes.REASON_LENGTH


def test_a_note_for_another_player_id_is_not_taken(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    install(tmp_path, monkeypatch, GOOD + "for n in notes: n['id'] = '99' + n['id']\n" + ANSWER)
    run = notes.make_notes(inputs())
    assert run.reasons == {notes.REASON_NO_NOTE: 6}


# The template: its own numbers, no model, passes the checks by construction.
def test_the_template_passes_its_own_checks_for_a_goalkeeper_with_zero_goals() -> None:
    rec = dict(inputs()[0], position="Goalkeeper", goals=0, assists=0, minutes=2310)
    text = notes.template_note(rec)
    assert text.startswith(f"{rec['age']}-year-old Goalkeeper with 0 goals and 0 assists")
    assert notes.note_problem(text, rec) is None
    assert "model" not in text.lower()


def test_every_template_of_the_pool_passes_the_checks() -> None:
    for rec in inputs():
        assert notes.note_problem(notes.template_note(rec), rec) is None


# Criterion 3 and 6: one setting, no program in template mode, nothing of the program printed.
def test_template_setting_never_starts_the_program(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    started = tmp_path / "started"
    install(tmp_path, monkeypatch, f"open({str(started)!r}, 'w').close()\n" + GOOD + ANSWER)
    monkeypatch.setenv(notes.ENV_SETTING, "template")
    run = notes.write_notes(records(), te.make_sources().tier_stats, tmp_path)
    assert not started.exists()
    assert run.reasons == {notes.REASON_TEMPLATE_MODE: 6}
    monkeypatch.setenv(notes.ENV_SETTING, "other")
    with pytest.raises(notes.StepError, match=notes.ENV_SETTING):
        notes.write_notes(records(), te.make_sources().tier_stats, tmp_path)


def test_the_counts_per_reason_are_printed_and_nothing_of_the_program(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    body = GOOD + "notes[0]['note'] = 'Scored 77777.'\nnotes[1]['note'] = 'One. Two. Three.'\n"
    install(tmp_path, monkeypatch, body + f"print('{MARK}', file=sys.stderr)\n" + ANSWER)
    run = notes.write_notes(records(), te.make_sources().tier_stats, tmp_path)
    lines = run.report()
    assert "from the model: 4" in lines and "from a template (fallbacks): 2" in lines
    assert f"  {notes.REASON_NUMBERS}: 1" in lines and f"  {notes.REASON_LENGTH}: 1" in lines
    written = json.loads((tmp_path / notes.NOTES_FILE).read_text(encoding="utf-8"))
    assert set(written) == {"1", "2", "3", "4", "5", "6"}
    shown = capsys.readouterr()
    assert MARK not in shown.out + shown.err + "\n".join(lines)


def test_the_command_line_is_an_argument_list_in_print_mode_with_json_output() -> None:
    command = notes.program_command("/path/claude")
    assert command[:4] == ["/path/claude", "-p", "--output-format", "json"]
    assert "--json-schema" in command and "--bare" not in command
    assert not any("KEY" in part.upper() for part in command)


# Criterion 2 and 7: check 11 tests the assembled data; the export changes nothing else.
def test_check_11_fails_on_a_foreign_number_and_on_a_pool_record_without_a_note() -> None:
    sources = te.make_sources()
    assembled = export.assemble(sources, te.NOW)
    assert checks.check_11_notes_use_own_numbers(export.check_data(sources, assembled)).passed
    first = assembled.files["players"][0]
    first["note"] = "Scored 77777 goals"
    bad = checks.check_11_notes_use_own_numbers(export.check_data(sources, assembled))
    assert not bad.passed and "player 1" in bad.message
    first["note"], first["note_source"] = None, None
    assert not checks.check_11_notes_use_own_numbers(export.check_data(sources, assembled)).passed


def test_check_11_fails_on_a_note_outside_the_pool_and_on_a_long_note() -> None:
    sources = te.make_sources()
    assembled = export.assemble(sources, te.NOW)
    players = assembled.files["players"]
    outside = next(p for p in players if not p["in_pool"])
    outside["note"], outside["note_source"] = "A note", "template"
    assert not checks.check_11_notes_use_own_numbers(export.check_data(sources, assembled)).passed
    outside["note"] = outside["note_source"] = None
    players[0]["note"] = "Scored 77777 goals."
    assert not checks.check_11_notes_use_own_numbers(export.check_data(sources, assembled)).passed


def test_the_export_fills_notes_and_sources_and_changes_nothing_else() -> None:
    plain, _, _ = export.build_players(sources_of(None))
    pool = [r for r in plain if r["in_pool"]]
    assert all(r["note_source"] == "template" and r["note"] for r in pool)
    assert all(r["note"] is None and r["note_source"] is None for r in plain if not r["in_pool"])
    entries = {"1": entry("Scored 3 goals.", "model", "1")}
    with_notes, _, _ = export.build_players(sources_of(entries))
    by_id = {r["id"]: r for r in with_notes}
    assert by_id["1"]["note"] == "Scored 3 goals." and by_id["1"]["note_source"] == "model"
    assert by_id["2"]["note_source"] == "template"

    def stripped(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [{k: v for k, v in r.items() if k not in ("note", "note_source")} for r in rows]

    assert stripped(with_notes) == stripped(plain)


def test_an_entry_in_the_file_that_fails_the_checks_gets_the_template() -> None:
    entries = {"1": entry("Scored 77777 goals.", "model", "1")}
    built, _, _ = export.build_players(sources_of(entries))
    first = next(r for r in built if r["id"] == "1")
    assert first["note_source"] == "template" and "77777" not in first["note"]


def test_reading_the_file_gives_none_when_missing_and_an_error_when_broken(
    tmp_path: Path,
) -> None:
    assert notes.read_notes(tmp_path) is None
    (tmp_path / notes.NOTES_FILE).write_text("[1", encoding="utf-8")
    with pytest.raises(notes.StepError, match="unreadable"):
        notes.read_notes(tmp_path)


def test_the_rating_is_the_output_percentile_and_not_the_score_rank() -> None:
    row = dict(records()[0], score_rank_pct=100)
    row["pct"] = dict(row["pct"], output=23)
    rec = notes.input_record(row, te.make_sources().tier_stats)
    assert rec["rating_out_of_100"] == 23 and "score_rank_pct" not in rec
    assert "Rating 23 of 100" in notes.template_note(rec)
    assert notes.note_problem("Rated 100 and young.", rec) == notes.REASON_NUMBERS
    assert notes.note_problem("Rated 23 of 100.", rec) is None


def test_a_broken_notes_file_is_replaced_by_the_notes_step(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from argparse import Namespace

    from fairscout import cli, config

    (tmp_path / notes.NOTES_FILE).write_text("[1", encoding="utf-8")
    seen: list[bool] = []

    def reader(raw: Path, work: Path, with_notes: bool = True) -> export.Sources:
        seen.append(with_notes)
        return sources_of(notes.read_notes(work) if with_notes else None)

    monkeypatch.setattr(export, "read_sources", reader)
    monkeypatch.setattr(config, "work_dir", lambda: tmp_path)
    monkeypatch.setenv(notes.ENV_SETTING, "template")
    cli.run_notes(Namespace())
    assert seen == [False]
    assert set(notes.read_notes(tmp_path) or {}) == {"1", "2", "3", "4", "5", "6"}


def test_the_stamp_is_16_hex_characters_of_the_input_record() -> None:
    stamp = notes.input_stamp(inputs()[0])
    assert len(stamp) == 16 and int(stamp, 16) >= 0
    assert stamp != notes.input_stamp(inputs()[1])


def test_an_entry_is_kept_only_with_the_stamp_of_the_current_input() -> None:
    good = entry("Scored 3 goals.", "model", "1")
    kept, _, _ = export.build_players(sources_of({"1": good}))
    assert next(r for r in kept if r["id"] == "1")["note"] == "Scored 3 goals."
    for changed in (dict(good, input="0" * 16), {k: v for k, v in good.items() if k != "input"}):
        built, _, _ = export.build_players(sources_of({"1": changed}))
        first = next(r for r in built if r["id"] == "1")
        assert first["note_source"] == "template" and first["note"] != "Scored 3 goals."
        assert set(first) == set(kept[0]) and "input" not in first


def test_per_90_and_of_100_do_not_count_as_numbers() -> None:
    rec = dict(inputs()[0], goals_plus_assists_per_90=0.45)
    assert notes.note_problem("Scored 0.45 per 90.", rec) is None
    assert notes.note_problem("Scored 0.45 per 91.", rec) == notes.REASON_NUMBERS


def test_the_child_process_does_not_see_a_key_variable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen = tmp_path / "seen"
    body = (
        "import os\n"
        f"open({str(seen)!r}, 'w').write(repr([k for k in notes_vars if k in os.environ]))\n"
    )
    install(
        tmp_path,
        monkeypatch,
        "notes_vars = " + repr(list(notes.HIDDEN_VARIABLES)) + "\n" + body + GOOD + ANSWER,
    )
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")
    monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "y")
    run = notes.make_notes(inputs())
    assert seen.read_text(encoding="utf-8") == "[]"
    assert run.from_model == 6


def card_record() -> dict[str, Any]:
    return records()[0]


def check_note(note: str | None, source: str | None = "model") -> checks.Verdict:
    sources = te.make_sources()
    assembled = export.assemble(sources, te.NOW)
    assembled.files["players"][0]["note"] = note
    assembled.files["players"][0]["note_source"] = source
    return checks.check_11_notes_use_own_numbers(export.check_data(sources, assembled))


def test_check_11_own_rule_accepts_rounded_forms_and_the_two_scales() -> None:
    first = card_record()
    assert first["value_eur"] == 100_000 and first["goals"] == 3
    for text in (
        f"Scored {first['goals']} goals in {first['minutes']:,} minutes.",
        "Rated 100 of 100 and 3 goals per 90.",
        "Priced at \N{EURO SIGN}100k.",
        "Priced at \N{EURO SIGN}0.1M.",
    ):
        assert check_note(text).passed, text
    assert check_note("Scored 3 goals per 90 and 100 of 100.").passed
    assert check_note("Aged 20, 1,000 minutes.").passed


def test_check_11_own_rule_rejects_a_foreign_number_and_a_missing_note() -> None:
    assert not check_note("Scored 77777 goals.").passed
    assert not check_note("Priced at €9M.").passed
    assert not check_note(None, None).passed
    assert not check_note("Scored 3 goals.", "human").passed


def defender_row() -> dict[str, Any]:
    row = dict(records()[0])
    row["flags"] = dict(row["flags"], limited_position_data=True)
    row["pct"] = dict(row["pct"], output=19, role=84)
    return row


def test_a_defenders_input_carries_the_role_percentile_and_the_template_names_it() -> None:
    tier_stats = te.make_sources().tier_stats
    rec = notes.input_record(defender_row(), tier_stats)
    assert rec["rating_out_of_100"] == 84 and rec["rating_rests_on"] == "playing time"
    assert "Rating 84 of 100" in notes.template_note(rec)
    assert notes.note_problem(notes.template_note(rec), rec) is None


def test_an_attackers_input_keeps_the_output_percentile() -> None:
    row = dict(defender_row(), flags=dict(defender_row()["flags"], limited_position_data=False))
    rec = notes.input_record(row, te.make_sources().tier_stats)
    assert rec["rating_out_of_100"] == 19
    assert rec["rating_rests_on"] == "goals and assists, league-adjusted"


def test_check_11_accepts_a_note_that_names_the_role_percentile_of_a_defender() -> None:
    row = defender_row()
    row["pct"] = dict(row["pct"], output=19, role=84)
    stats = te.make_sources().tier_stats
    row["note"] = "Rating 84 of 100 on playing time."
    assert checks.note_problem_of(row, stats) is None


def test_check_11_rejects_the_percentile_the_card_does_not_show_as_the_rating() -> None:
    stats = te.make_sources().tier_stats
    defender = dict(defender_row(), note="Rating 19 of 100.")
    assert checks.note_problem_of(defender, stats) is not None
    flags = dict(defender_row()["flags"], limited_position_data=False)
    attacker = dict(defender_row(), flags=flags, note="Rating 84 of 100.")
    assert checks.note_problem_of(attacker, stats) is not None
    assert checks.note_problem_of(dict(attacker, note="Rating 19 of 100."), stats) is None

