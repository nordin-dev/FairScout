"""Step `values`: the price at decision time and three seasons later for every player-season.

A season is named by its start year S. The decision value is the last valuation dated from
1 December S to 30 June S+1, both days included; the outcome is the last valuation in the same
window three seasons later (1 December S+3 to 30 June S+4). A player-season without a decision
value is left out and counted. A season without an outcome keeps its row: `value_outcome` is
empty and `made_it` false. `outcome_known` tells "did not make it" from "cannot be known yet":
it is true when the latest valuation in the source is dated in or after June of the year in
which the outcome window ends. A season whose outcome is not known has an empty outcome.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Final

import pandas as pd

from fairscout import config, ingest, rebuild, seasons
from fairscout.errors import StepError, require_file

VALUE_COLUMNS: Final[tuple[str, ...]] = (
    "value_decision",
    "value_decision_date",
    "value_outcome",
    "outcome_known",
    "made_it",
)
TABLE_COLUMNS: Final[tuple[str, ...]] = (*seasons.SEASON_COLUMNS, *VALUE_COLUMNS)
SEASONS_FILE: Final = "seasons.csv"
VALUATIONS_COLUMNS: Final[tuple[str, ...]] = ("player_id", "date", "market_value_in_eur")

WINDOW_START: Final = "-12-01"
WINDOW_END: Final = "-06-30"
OUTCOME_LAG: Final = 3
MADE_IT_FACTOR: Final = 2
MADE_IT_MINIMUM: Final = 1_000_000


@dataclass(frozen=True, slots=True)
class Values:
    """The season table with the value columns and the player-seasons left out for lack of a
    decision value."""

    table: pd.DataFrame
    excluded: int
    latest_valuation: pd.Timestamp


def sort_valuations(valuations: pd.DataFrame) -> pd.DataFrame:
    """Return the valuations (`player_id`, `date`, `market_value_in_eur`) sorted by player
    and date, as `date` and `value`. Valuations of one player on one day order by value, so
    the last one is the same whatever the input order."""
    frame = pd.DataFrame(
        {
            "player_id": valuations["player_id"].astype("int64"),
            "date": pd.to_datetime(valuations["date"], format="%Y-%m-%d"),
            "value": valuations["market_value_in_eur"].astype("int64"),
        }
    )
    return frame.sort_values(["date", "player_id", "value"], kind="stable").reset_index(drop=True)


def window_dates(season: "pd.Series[int]", lag: int) -> tuple[pd.Series, pd.Series]:
    """Return first and last day (both included) of the window of the season `lag` years on."""
    year = season.astype("int64") + lag
    start = pd.to_datetime(year.astype(str) + WINDOW_START, format="%Y-%m-%d")
    end = pd.to_datetime((year + 1).astype(str) + WINDOW_END, format="%Y-%m-%d")
    return start, end


def last_in_window(rows: pd.DataFrame, sorted_valuations: pd.DataFrame, lag: int) -> pd.DataFrame:
    """For every row of `rows` (`player_id`, `season`) return the last valuation inside the
    window `lag` seasons later as `date` and `value`, missing when there is none.

    The valuation is looked up as the last one dated on or before the window end, and it
    counts only when it is also on or after the window start, so nothing dated after the
    window is ever used. The result has the index of `rows`.
    """
    start, end = window_dates(rows["season"], lag)
    asked = pd.DataFrame({"player_id": rows["player_id"].astype("int64"), "end": end})
    asked["row"] = range(len(asked))
    asked = asked.sort_values("end", kind="stable")
    found = pd.merge_asof(
        asked,
        sorted_valuations.rename(columns={"date": "found_date"}),
        left_on="end",
        right_on="found_date",
        by="player_id",
        direction="backward",
    ).sort_values("row")
    inside = found["found_date"].to_numpy() >= start.to_numpy()
    result = pd.DataFrame(
        {
            "date": found["found_date"].where(inside),
            "value": found["value"].where(inside),
        }
    )
    result.index = rows.index
    return result


def attach_values(table: pd.DataFrame, valuations: pd.DataFrame) -> Values:
    """Add the columns of `VALUE_COLUMNS` to the season table.

    Rows without a decision value are left out and counted; no row is left out for a missing
    outcome. Made it needs an outcome of at least twice the decision value and at least
    1,000,000, and is false while the outcome is not known yet. The result is sorted by player,
    season and league.
    """
    ordered = sort_valuations(valuations)
    rows = table.sort_values(list(seasons.SEASON_KEY), kind="stable").reset_index(drop=True)
    decision = last_in_window(rows, ordered, 0)
    outcome = last_in_window(rows, ordered, OUTCOME_LAG)
    has_decision = decision["value"].notna()
    kept = rows.loc[has_decision].copy()
    decided = decision.loc[has_decision]
    outcome = outcome.loc[has_decision]
    latest = ordered["date"].max()
    # The rule: the outcome of season S is known once the source reaches 1 June of year S+4.
    # The source may end a few days before the window closes on 30 June, and a season must
    # not wait for those days.
    reached = pd.to_datetime(
        (kept["season"] + OUTCOME_LAG + 1).astype(str) + "-06-01", format="%Y-%m-%d"
    )
    known = reached <= latest
    kept["value_decision"] = decided["value"].astype("int64")
    kept["value_decision_date"] = decided["date"].dt.strftime("%Y-%m-%d")
    kept["outcome_known"] = known.to_numpy()
    kept["value_outcome"] = outcome["value"].where(kept["outcome_known"]).astype("Int64")
    doubled = (kept["value_outcome"] >= MADE_IT_FACTOR * kept["value_decision"]) & (
        kept["value_outcome"] >= MADE_IT_MINIMUM
    )
    kept["made_it"] = (doubled.fillna(False) & kept["outcome_known"]).astype("bool")
    return Values(
        table=kept[list(TABLE_COLUMNS)].reset_index(drop=True),
        excluded=int((~has_decision).sum()),
        latest_valuation=latest,
    )


def read_inputs(raw_dir: Path, work_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Read the two season tables put together and the valuations."""
    frames = []
    for name in (seasons.SEASONS_FILE, rebuild.SEASONS_FILE):
        step = "seasons" if name == seasons.SEASONS_FILE else "rebuild"
        path = require_file(work_dir / name, f"run the step `{step}` first")
        try:
            frames.append(pd.read_csv(path))
        except (pd.errors.ParserError, UnicodeDecodeError) as error:
            raise StepError(f"input file {path} is missing or unreadable: {error}") from error
    path = require_file(
        raw_dir / config.table_file("player_valuations"), "run the step `ingest` first"
    )
    valuations = pd.read_csv(path, usecols=list(VALUATIONS_COLUMNS))
    return pd.concat(frames, ignore_index=True), valuations


def write_values(raw_dir: Path, work_dir: Path) -> Values:
    """Read the inputs, attach the values and write `seasons.csv` into the work folder.

    The table is written next to its place and moved there when it is complete.
    """
    table, valuations = read_inputs(raw_dir, work_dir)
    built = attach_values(table, valuations)
    target = work_dir / SEASONS_FILE
    with ingest.partial_file(target) as partial:
        built.table.to_csv(partial, index=False, lineterminator="\n")
        partial.replace(target)
    return built
