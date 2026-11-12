"""The fifteen quality checks that run on the assembled data before anything is written.

Numbered and named as in the list "Quality checks before export" of the business rules. Each
check is one function that takes the `CheckData` and returns a `Verdict`: whether it passed
and a short message with the figures. `run_checks` calls all fifteen in order and stops at the
first failure with a `StepError` that names the check by number and name.
"""

import re
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Final

import pandas as pd

from fairscout import backtest, config, contract, leagues, rebuild, values
from fairscout.errors import StepError

MIN_WITHIN_5_MINUTES: Final = 0.99
MAX_RANK_CORRELATION: Final = -0.7
LOWEST_LEAGUE: Final = "GB1"
MAX_SIMILAR: Final = 3
MAX_SENTENCE_WORDS: Final = 6
TIER_NAMES: Final[tuple[str, ...]] = ("A", "B", "C")
NOTE_NUMBER: Final = re.compile(r"(\d+(?:,\d{3})*)(\.\d+)?([kM]\b)?")
NOTE_SCALES: Final = (100, 90)
NOTE_SOURCES: Final = ("model", "template")
SEASON_LABEL: Final = re.compile(r"(\d{4})/\d{2}")


@dataclass(frozen=True, slots=True)
class TableInfo:
    """What the first look at a source table showed: its header and whether it has a data row."""

    columns: tuple[str, ...]
    has_rows: bool


@dataclass(frozen=True, slots=True)
class CheckData:
    """Everything the checks look at: the work tables and the five assembled files.

    `pool_rows` holds one row per radar pool player with `date_of_birth`, `position_group`,
    `value_eur` and `tier` as found in the tables, before they were turned into records.
    """

    source_tables: Mapping[str, TableInfo]
    minutes_check: Mapping[str, Any]
    rated: pd.DataFrame
    leagues: pd.DataFrame
    league_evidence: Mapping[str, Any]
    backtest: Mapping[str, Any]
    pools: pd.DataFrame
    pool_rows: pd.DataFrame
    files: Mapping[str, Any]
    tier_stats: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class Verdict:
    """The result of one check."""

    passed: bool
    message: str


@dataclass(frozen=True, slots=True)
class Outcome:
    """A verdict with the number and the name of its check."""

    number: int
    name: str
    verdict: Verdict


type Check = Callable[[CheckData], Verdict]


def ok(message: str) -> Verdict:
    """Return a passed verdict."""
    return Verdict(True, message)


def fail(message: str) -> Verdict:
    """Return a failed verdict."""
    return Verdict(False, message)


def check_01_source_tables(data: CheckData) -> Verdict:
    """Each of the nine tables has its expected columns and more than zero rows."""
    for table, expected in config.EXPECTED_COLUMNS.items():
        info = data.source_tables.get(table)
        if info is None:
            return fail(f"table {table} was not read")
        missing = [column for column in expected if column not in info.columns]
        if missing:
            return fail(f"table {table} lacks the columns {', '.join(missing)}")
        if not info.has_rows:
            return fail(f"table {table} has zero rows")
    return ok(f"{len(config.EXPECTED_COLUMNS)} tables have their columns and rows")


def check_02_rebuilt_minutes(data: CheckData) -> Verdict:
    """Rebuilt minutes on the test leagues are within 5 minutes in at least 99% of appearances."""
    share = float(data.minutes_check["within_5_min"])
    count = int(data.minutes_check["appearances"])
    if share < MIN_WITHIN_5_MINUTES:
        return fail(f"{share:.4f} of {count} appearances within 5 minutes, below the minimum")
    return ok(f"{share:.4f} of {count} appearances within 5 minutes")


def check_03_minutes_within_team(data: CheckData) -> Verdict:
    """No player has more minutes than his team played.

    Looked at are the rows that reach a file or the model: the young players of every season
    and every player of the radar season.
    """
    rows = data.rated
    played = rows["team_matches"].where(rows["team_matches"] > 0) * rebuild.MATCH_LENGTH
    looked_at = rows["young"] | (rows["season"] == config.RADAR_SEASON)
    too_many = int((looked_at & (rows["minutes"] > played)).sum())
    if too_many:
        return fail(f"{too_many} player-seasons have more minutes than their team played")
    return ok(f"{int(looked_at.sum())} player-seasons within their team's minutes")


