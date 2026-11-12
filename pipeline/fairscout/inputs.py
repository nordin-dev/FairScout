"""Read work files for a step: a missing file or a missing column gives one `StepError`.

Shared by the steps that read the tables other steps wrote; the older steps may move to these
helpers later.
"""

import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import pandas as pd

from fairscout import config
from fairscout.errors import StepError, require_file


def read_csv_table(path: Path, step: str, columns: Sequence[str]) -> pd.DataFrame:
    """Read a CSV work table that `step` wrote and check it holds the `columns`.

    A missing file, an unreadable file and a missing column each stop with a message that names
    the file and, for a column, the column.
    """
    require_file(path, f"run the step `{step}` first")
    try:
        table = pd.read_csv(path, low_memory=False)
    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeDecodeError) as error:
        raise StepError(f"input file {path} is missing or unreadable: {error}") from error
    missing = [column for column in columns if column not in table.columns]
    if missing:
        raise StepError(f"input file {path} lacks the columns {', '.join(missing)}")
    return table


def read_json_file(path: Path, step: str, keys: Sequence[str]) -> dict[str, Any]:
    """Read a JSON work file that `step` wrote and check it is an object with the `keys`."""
    require_file(path, f"run the step `{step}` first")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise StepError(f"input file {path} is missing or unreadable: {error}") from error
    if not isinstance(data, dict):
        raise StepError(f"input file {path} is not a JSON object")
    missing = [key for key in keys if key not in data]
    if missing:
        raise StepError(f"input file {path} lacks the keys {', '.join(missing)}")
    result: dict[str, Any] = data
    return result


def read_raw_columns(raw_dir: Path, table: str, columns: Sequence[str]) -> pd.DataFrame:
    """Read the `columns` of a source table; a missing file or column stops with one message."""
    path = require_file(raw_dir / config.table_file(table), "run the step `ingest` first")
    try:
        header = pd.read_csv(path, nrows=0).columns
        missing = [column for column in columns if column not in header]
        if missing:
            raise StepError(f"table {table} lacks the columns {', '.join(missing)}")
        return pd.read_csv(path, usecols=list(columns), low_memory=False)
    except (pd.errors.ParserError, pd.errors.EmptyDataError, UnicodeDecodeError, OSError) as error:
        raise StepError(f"table {table} at {path} is unreadable: {error}") from error
