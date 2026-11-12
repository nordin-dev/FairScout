"""Builds app/public/data/references.json: the players a scout can name on the "Similar" screen.

players.json holds the radar pool and the Bosnian players outside it, so a search for a well-known
player found nobody. This file adds every other player of the radar season with the minimum
minutes in one of the 23 leagues. They are only named, never offered as a match: matches still
come from the pool in players.json.

A player gets the same numbers as a player outside the pool in players.json: the league-adjusted
output of the step `rating`, as percentiles against every player of his position group with the
minimum minutes in the radar season (a young player keeps his percentiles among young players),
and the decision value of the season, or the latest valuation when there is none.

It reads the work tables of the pipeline, so the steps up to `rating` must have run:
`python -m fairscout all`, or the steps ingest, seasons, rebuild, values, leagues and rating.

Usage: python scripts/reference_players.py [--out app/public/data/references.json]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd
from fairscout import config, export, inputs, leagues, rating, tiers
from fairscout.errors import StepError

OUT = Path(__file__).resolve().parents[1] / "app" / "public" / "data" / "references.json"

# One row per player, in this order. The app reads the rows by these names.
COLUMNS = (
    "id",
    "name",
    "club",
    "league",
    "position",
    "group",
    "age",
    "value",
    "creating",
    "scoring",
    "role",
    "ga90",
    "ga90_adj",
    "low_sample",
    "born_q4",
)
SCORES = ("pct_creating", "pct_scoring", "pct_role")
NEEDED = ("name", "club", "league_name", "position_group", "date_of_birth", "value_eur", *SCORES)


def candidates(rated: pd.DataFrame) -> pd.DataFrame:
    """Return the players of the radar season outside the pool with the minimum minutes, one row
    each (the league with the most minutes), with percentiles filled where they are empty."""
    radar = rated.loc[rated["season"] == config.RADAR_SEASON]
    outside = radar.loc[(radar["minutes"] >= rating.MIN_MINUTES) & ~radar["in_pool"].astype(bool)]
    frame = export.one_per_player(outside).assign(in_pool=False).reset_index(drop=True)
    return export.fill_percentiles(frame, radar)


def player_frame(
    rated: pd.DataFrame,
    league_table: pd.DataFrame,
    players: pd.DataFrame,
    clubs: pd.DataFrame,
    valuations: pd.DataFrame,
) -> pd.DataFrame:
    """Join the candidates with their name, club, league and value; drop the incomplete ones."""
    frame = candidates(rated).merge(players, on="player_id", how="left")
    names = clubs.rename(columns={"name": "club"}).drop_duplicates("club_id")
    frame = frame.merge(names, on="club_id", how="left")
    frame = frame.merge(league_table[["league_id", "league_name"]], on="league_id", how="left")
    frame = frame.merge(export.latest_valuations(valuations), on="player_id", how="left")
    frame["value_eur"] = frame["value_decision"].fillna(frame["latest_value"])
    complete = frame[list(NEEDED)].notna().all(axis=1) & (frame["value_eur"] > 0)
    return frame.loc[complete].reset_index(drop=True)


def rows_of(frame: pd.DataFrame, last_date: pd.Timestamp) -> list[list[Any]]:
    """Turn the frame into rows in the order of COLUMNS, the most valuable player first."""
    flags = tiers.compute_flags(frame, last_date)
    born = pd.to_datetime(frame["date_of_birth"], errors="coerce")
    ages = ((last_date - born).dt.days / export.DAYS_PER_YEAR).round(1)
    rows: list[list[Any]] = []
    for i, row in enumerate(frame.to_dict("records")):
        position = export.clean(row["sub_position"]) or row["position_group"]
        rows.append(
            [
                str(int(row["player_id"])),
                str(row["name"]),
                str(row["club"]),
                str(row["league_name"]),
                str(position),
                str(row["position_group"]),
                float(ages.iloc[i]),
                export.whole_or_float(row["value_eur"]),
                int(row["pct_creating"]),
                int(row["pct_scoring"]),
                int(row["pct_role"]),
                round(float(row["ga90"]), 2),
                export.round_or_none(row["ga90_adj"], 2),
                int(bool(flags["flag_low_sample"].iloc[i])),
                int(bool(flags["flag_born_q4"].iloc[i])),
            ]
        )
    return sorted(rows, key=lambda r: (-r[7], r[0]))


def build(raw_dir: Path, work_dir: Path) -> dict[str, Any]:
    """Read the work tables and the source tables and return the file as data."""
    rated = inputs.read_csv_table(work_dir / rating.RATED_FILE, "rating", export.RATED_NEEDED)
    league_table = inputs.read_csv_table(
        work_dir / leagues.LEAGUES_FILE, "leagues", ("league_id", "league_name")
    )
    players = inputs.read_raw_columns(raw_dir, "players", export.PLAYER_COLUMNS)
    clubs = inputs.read_raw_columns(raw_dir, "clubs", ("club_id", "name"))
    valuations = inputs.read_raw_columns(
        raw_dir, "player_valuations", ("player_id", "date", "market_value_in_eur")
    )
    last_date = tiers.source_last_date(raw_dir)
    frame = player_frame(rated, league_table, players, clubs, valuations)
    start = config.RADAR_SEASON
    return {
        "meta": {
            "season": f"{start}/{(start + 1) % 100:02d}",
            "source_last_date": f"{last_date:%Y-%m-%d}",
            "min_minutes": rating.MIN_MINUTES,
        },
        "columns": list(COLUMNS),
        "rows": rows_of(frame, last_date),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--out", type=Path, default=OUT, help="the file to write")
    options = parser.parse_args(argv)
    try:
        data = build(config.raw_dir(), config.work_dir())
    except StepError as error:
        print(f"FAIL {error}", file=sys.stderr)
        return 1
    text = json.dumps(
        data, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False
    )
    options.out.parent.mkdir(parents=True, exist_ok=True)
    options.out.write_text(text, encoding="utf-8")
    by_league = pd.Series([row[3] for row in data["rows"]]).value_counts()
    print(f"{options.out.name}: {len(data['rows'])} players, {len(text.encode('utf-8'))} bytes")
    print("by league: " + ", ".join(f"{name} {count}" for name, count in by_league.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
