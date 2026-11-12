"""Write the short scout note of every pool player from his own numbers, offline.

The step `notes` builds an input record for each pool player (only what his card shows),
asks the Claude command-line program on this machine for a note of at most two short
sentences and 25 words, checks every note and replaces any note that fails by a template
sentence built from the player's own numbers. The result is `notes.json` in the work folder;
the export reads it. The program needs no key (decision D-010): the child process gets the
environment without `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN`, so a key set in the shell
is never used. This module reads no key or account variable, prints nothing of the program's
output and writes no prompt or answer to a log. The app never calls a language model: it only
shows the finished notes.
"""

import hashlib
import json
import math
import os
import re
import shutil
import subprocess
from collections import Counter
from collections.abc import Callable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any, Final

from fairscout.errors import StepError

NOTES_FILE: Final = "notes.json"
PROGRAM: Final = "claude"
ENV_SETTING: Final = "FAIRSCOUT_NOTES"
MODE_MODEL: Final = "model"
MODE_TEMPLATE: Final = "template"
BATCH_SIZE: Final = 20
PARALLEL_BATCHES: Final = 3
DEFAULT_TIMEOUT: Final = 120
MAX_WORDS: Final = 25
MAX_SENTENCES: Final = 2
SCALE: Final = 100
HIDDEN_VARIABLES: Final = ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")

REASON_MISSING: Final = "program not installed"
REASON_NOT_SIGNED_IN: Final = "not signed in"
REASON_TIMED_OUT: Final = "timed out"
REASON_FAILED: Final = "failed"
REASON_UNUSABLE: Final = "unusable answer"
REASON_NO_NOTE: Final = "no note for the player"
REASON_LENGTH: Final = "failed the length check"
REASON_NUMBERS: Final = "failed the number check"
REASON_TEMPLATE_MODE: Final = "template mode"

SYSTEM_PROMPT: Final = "You write short scouting notes from numbers. Answer only as asked."
INSTRUCTION: Final = (
    "Below is a JSON list of football players, each with the numbers his card shows. "
    'Answer with the JSON object {"notes": [{"id": ..., "note": ...}]} that holds one note '
    "for every player in the list, with his id copied exactly. Rules for every note: at most "
    "two short sentences and at most 25 words; plain English; use only numbers from that "
    "player's own record and no number that is not in it; the rating and the outlook tier "
    "are two different things, and a low rating with a high tier is normal; write every "
    "number in digits and never spell a number as a word, not even in 'one of'; do not name "
    "the season or the year; no advice to sign or buy; no claim "
    "about character, injuries or playing style. For defenders and goalkeepers the rating rests "
    "on playing time, not on goals."
)
RATING_BASIS: Final = {True: "playing time", False: "goals and assists, league-adjusted"}
ANSWER_SCHEMA: Final = json.dumps(
    {
        "type": "object",
        "properties": {
            "notes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {"id": {"type": "string"}, "note": {"type": "string"}},
                    "required": ["id", "note"],
                },
            }
        },
        "required": ["notes"],
    },
    separators=(",", ":"),
)
SIGNED_OUT_WORDS: Final[tuple[str, ...]] = ("log in", "login", "logged in", "authenticat")
NUMBER: Final = re.compile(r"(\d+(?:,\d{3})*(?:\.\d+)?)(%|[kM]\b)?")
SENTENCE_END: Final = re.compile(r"(?<!\d)[.!?]+|[.!?]+(?!\d)")
OF_SCALE: Final = re.compile(rf"\bof {SCALE}\b|\bper 90\b")
NUMBER_WORDS: Final = re.compile(
    r"\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|"
    r"fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|"
    r"sixty|seventy|eighty|ninety|hundred|thousand|million)\b",
    re.IGNORECASE,
)

type Figure = tuple[Decimal, str]


