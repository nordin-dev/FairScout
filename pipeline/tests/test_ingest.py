"""Tests of the step `ingest`, grouped by the acceptance criterion they prove.

They use no network and never write the real data folder. Two tests skip themselves when what
they need is absent: one checks the real tables when they are on this machine, the other
downloads the smallest real table into a temporary folder when the network is reachable.
"""

import csv
import gzip
import io
import os
import socket
import subprocess
import sys
from collections.abc import Mapping, Sequence
from http.client import HTTPMessage
from pathlib import Path
from typing import IO, NoReturn, Self
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request

import pytest

from fairscout import cli, config, ingest

PIPELINE_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = PIPELINE_DIR.parent
NINE_TABLES = (
    "competitions",
    "games",
    "appearances",
    "game_lineups",
    "game_events",
    "player_valuations",
    "transfers",
    "players",
    "clubs",
)
NINE_FILES = sorted(f"{table}.csv.gz" for table in NINE_TABLES)
SOURCE = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data"
CELL = "cell-that-must-never-be-printed"
EXTRA_COLUMN = "column_no_step_reads"


def address(table: str) -> str:
    """Return the public address of a table, written out independently of the package."""
    return f"{SOURCE}/{table}.csv.gz"


def table_bytes(header: Sequence[str], rows: int) -> bytes:
    """Build a compressed CSV table in which every cell of every row holds CELL."""
    text = io.StringIO(newline="")
    writer = csv.writer(text, quoting=csv.QUOTE_ALL)
    writer.writerow(header)
    writer.writerows([[CELL] * len(header)] * rows)
    return gzip.compress(text.getvalue().encode("utf-8"), mtime=0)


def good_table(table: str, rows: int = 2) -> bytes:
    """Build a table with every expected column and one column more."""
    return table_bytes([*config.EXPECTED_COLUMNS[table], EXTRA_COLUMN], rows)


def table_without(table: str, *columns: str) -> bytes:
    """Build a table with two rows that lacks the given expected columns."""
    kept = [column for column in config.EXPECTED_COLUMNS[table] if column not in columns]
    return table_bytes([*kept, EXTRA_COLUMN], rows=2)


def good_tables(rows: int = 2) -> dict[str, bytes]:
    """Build the nine tables, each complete and with the same number of rows."""
    return {table: good_table(table, rows) for table in NINE_TABLES}


def place(raw: Path, tables: Mapping[str, bytes]) -> None:
    """Put tables into a raw folder, as an earlier run would have left them."""
    raw.mkdir(parents=True, exist_ok=True)
    for table, content in tables.items():
        (raw / f"{table}.csv.gz").write_bytes(content)


def names_in(folder: Path) -> list[str]:
    """List what a folder holds, hidden files included."""
    return sorted(path.name for path in folder.iterdir())


def state_of(folder: Path) -> dict[str, tuple[bytes, int]]:
    """Record content and time of last change of every file in a folder."""
    return {path.name: (path.read_bytes(), path.stat().st_mtime_ns) for path in folder.iterdir()}


class Source:
    """Stands in for the public address: answers from memory and records what was asked."""

    def __init__(self, tables: Mapping[str, bytes]) -> None:
        self.answers = {address(table): content for table, content in tables.items()}
        self.asked: list[str] = []

    def __call__(self, url: str) -> IO[bytes]:
        self.asked.append(url)
        if url not in self.answers:
            raise HTTPError(url, 404, "Not Found", HTTPMessage(), None)
        return io.BytesIO(self.answers[url])


class Director:
    """Stands in for urllib's opener, so the command runs whole except for the network."""

    def __init__(self, tables: Mapping[str, bytes]) -> None:
        self.source = Source(tables)
        self.handlers: tuple[object, ...] = ()
        self.requests: list[Request] = []
        self.timeouts: list[float] = []

    def build(self, *handlers: object) -> Self:
        self.handlers = handlers
        return self

    def open(self, request: Request, timeout: float) -> IO[bytes]:
        self.requests.append(request)
        self.timeouts.append(timeout)
        return self.source(request.full_url)


class Dropping(io.BytesIO):
    """A stream that hands out its first bytes and then fails, like a dropped connection."""

    def __init__(self, content: bytes, failure: BaseException) -> None:
        super().__init__(content)
        self.failure = failure

    def read(self, size: int | None = -1, /) -> bytes:
        if self.tell() > 0:
            raise self.failure
        return super().read(16)


