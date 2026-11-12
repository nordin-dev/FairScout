"""Builds app/public/data/tennis.json from the open ATP tables of Jeff Sackmann / Tennis Abstract.

Pool: men under 21 on the ranking date, ranked 101 to 1000. Outcome: a ranking inside the top 100
at any time in the three years after the ranking date. A logistic regression is fitted on past
June pools and tested walk-forward: the pool of year Y is scored by a model that saw only pools
whose three years had ended before June of Y. Today's pool is the last ranking date in the data.

A table that is missing from the data folder is downloaded first. The author's own repository was
not reachable on 12 November 2026, so the tables come from an unchanged public fork of it.

It also writes tennis_references.json: everyone else ranked up to the pool's last ranking, scored
against the pool. They can be named on the "Similar" screen and are never offered as a match.

Usage: python scripts/tennis_data.py [--data data/tennis] [--out app/public/data/tennis.json]
       [--references-out app/public/data/tennis_references.json]
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import urllib.request
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

SOURCE = "Jeff Sackmann / Tennis Abstract, tennis_atp (CC BY-NC-SA 4.0)"
TABLES_URL = "https://raw.githubusercontent.com/Kadantte/tennis_atp/master/"
FIRST_MATCH_YEAR, LAST_MATCH_YEAR = 2011, 2026
MAX_AGE = 21.0
RANK_FROM, RANK_TO = 101, 1000
TOP = 100
YEARS_AHEAD = 3
FIRST_POOL_YEAR = 2012
FIRST_TEST_YEAR = 2017
UNRANKED = 2000
MIN_MATCHES = 15
TOP_SHARE = 0.10
FEATURES = ["age", "log_rank", "win_pct", "upper_share", "log_top200_wins"]
# For each input: the words when the player is above the pool's past average, and when below.
DRIVER_TEXT = {
    "age": ("Older than most of the pool", "Young for his ranking"),
    "log_rank": ("Still far from the top 100", "Already close to the top 100"),
    "win_pct": ("Wins most of his matches", "Loses often"),
    "upper_share": ("Plays at Challenger level or higher", "Mostly entry-level events"),
    "log_top200_wins": ("Beats top-200 players", "Few wins over top-200 players"),
}
COUNTRIES = {
    "ARG": "Argentina", "AUS": "Australia", "AUT": "Austria", "BEL": "Belgium", "BIH": "Bosnia-Herzegovina",
    "BRA": "Brazil", "BUL": "Bulgaria", "CAN": "Canada", "CHI": "Chile", "CHN": "China", "COL": "Colombia",
    "CRO": "Croatia", "CZE": "Czech Republic", "DEN": "Denmark", "ESP": "Spain", "FIN": "Finland",
    "FRA": "France", "GBR": "Great Britain", "GER": "Germany", "GRE": "Greece", "HUN": "Hungary",
    "IND": "India", "IRI": "Iran", "ITA": "Italy", "JPN": "Japan", "KAZ": "Kazakhstan", "KOR": "South Korea",
    "MAR": "Morocco", "MEX": "Mexico", "MKD": "North Macedonia", "MNE": "Montenegro", "NED": "Netherlands", "NOR": "Norway",
    "NZL": "New Zealand", "PER": "Peru", "POL": "Poland", "POR": "Portugal", "ROU": "Romania",
    "RSA": "South Africa", "RUS": "Russia", "SLO": "Slovenia", "SRB": "Serbia", "SUI": "Switzerland",
    "SVK": "Slovakia", "SWE": "Sweden", "TPE": "Chinese Taipei", "TUN": "Tunisia", "TUR": "Turkey",
    "UKR": "Ukraine", "URU": "Uruguay", "USA": "United States", "VEN": "Venezuela",
}


def table_names() -> list[str]:
    names = ["atp_players.csv", "atp_rankings_10s.csv", "atp_rankings_20s.csv", "atp_rankings_current.csv"]
    for year in range(FIRST_MATCH_YEAR, LAST_MATCH_YEAR + 1):
        names += [f"atp_matches_{year}.csv", f"atp_matches_qual_chall_{year}.csv", f"atp_matches_futures_{year}.csv"]
    return names


def download_missing(folder: Path) -> None:
    """Download every table that is not in the folder yet."""
    folder.mkdir(parents=True, exist_ok=True)
    for name in table_names():
        target = folder / name
        if target.exists():
            continue
        print(f"tennis: downloading {name}")
        with urllib.request.urlopen(TABLES_URL + name, timeout=300) as response:
            target.write_bytes(response.read())


def read_tables(folder: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Return players, rankings and matches. Matches carry `upper`: Challenger level or higher."""
    players = pd.read_csv(folder / "atp_players.csv", dtype={"wikidata_id": "string"})
    players["dob"] = pd.to_datetime(players["dob"].astype("Int64").astype("string"), format="%Y%m%d", errors="coerce")
    ranking_files = sorted(folder.glob("atp_rankings_*.csv"))
    rankings = pd.concat([pd.read_csv(f) for f in ranking_files], ignore_index=True)
    rankings["date"] = pd.to_datetime(rankings["ranking_date"].astype("string"), format="%Y%m%d")
    rankings = rankings.drop_duplicates(["date", "player"])[["date", "rank", "player"]]
    frames = []
    columns = ["tourney_date", "tourney_level", "winner_id", "loser_id", "winner_rank", "loser_rank", "score"]
    for path in sorted(folder.glob("atp_matches*_[0-9][0-9][0-9][0-9].csv")):
        frame = pd.read_csv(path, usecols=columns, dtype={"tourney_level": "string", "score": "string"})
        frame["upper"] = "futures" not in path.name
        frames.append(frame)
    if not frames or not ranking_files:
        raise SystemExit(f"tennis_data: no tables in {folder}")
    matches = pd.concat(frames, ignore_index=True)
    matches["date"] = pd.to_datetime(matches["tourney_date"].astype("string"), format="%Y%m%d", errors="coerce")
    walkover = matches["score"].fillna("").str.contains("W/O")
    matches = matches.loc[matches["date"].notna() & ~walkover]
    return players, rankings, matches


