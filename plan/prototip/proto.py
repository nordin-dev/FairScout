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

young = [r for r in rows if r["s"] - r["yob"] <= 21]
print("young (turn 21 or younger in the season's start year):", len(young),
      "| in 14 full leagues, seasons <=2022:", sum(1 for r in young if r["c"] in FULL and r["s"] <= 2022),
      "| of those with value 3 years later:", sum(1 for r in young if r["c"] in FULL and r["s"] <= 2022 and r["v1"]))

FEATS = ["age", "min", "share", "g90", "a90", "ga_pct", "logv0", "mom", "mom_miss", "prev_min", "ppg", "club_med",
         "rel_v", "lg_med", "h", "p_att", "p_mid", "p_def", "p_gk"]


def fx(r):
    lv = math.log(r["v0"])
    return [r["age"], r["min"], r["share"], r["g90"], r["a90"], r["ga_pct"], lv,
            math.log(r["v0"] / r["vprev"]) if r["vprev"] else 0.0, 0.0 if r["vprev"] else 1.0, r["prev_min"], r["ppg"],
            r["club_med"], lv - r["club_med"], r["lg_med"], r["h"] or HMED,
            float(r["pos"] == "Attack"), float(r["pos"] == "Midfield"), float(r["pos"] == "Defender"), float(r["pos"] == "Goalkeeper")]


lab = [r for r in young if r["c"] in FULL and r["s"] <= 2022 and r["v1"]]
for r in lab:
    r["y"] = 1 if r["v1"] >= 2 * r["v0"] else 0
print("labelled:", len(lab), "| base rate (value at least doubled in 3 years):", round(100 * np.mean([r["y"] for r in lab]), 1), "%")


def gb():
    return HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=250, l2_regularization=1.0,
                                          min_samples_leaf=30, random_state=0)


def lr():
    return make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=2000))


TRAIN_CAP = 5e6
preds = []  # per test row dict
for T in range(2017, 2023):
    tr = [r for r in lab if r["s"] <= T - 3 and r["v0"] <= TRAIN_CAP]
    te = [r for r in lab if r["s"] == T and r["v0"] <= TRAIN_CAP]
    Xtr = np.array([fx(r) for r in tr]); ytr = np.array([r["y"] for r in tr])
    Xte = np.array([fx(r) for r in te])
    m1 = gb().fit(Xtr, ytr); m2 = lr().fit(Xtr, ytr)
    p1 = m1.predict_proba(Xte)[:, 1]; p2 = m2.predict_proba(Xte)[:, 1]
    for r, a, b in zip(te, p1, p2):
        preds.append({**r, "gb": a, "lr": b, "T": T, "ntrain": len(tr)})
    print(f"  T={T}: train {len(tr)} (seasons 2012-{T-3}) | test {len(te)}")


def evaluate(sub, title):
    y = np.array([r["y"] for r in sub])
    print(f"\n--- {title}: n={len(sub)} | base rate {100*y.mean():.1f}%")
    scores = {
        "model GB": np.array([r["gb"] for r in sub]),
        "model LR": np.array([r["lr"] for r in sub]),
        "samo golovi+asistencije/90": np.array([r["g90"] + r["a90"] for r in sub]),
        "samo najmladji": np.array([-r["age"] for r in sub]),
        "samo najvise minuta": np.array([r["min"] for r in sub]),
        "samo najjeftiniji": np.array([-r["v0"] for r in sub]),
    }
    rng = np.random.default_rng(0)
    for name, sc in scores.items():
        auc = roc_auc_score(y, sc)
        out = []
        for frac in (0.10, 0.20):
            hit = n = 0; mult = []
            for T in sorted({r["T"] for r in sub}):
                idx = [i for i, r in enumerate(sub) if r["T"] == T]
                k = max(1, round(frac * len(idx)))
                order = sorted(idx, key=lambda i: (-sc[i], rng.random()))[:k]
                hit += sum(y[i] for i in order); n += k
                mult += [sub[i]["v1"] / sub[i]["v0"] for i in order]
            out.append(f"top {int(frac*100)}%: {100*hit/n:.1f}% (n={n}, medijan x{sorted(mult)[len(mult)//2]:.2f})")
        print(f"  {name:28} AUC {auc:.3f} | " + " | ".join(out))