class ProgramProblem(Exception):  # noqa: N818 - carries a reason word, not an error of the run
    """The program could not give an answer for a batch; `reason` says why in one phrase."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True, slots=True)
class NotesRun:
    """The notes of one run: `entries` by player id and the reason of each fallback, counted."""

    entries: dict[str, dict[str, str]]
    reasons: Counter[str]

    @property
    def from_model(self) -> int:
        """How many notes came from the model."""
        return sum(1 for e in self.entries.values() if e["source"] == MODE_MODEL)

    @property
    def fallbacks(self) -> int:
        """How many notes are template sentences."""
        return len(self.entries) - self.from_model

    def report(self) -> list[str]:
        """Return the lines the command prints: the counts and one line per reason."""
        lines = [
            f"notes: {len(self.entries)} players",
            f"from the model: {self.from_model}",
            f"from a template (fallbacks): {self.fallbacks}",
        ]
        lines.extend(f"  {reason}: {count}" for reason, count in sorted(self.reasons.items()))
        return lines


def money(eur: float) -> str:
    """Write an amount the way the card does: 250k, 1M, 1.1M, with the euro sign."""
    if abs(eur) >= 1_000_000:
        return f"€{trimmed(eur / 1_000_000)}M"
    if abs(eur) >= 1_000:
        return f"€{trimmed(eur / 1_000)}k"
    return f"€{round(eur)}"


def trimmed(number: float) -> str:
    """Round to one decimal and drop a trailing `.0`."""
    value = math.floor(number * 10 + 0.5) / 10
    return str(int(value)) if value == int(value) else str(value)


def input_record(record: Mapping[str, Any], tier_stats: Mapping[str, Any]) -> dict[str, Any]:
    """Return what the model may see of a pool player: only what his card shows."""
    stats = tier_stats.get(str(record["tier"]), {})
    rate = stats.get("rate")
    limited = bool(record["flags"]["limited_position_data"])
    return {
        "id": record["id"],
        "name": record["name"],
        "position": record["position"],
        "age": int(record["age"]),
        "club": record["club"],
        "league": record["league_name"],
        "minutes": record["minutes"],
        "goals": record["goals"],
        "assists": record["assists"],
        "goals_plus_assists_per_90": record["ga90"],
        "goals_plus_assists_per_90_league_adjusted": record["ga90_adj"],
        "rating_out_of_100": record["pct"]["role" if limited else "output"],
        "rating_rests_on": RATING_BASIS[limited],
        "price": None if record["value_eur"] is None else money(float(record["value_eur"])),
        "outlook_tier": record["tier"],
        "share_of_past_players_of_this_tier_who_made_it_pct": (
            None if rate is None else round(float(rate) * SCALE)
        ),
        "reasons": [d["text"] for d in record["drivers"]],
    }


def input_stamp(rec: Mapping[str, Any]) -> str:
    """Return the first 16 hex characters of the SHA-256 of the canonical JSON of a record."""
    canonical = json.dumps(rec, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]


def template_note(rec: Mapping[str, Any]) -> str:
    """Build the fallback sentence from the player's own numbers; it passes every check."""
    first = (
        f"{rec['age']}-year-old {rec['position']} with {rec['goals']} goals and "
        f"{rec['assists']} assists in {rec['minutes']:,} minutes."
    )
    rating = rec["rating_out_of_100"]
    if rating is None:
        return first
    return f"{first} Rating {rating} of {SCALE}, outlook tier {rec['outlook_tier']}."


def figures_in(text: str) -> list[Figure]:
    """Return the numbers of a text as value and suffix (`%`, `k`, `M` or empty)."""
    return [(Decimal(m.group(1).replace(",", "")), m.group(2) or "") for m in NUMBER.finditer(text)]


def decimals_of(value: float) -> list[Figure]:
    """Return a number in the forms the card prints: as it is and rounded to 1 or 2 decimals."""
    forms = {Decimal(str(value)), Decimal(f"{value:.1f}"), Decimal(f"{value:.2f}")}
    return [(form, "") for form in forms]


def scalar_figures(value: object) -> list[Figure]:
    """Return the numbers a single field of the record allows."""
    if isinstance(value, bool) or value is None:
        return []
    if isinstance(value, int):
        return [(Decimal(value), "")]
    if isinstance(value, float):
        return decimals_of(value)
    if isinstance(value, str):
        return spelled_out(figures_in(value))
    return []


def spelled_out(figures: list[Figure]) -> list[Figure]:
    """Add the plain whole number to every amount written with k or M."""
    scale = {"k": 1_000, "M": 1_000_000}
    return [*figures, *((v * scale[s], "") for v, s in figures if s in scale)]


def allowed_figures(rec: Mapping[str, Any]) -> set[Figure]:
    """Return every number of a record in the forms the card prints, with the scale 100."""
    allowed: set[Figure] = set()
    for key, value in rec.items():
        if key == "id":
            continue
        parts = value if isinstance(value, list) else [value]
        for part in parts:
            allowed.update(scalar_figures(part))
    share = rec.get("share_of_past_players_of_this_tier_who_made_it_pct")
    if isinstance(share, int):
        allowed.add((Decimal(share), "%"))
    return allowed


def length_problem(text: str) -> str | None:
    """Return the reason when a note has more than two sentences or more than 25 words."""
    sentences = [s for s in SENTENCE_END.split(text) if s.strip()]
    if len(sentences) > MAX_SENTENCES or len(text.split()) > MAX_WORDS:
        return REASON_LENGTH
    return None