def last_date_on_or_before(dates: np.ndarray, day: pd.Timestamp) -> pd.Timestamp | None:
    earlier = dates[dates <= np.datetime64(day)]
    return None if len(earlier) == 0 else pd.Timestamp(earlier[-1])


def pool_at(day: pd.Timestamp, players: pd.DataFrame, rankings: pd.DataFrame, matches: pd.DataFrame, everyone: bool = False) -> pd.DataFrame:
    """Return the pool on a ranking date with its features, one row per player. With `everyone`, the
    same for every player ranked up to the pool's last ranking whose age is known, whatever his age."""
    dates = np.sort(rankings["date"].unique())
    now = rankings.loc[rankings["date"] == day, ["player", "rank"]]
    year_ago = last_date_on_or_before(dates, day - pd.Timedelta(days=364))
    before = rankings.loc[rankings["date"] == year_ago, ["player", "rank"]].rename(columns={"rank": "rank_before"})
    pool = now.merge(players[["player_id", "dob"]], left_on="player", right_on="player_id").merge(before, on="player", how="left")
    pool["age"] = (day - pool["dob"]).dt.days / 365.25
    in_pool = pool["rank"].between(RANK_FROM, RANK_TO) & (pool["age"] < MAX_AGE) & (pool["age"] > 14)
    pool = pool.loc[(pool["rank"] <= RANK_TO) & (pool["age"] > 14) if everyone else in_pool].copy()

    recent = matches.loc[(matches["date"] > day - pd.Timedelta(days=365)) & (matches["date"] <= day)]
    won = recent.groupby("winner_id").agg(
        wins=("upper", "size"),
        upper_wins=("upper", "sum"),
        top200_wins=("loser_rank", lambda r: int((r <= 200).sum())),
        best_win=("loser_rank", "min"),
    )
    lost = recent.groupby("loser_id").agg(losses=("upper", "size"), upper_losses=("upper", "sum"))
    pool = pool.join(won, on="player").join(lost, on="player")
    for column in ["wins", "upper_wins", "top200_wins", "losses", "upper_losses"]:
        pool[column] = pool[column].fillna(0).astype(int)
    pool["matches"] = pool["wins"] + pool["losses"]
    upper = pool["upper_wins"] + pool["upper_losses"]
    pool["upper_matches"] = upper
    pool["win_pct"] = (pool["wins"] + 2) / (pool["matches"] + 4)
    pool["upper_win_pct"] = (pool["upper_wins"] + 1) / (upper + 4)
    pool["upper_share"] = (upper / pool["matches"].clip(lower=1)).astype(float)
    pool["log_rank"] = np.log(pool["rank"])
    pool["log_matches"] = np.log1p(pool["matches"])
    pool["log_top200_wins"] = np.log1p(pool["top200_wins"])
    pool["climb"] = np.log(pool["rank_before"].fillna(UNRANKED).clip(upper=UNRANKED) / pool["rank"])
    pool["day"] = day
    return pool.drop(columns=["player_id"]).reset_index(drop=True)