def no_download(url: str) -> NoReturn:
    """Fail the test when a run that must not download asks for an address."""
    raise AssertionError(f"unexpected download of {url}")


def no_opener(*handlers: object) -> NoReturn:
    """Fail the test when urllib is reached although the address had to be refused."""
    raise AssertionError("urllib must not be reached")


def in_place(table: str, raw: Path) -> str:
    """Return what the error of a table in place adds: its file and what to do."""
    return f"; the file is {raw / f'{table}.csv.gz'}; run again with --force to download it again"


def run_command(data: Path) -> subprocess.CompletedProcess[str]:
    """Start `python -m fairscout ingest` as a team member does, on its own data folder."""
    environment = {**os.environ, "FAIRSCOUT_DATA": str(data), "PYTHONPATH": str(PIPELINE_DIR)}
    return subprocess.run(
        [sys.executable, "-m", "fairscout", "ingest"],
        cwd=data,
        env=environment,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )


# Criterion 1: the command leaves the nine compressed tables under data/raw.


def test_config_lists_the_nine_tables_and_their_public_addresses() -> None:
    assert config.TABLES == NINE_TABLES
    assert [config.table_url(table) for table in NINE_TABLES] == [
        address(table) for table in NINE_TABLES
    ]


def test_every_table_lists_expected_columns_without_repeats() -> None:
    for table in NINE_TABLES:
        columns = config.EXPECTED_COLUMNS[table]
        assert columns, table
        assert len(set(columns)) == len(columns), table


