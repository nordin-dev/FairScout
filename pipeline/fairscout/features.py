"""The feature table of the outlook model: 19 features for every young player-season.

One row per young player-season (the `young` mark of `rated.csv`) that has a decision value,
in every league and season. A season is named by its start year S and ends on 30 June S+1.
Every feature uses data dated up to that day: the decision value is the last valuation of
1 December S to 30 June S+1, the previous value the last one of 1 December S-1 to 30 June S,
and minutes of the previous season come from season S-1 only. `check_timing` proves it on the
finished table. Minutes of the previous season are divided by the share of that league
season's matches that have line-ups, summed over every league the player played in; the share
is exactly 1 for the 14 long-history leagues. Height stays empty here: the model fills it
from the training rows of each call.
"""

from collections.abc import Set
from typing import Final

import numpy as np
import pandas as pd

from fairscout import config, values
from fairscout.errors import StepError

FEATURES: Final[tuple[str, ...]] = (
    "age",
    "minutes",
    "role",
    "goals_per90",
    "assists_per90",
    "output_percentile",
    "log_value",
    "log_change",
    "change_missing",
    "prev_minutes",
    "team_points",
    "club_median",
    "vs_club",
    "league_median",
    "height",
    "pos_attack",
    "pos_midfield",
    "pos_defender",
    "pos_goalkeeper",
)
KEY: Final[tuple[str, ...]] = ("player_id", "season", "league_id")
LABELS: Final[tuple[str, ...]] = ("made_it", "outcome_known")
FEATURE_COLUMNS: Final[tuple[str, ...]] = (
    *KEY,
    *FEATURES,
    *LABELS,
    "value_decision",
    "value_date",
    "prev_value_date",
)
POSITION_MARKS: Final[dict[str, str]] = {
    "Attack": "pos_attack",
    "Midfield": "pos_midfield",
    "Defender": "pos_defender",
    "Goalkeeper": "pos_goalkeeper",
}
MIN_REFERENCE_MINUTES: Final = 450
NEUTRAL_POINTS: Final = 1.3
DAYS_PER_YEAR: Final = 365.25
RATED_COLUMNS: Final[tuple[str, ...]] = (
    *KEY,
    "club_id",
    "minutes",
    "goals",
    "assists",
    "value_decision",
    "value_decision_date",
    "outcome_known",
    "made_it",
    "position_group",
    "young",
    "role",
    "team_matches",
)
RESULT_COLUMNS: Final[tuple[str, ...]] = (
    "game_id",
    "competition_id",
    "season",
    "home_club_id",
    "away_club_id",
    "home_club_goals",
    "away_club_goals",
)


def lineup_shares(games: pd.DataFrame, lineup_games: Set[int]) -> pd.DataFrame:
    """Return `league_id`, `season` and `lineup_share` for the nine short-history leagues.

    The share is the matches that have line-ups divided by the matches with a result. A
    league season without a match with a result has no row.
    """
    short = games.loc[
        games["competition_id"].isin(list(config.SHORT_HISTORY_LEAGUES))
        & games["home_club_goals"].notna()
        & games["away_club_goals"].notna()
    ]
    frame = pd.DataFrame(
        {
            "league_id": short["competition_id"],
            "season": short["season"],
            "has": short["game_id"].isin(list(lineup_games)),
        }
    )
    grouped = frame.groupby(["league_id", "season"], sort=True)["has"].mean()
    result: pd.DataFrame = grouped.rename("lineup_share").reset_index()
    return result


def share_of(table: pd.DataFrame, shares: pd.DataFrame) -> pd.Series:
    """Return the share of matches with line-ups of every row's league season.

    It is exactly 1 for a long-history league; a short-history league without a share stops
    the run.
    """
    merged = table[["league_id", "season"]].merge(shares, on=["league_id", "season"], how="left")
    long = table["league_id"].isin(list(config.LONG_HISTORY_LEAGUES)).to_numpy()
    share = merged["lineup_share"].to_numpy(dtype="float64")
    share = np.where(long, 1.0, share)
    if np.isnan(share).any() or (share <= 0).any():
        raise StepError("a league season has no share of matches with line-ups")
    return pd.Series(share, index=table.index)


