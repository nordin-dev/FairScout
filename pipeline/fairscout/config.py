"""Where the data lives, where the source tables come from, which columns they must hold and
which leagues have a long history in them.

Shared by every pipeline step. Nothing in this module reads or writes a file.
"""

import os
from collections.abc import Mapping
from pathlib import Path
from types import MappingProxyType
from typing import Final

DATA_ENV: Final = "FAIRSCOUT_DATA"

# Public address of the open Transfermarkt dataset; it needs no key and no account.
SOURCE_URL: Final = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data"

# The nine source tables, in the order they are processed, with the columns the later steps
# read: every column the prototype scripts in plan/prototip use, the game date behind
# `source_last_date` in meta.json, and the key columns of `transfers`. A table may hold more.
EXPECTED_COLUMNS: Final[Mapping[str, tuple[str, ...]]] = MappingProxyType(
    {
        "competitions": ("competition_id", "type", "confederation", "country_name"),
        "games": (
            "game_id",
            "competition_id",
            "season",
            "date",
            "home_club_id",
            "away_club_id",
            "home_club_goals",
            "away_club_goals",
        ),
        "appearances": (
            "game_id",
            "player_id",
            "player_club_id",
            "minutes_played",
            "goals",
            "assists",
        ),
        "game_lineups": ("game_id", "player_id", "club_id", "type"),
        "game_events": (
            "game_id",
            "minute",
            "type",
            "player_id",
            "description",
            "player_in_id",
            "player_assist_id",
        ),
        "player_valuations": (
            "player_id",
            "date",
            "market_value_in_eur",
            "player_club_domestic_competition_id",
        ),
        "transfers": ("player_id", "transfer_date", "from_club_id", "to_club_id", "transfer_fee"),
        "players": (
            "player_id",
            "name",
            "date_of_birth",
            "position",
            "sub_position",
            "foot",
            "height_in_cm",
            "contract_expiration_date",
            "country_of_citizenship",
            "country_of_birth",
            "market_value_in_eur",
            "highest_market_value_in_eur",
        ),
        "clubs": ("club_id", "name"),
    }
)

TABLES: Final[tuple[str, ...]] = tuple(EXPECTED_COLUMNS)

# The season the radar looks at, named by its start year: 2025 is 2025/26.
RADAR_SEASON: Final = 2025

# The test seasons of the backtest, named by their start year: 2017 to 2022 is 2017/18 to
# 2022/23, and the budget (EUR) of the pool the model is scored on in each of them.
BACKTEST_SEASONS: Final[tuple[int, ...]] = (2017, 2018, 2019, 2020, 2021, 2022)
BACKTEST_BUDGET: Final = 1_000_000

# The 14 first tiers with a long history in the source: 14 seasons (2012/13 to 2025/26) and
# rows in `appearances`. Competition id to the country name in English.
LONG_HISTORY_LEAGUES: Final[Mapping[str, str]] = MappingProxyType(
    {
        "IT1": "Italy",
        "ES1": "Spain",
        "GB1": "England",
        "FR1": "France",
        "TR1": "Türkiye",
        "L1": "Germany",
        "NL1": "Netherlands",
        "PO1": "Portugal",
        "BE1": "Belgium",
        "RU1": "Russia",
        "GR1": "Greece",
        "SC1": "Scotland",
        "UKR1": "Ukraine",
        "DK1": "Denmark",
    }
)

# The nine first tiers with a short history: seasons in `games`, but no `appearances` table.
# Competition id to the country name in English.
SHORT_HISTORY_LEAGUES: Final[Mapping[str, str]] = MappingProxyType(
    {
        "PL1": "Poland",
        "SER1": "Serbia",
        "TS1": "Czech Republic",
        "RO1": "Romania",
        "C1": "Switzerland",
        "KR1": "Croatia",
        "A1": "Austria",
        "NO1": "Norway",
        "SE1": "Sweden",
    }
)


def repository_root() -> Path:
    """Return the checkout root.

    The package is installed in editable mode, so this file lies in `pipeline/fairscout` of
    the checkout it belongs to.
    """
    return Path(__file__).resolve().parents[2]


def data_dir() -> Path:
    """Return the data folder: `FAIRSCOUT_DATA` when it is set, else `data` in the checkout root."""
    override = os.environ.get(DATA_ENV)
    return Path(override) if override else repository_root() / "data"


def raw_dir() -> Path:
    """Return the folder that holds the nine source tables."""
    return data_dir() / "raw"


def work_dir() -> Path:
    """Return the folder that holds the intermediate tables the pipeline steps write."""
    return data_dir() / "work"


def table_file(table: str) -> str:
    """Return the file name of a source table, the same at the source and in the raw folder."""
    return f"{table}.csv.gz"


def table_url(table: str) -> str:
    """Return the public address a source table is downloaded from."""
    return f"{SOURCE_URL}/{table_file(table)}"