def add_outcome(pool: pd.DataFrame, rankings: pd.DataFrame) -> pd.DataFrame:
    """Add what happened in the three years after the pool's date: `hit` (ranked inside the top 100 at
    any time), `best_later` (the best ranking) and `reached` (the first date inside the top 100)."""
    day = pool["day"].iloc[0]
    later = rankings.loc[(rankings["date"] > day) & (rankings["date"] <= day + pd.DateOffset(years=YEARS_AHEAD))]
    best = later.groupby("player")["rank"].min()
    first = later.loc[later["rank"] <= TOP].groupby("player")["date"].min()
    out = pool.copy()
    out["best_later"] = out["player"].map(best)
    out["reached"] = out["player"].map(first)
    out["hit"] = out["best_later"].fillna(UNRANKED) <= TOP
    return out


def new_model() -> Any:
    return make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))


def top_count(size: int) -> int:
    return max(1, math.ceil(size * TOP_SHARE))


def hits_of_top(pool: pd.DataFrame, by: str, ascending: bool) -> int:
    """Hits among the top 10% of the pool when it is ordered by one column; ties by player id."""
    ordered = pool.sort_values([by, "player"], ascending=[ascending, True])
    return int(ordered.head(top_count(len(pool)))["hit"].sum())


def tiers_of(scores: pd.Series, ids: pd.Series) -> pd.Series:
    """Top 10% by score is tier A, the next 10% tier B, the rest tier C; ties by player id."""
    order = pd.DataFrame({"score": scores, "id": ids}).sort_values(["score", "id"], ascending=[False, True]).index
    cut = top_count(len(scores))
    labels = pd.Series("C", index=scores.index)
    labels.loc[order[:cut]] = "A"
    labels.loc[order[cut : 2 * cut]] = "B"
    return labels


