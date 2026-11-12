"""Builds app/public/data/basketball.json from the public statistics of EuroLeague and EuroCup.

Pool: players under 23 at the start of a season who played at least five games in EuroLeague or
EuroCup and averaged under 18 minutes. Outcome: a season with at least ten games and at least 20
minutes per game in either competition within the three following seasons. A logistic regression
is fitted on past pools and tested walk-forward: the pool of a season is scored by a model that saw
only pools whose three seasons had ended before it. Today's pool is the last finished season.

A table that is missing from the data folder is downloaded first from the competitions' public API.

It also writes basketball_references.json: everyone else of the last season with the pool's minimum
of games, scored against the pool. They can be named on the "Similar" screen and are never offered
as a match.

Usage: python scripts/basketball_data.py [--data data/basketball] [--out app/public/data/basketball.json]
       [--references-out app/public/data/basketball_references.json]
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import urllib.request
from pathlib import Path
from typing import Any

import pandas as pd
from tennis_data import new_model, percentile, percentile_against, tiers_of, top_count

SOURCE = "EuroLeague Basketball, public statistics of EuroLeague and EuroCup"
API = "https://api-live.euroleague.net"
COMPETITIONS = {"E": "EuroLeague", "U": "EuroCup"}
FIRST_SEASON, LAST_SEASON = 2007, 2025
MAX_AGE = 23.0
MIN_GAMES = 5
MAX_MINUTES = 18.0
TARGET_GAMES, TARGET_MINUTES = 10, 20.0
SEASONS_AHEAD = 3
FIRST_TEST_SEASON = 2013
LOW_SAMPLE_GAMES = 10
FEATURES = ["age", "mpg", "pir40", "pts40", "games", "euroleague"]
# For each input: the words when the player is above the past pools' average, and when below.
DRIVER_TEXT = {
    "age": ("Older than most of the pool", "Young for this level"),
    "mpg": ("Already gets minutes", "Very few minutes so far"),
    "pir40": ("Productive when on the floor", "Little production so far"),
    "pts40": ("Scores when on the floor", "Scores little"),
    "games": ("Used in many games", "Used in few games"),
    "euroleague": ("Plays in the EuroLeague", "Plays in the EuroCup"),
}


def fetch(url: str, target: Path) -> None:
    if target.exists():
        return
    print(f"basketball: downloading {target.name}")
    request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "fair-scout"})
    with urllib.request.urlopen(request, timeout=120) as response:
        target.write_bytes(response.read())


def download_missing(folder: Path) -> None:
    """Download the season statistics and the player lists that are not in the folder yet."""
    folder.mkdir(parents=True, exist_ok=True)
    for code in COMPETITIONS:
        for year in range(FIRST_SEASON, LAST_SEASON + 1):
            season = f"{code}{year}"
            stats = f"{API}/v3/competitions/{code}/statistics/players/traditional?seasonMode=Single&seasonCode={season}&statisticMode=Accumulated&limit=1000"
            people = f"{API}/v2/competitions/{code}/seasons/{season}/people?personType=J&limit=2000"
            fetch(stats, folder / f"stats_{season}.json")
            fetch(people, folder / f"people_{season}.json")


def proper(name: str) -> str:
    """ "BEGARIN, JUHANN" becomes "Juhann Begarin"."""
    last, _, first = name.partition(",")
    return " ".join(part.strip().title() for part in (first, last) if part.strip())


def read_tables(folder: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return one row per player and season (the competitions and clubs of a season summed), and the people."""
    lines, people = [], {}
    for code, competition in COMPETITIONS.items():
        for year in range(FIRST_SEASON, LAST_SEASON + 1):
            stats = json.loads((folder / f"stats_{code}{year}.json").read_text(encoding="utf-8"))
            for row in stats.get("players", []):
                lines.append(
                    {
                        "player": row["player"]["code"],
                        "season": year,
                        "competition": competition,
                        "team": row["player"]["team"]["name"],
                        "games": float(row["gamesPlayed"]),
                        "minutes": float(row["minutesPlayed"]),
                        "points": float(row["pointsScored"]),
                        "rebounds": float(row["totalRebounds"]),
                        "assists": float(row["assists"]),
                        "pir": float(row["pir"]),
                    }
                )
            listed = json.loads((folder / f"people_{code}{year}.json").read_text(encoding="utf-8"))
            for entry in listed.get("data", []):
                person = entry["person"]
                people[person["code"]] = {
                    "name": proper(person["name"]),
                    "birth": person.get("birthDate"),
                    "height": person.get("height"),
                    "country": (person.get("country") or {}).get("name"),
                    "position": entry.get("positionName") or people.get(person["code"], {}).get("position"),
                }
    if not lines:
        raise SystemExit(f"basketball_data: no tables in {folder}")
    table = pd.DataFrame(lines)
    totals = table.groupby(["player", "season"], as_index=False).agg(
        games=("games", "sum"), minutes=("minutes", "sum"), points=("points", "sum"),
        rebounds=("rebounds", "sum"), assists=("assists", "sum"), pir=("pir", "sum"),
    )  # fmt: skip
    main = table.sort_values("minutes", ascending=False).drop_duplicates(["player", "season"])[["player", "season", "competition", "team"]]
    seasons = totals.merge(main, on=["player", "season"])
    persons = pd.DataFrame.from_dict(people, orient="index")
    persons["birth"] = pd.to_datetime(persons["birth"], errors="coerce")
    return seasons, persons


