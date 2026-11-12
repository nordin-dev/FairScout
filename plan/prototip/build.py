"""Quick prototype: can a model find undervalued young players? Walk-forward backtest.
Usage: python -I proto.py <data_dir>
"""
import csv, gzip, sys, collections, datetime, math, bisect
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import roc_auc_score

D = sys.argv[1]
date = datetime.date


def rd(name):
    return csv.DictReader(gzip.open(f"{D}/{name}.csv.gz", "rt"))


comps = {c["competition_id"]: c for c in rd("competitions")}
EU = {k for k, c in comps.items() if c["type"] == "domestic_league" and c["confederation"] == "europa"}
NAME = {c: comps[c]["country_name"] for c in EU}
players = {p["player_id"]: p for p in rd("players")}
clubs = {c["club_id"]: c["name"] for c in rd("clubs")}


def dob(pid):
    p = players.get(pid)
    if not p or not p["date_of_birth"]:
        return None
    try:
        return date.fromisoformat(p["date_of_birth"][:10])
    except ValueError:
        return None


# ---------------- games: team points
G = {}
tp = collections.defaultdict(lambda: [0, 0])  # (club, season, comp) -> [points, games]
for g in rd("games"):
    c = g["competition_id"]
    if c not in EU:
        continue
    s = int(g["season"])
    G[g["game_id"]] = (c, s)
    try:
        hg, ag = int(g["home_club_goals"]), int(g["away_club_goals"])
    except ValueError:
        continue
    h, a = (g["home_club_id"], s, c), (g["away_club_id"], s, c)
    tp[h][1] += 1; tp[a][1] += 1
    if hg > ag: tp[h][0] += 3
    elif hg < ag: tp[a][0] += 3
    else: tp[h][0] += 1; tp[a][0] += 1

# ---------------- player-season-league-club aggregates
agg = collections.defaultdict(lambda: [0, 0, 0, 0])
FULL = set()
for a in rd("appearances"):
    cs = G.get(a["game_id"])
    if not cs:
        continue
    FULL.add(cs[0])
    v = agg[(a["player_id"], cs[1], cs[0], a["player_club_id"])]
    v[0] += int(a["minutes_played"] or 0); v[1] += int(a["goals"] or 0); v[2] += int(a["assists"] or 0); v[3] += 1
SHORT = EU - FULL

lin = collections.defaultdict(dict)
lclub = {}
for l in rd("game_lineups"):
    cs = G.get(l["game_id"])
    if cs and cs[0] in SHORT:
        lin[l["game_id"]][l["player_id"]] = l["type"]
        lclub[(l["game_id"], l["player_id"])] = l["club_id"]
ev = collections.defaultdict(list)
for e in rd("game_events"):
    cs = G.get(e["game_id"])
    if cs and cs[0] in SHORT:
        ev[e["game_id"]].append(e)
for gid, d in lin.items():
    start, end = {}, {}
    for pid, t in d.items():
        if t == "starting_lineup":
            start[pid] = 0; end[pid] = 90
    for e in sorted(ev[gid], key=lambda x: int(x["minute"] or 0)):
        m = min(int(e["minute"] or 0), 90)
        if e["type"] == "Substitutions":
            if e["player_id"] in start: end[e["player_id"]] = m
            if e["player_in_id"]:
                start[e["player_in_id"]] = m; end[e["player_in_id"]] = 90
        elif e["type"] == "Cards":
            dsc = e["description"].lower()
            if ("red" in dsc or "second yellow" in dsc) and e["player_id"] in start:
                end[e["player_id"]] = m
    c, s = G[gid]
    for pid in start:
        club = lclub.get((gid, pid))
        if club is None:
            continue
        v = agg[(pid, s, c, club)]
        v[0] += max(end[pid] - start[pid], 0); v[3] += 1
    for e in ev[gid]:
        if e["type"] != "Goals" or "wn-goal" in e["description"] or "wn goal" in e["description"]:
            continue
        for pid, j in ((e["player_id"], 1), (e["player_assist_id"], 2)):
            if pid and (gid, pid) in lclub and pid in start:
                agg[(pid, s, c, lclub[(gid, pid)])][j] += 1