def check_04_pool_basics(data: CheckData) -> Verdict:
    """Every pool player has a birth date, a position group and a value."""
    rows = data.pool_rows
    for column in ("date_of_birth", "position_group", "value_eur"):
        empty = int(rows[column].isna().sum())
        if empty:
            return fail(f"{empty} pool players have no {column}")
    return ok(f"{len(rows)} pool players have birth date, position group and value")


def check_05_factor_range(data: CheckData) -> Verdict:
    """Every league has a factor between 0.3 and 2.5."""
    table = data.leagues.set_index("league_id")["factor"]
    wanted = [*config.LONG_HISTORY_LEAGUES, *config.SHORT_HISTORY_LEAGUES]
    for league_id in wanted:
        factor = table.get(league_id)
        if factor is None or pd.isna(factor):
            return fail(f"league {league_id} has no factor")
        if not leagues.FACTOR_MIN <= float(factor) <= leagues.FACTOR_MAX:
            return fail(f"league {league_id} has factor {float(factor)}, outside the range")
    return ok(f"{len(wanted)} factors between {leagues.FACTOR_MIN} and {leagues.FACTOR_MAX}")


def check_06_england_lowest(data: CheckData) -> Verdict:
    """England has the lowest factor of the 14 leagues; the rank correlation is -0.7 or lower."""
    table = data.leagues.set_index("league_id")["factor"]
    measured = table[list(config.LONG_HISTORY_LEAGUES)].astype(float)
    lowest = str(measured.idxmin())
    if lowest != LOWEST_LEAGUE or int((measured <= measured[LOWEST_LEAGUE]).sum()) != 1:
        return fail(f"the lowest factor of the 14 leagues is {lowest}, not {LOWEST_LEAGUE}")
    correlation = float(data.league_evidence["rank_correlation"])
    if correlation > MAX_RANK_CORRELATION:
        return fail(f"rank correlation {correlation} is above {MAX_RANK_CORRELATION}")
    return ok(f"{LOWEST_LEAGUE} is lowest, rank correlation {correlation}")


def check_07_no_test_in_training(data: CheckData) -> Verdict:
    """No test season is in its own training set."""
    for entry in data.backtest["by_season"]:
        season = int(str(entry["season"]).split("/")[0])
        if season in [int(s) for s in entry["training_seasons"]]:
            return fail(f"test season {entry['season']} is in its own training set")
    return ok(f"{len(data.backtest['by_season'])} test seasons are not in their training sets")


def check_08_hits_plus_misses(data: CheckData) -> Verdict:
    """Hits plus misses equal picks in every row of the report."""
    count = 0
    for budget in data.backtest["budgets"]:
        for row in [*budget["rows"], *budget["rows_top20"]]:
            count += 1
            if row["hits"] + row["misses"] != row["picks"]:
                return fail(
                    f"{budget['budget_eur']} EUR, {row['rule']}: hits {row['hits']} plus "
                    f"misses {row['misses']} differ from picks {row['picks']}"
                )
    return ok(f"hits plus misses equal picks in {count} rows")


def check_09_tier_counts(data: CheckData) -> Verdict:
    """Counts per tier add up to the pool size."""
    records = [p for p in data.files["players"] if p["in_pool"]]
    counts = {name: sum(1 for p in records if p["tier"] == name) for name in TIER_NAMES}
    total = sum(counts.values())
    pool_size = int(data.files["meta"]["pool"]["up_to_1m"])
    if total != len(records) or total != pool_size or len(data.pool_rows) != pool_size:
        return fail(
            f"tiers A, B and C hold {total} players, the pool holds {pool_size} "
            f"and has {len(records)} records"
        )
    return ok(f"A {counts['A']} + B {counts['B']} + C {counts['C']} = {pool_size}")


def sentence_problem(
    record: Mapping[str, Any], entry: Mapping[str, Any], by_id: Mapping[str, Mapping[str, Any]]
) -> str | None:
    """What is wrong with the sentence of one pair, or None."""
    text = str(entry["diff"])
    who = f"player {record['id']} and {entry['id']}"
    if re.search(r"\b(nan|inf)\b", text, re.IGNORECASE):
        return f"{who}: the sentence '{text}' holds a number that is not a number"
    if len(text.split()) > MAX_SENTENCE_WORDS:
        return f"{who}: the sentence '{text}' is longer than {MAX_SENTENCE_WORDS} words"
    if re.search(r"\b(taller|shorter)\b", text) and (
        record["height_cm"] is None or by_id[entry["id"]]["height_cm"] is None
    ):
        return f"{who}: the sentence '{text}' names a height that one of them does not have"
    return None


