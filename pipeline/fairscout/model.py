"""Step `model`: train the outlook model and score the radar pool.

`score_season` takes a decision season S. It trains on the young players of the 14
long-history leagues in the seasons up to S-3 whose outcome is known, with a decision value of
at most 5,000,000 EUR; a player with no value three seasons later is a negative example. It
trains two models with fixed seeds, logistic regression on standardised features (the product
model) and gradient boosting with shallow trees (the challenger), and scores the pool of S: the
young players of that season with a decision value up to the budget. Fewer than 200 training
rows stop the run. The step writes `features.csv`, `scores.csv` and `model_facts.json` into the
work folder and nothing else.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.preprocessing import StandardScaler

from fairscout import config, features, ingest, rating
from fairscout.errors import StepError, require_file

FEATURES_FILE: Final = "features.csv"
SCORES_FILE: Final = "scores.csv"
FACTS_FILE: Final = "model_facts.json"
TRAINING_VALUE_LIMIT: Final = 5_000_000
OUTCOME_LAG: Final = 3
MIN_TRAINING_ROWS: Final = 200
DEFAULT_BUDGET: Final = 1_000_000
SCORE_COLUMNS: Final[tuple[str, ...]] = ("player_id", "season", "league_id", "score_lr", "score_gb")


@dataclass(frozen=True, slots=True)
class Scored:
    """The pool of one decision season with both scores, and the facts of the call."""

    pool: pd.DataFrame
    facts: dict[str, Any]


@dataclass(frozen=True, slots=True)
class ModelRun:
    """The result of the step: the scored radar season, the table, the lines printed."""

    scored: Scored
    table: pd.DataFrame
    report: list[str]


def logistic_model() -> Pipeline:
    """Return the product model: logistic regression on standardised features."""
    return make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=3000))


def boosting_model() -> HistGradientBoostingClassifier:
    """Return the challenger: gradient boosting with shallow trees and a fixed seed."""
    return HistGradientBoostingClassifier(
        max_depth=3,
        learning_rate=0.05,
        max_iter=250,
        l2_regularization=1.0,
        min_samples_leaf=30,
        random_state=0,
    )


def training_rows(table: pd.DataFrame, season: int) -> pd.DataFrame:
    """Return the training set of a decision season: seasons up to S-3 with a known outcome,
    the 14 long-history leagues, a decision value of at most 5,000,000 EUR."""
    keep = (
        (table["season"] <= season - OUTCOME_LAG)
        & table["outcome_known"]
        & table["league_id"].isin(list(config.LONG_HISTORY_LEAGUES))
        & (table["value_decision"] <= TRAINING_VALUE_LIMIT)
    )
    return table.loc[keep]


def matrix(rows: pd.DataFrame, height: float) -> np.ndarray[Any, np.dtype[np.float64]]:
    """Return the 19 features of the rows in the fixed order, empty heights filled."""
    filled = rows[list(features.FEATURES)].copy()
    filled["height"] = filled["height"].fillna(height)
    return filled.to_numpy(dtype="float64")


def score_season(
    table: pd.DataFrame,
    season: int,
    budget: int = DEFAULT_BUDGET,
    min_rows: int = MIN_TRAINING_ROWS,
) -> Scored:
    """Train on every season whose outcome was known at `season` and score that season's pool.

    The pool is the young players of the season (every league with rows) with a decision
    value up to `budget`. Fewer than `min_rows` training rows raise a `StepError` that names
    the season and the count.
    """
    train = training_rows(table, season)
    if len(train) < min_rows:
        raise StepError(
            f"decision season {season} has {len(train)} training rows, fewer than {min_rows}"
        )
    height = float(train["height"].median())
    if np.isnan(height):
        raise StepError(f"decision season {season}: no training row has a height")
    x_train = matrix(train, height)
    y_train = train["made_it"].to_numpy(dtype="int64")
    chosen = table.loc[(table["season"] == season) & (table["value_decision"] <= budget)]
    x_pool = matrix(chosen, height)
    logistic = logistic_model().fit(x_train, y_train)
    boosting = boosting_model().fit(x_train, y_train)
    pool = chosen[list(features.KEY)].reset_index(drop=True)
    pool["score_lr"] = positive_scores(logistic, x_pool)
    pool["score_gb"] = positive_scores(boosting, x_pool)
    return Scored(pool=pool, facts=describe_fit(season, budget, train, logistic, height))


def positive_scores(
    fitted: Pipeline | HistGradientBoostingClassifier, x: np.ndarray[Any, np.dtype[np.float64]]
) -> np.ndarray[Any, Any]:
    """Return the probability of the positive class for every row; none for an empty pool."""
    if len(x) == 0:
        return np.empty(0, dtype="float64")
    scores: np.ndarray[Any, Any] = fitted.predict_proba(x)[:, 1]
    return scores


def describe_fit(
    season: int, budget: int, train: pd.DataFrame, logistic: Pipeline, height: float
) -> dict[str, Any]:
    """Return the facts of a call: what it trained on and the numbers behind the reasons."""
    scaler: StandardScaler = logistic.named_steps["standardscaler"]
    regression: LogisticRegression = logistic.named_steps["logisticregression"]
    return {
        "decision_season": season,
        "budget": budget,
        "training_seasons": sorted(int(s) for s in train["season"].unique()),
        "training_rows": len(train),
        "positive_share": float(train["made_it"].mean()),
        "features": list(features.FEATURES),
        "coefficients": [float(c) for c in regression.coef_[0]],
        "intercept": float(regression.intercept_[0]),
        "means": [float(m) for m in scaler.mean_],
        "scales": [float(s) for s in scaler.scale_],
        "height_median": height,
    }


def read_games(raw_dir: Path) -> pd.DataFrame:
    """Read the matches of the source table `games`."""
    return rating.read_raw(raw_dir, "games", features.RESULT_COLUMNS)


def read_lineup_games(raw_dir: Path) -> set[int]:
    """Return the ids of the matches that have a line-up, reading only that column."""
    path = require_file(raw_dir / config.table_file("game_lineups"), "run the step `ingest` first")
    found: set[int] = set()
    for chunk in pd.read_csv(path, usecols=["game_id"], chunksize=500_000):
        found.update(int(g) for g in chunk["game_id"].unique())
    return found


def run_model(raw_dir: Path, work_dir: Path) -> ModelRun:
    """Read the inputs, build the feature table and score the radar season."""
    rated = rating.read_table(work_dir / rating.RATED_FILE, "rating")
    games = read_games(raw_dir)
    valuations = rating.read_raw(
        raw_dir, "player_valuations", ("player_id", "date", "market_value_in_eur")
    )
    players = rating.read_raw(raw_dir, "players", ("player_id", "date_of_birth", "height_in_cm"))
    shares = features.lineup_shares(games, read_lineup_games(raw_dir))
    table = features.build_features(rated, valuations, games, players, shares)
    scored = score_season(table, config.RADAR_SEASON)
    report = [
        f"{FEATURES_FILE}: {len(table)} rows",
        f"training rows, decision season {config.RADAR_SEASON}: {scored.facts['training_rows']}",
        f"share of positives in training: {scored.facts['positive_share']:.4f}",
        f"pool size: {len(scored.pool)} players",
        *features.share_lines(shares),
    ]
    return ModelRun(scored=scored, table=table, report=report)


def write_model(raw_dir: Path, work_dir: Path) -> ModelRun:
    """Run the step and write `features.csv`, `scores.csv` and `model_facts.json`."""
    run = run_model(raw_dir, work_dir)
    scores = run.scored.pool.sort_values(["score_lr", "player_id"], ascending=[False, True])
    outputs = (
        (FEATURES_FILE, run.table.to_csv(index=False, lineterminator="\n")),
        (SCORES_FILE, scores[list(SCORE_COLUMNS)].to_csv(index=False, lineterminator="\n")),
        (FACTS_FILE, json.dumps(run.scored.facts, indent=2) + "\n"),
    )
    for name, text in outputs:
        target = work_dir / name
        with ingest.partial_file(target) as partial:
            partial.write_text(text, encoding="utf-8")
            partial.replace(target)
    return run