def backtest(pools: dict[int, pd.DataFrame]) -> tuple[dict[str, Any], pd.DataFrame]:
    """Walk forward over the labelled years and return the summary and the scored past pools."""
    scored = []
    for year in sorted(pools):
        seen = [pools[y] for y in pools if y + YEARS_AHEAD <= year]
        if year < FIRST_TEST_YEAR or not seen:
            continue
        train = pd.concat(seen, ignore_index=True)
        model = new_model().fit(train[FEATURES], train["hit"])
        test = pools[year].copy()
        test["score"] = model.predict_proba(test[FEATURES])[:, 1]
        test["tier"] = tiers_of(test["score"], test["player"])
        scored.append(test)
    past = pd.concat(scored, ignore_index=True)
    groups = [g for _, g in past.groupby("day")]
    picked = sum(top_count(len(g)) for g in groups)
    rate = float(past["hit"].mean())
    margin = 1.96 * math.sqrt(rate * (1 - rate) / picked)
    tier_stats = {
        tier: {"n": int((past["tier"] == tier).sum()), "hits": int(past.loc[past["tier"] == tier, "hit"].sum())}
        for tier in ["A", "B", "C"]
    }
    summary = {
        "years": [int(g["day"].iloc[0].year) for g in groups],
        "pool": len(past),
        "pool_hits": int(past["hit"].sum()),
        "pool_rate_pct": round(100 * rate, 1),
        "picked": picked,
        "margin_pct": round(100 * margin, 1),
        "rules": [
            {"key": "model", "label": "Model", "hits": sum(hits_of_top(g, "score", False) for g in groups)},
            {"key": "rank", "label": "Best ranking", "hits": sum(hits_of_top(g, "rank", True) for g in groups)},
            {"key": "wins", "label": "Most wins", "hits": sum(hits_of_top(g, "wins", False) for g in groups)},
            {"key": "age", "label": "Youngest", "hits": sum(hits_of_top(g, "age", True) for g in groups)},
        ],
        "tiers": tier_stats,
    }
    for rule in summary["rules"]:
        rule["rate_pct"] = round(100 * rule["hits"] / picked, 1)
    summary["by_year"] = [
        {
            "year": int(g["day"].iloc[0].year),
            "pool": len(g),
            "pool_hits": int(g["hit"].sum()),
            "picked": top_count(len(g)),
            "model_hits": hits_of_top(g, "score", False),
            "rank_hits": hits_of_top(g, "rank", True),
        }
        for g in groups
    ]
    return summary, past


def past_player(row: Any, names: pd.DataFrame) -> dict[str, Any]:
    person = names.loc[row.player]
    return {
        "id": f"t{row.player}",
        "name": f"{person['name_first']} {person['name_last']}".strip(),
        "country": COUNTRIES.get(str(person["ioc"]), str(person["ioc"])),
        "age": round(float(row.age), 1),
        "rank": int(row.rank),
        "tier": row.tier,
        "hit": bool(row.hit),
        "best_later": None if pd.isna(row.best_later) else int(row.best_later),
        "reached": None if pd.isna(row.reached) else row.reached.strftime("%Y-%m-%d"),
    }


def time_machine(past: pd.DataFrame, names: pd.DataFrame) -> list[dict[str, Any]]:
    """For each tested year: the model's tier A as it stood then, what happened to each player, and
    the players outside tier A who reached the top 100 all the same (the model's misses)."""
    years = []
    for day, pool in past.groupby("day"):
        ordered = pool.sort_values(["score", "player"], ascending=[False, True])
        top = ordered.loc[ordered["tier"] == "A"]
        missed = ordered.loc[(ordered["tier"] != "A") & ordered["hit"]].sort_values(["best_later", "player"])
        years.append(
            {
                "year": int(day.year),
                "date": day.strftime("%Y-%m-%d"),
                "pool": len(pool),
                "pool_hits": int(pool["hit"].sum()),
                "tier_a": [past_player(row, names) for row in top.itertuples(index=False)],
                "tier_a_hits": int(top["hit"].sum()),
                "missed": [past_player(row, names) for row in missed.itertuples(index=False)],
            }
        )
    return years


def percentile(values: pd.Series) -> pd.Series:
    """Whole percentile inside the pool, 1 to 100; the highest value gets 100."""
    return np.ceil(values.rank(pct=True, method="max") * 100).clip(1, 100).astype(int)


def percentile_against(pool: pd.Series, values: pd.Series) -> pd.Series:
    """Whole percentile, 1 to 100, of values from outside the pool: the share of the pool at or below
    each value. A value equal to a pool player's gets that player's percentile."""
    ordered = np.sort(pool.to_numpy(dtype=float))
    share = np.searchsorted(ordered, values.to_numpy(dtype=float), side="right") / len(ordered)
    return pd.Series(np.ceil(share * 100).clip(1, 100).astype(int), index=values.index)


REFERENCE_COLUMNS = ["id", "name", "country", "age", "rank", "wins", "level", "rise", "low_sample"]