def similar_problem(
    record: Mapping[str, Any],
    group_of: Mapping[str, str | None],
    by_id: Mapping[str, Mapping[str, Any]],
) -> str | None:
    """The first thing wrong with the list of one record, or None."""
    listed = record["similar"]
    if len(listed) > MAX_SIMILAR:
        return f"player {record['id']} has {len(listed)} similar players, at most {MAX_SIMILAR}"
    for entry in listed:
        other, score = entry["id"], entry["similarity"]
        if other == record["id"]:
            return f"player {record['id']} is listed as similar to himself"
        if other not in group_of:
            return f"player {record['id']} lists {other}, who is not in the pool"
        if group_of[other] != record["position_group"]:
            return f"player {record['id']} lists {other} from another position group"
        if isinstance(score, bool) or not isinstance(score, int) or not 0 <= score <= 100:
            return f"player {record['id']} has the similarity {score}, not a whole number 0 to 100"
        problem = sentence_problem(record, entry, by_id)
        if problem:
            return problem
    return None


def check_10_not_similar_to_self(data: CheckData) -> Verdict:
    """No player is similar to himself, and every list is well formed."""
    players = data.files["players"]
    group_of = {p["id"]: p["position_group"] for p in players if p["in_pool"]}
    by_id = {p["id"]: p for p in players}
    for record in players:
        problem = similar_problem(record, group_of, by_id)
        if problem:
            return fail(problem)
    listed = sum(len(p["similar"]) for p in players)
    return ok(f"{listed} similar players listed, none is the player himself")


def note_numbers(text: str) -> list[tuple[float, int, str]]:
    """The number tokens of a text as value, count of decimals and suffix (`k`, `M` or empty)."""
    return [
        (float(whole.replace(",", "") + fraction), max(len(fraction) - 1, 0), unit)
        for whole, fraction, unit in NOTE_NUMBER.findall(text)
    ]


def record_numbers(record: Mapping[str, Any], tier_stats: Mapping[str, Any]) -> list[float]:
    """The numbers of a pool record a note may use, apart from the price."""
    values_ = [record["minutes"], record["goals"], record["assists"], record["ga90"]]
    shown = "role" if record["flags"]["limited_position_data"] else "output"
    values_ += [record["pct"][shown], int(record["age"]), record["age"], *NOTE_SCALES]
    values_ += [x for x in (record["ga90_adj"],) if x is not None]
    rate = tier_stats.get(str(record["tier"]), {}).get("rate")
    if rate is not None:
        values_.append(float(rate) * 100)
    texts = [record["name"], record["club"], record["league_name"]]
    texts += [d["text"] for d in record["drivers"]]
    values_ += [token[0] for text in texts for token in note_numbers(str(text))]
    return [float(v) for v in values_]


def number_is_known(token: tuple[float, int, str], plain: Sequence[float], price: float) -> bool:
    """Whether a token equals a number of the record, to the decimals it is written with."""
    value, decimals, unit = token
    margin = 0.5 * 10.0**-decimals + 1e-9
    divisor = {"k": 1_000.0, "M": 1_000_000.0}.get(unit)
    if divisor is not None:
        return abs(price / divisor - value) <= margin
    return bool(any(abs(v - value) <= margin for v in [*plain, price]))


def note_problem_of(record: Mapping[str, Any], tier_stats: Mapping[str, Any]) -> str | None:
    """The first thing wrong with the note of one record, or None."""
    if not record["in_pool"]:
        if record["note"] is not None or record["note_source"] is not None:
            return f"player {record['id']} is outside the pool and has a note"
        return None
    who = f"the note of player {record['id']}"
    note = record["note"]
    if not isinstance(note, str) or not note.strip():
        return f"{who} no note for the player"
    if record["note_source"] not in NOTE_SOURCES:
        return f"{who} has the source {record['note_source']}"
    plain = record_numbers(record, tier_stats)
    price = float(record["value_eur"]) if record["value_eur"] is not None else float("nan")
    if any(not number_is_known(t, plain, price) for t in note_numbers(note)):
        return f"{who} failed the number check"
    return None


