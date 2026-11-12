"""The one error type every pipeline step raises when it cannot go on.

`cli.main` turns it into a single `error:` line and exit code 1.
"""

from pathlib import Path


class StepError(Exception):
    """A pipeline step stopped because an input is missing or unusable."""


def require_file(path: Path, hint: str = "") -> Path:
    """Return the path when it is a file, else raise a `StepError` that names it.

    `hint` is added to the message, for example which step makes the file.
    """
    if not path.is_file():
        suffix = f"; {hint}" if hint else ""
        raise StepError(f"input file {path} is missing or unreadable{suffix}")
    return path
