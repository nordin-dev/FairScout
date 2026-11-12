"""Step `ingest`: download the nine source tables and check them.

A table that is already in the raw folder is checked where it lies. A table that is missing
is downloaded into a temporary file next to its place, checked there, and moved into place only
when it passed. A forced run downloads and checks all nine tables into temporary files first and
moves them into place together, so a failed forced run leaves the old tables as they were.
A table in place is therefore only ever replaced by a checked one, and no table ever has a
partial content. A temporary file is removed when its run ends or fails; one that a killed run
left behind is removed at the start of the next run.
"""

import csv
import gzip
import time
import zlib
from collections.abc import Callable, Iterator, Sequence
from contextlib import ExitStack, contextmanager
from dataclasses import dataclass
from http.client import HTTPException, HTTPMessage
from pathlib import Path
from typing import IO, Final
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4

from fairscout import config
from fairscout.errors import StepError

type Opener = Callable[[str], IO[bytes]]

# The public address refuses urllib's default client name with HTTP 403 while it serves curl
# and other clients, so the download sends a plain name of its own. Nothing else is sent:
# no key, no account, no personal detail.
CLIENT_NAME: Final = "source-table-download/1.0"
TIMEOUT_SECONDS: Final = 60.0
CHUNK_BYTES: Final = 1024 * 1024

# What reading a broken or foreign file as a gzip CSV table raises.
UNREADABLE: Final = (OSError, EOFError, zlib.error, csv.Error, UnicodeDecodeError)
# What the network and the disk raise while a table is fetched.
# A redirect address that urllib cannot parse raises ValueError.
FAILED_DOWNLOAD: Final = (OSError, HTTPException, ValueError)


class IngestError(StepError):
    """A source table could not be downloaded or did not pass its check."""


@dataclass(frozen=True, slots=True)
class Limits:
    """What one table may cost: bytes downloaded, seconds of download, characters in one line."""

    max_bytes: int = 1024**3
    max_seconds: float = 900.0
    max_line_chars: int = 1024 * 1024


LIMITS: Final = Limits()


def no_announcement(table: str) -> None:
    """Say nothing before a download starts."""


def printable(text: str) -> str:
    """Escape every character that is not printable, so remote text cannot steer a terminal."""
    return "".join(
        char if char.isprintable() else char.encode("unicode_escape").decode("ascii")
        for char in text
    )


@dataclass(frozen=True, slots=True)
class TableReport:
    """What a run reports for one table. It never holds file contents."""

    table: str
    rows: int
    downloaded: bool


def require_https(url: str) -> None:
    """Stop when an address is not https."""
    if urlsplit(url).scheme != "https":
        raise URLError("only https addresses are accepted")