evaluate(preds, "svi mladi do 5M")
evaluate([r for r in preds if r["v0"] <= 1e6], "mladi do 1M")
evaluate([r for r in preds if r["v0"] <= 5e5], "mladi do 500k")
BIG5 = {"GB1", "ES1", "IT1", "L1", "FR1"}
evaluate([r for r in preds if r["v0"] <= 1e6 and r["c"] not in BIG5], "mladi do 1M, izvan top 5 liga")
evaluate([r for r in preds if r["v0"] <= 1e6 and r["pos"] in ("Defender", "Goalkeeper")], "mladi do 1M, odbrana i golmani")
evaluate([r for r in preds if r["v0"] <= 1e6 and r["pos"] in ("Attack", "Midfield")], "mladi do 1M, napad i vezni")

# absolute outcome for cheap picks
cheap = [r for r in preds if r["v0"] <= 1e6]
for T in sorted({r["T"] for r in cheap}):
    sub = sorted([r for r in cheap if r["T"] == T], key=lambda r: -r["gb"])
    k = max(1, round(0.1 * len(sub)))
    top, rest = sub[:k], sub[k:]
    print(f"  sezona {T}: top 10% modela n={k}: udvostrucili {100*np.mean([r['y'] for r in top]):.0f}% , dosegli 2M+ {100*np.mean([r['v1']>=2e6 for r in top]):.0f}%"
          f" | ostali n={len(rest)}: {100*np.mean([r['y'] for r in rest]):.0f}% , 2M+ {100*np.mean([r['v1']>=2e6 for r in rest]):.0f}%")

# feature importance via permutation on pooled test (GB retrained on all labelled <=2019 -> test 2022 for a rough view)
tr = [r for r in lab if r["s"] <= 2019 and r["v0"] <= TRAIN_CAP]; te = [r for r in lab if r["s"] == 2022 and r["v0"] <= TRAIN_CAP]
m = gb().fit(np.array([fx(r) for r in tr]), np.array([r["y"] for r in tr]))
Xte = np.array([fx(r) for r in te]); yte = np.array([r["y"] for r in te])
base = roc_auc_score(yte, m.predict_proba(Xte)[:, 1])
rng = np.random.default_rng(1)
imp = []
for j, f in enumerate(FEATS):
    drops = []
    for _ in range(10):
        Xp = Xte.copy(); Xp[:, j] = rng.permutation(Xp[:, j])
        drops.append(base - roc_auc_score(yte, m.predict_proba(Xp)[:, 1]))
    imp.append((np.mean(drops), f))
print("\nvaznost osobina (pad AUC kad se osobina izmijesa), test 2022, AUC", round(base, 3))
for d, f in sorted(imp, reverse=True)[:10]:
    print(f"  {f:10} {d:+.3f}")

# example picks
for T in (2019, 2021):
    sub = sorted([r for r in preds if r["T"] == T and r["v0"] <= 1e6], key=lambda r: -r["gb"])[:12]
    print(f"\nPrimjer: 12 najboljih po modelu, sezona {T}/{str(T+1)[2:]} (vrijednost do 1M), model treniran na sezonama 2012-{T-3}")
    for r in sub:
        p = players[r["pid"]]
        hv = p["highest_market_value_in_eur"]
        print(f"  {p['name'][:26]:26} {r['age']:.1f}g {r['pos'][:3]} {clubs.get(r['club'], r['club'])[:22]:22} {NAME[r['c']][:11]:11} "
              f"{r['v0']/1e6:5.2f}M -> {r['v1']/1e6:6.2f}M (x{r['v1']/r['v0']:.1f}) max {float(hv)/1e6 if hv else 0:.1f}M  p={r['gb']:.2f}")

# ---------------- fairness: birth quarter
print("\n=== Kvartal rodjenja i rast vrijednosti (mladi, 14 liga, sezone 2012-2022)")
for name, sub in (("svi", lab), ("do 1M", [r for r in lab if r["v0"] <= 1e6])):
    print(" ", name, "| " + " | ".join(
        f"Q{q}: n={sum(1 for r in sub if r['q']==q)} udvostrucili {100*np.mean([r['y'] for r in sub if r['q']==q]):.1f}%" for q in (1, 2, 3, 4)))