def pool_of(season: int, seasons: pd.DataFrame, persons: pd.DataFrame, everyone: bool = False) -> pd.DataFrame:
    """Return the pool of one season with its features, one row per player. With `everyone`, the same
    for every player with the pool's minimum of games whose age is known, whatever his age and minutes."""
    rows = seasons.loc[seasons["season"] == season].join(persons, on="player")
    start = pd.Timestamp(year=season, month=10, day=1)
    rows = rows.assign(age=(start - rows["birth"]).dt.days / 365.25, mpg=rows["minutes"] / rows["games"].clip(lower=1))
    played = (rows["age"] > 14) & (rows["games"] >= MIN_GAMES)
    pool = rows.loc[played if everyone else played & (rows["age"] < MAX_AGE) & (rows["mpg"] < MAX_MINUTES)].copy()
    per40 = 40 / pool["minutes"].clip(lower=20)
    pool["pir40"] = pool["pir"] * per40
    pool["pts40"] = pool["points"] * per40
    pool["reb40"] = pool["rebounds"] * per40
    pool["ast40"] = pool["assists"] * per40
    pool["euroleague"] = (pool["competition"] == "EuroLeague").astype(float)
    return pool.reset_index(drop=True)


def add_outcome(pool: pd.DataFrame, seasons: pd.DataFrame) -> pd.DataFrame:
    """Add what happened in the three following seasons: `hit` (a season with enough games and minutes),
    `best_later` (the best minutes per game in a season with enough games) and `reached` (its first season)."""
    season = int(pool["season"].iloc[0])
    later = seasons.loc[seasons["season"].between(season + 1, season + SEASONS_AHEAD) & (seasons["games"] >= TARGET_GAMES)]
    later = later.assign(mpg=later["minutes"] / later["games"])
    best = later.groupby("player")["mpg"].max()
    first = later.loc[later["mpg"] >= TARGET_MINUTES].groupby("player")["season"].min()
    out = pool.copy()
    out["best_later"] = out["player"].map(best)
    out["reached"] = out["player"].map(first)
    out["hit"] = out["best_later"].fillna(0) >= TARGET_MINUTES
    return out


def hits_of_top(pool: pd.DataFrame, by: str, ascending: bool) -> int:
    ordered = pool.sort_values([by, "player"], ascending=[ascending, True])
    return int(ordered.head(top_count(len(pool)))["hit"].sum())