def number_problem(text: str, rec: Mapping[str, Any]) -> str | None:
    """Return the reason when the note has a number that the record does not hold."""
    if NUMBER_WORDS.search(text):
        return REASON_NUMBERS
    allowed = allowed_figures(rec)
    if any(figure not in allowed for figure in figures_in(OF_SCALE.sub("", text))):
        return REASON_NUMBERS
    return None


def note_problem(text: object, rec: Mapping[str, Any]) -> str | None:
    """Check a note: it is text, then its length, then its numbers. Return the reason or None."""
    if not isinstance(text, str) or not text.strip():
        return REASON_NO_NOTE
    return length_problem(text) or number_problem(text, rec)


def mentions_signed_out(text: str) -> bool:
    """Tell whether a message from the program says that nobody is signed in."""
    lowered = text.lower()
    return any(word in lowered for word in SIGNED_OUT_WORDS)


def program_command(path: str) -> list[str]:
    """Return the argument list that starts the program: print mode, JSON output, no tools."""
    return [
        path,
        "-p",
        "--output-format",
        "json",
        "--json-schema",
        ANSWER_SCHEMA,
        "--no-session-persistence",
        "--tools",
        "",
        "--disable-slash-commands",
        "--strict-mcp-config",
        "--setting-sources",
        "",
        "--system-prompt",
        SYSTEM_PROMPT,
    ]