# one row per player (first qualifying season) to avoid repeated players
first = {}
for r in sorted(lab, key=lambda r: r["s"]):
    first.setdefault(r["pid"], r)
fl = list(first.values())
print("  po igracu (prva sezona) | " + " | ".join(
    f"Q{q}: n={sum(1 for r in fl if r['q']==q)} udvostrucili {100*np.mean([r['y'] for r in fl if r['q']==q]):.1f}% , medijan v0 {np.median([r['v0'] for r in fl if r['q']==q])/1e6:.2f}M"
    for q in (1, 2, 3, 4)))
pq = collections.defaultdict(list)
for r in preds:
    pq[r["q"]].append(r)
print("  model na testu | " + " | ".join(
    f"Q{q}: n={len(pq[q])} stvarno {100*np.mean([r['y'] for r in pq[q]]):.1f}% , model predvidja {100*np.mean([r['gb'] for r in pq[q]]):.1f}%" for q in (1, 2, 3, 4)))

# ---------------- relative age verification
seen = {r["pid"] for r in rows}
mon = collections.Counter(); jan1 = 0
for pid in seen:
    d = dob(pid)
    mon[d.month] += 1
    jan1 += (d.month == 1 and d.day == 1)
n = sum(mon.values())
print(f"\n=== Mjesec rodjenja, svi igraci s 450+ min u nekoj sezoni (n={n}); rodjeni tacno 1.1.: {jan1} ({100*jan1/n:.2f}%)")
print("  " + " ".join(f"{m}:{100*mon[m]/n:.1f}" for m in range(1, 13)))
q = [sum(mon[m] for m in range(a, a + 3)) for a in (1, 4, 7, 10)]
print("  Q1..Q4:", [round(100 * x / n, 1) for x in q], "| Q1/Q4 =", round(q[0] / q[3], 2), "| bez 1.1.: Q1 =", round(100 * (q[0] - jan1) / (n - jan1), 1))
em = collections.Counter(dob(pid).month for pid in seen if players[pid]["country_of_birth"] == "England")
ne = sum(em.values())
print(f"  rodjeni u Engleskoj (n={ne}): " + " ".join(f"{m}:{100*em[m]/ne:.1f}" for m in range(1, 13)))

# ---------------- today's radar: season 2025, regional leagues
final_tr = [r for r in lab if r["v0"] <= TRAIN_CAP]
mf = gb().fit(np.array([fx(r) for r in final_tr]), np.array([r["y"] for r in final_tr]))
now = [r for r in young if r["s"] == 2025]
P = mf.predict_proba(np.array([fx(r) for r in now]))[:, 1]
for r, p in zip(now, P):
    r["p"] = p
thr = np.quantile([r["gb"] for r in preds if r["v0"] <= 1e6], 0.9)
print(f"\n=== Radar danas (sezona 2025/26), prag = gornjih 10% iz provjere unazad (p >= {thr:.2f})")
REG = ["KR1", "SER1", "PL1", "TS1", "RO1", "A1", "C1", "NO1", "SE1"]
for c in REG + sorted(FULL):
    sub = [r for r in now if r["c"] == c]
    ch = [r for r in sub if r["v0"] <= 5e5]
    ch1 = [r for r in sub if r["v0"] <= 1e6]
    print(f"  {NAME[c]:15} mladih 450+ min: {len(sub):3} | do 500k: {len(ch):3}, iznad praga: {sum(1 for r in ch if r['p']>=thr):2} | do 1M: {len(ch1):3}, iznad praga: {sum(1 for r in ch1 if r['p']>=thr):2}")
print("\nPrimjer radara: 5 regionalnih liga, vrijednost do 500k, 15 najboljih po modelu")
sub = sorted([r for r in now if r["c"] in ("KR1", "SER1", "PL1", "TS1", "RO1") and r["v0"] <= 5e5], key=lambda r: -r["p"])[:15]
for r in sub:
    p = players[r["pid"]]
    print(f"  {p['name'][:26]:26} {r['age']:.1f}g {p['sub_position'][:18]:18} {clubs.get(r['club'], r['club'])[:22]:22} {NAME[r['c']][:8]:8} "
          f"{r['v0']/1e3:5.0f}k  min {r['min']:4}  G+A {round(r['g90']*r['min']/90)}+{round(r['a90']*r['min']/90)}  p={r['p']:.2f}")