def check_11_notes_use_own_numbers(data: CheckData) -> Verdict:
    """Every pool player has a note and every number in it is a number of his record; players
    outside the pool have no note."""
    players = data.files["players"]
    for record in players:
        problem = note_problem_of(record, data.tier_stats)
        if problem:
            return fail(problem)
    noted = sum(1 for p in players if p["note"] is not None)
    return ok(f"{noted} notes checked")


def check_12_schema(data: CheckData) -> Verdict:
    """The output files pass the schema check."""
    for name in contract.FILES:
        try:
            contract.validate(name, data.files[name])
        except contract.ContractError as error:
            return fail(str(error))
    return ok(f"{len(contract.FILES)} files pass their schemas")


def season_start(label: str) -> int:
    """Return the start year of a season label such as `2019/20`."""
    return int(label.split("/")[0])


def check_13_no_late_training(data: CheckData) -> Verdict:
    """In the time machine no training row is from a season less than three before the one shown."""
    shown = data.files["timemachine"]["seasons"]
    for entry in shown:
        trained = [int(year) for year in SEASON_LABEL.findall(str(entry["trained_on"]))]
        limit = season_start(entry["season"]) - values.OUTCOME_LAG
        if not trained or max(trained) > limit:
            return fail(f"season {entry['season']} trains on {entry['trained_on']}, after {limit}")
    return ok(f"{len(shown)} shown seasons train only on seasons up to three years before")


def check_14_pool_complete(data: CheckData) -> Verdict:
    """The time machine pool holds every young player of the season up to 1,000,000 EUR."""
    rows = data.rated
    inside = rows["young"] & (rows["value_decision"] <= config.BACKTEST_BUDGET)
    shown = data.files["timemachine"]["seasons"]
    for entry in shown:
        expected = int((inside & (rows["season"] == season_start(entry["season"]))).sum())
        if int(entry["pool"]) != expected:
            return fail(f"season {entry['season']} pool is {entry['pool']}, expected {expected}")
    return ok(f"{len(shown)} shown pools hold every young player inside the budget")


def check_15_top_tenth(data: CheckData) -> Verdict:
    """The time machine list is exactly the top 10% of the pool, in the model's order."""
    shown = data.files["timemachine"]["seasons"]
    share = float(data.backtest["pick_share"])
    for entry in shown:
        label, picks = entry["season"], entry["picks"]
        pool = data.pools[data.pools["season"] == season_start(label)]
        wanted = backtest.pick_count(len(pool), share)
        ranked = pool.sort_values(["lr_rank", "player_id"], kind="mergesort").head(wanted)
        expected = [str(int(i)) for i in ranked["player_id"]]
        if len(picks) != wanted or int(entry["pool"]) != len(pool):
            return fail(f"season {label} lists {len(picks)} players, expected {wanted}")
        if [p["id"] for p in picks] != expected or [p["rank"] for p in picks] != list(
            range(1, wanted + 1)
        ):
            return fail(f"season {label} is not the top of the pool in the model's order")
    return ok(f"{len(shown)} shown lists are the top {share:.0%} of their pools in order")


CHECKS: Final[Sequence[tuple[int, str, Check]]] = (
    (1, "source tables", check_01_source_tables),
    (2, "rebuilt minutes", check_02_rebuilt_minutes),
    (3, "minutes within team", check_03_minutes_within_team),
    (4, "pool basics", check_04_pool_basics),
    (5, "factor range", check_05_factor_range),
    (6, "England lowest", check_06_england_lowest),
    (7, "no test season in training", check_07_no_test_in_training),
    (8, "hits plus misses", check_08_hits_plus_misses),
    (9, "tier counts", check_09_tier_counts),
    (10, "not similar to self", check_10_not_similar_to_self),
    (11, "notes use own numbers", check_11_notes_use_own_numbers),
    (12, "schema", check_12_schema),
    (13, "no late training rows", check_13_no_late_training),
    (14, "time machine pool complete", check_14_pool_complete),
    (15, "time machine top tenth", check_15_top_tenth),
)


def run_checks(data: CheckData, checks: Sequence[tuple[int, str, Check]] = CHECKS) -> list[Outcome]:
    """Run the checks in order and return their outcomes.

    The first failure stops the run with a `StepError` that names the check by number and
    name and gives its message.
    """
    outcomes: list[Outcome] = []
    for number, name, check in checks:
        verdict = check(data)
        if not verdict.passed:
            raise StepError(f"quality check {number} ({name}) failed: {verdict.message}")
        outcomes.append(Outcome(number, name, verdict))
    return outcomes