def previous_minutes(rated: pd.DataFrame, shares: pd.DataFrame) -> pd.DataFrame:
    """Return `player_id`, `season`, `prev_minutes` and `prev_min_season`.

    The minutes of season S-1 in every league, each divided by the share of that league
    season's matches that have line-ups, summed, are filed under season S.
    """
    rows = rated[["player_id", "season", "league_id", "minutes"]]
    scaled = rows["minutes"] / share_of(rows, shares)
    frame = pd.DataFrame(
        {
            "player_id": rows["player_id"],
            "season": rows["season"] + 1,
            "prev_minutes": scaled,
            "prev_min_season": rows["season"],
        }
    )
    result: pd.DataFrame = frame.groupby(["player_id", "season"], as_index=False, sort=True).agg(
        prev_minutes=("prev_minutes", "sum"), prev_min_season=("prev_min_season", "max")
    )
    return result


def team_points(games: pd.DataFrame) -> pd.DataFrame:
    """Return `team_points`, the points per match of every club, per league and season.

    A win is 3 points and a draw 1; only matches with a result count.
    """
    played = games.dropna(subset=["home_club_goals", "away_club_goals"])
    home_goals = played["home_club_goals"]
    away_goals = played["away_club_goals"]
    sides = []
    for side, mine, other in (
        ("home", home_goals, away_goals),
        ("away", away_goals, home_goals),
    ):
        points = np.where(mine > other, 3, np.where(mine == other, 1, 0))
        sides.append(
            pd.DataFrame(
                {
                    "league_id": played["competition_id"],
                    "season": played["season"],
                    "club_id": played[f"{side}_club_id"],
                    "points": points,
                }
            )
        )
    both = pd.concat(sides, ignore_index=True)
    grouped = both.groupby(["league_id", "season", "club_id"], sort=True)["points"].mean()
    result: pd.DataFrame = grouped.rename("team_points").reset_index()
    return result


def player_columns(players: pd.DataFrame) -> pd.DataFrame:
    """Return `player_id`, `birth_date` and `height` per player; height 0 counts as missing."""
    height = pd.to_numeric(players["height_in_cm"], errors="coerce")
    return pd.DataFrame(
        {
            "player_id": players["player_id"].astype("int64"),
            "birth_date": pd.to_datetime(players["date_of_birth"], errors="coerce"),
            "height": height.where(height > 0),
        }
    ).drop_duplicates("player_id")


def previous_values(rows: pd.DataFrame, valuations: pd.DataFrame) -> pd.DataFrame:
    """Return the last valuation of the previous season's window as `prev_value` and its
    date as `prev_value_date`, for the rows' index; a value of 0 or less is missing."""
    found = values.last_in_window(rows, values.sort_valuations(valuations), -1)
    positive = found["value"] > 0
    return pd.DataFrame(
        {
            "prev_value": found["value"].where(positive),
            "prev_value_date": found["date"].where(positive).dt.strftime("%Y-%m-%d"),
        }
    )


def group_medians(reference: pd.DataFrame, by: list[str], name: str) -> pd.DataFrame:
    """Return the median of `log_value` per group of `by` as `name`."""
    medians = reference.groupby(by, sort=True)["log_value"].median()
    result: pd.DataFrame = medians.rename(name).reset_index()
    return result


def reference_columns(rated: pd.DataFrame) -> pd.DataFrame:
    """Return the keys with `output_percentile`, `club_median` and `league_median`.

    The reference is every row of the table with at least 450 minutes and a position group
    (the percentile, against the same league, season and position group), and among them
    the rows with a decision value (the medians of club and league). The percentile is the
    share of the reference strictly below the row's goals plus assists per 90.
    """
    ref = rated.loc[
        (rated["minutes"] >= MIN_REFERENCE_MINUTES) & rated["position_group"].notna()
    ].copy()
    ref["output"] = 90 * (ref["goals"] + ref["assists"]) / ref["minutes"]
    group = ref.groupby(["league_id", "season", "position_group"], sort=False)["output"]
    ref["output_percentile"] = (group.rank(method="min") - 1) / group.transform("size")
    ref["log_value"] = np.log(ref["value_decision"])
    valued = ref.loc[ref["value_decision"] > 0]
    club = group_medians(valued, ["league_id", "season", "club_id"], "club_median")
    league = group_medians(valued, ["league_id", "season"], "league_median")
    out = ref[[*KEY, "club_id", "output_percentile"]].merge(
        club, on=["league_id", "season", "club_id"], how="left"
    )
    return out.merge(league, on=["league_id", "season"], how="left")