def test_data_folder_is_the_one_of_the_checkout_unless_the_environment_names_another(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("FAIRSCOUT_DATA", raising=False)
    assert config.raw_dir() == REPOSITORY_ROOT / "data" / "raw"

    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    assert config.raw_dir() == tmp_path / "raw"


def test_run_downloads_the_nine_tables_into_the_raw_folder(tmp_path: Path) -> None:
    raw = tmp_path / "data" / "raw"
    tables = good_tables()
    source = Source(tables)

    reports = list(ingest.ingest_tables(raw, opener=source))

    assert names_in(raw) == NINE_FILES
    assert all((raw / f"{table}.csv.gz").read_bytes() == tables[table] for table in NINE_TABLES)
    assert source.asked == [address(table) for table in NINE_TABLES]
    assert reports == [ingest.TableReport(table, rows=2, downloaded=True) for table in NINE_TABLES]


def test_command_downloads_missing_tables_and_writes_only_the_raw_folder(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    data = tmp_path / "data"
    monkeypatch.setenv("FAIRSCOUT_DATA", str(data))
    director = Director(good_tables(rows=3))
    monkeypatch.setattr(ingest, "build_opener", director.build)

    assert cli.main(["ingest"]) == 0

    assert names_in(tmp_path) == ["data"]
    assert names_in(data) == ["raw"]
    assert names_in(data / "raw") == NINE_FILES
    assert capsys.readouterr().out.splitlines() == [
        f"{table}: 3 rows (downloaded)" for table in NINE_TABLES
    ]


# The download: https only, nothing sent but a client name, and no broken table left behind.


def test_download_sends_nothing_but_a_client_name_and_sets_a_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    director = Director({"clubs": good_table("clubs")})
    monkeypatch.setattr(ingest, "build_opener", director.build)

    with ingest.open_address(address("clubs")) as response:
        assert response.read() == good_table("clubs")

    (request,) = director.requests
    assert request.full_url == address("clubs")
    assert request.header_items() == [("User-agent", ingest.CLIENT_NAME)]
    assert request.data is None
    assert director.timeouts == [ingest.TIMEOUT_SECONDS]
    assert director.handlers == (ingest.HttpsRedirects,)


@pytest.mark.parametrize(
    "url",
    ["http://example.org/clubs.csv.gz", "ftp://example.org/clubs.csv.gz", "file:///etc/hosts"],
    ids=["http", "ftp", "file"],
)
def test_address_that_is_not_https_is_refused_before_urllib_is_reached(
    url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(ingest, "build_opener", no_opener)

    with pytest.raises(URLError, match="only https addresses are accepted"):
        ingest.open_address(url)


def test_redirect_is_followed_only_to_an_https_address() -> None:
    handler = ingest.HttpsRedirects()
    first = Request("https://example.org/clubs.csv.gz")

    followed = handler.redirect_request(
        first, io.BytesIO(), 302, "Found", HTTPMessage(), "https://example.net/clubs.csv.gz"
    )

    assert followed is not None
    assert followed.full_url == "https://example.net/clubs.csv.gz"
    with pytest.raises(URLError, match="only https addresses are accepted"):
        handler.redirect_request(
            first, io.BytesIO(), 302, "Found", HTTPMessage(), "http://example.net/clubs.csv.gz"
        )


def test_failed_forced_run_names_the_table_and_the_address_and_keeps_all_nine_old_tables(
    tmp_path: Path,
) -> None:
    raw = tmp_path / "raw"
    old = good_tables(rows=2)
    place(raw, old)
    fresh = good_tables(rows=4)
    del fresh["games"]

    with pytest.raises(ingest.IngestError) as stopped:
        list(ingest.ingest_tables(raw, force=True, opener=Source(fresh)))

    assert str(stopped.value) == (
        f"table 'games' could not be downloaded from {address('games')}: HTTP Error 404: Not Found"
    )
    assert all((raw / f"{table}.csv.gz").read_bytes() == old[table] for table in NINE_TABLES)
    assert names_in(raw) == NINE_FILES


def test_command_exits_with_code_1_when_a_download_fails(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    monkeypatch.setattr(ingest, "build_opener", Director({}).build)

    assert cli.main(["ingest"]) == 1

    printed = capsys.readouterr()
    assert printed.out == ""
    assert printed.err == (
        "downloading competitions ...\n"
        f"error: table 'competitions' could not be downloaded from {address('competitions')}: "
        "HTTP Error 404: Not Found\n"
    )
    assert names_in(tmp_path / "raw") == []


def test_dropped_connection_leaves_no_broken_table(tmp_path: Path) -> None:
    raw = tmp_path / "raw"

    def dropping(url: str) -> IO[bytes]:
        return Dropping(good_table("competitions"), ConnectionResetError("connection reset"))

    with pytest.raises(ingest.IngestError) as stopped:
        list(ingest.ingest_tables(raw, opener=dropping))

    assert str(stopped.value) == (
        f"table 'competitions' could not be downloaded from {address('competitions')}: "
        "connection reset"
    )
    assert names_in(raw) == []


def test_interrupted_run_leaves_no_partial_file(tmp_path: Path) -> None:
    raw = tmp_path / "raw"

    def interrupted(url: str) -> IO[bytes]:
        return Dropping(good_table("competitions"), KeyboardInterrupt())

    with pytest.raises(KeyboardInterrupt):
        list(ingest.ingest_tables(raw, opener=interrupted))

    assert names_in(raw) == []


@pytest.mark.parametrize(
    ("received", "problem"),
    [
        (good_table("competitions", rows=500)[:-8], "is not a readable gzip CSV file (EOFError)"),
        (b"<html>sign in to the network</html>", "is not a readable gzip CSV file (BadGzipFile)"),
        (table_without("competitions", "type"), "is missing the column 'type'"),
        (good_table("competitions", rows=0), "has zero rows"),
    ],
    ids=["cut short", "not a gzip file", "missing column", "zero rows"],
)
def test_download_that_fails_the_check_is_not_kept(
    received: bytes, problem: str, tmp_path: Path
) -> None:
    raw = tmp_path / "raw"
    old = good_table("competitions", rows=3)
    place(raw, {"competitions": old})

    with pytest.raises(ingest.IngestError) as stopped:
        list(ingest.ingest_tables(raw, force=True, opener=Source({"competitions": received})))

    assert str(stopped.value) == (
        f"table 'competitions' {problem}; it came from {address('competitions')} and was not kept"
    )
    assert (raw / "competitions.csv.gz").read_bytes() == old
    assert names_in(raw) == ["competitions.csv.gz"]


# Criterion 2: a table that is present is not downloaded again unless the run is forced.


def test_present_tables_are_not_downloaded_again(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    place(raw, good_tables())
    before = state_of(raw)

    reports = list(ingest.ingest_tables(raw, opener=no_download))

    assert reports == [ingest.TableReport(table, rows=2, downloaded=False) for table in NINE_TABLES]
    assert state_of(raw) == before


def test_only_the_missing_table_is_downloaded(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    tables = good_tables()
    place(raw, {table: content for table, content in tables.items() if table != "transfers"})
    source = Source(tables)

    reports = list(ingest.ingest_tables(raw, opener=source))

    assert source.asked == [address("transfers")]
    assert [report.table for report in reports if report.downloaded] == ["transfers"]
    assert names_in(raw) == NINE_FILES


def test_force_downloads_every_table_again(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    place(raw, good_tables(rows=2))
    fresh = good_tables(rows=4)
    source = Source(fresh)

    reports = list(ingest.ingest_tables(raw, force=True, opener=source))

    assert source.asked == [address(table) for table in NINE_TABLES]
    assert reports == [ingest.TableReport(table, rows=4, downloaded=True) for table in NINE_TABLES]
    assert all((raw / f"{table}.csv.gz").read_bytes() == fresh[table] for table in NINE_TABLES)
    assert names_in(raw) == NINE_FILES


def test_command_downloads_present_tables_again_only_with_the_force_option(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    place(tmp_path / "raw", good_tables(rows=2))
    director = Director(good_tables(rows=4))
    monkeypatch.setattr(ingest, "build_opener", director.build)

    assert cli.main(["ingest"]) == 0
    assert director.requests == []
    assert capsys.readouterr().out.splitlines() == [
        f"{table}: 2 rows (already present)" for table in NINE_TABLES
    ]

    assert cli.main(["ingest", "--force"]) == 0
    assert [request.full_url for request in director.requests] == [
        address(table) for table in NINE_TABLES
    ]
    assert capsys.readouterr().out.splitlines() == [
        f"{table}: 4 rows (downloaded)" for table in NINE_TABLES
    ]


# Criterion 3: a missing column stops the run with exit code 1; table and column are named.


def test_missing_column_stops_with_the_table_and_the_column_named(tmp_path: Path) -> None:
    path = tmp_path / "players.csv.gz"
    path.write_bytes(table_without("players", "foot"))

    with pytest.raises(ingest.IngestError) as stopped:
        ingest.check_table("players", path)

    assert str(stopped.value) == "table 'players' is missing the column 'foot'"


def test_every_missing_column_is_named(tmp_path: Path) -> None:
    path = tmp_path / "games.csv.gz"
    path.write_bytes(table_without("games", "date", "season"))

    with pytest.raises(ingest.IngestError) as stopped:
        ingest.check_table("games", path)

    assert str(stopped.value) == "table 'games' is missing the columns 'season', 'date'"


def test_file_without_a_header_row_stops_with_the_table_named(tmp_path: Path) -> None:
    path = tmp_path / "clubs.csv.gz"
    path.write_bytes(gzip.compress(b""))

    with pytest.raises(ingest.IngestError) as stopped:
        ingest.check_table("clubs", path)

    assert str(stopped.value) == "table 'clubs' is missing the columns 'club_id', 'name'"


def test_command_exits_with_code_1_when_a_column_is_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    broken = table_without("appearances", "minutes_played")
    place(tmp_path / "raw", good_tables() | {"appearances": broken})

    assert cli.main(["ingest"]) == 1

    printed = capsys.readouterr()
    assert printed.err == (
        "error: table 'appearances' is missing the column 'minutes_played'"
        f"{in_place('appearances', tmp_path / 'raw')}\n"
    )
    assert printed.out.splitlines() == [
        "competitions: 2 rows (already present)",
        "games: 2 rows (already present)",
    ]


def test_started_command_exits_with_code_1_when_a_column_is_missing(tmp_path: Path) -> None:
    broken = table_without("competitions", "confederation")
    place(tmp_path / "raw", good_tables() | {"competitions": broken})

    finished = run_command(tmp_path)

    assert finished.returncode == 1
    assert finished.stderr == (
        "error: table 'competitions' is missing the column 'confederation'"
        f"{in_place('competitions', tmp_path / 'raw')}\n"
    )
    assert finished.stdout == ""


# Criterion 4: a table with zero rows stops the run with a message that names the table.


def test_table_with_zero_rows_stops_with_the_table_named(tmp_path: Path) -> None:
    path = tmp_path / "clubs.csv.gz"
    path.write_bytes(good_table("clubs", rows=0))

    with pytest.raises(ingest.IngestError) as stopped:
        ingest.check_table("clubs", path)

    assert str(stopped.value) == "table 'clubs' has zero rows"


def test_blank_lines_do_not_count_as_rows(tmp_path: Path) -> None:
    path = tmp_path / "clubs.csv.gz"
    path.write_bytes(gzip.compress(b"club_id,name\n\n\n"))

    with pytest.raises(ingest.IngestError) as stopped:
        ingest.check_table("clubs", path)

    assert str(stopped.value) == "table 'clubs' has zero rows"


def test_command_exits_with_code_1_when_a_table_has_zero_rows(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    place(tmp_path / "raw", good_tables() | {"clubs": good_table("clubs", rows=0)})

    assert cli.main(["ingest"]) == 1

    printed = capsys.readouterr()
    assert printed.err == (
        f"error: table 'clubs' has zero rows{in_place('clubs', tmp_path / 'raw')}\n"
    )
    assert printed.out.splitlines() == [
        f"{table}: 2 rows (already present)" for table in NINE_TABLES[:-1]
    ]


# Criterion 5: the run prints the row count of each table, and never what a file holds.


def test_check_returns_the_number_of_data_rows(tmp_path: Path) -> None:
    path = tmp_path / "games.csv.gz"
    path.write_bytes(good_table("games", rows=7))

    assert ingest.check_table("games", path) == 7


def test_line_break_inside_a_cell_does_not_split_a_row(tmp_path: Path) -> None:
    path = tmp_path / "clubs.csv.gz"
    path.write_bytes(gzip.compress(b'club_id,name\n1,"two\nlines"\n2,"one line"\n'))

    assert ingest.check_table("clubs", path) == 2


def test_command_prints_one_line_per_table_with_its_row_count(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    rows = {table: index + 2 for index, table in enumerate(NINE_TABLES)}
    place(tmp_path / "raw", {table: good_table(table, rows[table]) for table in NINE_TABLES})

    assert cli.main(["ingest"]) == 0

    printed = capsys.readouterr()
    assert printed.out.splitlines() == [
        f"{table}: {rows[table]} rows (already present)" for table in NINE_TABLES
    ]
    assert printed.err == ""


def test_started_command_prints_nine_row_counts_and_exits_with_code_0(tmp_path: Path) -> None:
    rows = {table: index + 2 for index, table in enumerate(NINE_TABLES)}
    place(tmp_path / "raw", {table: good_table(table, rows[table]) for table in NINE_TABLES})

    finished = run_command(tmp_path)

    assert finished.returncode == 0
    assert finished.stdout.splitlines() == [
        f"{table}: {rows[table]} rows (already present)" for table in NINE_TABLES
    ]
    assert finished.stderr == ""


def test_same_tables_give_the_same_output(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    place(tmp_path / "raw", good_tables(rows=5))

    assert cli.main(["ingest"]) == 0
    first = capsys.readouterr()
    assert cli.main(["ingest"]) == 0

    assert capsys.readouterr() == first
    assert len(first.out.splitlines()) == 9


@pytest.mark.parametrize(
    ("players", "problem"),
    [
        (good_table("players"), ""),
        (table_without("players", "foot"), "is missing the column 'foot'"),
        (good_table("players", rows=0), "has zero rows"),
        (f"{CELL},{EXTRA_COLUMN}\n".encode(), "is not a readable gzip CSV file (BadGzipFile)"),
        (
            gzip.compress(b"\xff\xfe not text"),
            "is not a readable gzip CSV file (UnicodeDecodeError)",
        ),
        (good_table("players", rows=500)[:-8], "is not a readable gzip CSV file (EOFError)"),
        (b"", "is empty: the file has no bytes"),
        (
            gzip.compress(
                (",".join(config.EXPECTED_COLUMNS["players"]) + f'\n"{"x" * 200000}"\n').encode()
            ),
            "is not a readable gzip CSV file (csv: field larger than field limit (131072))",
        ),
    ],
    ids=[
        "complete",
        "missing column",
        "zero rows",
        "not a gzip file",
        "not text",
        "cut short",
        "zero bytes",
        "cell over the csv limit",
    ],
)
def test_output_never_holds_what_a_file_holds(
    players: bytes,
    problem: str,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    place(tmp_path / "raw", good_tables() | {"players": players})
    error = f"error: table 'players' {problem}{in_place('players', tmp_path / 'raw')}\n"

    assert cli.main(["ingest"]) == (1 if problem else 0)

    printed = capsys.readouterr()
    assert printed.err == (error if problem else "")
    assert CELL not in printed.out
    assert EXTRA_COLUMN not in printed.out + printed.err


# Criterion 6: data/raw is ignored by version control. That a run writes nothing but the raw
# folder is proved by test_command_downloads_missing_tables_and_writes_only_the_raw_folder.


def data_is_ignored_and_untracked(root: Path) -> bool:
    """Ask git whether the data of a checkout is ignored and holds no tracked file.

    Git refuses a path beyond a symbolic link, so when `data` is a link (story worktrees link
    it to the main checkout) git is asked about `data` itself.
    """
    if (root / "data").is_symlink():
        paths = ["data"]
    else:
        paths = ["data/raw", *(f"data/raw/{name}" for name in NINE_FILES)]
    for path in paths:
        ignored = subprocess.run(
            ["git", "check-ignore", "--quiet", "--no-index", path],
            cwd=root,
            check=False,
        )
        if ignored.returncode != 0:
            return False
    tracked = subprocess.run(
        ["git", "ls-files", "--", "data"], cwd=root, capture_output=True, text=True, check=True
    )
    return tracked.stdout == ""


def test_raw_folder_is_ignored_by_version_control() -> None:
    assert data_is_ignored_and_untracked(REPOSITORY_ROOT)


def test_ignore_check_holds_in_a_checkout_whose_data_folder_is_a_link(tmp_path: Path) -> None:
    main = tmp_path / "main"
    (main / "raw").mkdir(parents=True)
    checkout = tmp_path / "worktree"
    checkout.mkdir()
    (checkout / "data").symlink_to(main, target_is_directory=True)
    (checkout / ".gitignore").write_text(
        (REPOSITORY_ROOT / ".gitignore").read_text(encoding="utf-8"), encoding="utf-8"
    )
    subprocess.run(["git", "init", "--quiet"], cwd=checkout, check=True)
    beyond_link = subprocess.run(
        ["git", "check-ignore", "--quiet", "--no-index", "data/raw"], cwd=checkout, check=False
    )

    assert beyond_link.returncode == 128
    assert data_is_ignored_and_untracked(checkout)


# The command line.


def test_command_without_a_step_is_refused() -> None:
    with pytest.raises(SystemExit) as stopped:
        cli.main([])

    assert stopped.value.code == 2


# The real tables, when they are on this machine.


def test_real_tables_pass_the_check() -> None:
    raw = config.raw_dir()
    if not all((raw / name).is_file() for name in NINE_FILES):
        pytest.skip("the nine source tables are not in the data folder of this machine")

    rows = [ingest.check_table(table, raw / f"{table}.csv.gz") for table in NINE_TABLES]

    assert all(count > 0 for count in rows)


def test_command_download_fetches_the_smallest_real_table_from_the_real_address(
    tmp_path: Path,
) -> None:
    host = urlsplit(config.SOURCE_URL).hostname
    assert host is not None
    try:
        socket.create_connection((host, 443), timeout=5).close()
    except OSError:
        pytest.skip("the public source address cannot be reached from this machine")
    raw = tmp_path / "raw"

    report = ingest.ingest_table("competitions", raw, force=False, opener=ingest.open_address)

    assert report.table == "competitions"
    assert report.downloaded
    assert report.rows > 0
    assert names_in(raw) == ["competitions.csv.gz"]
    assert ingest.check_table("competitions", raw / "competitions.csv.gz") == report.rows


# Rework of review round 1: leftovers, remote text, limits, unparsable redirect, folder, mark.


def test_run_removes_partial_files_that_a_killed_run_left_behind(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    place(raw, good_tables())
    leftovers = [f".{table}.csv.gz.{'0' * 32}.part" for table in ("competitions", "game_lineups")]
    for name in leftovers:
        (raw / name).write_bytes(b"half a table")
    (raw / ".notes.part").write_bytes(b"not of this step")

    list(ingest.ingest_tables(raw, opener=no_download))

    assert names_in(raw) == sorted([*NINE_FILES, ".notes.part"])


def test_remote_text_reaches_the_error_without_control_characters(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    hostile = "\x1b]0;title\x07\x1b[2K\rcompetitions: 99 rows (downloaded)"

    def refusing(url: str) -> IO[bytes]:
        raise HTTPError(url, 403, hostile, HTTPMessage(), None)

    monkeypatch.setattr(ingest, "open_address", refusing)
    with pytest.raises(ingest.IngestError) as stopped:
        list(ingest.ingest_tables(tmp_path / "raw", opener=refusing))

    message = str(stopped.value)
    assert all(char.isprintable() for char in message)
    assert "\\x1b]0;title\\x07\\x1b[2K\\rcompetitions: 99 rows" in message

    monkeypatch.setattr(ingest, "build_opener", Director({}).build)
    monkeypatch.setattr(
        ingest, "check_table", lambda *_: pytest.fail("a refused download is not checked")
    )

    def hostile_open(url: str) -> NoReturn:
        raise URLError(hostile)

    monkeypatch.setattr(ingest, "open_address", hostile_open)
    assert cli.main(["ingest"]) == 1
    error = capsys.readouterr().err
    assert not any(char in error for char in "\x1b\x07\r")
    assert error.endswith("\n")


def test_download_larger_than_the_limit_is_stopped_with_the_table_named(tmp_path: Path) -> None:
    raw = tmp_path / "raw"
    limits = ingest.Limits(max_bytes=10)

    with pytest.raises(ingest.IngestError) as stopped:
        list(ingest.ingest_tables(raw, opener=Source(good_tables()), limits=limits))

    assert str(stopped.value) == (
        f"table 'competitions' is larger than 10 bytes; it came from {address('competitions')} "
        "and was not kept"
    )
    assert names_in(raw) == []


def test_download_that_takes_longer_than_the_limit_is_stopped_with_the_table_named(
    tmp_path: Path,
) -> None:
    raw = tmp_path / "raw"
    limits = ingest.Limits(max_seconds=0.0)

    with pytest.raises(ingest.IngestError) as stopped:
        list(ingest.ingest_tables(raw, opener=Source(good_tables()), limits=limits))

    assert str(stopped.value).startswith("table 'competitions' took longer than 0 seconds")
    assert names_in(raw) == []


def test_line_longer_than_the_limit_is_stopped_with_the_table_named(tmp_path: Path) -> None:
    path = tmp_path / "clubs.csv.gz"
    path.write_bytes(gzip.compress(b"club_id,name\n1," + b"x" * 500 + b"\n"))

    with pytest.raises(ingest.IngestError) as stopped:
        ingest.check_table("clubs", path, ingest.Limits(max_line_chars=100))

    assert str(stopped.value) == "table 'clubs' has a line longer than 100 characters"


def test_redirect_address_that_cannot_be_parsed_is_reported_with_the_table_named(
    tmp_path: Path,
) -> None:
    def unparsable(url: str) -> IO[bytes]:
        raise ValueError("Invalid IPv6 URL")

    with pytest.raises(ingest.IngestError) as stopped:
        list(ingest.ingest_tables(tmp_path / "raw", opener=unparsable))

    assert str(stopped.value) == (
        f"table 'competitions' could not be downloaded from {address('competitions')}: "
        "Invalid IPv6 URL"
    )


def test_command_names_the_table_before_each_download_and_keeps_the_row_count_lines(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    monkeypatch.setattr(ingest, "build_opener", Director(good_tables(rows=3)).build)

    assert cli.main(["ingest"]) == 0

    printed = capsys.readouterr()
    assert printed.err.splitlines() == [f"downloading {table} ..." for table in NINE_TABLES]
    assert printed.out.splitlines() == [f"{table}: 3 rows (downloaded)" for table in NINE_TABLES]


def test_raw_folder_that_cannot_be_searched_is_an_error_line_that_names_the_folder(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("FAIRSCOUT_DATA", str(tmp_path))
    raw = tmp_path / "raw"
    place(raw, good_tables())
    raw.chmod(0o000)
    try:
        assert cli.main(["ingest"]) == 1
    finally:
        raw.chmod(0o700)

    printed = capsys.readouterr()
    assert printed.err.startswith(f"error: the raw folder {raw} cannot be searched: ")
    assert printed.err.count("\n") == 1
    assert printed.out == ""


def test_byte_order_mark_before_the_header_is_not_part_of_the_first_column(tmp_path: Path) -> None:
    path = tmp_path / "clubs.csv.gz"
    path.write_bytes(gzip.compress(b"\xef\xbb\xbf" + gzip.decompress(good_table("clubs"))))

    assert ingest.check_table("clubs", path) == 2