def build_references(tables: tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]) -> dict[str, Any]:
    """The players a scout can name on the "Similar" screen who are not in the pool: everyone else ranked
    up to the pool's last ranking on the last ranking date, the best ranked first. Their three scores are
    the pool's scores, measured against the pool: the share of the pool at or below the player."""
    players, rankings, matches = tables
    last = pd.Timestamp(np.sort(rankings["date"].unique())[-1])
    pool = pool_at(last, players, rankings, matches)
    others = pool_at(last, players, rankings, matches, everyone=True)
    others = others.loc[~others["player"].isin(pool["player"])].sort_values(["rank", "player"])
    wins = percentile_against(pool["win_pct"], others["win_pct"])
    level = percentile_against(pool["upper_share"] + pool["upper_win_pct"], others["upper_share"] + others["upper_win_pct"])
    rise = percentile_against(pool["climb"], others["climb"])
    names = players.set_index("player_id")
    rows = []
    for row in others.itertuples():
        person = names.loc[row.player]
        rows.append(
            [
                f"t{row.player}",
                f"{person['name_first']} {person['name_last']}".strip(),
                COUNTRIES.get(str(person["ioc"]), str(person["ioc"])),
                round(float(row.age), 1),
                int(row.rank),
                int(wins[row.Index]),
                int(level[row.Index]),
                int(rise[row.Index]),
                int(row.matches < MIN_MATCHES),
            ]
        )
    return {"meta": {"sport": "tennis", "source_last_date": last.strftime("%Y-%m-%d")}, "columns": REFERENCE_COLUMNS, "rows": rows}


def drivers_of(row: pd.Series, model: Any) -> list[dict[str, str]]:
    """The three strongest reasons for and the strongest reason against, from the fitted weights."""
    scaler, regression = model.named_steps["standardscaler"], model.named_steps["logisticregression"]
    scaled = (row[FEATURES].to_numpy(dtype=float) - scaler.mean_) / scaler.scale_
    parts = sorted(zip(FEATURES, scaled, scaled * regression.coef_[0], strict=True), key=lambda p: -p[2])
    words = {k: DRIVER_TEXT[k][0 if z > 0 else 1] for k, z, _ in parts}
    plus = [{"key": k, "sign": "+", "text": words[k]} for k, _, v in parts if v > 0][:3]
    minus = [{"key": k, "sign": "-", "text": words[k]} for k, _, v in reversed(parts) if v < 0][:1]
    return plus + minus


def history_of(player: int, rankings: pd.DataFrame, day: pd.Timestamp) -> list[dict[str, Any]]:
    """The ranking at the last ranking date of each month over the three years before the pool's date."""
    own = rankings.loc[(rankings["player"] == player) & (rankings["date"] > day - pd.DateOffset(years=3)) & (rankings["date"] <= day)]
    monthly = own.sort_values("date").groupby(own["date"].dt.to_period("M")).tail(1)
    return [{"date": d.strftime("%Y-%m-%d"), "rank": int(r)} for d, r in zip(monthly["date"], monthly["rank"], strict=True)]