def backtest(pools: dict[int, pd.DataFrame]) -> tuple[dict[str, Any], pd.DataFrame]:
    """Walk forward over the labelled seasons and return the summary and the scored past pools."""
    scored = []
    for season in sorted(pools):
        seen = [pools[s] for s in pools if s + SEASONS_AHEAD < season]
        if season < FIRST_TEST_SEASON or not seen:
            continue
        train = pd.concat(seen, ignore_index=True)
        model = new_model().fit(train[FEATURES], train["hit"])
        test = pools[season].copy()
        test["score"] = model.predict_proba(test[FEATURES])[:, 1]
        test["tier"] = tiers_of(test["score"], test["player"])
        scored.append(test)
    past = pd.concat(scored, ignore_index=True)
    groups = [g for _, g in past.groupby("season")]
    picked = sum(top_count(len(g)) for g in groups)
    rate = float(past["hit"].mean())
    rules = [
        {"key": "model", "label": "Model", "hits": sum(hits_of_top(g, "score", False) for g in groups)},
        {"key": "minutes", "label": "Most minutes", "hits": sum(hits_of_top(g, "mpg", False) for g in groups)},
        {"key": "pir", "label": "Best index rating per game", "hits": sum(hits_of_top(g.assign(pirpg=g["pir"] / g["games"]), "pirpg", False) for g in groups)},
        {"key": "age", "label": "Youngest", "hits": sum(hits_of_top(g, "age", True) for g in groups)},
    ]
    for rule in rules:
        rule["rate_pct"] = round(100 * rule["hits"] / picked, 1)
    summary = {
        "years": [int(g["season"].iloc[0]) for g in groups],
        "pool": len(past),
        "pool_hits": int(past["hit"].sum()),
        "pool_rate_pct": round(100 * rate, 1),
        "picked": picked,
        "margin_pct": round(100 * 1.96 * math.sqrt(rate * (1 - rate) / picked), 1),
        "rules": rules,
        "tiers": {
            tier: {"n": int((past["tier"] == tier).sum()), "hits": int(past.loc[past["tier"] == tier, "hit"].sum())}
            for tier in ["A", "B", "C"]
        },
        "by_year": [
            {
                "year": int(g["season"].iloc[0]),
                "pool": len(g),
                "pool_hits": int(g["hit"].sum()),
                "picked": top_count(len(g)),
                "model_hits": hits_of_top(g, "score", False),
                "rank_hits": hits_of_top(g, "mpg", False),
            }
            for g in groups
        ],
    }
    return summary, past


def season_name(season: int) -> str:
    return f"{season}/{str(season + 1)[2:]}"


def past_player(row: Any) -> dict[str, Any]:
    return {
        "id": f"b{row.player}",
        "name": row.name_,
        "country": row.country,
        "team": row.team,
        "competition": row.competition,
        "age": round(float(row.age), 1),
        "mpg": round(float(row.mpg), 1),
        "tier": row.tier,
        "hit": bool(row.hit),
        "best_later": None if pd.isna(row.best_later) else round(float(row.best_later), 1),
        "reached": None if pd.isna(row.reached) else season_name(int(row.reached)),
    }


def time_machine(past: pd.DataFrame) -> list[dict[str, Any]]:
    """For each tested season: the model's tier A as it stood then, what happened to each player, and
    the players outside tier A who became rotation players all the same (the model's misses)."""
    years = []
    named = past.rename(columns={"name": "name_"})
    for season, pool in named.groupby("season"):
        ordered = pool.sort_values(["score", "player"], ascending=[False, True])
        top = ordered.loc[ordered["tier"] == "A"]
        missed = ordered.loc[(ordered["tier"] != "A") & ordered["hit"]].sort_values(["best_later", "player"], ascending=[False, True])
        years.append(
            {
                "year": int(season),
                "season": season_name(int(season)),
                "pool": len(pool),
                "pool_hits": int(pool["hit"].sum()),
                "tier_a": [past_player(row) for row in top.itertuples(index=False)],
                "tier_a_hits": int(top["hit"].sum()),
                "missed": [past_player(row) for row in missed.itertuples(index=False)],
            }
        )
    return years