# collapse to (pid, season, comp)
ps = {}
for (pid, s, c, club), v in agg.items():
    k = (pid, s, c)
    if k not in ps:
        ps[k] = {"min": 0, "g": 0, "a": 0, "apps": 0, "club": club, "cmin": -1}
    r = ps[k]
    r["min"] += v[0]; r["g"] += v[1]; r["a"] += v[2]; r["apps"] += v[3]
    if v[0] > r["cmin"]:
        r["cmin"] = v[0]; r["club"] = club
tot_min = collections.Counter()
for (pid, s, c), r in ps.items():
    tot_min[(pid, s)] += r["min"]
# keep main league per player-season
best = {}
for (pid, s, c), r in ps.items():
    if (pid, s) not in best or r["min"] > ps[(pid, s, best[(pid, s)])]["min"]:
        best[(pid, s)] = c

# ---------------- valuations
vals = collections.defaultdict(list)
for v in rd("player_valuations"):
    try:
        vals[v["player_id"]].append((date.fromisoformat(v["date"][:10]), float(v["market_value_in_eur"])))
    except ValueError:
        pass
for p in vals:
    vals[p].sort()


def val_in(pid, d0, d1):
    lst = vals.get(pid)
    if not lst:
        return None
    i = bisect.bisect_right(lst, (d1, float("inf"))) - 1
    if i >= 0 and lst[i][0] >= d0 and lst[i][1] > 0:
        return lst[i][1]
    return None


# ---------------- rows
rows = []
for (pid, s), c in best.items():
    r = ps[(pid, s, c)]
    if r["min"] < 450:
        continue
    p = players.get(pid)
    d = dob(pid)
    if not p or not d or p["position"] not in ("Attack", "Midfield", "Defender", "Goalkeeper"):
        continue
    v0 = val_in(pid, date(s, 12, 1), date(s + 1, 6, 30))
    if not v0:
        continue
    t = tp.get((r["club"], s, c), [0, 0])
    rows.append({
        "pid": pid, "s": s, "c": c, "club": r["club"], "pos": p["position"], "yob": d.year, "q": (d.month - 1) // 3 + 1,
        "age": (date(s + 1, 6, 30) - d).days / 365.25, "min": r["min"],
        "share": r["min"] / (t[1] * 90) if t[1] else 0.0, "ppg": t[0] / t[1] if t[1] else 1.3,
        "g90": 90 * r["g"] / r["min"], "a90": 90 * r["a"] / r["min"], "v0": v0,
        "vprev": val_in(pid, date(s - 1, 12, 1), date(s, 6, 30)),
        "v1": val_in(pid, date(s + 3, 12, 1), date(s + 4, 6, 30)) if s <= 2022 else None,
        "prev_min": tot_min.get((pid, s - 1), 0),
        "h": float(p["height_in_cm"]) if p["height_in_cm"] not in ("", "0") else None,
    })
print("player-seasons with 450+ min and a value at season end:", len(rows))
# reference distributions (all ages)
ref_ga = collections.defaultdict(list); club_v = collections.defaultdict(list); lg_v = collections.defaultdict(list)
for r in rows:
    ref_ga[(r["s"], r["c"], r["pos"])].append(r["g90"] + r["a90"])
    club_v[(r["club"], r["s"])].append(math.log(r["v0"]))
    lg_v[(r["c"], r["s"])].append(math.log(r["v0"]))
for dct in (ref_ga, club_v, lg_v):
    for k in dct:
        dct[k].sort()
medn = lambda x: x[len(x) // 2]
hs = sorted(r["h"] for r in rows if r["h"])
HMED = medn(hs)
for r in rows:
    lst = ref_ga[(r["s"], r["c"], r["pos"])]
    r["ga_pct"] = bisect.bisect_left(lst, r["g90"] + r["a90"]) / len(lst)
    r["club_med"] = medn(club_v[(r["club"], r["s"])])
    r["lg_med"] = medn(lg_v[(r["c"], r["s"])])


import json
top = {}
B5 = {"GB1", "ES1", "IT1", "L1", "FR1"}
for (pid, s, c), r in ps.items():
    if c in B5 and r["min"] >= 900:
        top.setdefault(pid, []).append(s)
json.dump({"rows": rows, "FULL": sorted(FULL), "NAME": NAME, "HMED": HMED, "big5": top,
           "names": {r["pid"]: players[r["pid"]]["name"] for r in rows},
           "clubs": clubs}, open(sys.argv[2], "w"))
print("dumped", len(rows))