def build(folder: Path, tables: tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame] | None = None) -> dict[str, Any]:
    players, rankings, matches = tables or read_tables(folder)
    dates = np.sort(rankings["date"].unique())
    last = pd.Timestamp(dates[-1])
    pools: dict[int, pd.DataFrame] = {}
    for year in range(FIRST_POOL_YEAR, last.year - YEARS_AHEAD + 1):
        day = last_date_on_or_before(dates, pd.Timestamp(year=year, month=last.month, day=last.day))
        if day is None:
            continue
        pools[year] = add_outcome(pool_at(day, players, rankings, matches), rankings)
    summary, past = backtest(pools)

    labelled = pd.concat(pools.values(), ignore_index=True)
    model = new_model().fit(labelled[FEATURES], labelled["hit"])
    today = pool_at(last, players, rankings, matches)
    today["score"] = model.predict_proba(today[FEATURES])[:, 1]
    today["tier"] = tiers_of(today["score"], today["player"])
    today["pct_wins"] = percentile(today["win_pct"])
    today["pct_level"] = percentile(today["upper_share"] + today["upper_win_pct"])
    today["pct_rise"] = percentile(today["climb"])
    today["score_rank_pct"] = percentile(today["score"])
    names = players.set_index("player_id")
    records = []
    for row in today.sort_values(["score", "player"], ascending=[False, True]).itertuples(index=False):
        person = names.loc[row.player]
        series = pd.Series(row._asdict())
        height = person["height"]
        records.append(
            {
                "id": f"t{row.player}",
                "name": f"{person['name_first']} {person['name_last']}".strip(),
                "country_code": str(person["ioc"]),
                "country": COUNTRIES.get(str(person["ioc"]), str(person["ioc"])),
                "hand": {"R": "Right", "L": "Left"}.get(str(person["hand"]), None),
                "height_cm": None if pd.isna(height) or not 150 <= float(height) <= 215 else int(height),
                "age": round(float(row.age), 1),
                "rank": int(row.rank),
                "rank_year_ago": None if pd.isna(row.rank_before) else int(row.rank_before),
                "matches": int(row.matches),
                "wins": int(row.wins),
                "losses": int(row.losses),
                "upper_matches": int(row.upper_matches),
                "upper_wins": int(row.upper_wins),
                "top200_wins": int(row.top200_wins),
                "best_win_rank": None if pd.isna(row.best_win) else int(row.best_win),
                "score": round(float(row.score), 4),
                "score_rank_pct": int(row.score_rank_pct),
                "tier": row.tier,
                "pct": {"wins": int(row.pct_wins), "level": int(row.pct_level), "rise": int(row.pct_rise)},
                "rating": int(row.pct_wins),
                "drivers": drivers_of(series, model),
                "flags": {"under18": bool(row.age < 18), "low_sample": bool(row.matches < MIN_MATCHES)},
                "rank_history": history_of(int(row.player), rankings, last),
            }
        )
    weights = model.named_steps["logisticregression"].coef_[0]
    return {
        "meta": {
            "sport": "tennis",
            "source": SOURCE,
            "source_last_date": last.strftime("%Y-%m-%d"),
            "matches_last_date": matches["date"].max().strftime("%Y-%m-%d"),
            "pool_rule": f"Men under {int(MAX_AGE)} on the ranking date, ranked {RANK_FROM} to {RANK_TO}.",
            "outcome": f"Ranked inside the top {TOP} at any time in the next {YEARS_AHEAD} years.",
            "pool": len(records),
            "model": "logistic regression",
            "trained_on": {"years": sorted(pools), "players": int(sum(len(p) for p in pools.values()))},
            "weights": {k: round(float(v), 3) for k, v in zip(FEATURES, weights, strict=True)},
            "backtest": summary,
        },
        "players": records,
        "timemachine": time_machine(past, names),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--data", type=Path, default=Path("data/tennis"))
    parser.add_argument("--out", type=Path, default=Path("app/public/data/tennis.json"))
    parser.add_argument("--references-out", type=Path, default=Path("app/public/data/tennis_references.json"))
    args = parser.parse_args()
    download_missing(args.data)
    tables = read_tables(args.data)
    result = build(args.data, tables)
    args.out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    references = build_references(tables)
    args.references_out.write_text(json.dumps(references, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"tennis: {len(references['rows'])} players outside the pool can be named ({args.references_out.name})")
    meta, back = result["meta"], result["meta"]["backtest"]
    print(f"tennis: pool {meta['pool']} on {meta['source_last_date']}; trained on {meta['trained_on']['players']} past players")
    print(f"backtest {back['years'][0]}-{back['years'][-1]}: pool {back['pool']}, rate {back['pool_rate_pct']}%, picked {back['picked']}, margin ±{back['margin_pct']}")
    for rule in back["rules"]:
        print(f"  {rule['label']}: {rule['hits']} of {back['picked']} ({rule['rate_pct']}%)")
    print(f"  tiers: {back['tiers']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