def drivers_of(row: pd.Series, model: Any) -> list[dict[str, str]]:
    """The three strongest reasons for and the strongest reason against, from the fitted weights."""
    scaler, regression = model.named_steps["standardscaler"], model.named_steps["logisticregression"]
    scaled = (row[FEATURES].to_numpy(dtype=float) - scaler.mean_) / scaler.scale_
    parts = sorted(zip(FEATURES, scaled, scaled * regression.coef_[0], strict=True), key=lambda p: -p[2])
    words = {k: DRIVER_TEXT[k][0 if z > 0 else 1] for k, z, _ in parts}
    plus = [{"key": k, "sign": "+", "text": words[k]} for k, _, v in parts if v > 0][:3]
    minus = [{"key": k, "sign": "-", "text": words[k]} for k, _, v in reversed(parts) if v < 0][:1]
    return plus + minus


def history_of(player: str, seasons: pd.DataFrame, last: int) -> list[dict[str, Any]]:
    own = seasons.loc[(seasons["player"] == player) & (seasons["season"] <= last)].sort_values("season")
    return [
        {
            "season": season_name(int(r.season)),
            "team": r.team,
            "competition": r.competition,
            "games": int(r.games),
            "mpg": round(float(r.minutes / max(r.games, 1)), 1),
            "ppg": round(float(r.points / max(r.games, 1)), 1),
        }
        for r in own.itertuples(index=False)
    ]


REFERENCE_COLUMNS = ["id", "name", "team", "competition", "position", "age", "mpg", "scoring", "impact", "trust", "low_sample"]


def build_references(tables: tuple[pd.DataFrame, pd.DataFrame]) -> dict[str, Any]:
    """The players a scout can name on the "Similar" screen who are not in the pool: everyone else of the
    last season with the pool's minimum of games, the most minutes per game first. Their three scores
    are the pool's scores, measured against the pool: the share of the pool at or below the player."""
    seasons, persons = tables
    last = int(seasons["season"].max())
    pool = pool_of(last, seasons, persons)
    others = pool_of(last, seasons, persons, everyone=True)
    others = others.loc[~others["player"].isin(pool["player"])].sort_values(["mpg", "player"], ascending=[False, True])
    scoring = percentile_against(pool["pts40"], others["pts40"])
    impact = percentile_against(pool["pir40"], others["pir40"])
    trust = percentile_against(pool["mpg"], others["mpg"])
    rows = []
    for row in others.itertuples():
        rows.append(
            [
                f"b{row.player}",
                row.name,
                row.team,
                row.competition,
                row.position if isinstance(row.position, str) and row.position else None,
                round(float(row.age), 1),
                round(float(row.mpg), 1),
                int(scoring[row.Index]),
                int(impact[row.Index]),
                int(trust[row.Index]),
                int(row.games < LOW_SAMPLE_GAMES),
            ]
        )
    return {"meta": {"sport": "basketball", "season": season_name(last)}, "columns": REFERENCE_COLUMNS, "rows": rows}