class HttpsRedirects(HTTPRedirectHandler):
    """Follows a redirect only when it leads to another https address."""

    def redirect_request(
        self, req: Request, fp: IO[bytes], code: int, msg: str, headers: HTTPMessage, newurl: str
    ) -> Request | None:
        """Refuse the new address unless it is https, then let urllib build the request."""
        require_https(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def open_address(url: str) -> IO[bytes]:
    """Open a source address for reading, over https only.

    The address and every redirect it answers with must be https, so the other schemes
    urllib understands (http, ftp, file) are never used. The server certificate is checked
    by urllib's default settings.
    """
    require_https(url)
    # S310 asks for a scheme check before urllib is given an address: it is the line above.
    request = Request(url, headers={"User-Agent": CLIENT_NAME})  # noqa: S310
    response: IO[bytes] = build_opener(HttpsRedirects).open(request, timeout=TIMEOUT_SECONDS)
    return response


def require_columns(table: str, header: Sequence[str]) -> None:
    """Stop when the header row lacks a column the later steps read."""
    missing = [f"'{column}'" for column in config.EXPECTED_COLUMNS[table] if column not in header]
    if missing:
        noun = "column" if len(missing) == 1 else "columns"
        raise IngestError(f"table '{table}' is missing the {noun} {', '.join(missing)}")


def capped_lines(table: str, stream: IO[str], limit: int) -> Iterator[str]:
    """Hand out the lines of a stream and stop when one is longer than the limit."""
    while line := stream.readline(limit + 1):
        if len(line) > limit:
            raise IngestError(f"table '{table}' has a line longer than {limit} characters")
        yield line


def check_table(table: str, path: Path, limits: Limits = LIMITS) -> int:
    """Check a compressed table and return its number of data rows.

    Stops with a message that names the table when an expected column is missing (the column
    is named too), when the file is empty, when the table has zero rows, when a line is
    longer than the limit, or when the file cannot be read to its end.
    The message never quotes what the file holds.
    """
    if path.stat().st_size == 0:
        raise IngestError(f"table '{table}' is empty: the file has no bytes")
    try:
        with gzip.open(path, "rt", encoding="utf-8-sig", newline="") as stream:
            reader = csv.reader(capped_lines(table, stream, limits.max_line_chars))
            require_columns(table, next(reader, []))
            rows = sum(1 for row in reader if row)
    except UNREADABLE as error:
        reason = f"csv: {error}" if isinstance(error, csv.Error) else type(error).__name__
        raise IngestError(f"table '{table}' is not a readable gzip CSV file ({reason})") from error
    if rows == 0:
        raise IngestError(f"table '{table}' has zero rows")
    return rows


@contextmanager
def partial_file(target: Path) -> Iterator[Path]:
    """Name a new file for a download in the target's folder, creating the folder if needed.

    The file is removed at the end unless it was moved into place.
    """
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(f".{target.name}.{uuid4().hex}.part")
    try:
        yield partial
    finally:
        partial.unlink(missing_ok=True)


def remove_leftovers(raw_dir: Path) -> None:
    """Remove the temporary files that an earlier run left behind when it was killed."""
    if not raw_dir.is_dir():
        return
    try:
        for table in config.TABLES:
            for leftover in raw_dir.glob(f".{config.table_file(table)}.*.part"):
                leftover.unlink(missing_ok=True)
    except OSError as error:
        raise IngestError(
            f"the raw folder {raw_dir} cannot be searched: {printable(str(error))}"
        ) from error


def copy_limited(table: str, source: IO[bytes], sink: IO[bytes], limits: Limits) -> None:
    """Copy a download, and stop when it is larger or slower than the limits allow."""
    started = time.monotonic()
    received = 0
    while chunk := source.read(CHUNK_BYTES):
        received += len(chunk)
        if received > limits.max_bytes:
            raise IngestError(f"table '{table}' is larger than {limits.max_bytes} bytes")
        if time.monotonic() - started >= limits.max_seconds:
            raise IngestError(
                f"table '{table}' took longer than {limits.max_seconds:g} seconds to download"
            )
        sink.write(chunk)


def fetch_checked(
    table: str, partial: Path, opener: Opener, limits: Limits, announce: Callable[[str], None]
) -> int:
    """Download a table into a new file, check it there, and return its number of data rows."""
    url = config.table_url(table)
    announce(table)
    try:
        with opener(url) as source, partial.open("xb") as sink:
            copy_limited(table, source, sink, limits)
        return check_table(table, partial, limits)
    except IngestError as error:
        raise IngestError(f"{error}; it came from {url} and was not kept") from error
    except FAILED_DOWNLOAD as error:
        reason = printable(str(error))
        raise IngestError(
            f"table '{table}' could not be downloaded from {url}: {reason}"
        ) from error


def download_table(
    table: str,
    target: Path,
    opener: Opener,
    limits: Limits = LIMITS,
    announce: Callable[[str], None] = no_announcement,
) -> int:
    """Download a table, check it, move it into place, and return its number of data rows.

    The table reaches its place only when the download ended and the check passed. On any
    failure the partial file is removed and a table already in place stays untouched.
    """
    with partial_file(target) as partial:
        rows = fetch_checked(table, partial, opener, limits, announce)
        partial.replace(target)
    return rows


def ingest_table(
    table: str,
    raw_dir: Path,
    *,
    force: bool,
    opener: Opener,
    limits: Limits = LIMITS,
    announce: Callable[[str], None] = no_announcement,
) -> TableReport:
    """Check a table where it lies, or download it when it is missing or the run is forced."""
    target = raw_dir / config.table_file(table)
    try:
        present = target.is_file()
    except OSError as error:
        raise IngestError(
            f"the raw folder {raw_dir} cannot be searched: {printable(str(error))}"
        ) from error
    if present and not force:
        try:
            return TableReport(table, check_table(table, target, limits), downloaded=False)
        except IngestError as error:
            raise IngestError(
                f"{error}; the file is {target}; run again with --force to download it again"
            ) from error
    return TableReport(
        table, download_table(table, target, opener, limits, announce), downloaded=True
    )


def replace_all(
    raw_dir: Path, opener: Opener, limits: Limits, announce: Callable[[str], None]
) -> list[TableReport]:
    """Download and check all nine tables first, then move them into place together."""
    reports: list[TableReport] = []
    with ExitStack() as stack:
        staged: list[tuple[Path, Path]] = []
        for table in config.TABLES:
            target = raw_dir / config.table_file(table)
            partial = stack.enter_context(partial_file(target))
            rows = fetch_checked(table, partial, opener, limits, announce)
            staged.append((partial, target))
            reports.append(TableReport(table, rows, downloaded=True))
        for partial, target in staged:
            partial.replace(target)
    return reports


def ingest_tables(
    raw_dir: Path,
    *,
    force: bool = False,
    opener: Opener = open_address,
    limits: Limits = LIMITS,
    announce: Callable[[str], None] = no_announcement,
) -> Iterator[TableReport]:
    """Leave the nine source tables present and checked in the raw folder.

    Yields one report per table, in the fixed table order, as soon as that table is done; a
    forced run yields them once all nine are in place. Stops with IngestError at the first
    table that cannot be downloaded or fails its check.
    """
    remove_leftovers(raw_dir)
    if force:
        yield from replace_all(raw_dir, opener, limits, announce)
        return
    for table in config.TABLES:
        yield ingest_table(
            table, raw_dir, force=False, opener=opener, limits=limits, announce=announce
        )
