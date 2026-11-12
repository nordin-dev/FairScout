"""The shape of the five app data files, checked against the schemas in `contract/`.

Used by the tests now and by the export step later. Nothing in this module writes a file.
"""

import json
from functools import cache
from pathlib import Path
from typing import Final

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError, ValidationError

from fairscout.config import repository_root

FILES: Final = ("players", "leagues", "evidence", "timemachine", "meta")
MAX_PROBLEMS_SHOWN: Final = 5
MAX_VALUE_CHARS: Final = 80


class ContractError(ValueError):
    """A data file does not match its schema; the message names the file and the field."""


def contract_dir() -> Path:
    """Return the `contract/` folder in the checkout root."""
    return repository_root() / "contract"


@cache
def _build_validator(name: str) -> Draft202012Validator:
    schema = json.loads((contract_dir() / f"{name}.schema.json").read_text(encoding="utf-8"))
    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as error:
        raise ContractError(f"{name}: the schema itself is invalid: {error.message}") from error
    return Draft202012Validator(schema)


def _validator(name: str) -> Draft202012Validator:
    """Return the checker of the schema `name`, built on first use and kept for the run."""
    if name not in FILES:
        raise ContractError(f"{name}: unknown data file; expected one of {', '.join(FILES)}")
    return _build_validator(name)


def _field(path: tuple[str | int, ...]) -> str:
    return ".".join(str(part) for part in path) or "(whole file)"


def _short(value: object) -> str:
    text = json.dumps(value, ensure_ascii=False, default=str)
    return text if len(text) <= MAX_VALUE_CHARS else text[: MAX_VALUE_CHARS - 3] + "..."


def _problem(error: ValidationError) -> str:
    path = tuple(error.absolute_path)
    if error.validator == "required":
        missing = str(error.message).split("'")[1]
        return f"{_field((*path, missing))}: required field is missing"
    rule = f"{error.validator} {_short(error.validator_value)}"
    return f"{_field(path)}: fails {rule}, value {_short(error.instance)}"


def validate(name: str, data: object) -> None:
    """Raise `ContractError` naming the file and the field of the problems in `data`.

    The message shows the first five problems, each with its field, the rule that failed
    and at most 80 characters of the value, and the number of the rest. `name` is one of
    `FILES`, without the `.json` ending.
    """
    errors = sorted(
        _validator(name).iter_errors(data), key=lambda e: [str(p) for p in e.absolute_path]
    )
    if not errors:
        return
    shown = "; ".join(_problem(e) for e in errors[:MAX_PROBLEMS_SHOWN])
    rest = len(errors) - MAX_PROBLEMS_SHOWN
    more = f"; and {rest} more" if rest > 0 else ""
    raise ContractError(f"{name}.json, field {shown}{more}")


def validate_file(name: str, path: Path) -> None:
    """Read the JSON file at `path` and check it against the schema called `name`."""
    validate(name, json.loads(path.read_text(encoding="utf-8")))