def build(folder: Path, tables: tuple[pd.DataFrame, pd.DataFrame] | None = None) -> dict[str, Any]:
    seasons, persons = tables or read_tables(folder)
    last = int(seasons["season"].max())
    pools = {s: add_outcome(pool_of(s, seasons, persons), seasons) for s in range(FIRST_SEASON, last - SEASONS_AHEAD + 1)}
    summary, past = backtest(pools)
    labelled = pd.concat(pools.values(), ignore_index=True)
    model = new_model().fit(labelled[FEATURES], labelled["hit"])
    today = pool_of(last, seasons, persons)
    today["score"] = model.predict_proba(today[FEATURES])[:, 1]
    today["tier"] = tiers_of(today["score"], today["player"])
    today["pct_scoring"] = percentile(today["pts40"])
    today["pct_impact"] = percentile(today["pir40"])
    today["pct_trust"] = percentile(today["mpg"])
    today["score_rank_pct"] = percentile(today["score"])
    records = []
    for row in today.sort_values(["score", "player"], ascending=[False, True]).itertuples(index=False):
        series = pd.Series(row._asdict())
        games = max(row.games, 1)
        records.append(
            {
                "id": f"b{row.player}",
                "name": row.name,
                "country": row.country,
                "team": row.team,
                "competition": row.competition,
                "position": row.position if isinstance(row.position, str) and row.position else None,
                "height_cm": None if pd.isna(row.height) or not 160 <= float(row.height) <= 230 else int(row.height),
                "age": round(float(row.age), 1),
                "games": int(row.games),
                "mpg": round(float(row.mpg), 1),
                "ppg": round(float(row.points / games), 1),
                "rpg": round(float(row.rebounds / games), 1),
                "apg": round(float(row.assists / games), 1),
                "pirpg": round(float(row.pir / games), 1),
                "pts40": round(float(row.pts40), 1),
                "pir40": round(float(row.pir40), 1),
                "score": round(float(row.score), 4),
                "score_rank_pct": int(row.score_rank_pct),
                "tier": row.tier,
                "pct": {"scoring": int(row.pct_scoring), "impact": int(row.pct_impact), "trust": int(row.pct_trust)},
                "rating": int(row.pct_impact),
                "drivers": drivers_of(series, model),
                "flags": {"under20": bool(row.age < 20), "low_sample": bool(row.games < LOW_SAMPLE_GAMES)},
                "history": history_of(row.player, seasons, last),
            }
        )
    weights = model.named_steps["logisticregression"].coef_[0]
    return {
        "meta": {
            "sport": "basketball",
            "source": SOURCE,
            "season": season_name(last),
            "pool_rule": f"Players under {int(MAX_AGE)} at the start of the season with at least {MIN_GAMES} games in EuroLeague or EuroCup and under {int(MAX_MINUTES)} minutes per game.",
            "outcome": f"A season with at least {TARGET_GAMES} games and at least {int(TARGET_MINUTES)} minutes per game in EuroLeague or EuroCup within the next {SEASONS_AHEAD} seasons.",
            "target_minutes": TARGET_MINUTES,
            "pool": len(records),
            "model": "logistic regression",
            "trained_on": {"years": sorted(pools), "players": len(labelled)},
            "weights": {k: round(float(v), 3) for k, v in zip(FEATURES, weights, strict=True)},
            "backtest": summary,
        },
        "players": records,
        "timemachine": time_machine(past),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").splitlines()[0])
    parser.add_argument("--data", type=Path, default=Path("data/basketball"))
    parser.add_argument("--out", type=Path, default=Path("app/public/data/basketball.json"))
    parser.add_argument("--references-out", type=Path, default=Path("app/public/data/basketball_references.json"))
    args = parser.parse_args()
    download_missing(args.data)
    tables = read_tables(args.data)
    result = build(args.data, tables)
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    references = build_references(tables)
    args.references_out.write_text(json.dumps(references, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"basketball: {len(references['rows'])} players outside the pool can be named ({args.references_out.name})")
    meta, back = result["meta"], result["meta"]["backtest"]
    print(f"basketball: pool {meta['pool']} in {meta['season']}; trained on {meta['trained_on']['players']} past players")
    print(f"backtest {back['years'][0]}-{back['years'][-1]}: pool {back['pool']}, rate {back['pool_rate_pct']}%, picked {back['picked']}, margin ±{back['margin_pct']}")
    for rule in back["rules"]:
        print(f"  {rule['label']}: {rule['hits']} of {back['picked']} ({rule['rate_pct']}%)")
    print(f"  tiers: {back['tiers']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