def check_timing(table: pd.DataFrame) -> None:
    """Stop with a `StepError` when a feature could use data from after the season's end.

    A `value_date` after 30 June S+1, a `prev_value_date` after 30 June S, or a
    `prev_min_season` (when the table has it) that is not S-1 is an error.
    """
    season = table["season"].astype("int64")
    late = pd.to_datetime(table["value_date"]) > pd.to_datetime((season + 1).astype(str) + "-06-30")
    late_prev = pd.to_datetime(table["prev_value_date"]) > pd.to_datetime(
        season.astype(str) + "-06-30"
    )
    wrong = pd.Series(False, index=table.index)
    if "prev_min_season" in table:
        wrong = table["prev_min_season"].notna() & (table["prev_min_season"] != season - 1)
    for broken, what in (
        (late, "a decision value dated after the end of its season"),
        (late_prev, "a previous value dated after the end of the previous season"),
        (wrong, "previous-season minutes from a season that is not the one before"),
    ):
        if broken.any():
            first = table.loc[broken].iloc[0]
            raise StepError(
                f"feature timing broken: {what}, {int(broken.sum())} rows, first player "
                f"{int(first['player_id'])} season {int(first['season'])}"
            )


def build_features(
    rated: pd.DataFrame,
    valuations: pd.DataFrame,
    games: pd.DataFrame,
    players: pd.DataFrame,
    shares: pd.DataFrame,
) -> pd.DataFrame:
    """Build the feature table from the rated table, the valuations, the matches with a
    result and their `game_id`, the players and the line-up shares.

    The result has `FEATURE_COLUMNS`, sorted by player, season and league. It is checked with
    `check_timing` before it is returned.
    """
    rows = rated.loc[rated["young"] & rated["value_decision"].notna(), list(RATED_COLUMNS)]
    rows = rows.sort_values(list(KEY), kind="stable").reset_index(drop=True)
    on = ["league_id", "season"]
    table = rows.merge(reference_columns(rated), on=[*KEY, "club_id"], how="left")
    table = table.merge(team_points(games), on=[*on, "club_id"], how="left")
    table = table.merge(player_columns(players), on="player_id", how="left")
    table = table.merge(previous_minutes(rated, shares), on=["player_id", "season"], how="left")
    table = pd.concat([table, previous_values(table, valuations)], axis=1)
    table = describe_rows(table)
    check_timing(table)
    return table[list(FEATURE_COLUMNS)]


def describe_rows(table: pd.DataFrame) -> pd.DataFrame:
    """Turn the joined columns into the 19 features and the label and date columns."""
    out = table.copy()
    end = pd.to_datetime((out["season"] + 1).astype(str) + "-06-30")
    out["age"] = (end - out["birth_date"]).dt.days / DAYS_PER_YEAR
    out["goals_per90"] = 90 * out["goals"] / out["minutes"]
    out["assists_per90"] = 90 * out["assists"] / out["minutes"]
    out["log_value"] = np.log(out["value_decision"])
    change = pd.Series(np.log(out["value_decision"] / out["prev_value"]), index=out.index)
    out["log_change"] = change.fillna(0.0)
    out["change_missing"] = out["prev_value"].isna().astype("float64")
    out["prev_minutes"] = out["prev_minutes"].fillna(0.0)
    out["team_points"] = out["team_points"].fillna(NEUTRAL_POINTS)
    out["vs_club"] = out["log_value"] - out["club_median"]
    for group, mark in POSITION_MARKS.items():
        out[mark] = (out["position_group"] == group).astype("float64")
    out["value_date"] = out["value_decision_date"]
    out["made_it"] = out["made_it"].astype("bool")
    out["outcome_known"] = out["outcome_known"].astype("bool")
    return out


def share_lines(shares: pd.DataFrame) -> list[str]:
    """Return one printed line for every league season with a share below 1."""
    short = shares.loc[shares["lineup_share"] < 1]
    return [
        f"line-up share below 1: {row.league_id} season {row.season}: {row.lineup_share:.3f}"
        for row in short.itertuples(index=False)
    ]