def run_program(path: str, batch: Sequence[Mapping[str, Any]], timeout: float) -> str:
    """Start the program on a batch and return its standard output, or raise `ProgramProblem`."""
    prompt = f"{INSTRUCTION}\n{json.dumps(list(batch), ensure_ascii=False)}"
    try:
        done = subprocess.run(  # noqa: S603 - argument list, no shell, path found on PATH
            program_command(path),
            input=prompt,
            capture_output=True,
            text=True,
            timeout=timeout,
            env={k: v for k, v in os.environ.items() if k not in HIDDEN_VARIABLES},
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise ProgramProblem(REASON_TIMED_OUT) from error
    except UnicodeDecodeError as error:
        raise ProgramProblem(REASON_UNUSABLE) from error
    except OSError as error:
        raise ProgramProblem(REASON_FAILED) from error
    if done.returncode != 0:
        signed_out = mentions_signed_out(done.stdout + done.stderr)
        raise ProgramProblem(REASON_NOT_SIGNED_IN if signed_out else REASON_FAILED)
    return done.stdout


def answer_items(output: str) -> list[Any]:
    """Return the list of notes the program answered, or raise `ProgramProblem`."""
    try:
        data = json.loads(output)
    except json.JSONDecodeError as error:
        raise ProgramProblem(REASON_UNUSABLE) from error
    if not isinstance(data, dict):
        raise ProgramProblem(REASON_UNUSABLE)
    if data.get("is_error") is True:
        signed_out = mentions_signed_out(str(data.get("result", "")))
        raise ProgramProblem(REASON_NOT_SIGNED_IN if signed_out else REASON_FAILED)
    answer = data.get("structured_output")
    if answer is None:
        try:
            answer = json.loads(str(data.get("result", "")))
        except json.JSONDecodeError as error:
            raise ProgramProblem(REASON_UNUSABLE) from error
    items = answer.get("notes") if isinstance(answer, dict) else answer
    if not isinstance(items, list):
        raise ProgramProblem(REASON_UNUSABLE)
    return items


def notes_by_id(items: Sequence[Any], ids: set[str]) -> dict[str, Any]:
    """Pick the note of each player of the batch out of the answer; other ids are ignored."""
    found: dict[str, Any] = {}
    for item in items:
        if isinstance(item, dict) and isinstance(item.get("id"), str) and item["id"] in ids:
            found[item["id"]] = item.get("note")
    return found


@dataclass(frozen=True, slots=True)
class BatchResult:
    """What one call gave: the raw note of each player it answered, or why it gave none."""

    notes: dict[str, Any]
    reason: str | None


def ask_batch(path: str, batch: Sequence[Mapping[str, Any]], timeout: float) -> BatchResult:
    """Ask the program for the notes of one batch; a problem is returned as a reason."""
    try:
        items = answer_items(run_program(path, batch, timeout))
    except ProgramProblem as problem:
        return BatchResult({}, problem.reason)
    return BatchResult(notes_by_id(items, {str(rec["id"]) for rec in batch}), None)


def settle(rec: Mapping[str, Any], raw: object, reason: str | None) -> tuple[dict[str, str], str]:
    """Return the entry of a player and the reason for it ("" for a model note)."""
    problem = reason or note_problem(raw, rec)
    if problem is None and isinstance(raw, str):
        return {"note": raw.strip(), "source": MODE_MODEL, "input": input_stamp(rec)}, ""
    template = {"note": template_note(rec), "source": MODE_TEMPLATE, "input": input_stamp(rec)}
    return template, problem or REASON_NO_NOTE


def make_notes(
    recs: Sequence[Mapping[str, Any]],
    mode: str = MODE_MODEL,
    timeout: float = DEFAULT_TIMEOUT,
    finder: Callable[[str], str | None] = shutil.which,
) -> NotesRun:
    """Return a note for each input record: from the program when it works, else a template.

    Nothing is printed here; every fallback is counted under its reason.
    """
    path = finder(PROGRAM) if mode == MODE_MODEL else None
    skipped = REASON_TEMPLATE_MODE if mode != MODE_MODEL else REASON_MISSING
    batches = [recs[i : i + BATCH_SIZE] for i in range(0, len(recs), BATCH_SIZE)]
    if path is None:
        results = [BatchResult({}, skipped) for _ in batches]
    else:
        with ThreadPoolExecutor(max_workers=PARALLEL_BATCHES) as pool:
            results = list(pool.map(lambda b: ask_batch(path, b, timeout), batches))
    entries: dict[str, dict[str, str]] = {}
    reasons: Counter[str] = Counter()
    for batch, result in zip(batches, results, strict=True):
        for rec in batch:
            entry, why = settle(rec, result.notes.get(str(rec["id"])), result.reason)
            entries[str(rec["id"])] = entry
            if why:
                reasons[why] += 1
    return NotesRun(entries, reasons)


def mode_from_environment() -> str:
    """Return the mode of the run from `FAIRSCOUT_NOTES`: `model` (the default) or `template`."""
    mode = os.environ.get(ENV_SETTING, MODE_MODEL)
    if mode not in (MODE_MODEL, MODE_TEMPLATE):
        raise StepError(f"{ENV_SETTING} must be {MODE_MODEL} or {MODE_TEMPLATE}")
    return mode


def pool_inputs(
    records: Sequence[Mapping[str, Any]], tier_stats: Mapping[str, Any]
) -> list[dict[str, Any]]:
    """Return the input records of the pool players, in the order of the records."""
    return [input_record(r, tier_stats) for r in records if r["in_pool"]]


def write_notes(
    records: Sequence[Mapping[str, Any]],
    tier_stats: Mapping[str, Any],
    work_dir: Path,
    timeout: float = DEFAULT_TIMEOUT,
) -> NotesRun:
    """Make the notes of every pool player and write `notes.json` into the work folder."""
    run = make_notes(pool_inputs(records, tier_stats), mode_from_environment(), timeout)
    target = work_dir / NOTES_FILE
    target.write_text(
        json.dumps(run.entries, sort_keys=True, indent=1, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return run


def read_notes(work_dir: Path) -> dict[str, Any] | None:
    """Read `notes.json`; None when the step has not run, a `StepError` when it is unreadable."""
    path = work_dir / NOTES_FILE
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, OSError) as error:
        raise StepError(f"input file {path} is unreadable: {error}") from error
    if not isinstance(data, dict):
        raise StepError(f"input file {path} is not a JSON object")
    return data


def entry_for(rec: Mapping[str, Any], found: object) -> dict[str, str]:
    """Return the file's entry for a player when it is well formed, stamped with his current
    input record and passes the checks; otherwise the template sentence."""
    valid = isinstance(found, dict) and found.get("source") in (MODE_MODEL, MODE_TEMPLATE)
    if (
        isinstance(found, dict)
        and valid
        and found.get("input") == input_stamp(rec)
        and note_problem(found.get("note"), rec) is None
    ):
        return {"note": str(found["note"]), "source": str(found["source"])}
    return {"note": template_note(rec), "source": MODE_TEMPLATE}


def apply_notes(
    records: Sequence[dict[str, Any]],
    tier_stats: Mapping[str, Any],
    notes: Mapping[str, Any] | None,
) -> None:
    """Fill `note` and `note_source` of the pool records; every other field stays as it is.

    A player missing from `notes`, or whose entry fails the checks, gets the template sentence.
    """
    for record in records:
        if not record["in_pool"]:
            continue
        found = (notes or {}).get(record["id"])
        entry = entry_for(input_record(record, tier_stats), found)
        record["note"], record["note_source"] = entry["note"], entry["source"]
