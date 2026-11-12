"""Feasibility checks on the open Transfermarkt dataset.
Usage: python3 -I check2.py <data_dir> <agg.json>
"""
import csv, gzip, sys, collections, datetime, json, math, bisect

D = sys.argv[1]


def rd(name):
    return csv.DictReader(gzip.open(f"{D}/{name}.csv.gz", "rt"))


comps = {c["competition_id"]: c for c in rd("competitions")}
EU = {k for k, c in comps.items() if c["type"] == "domestic_league" and c["confederation"] == "europa"}
players = {p["player_id"]: p for p in rd("players")}
agg = {}
for k, v in json.load(open(sys.argv[2])).items():
    pid, s, c = k.split("|")
    agg[(pid, int(s), c)] = v
FULL = sorted({c for (_, _, c) in agg})
SHORT = sorted(EU - set(FULL))
NAME = {c: comps[c]["country_name"] for c in EU}


def dob(pid):
    p = players.get(pid)
    if not p or not p["date_of_birth"]:
        return None
    try:
        return datetime.date.fromisoformat(p["date_of_birth"][:10])
    except ValueError:
        return None


def age_at(pid, date):
    d = dob(pid)
    return None if not d else (date - d).days / 365.25


G = {}
for g in rd("games"):
    G[g["game_id"]] = (g["competition_id"], int(g["season"]))

# ---------------------------------------------------------------- 1. minutes reconstruction
print("=" * 30, "1. REKONSTRUKCIJA MINUTA (provjera na Belgiji i Holandiji, sezona 2024)")
TEST = {("BE1", 2024), ("NL1", 2024)}
ALLSHORT_OR_TEST = lambda gid: (G.get(gid) in TEST) or (G.get(gid, (None,))[0] in SHORT)
lin = collections.defaultdict(dict)  # game -> player -> type
lin_club = {}
types = collections.Counter()
for l in rd("game_lineups"):
    if ALLSHORT_OR_TEST(l["game_id"]):
        lin[l["game_id"]][l["player_id"]] = l["type"]
        lin_club[(l["game_id"], l["player_id"])] = l["club_id"]
        types[l["type"]] += 1
print("lineup types:", dict(types))
ev = collections.defaultdict(list)
card_desc = collections.Counter()
goal_desc = collections.Counter()
for e in rd("game_events"):
    if ALLSHORT_OR_TEST(e["game_id"]):
        ev[e["game_id"]].append(e)
        if e["type"] == "Cards":
            card_desc[e["description"].split(",")[0].strip()[:30]] += 1
        if e["type"] == "Goals":
            d = e["description"]
            goal_desc["own" if "wn-goal" in d or "wn goal" in d else "normal"] += 1
print("card descriptions:", card_desc.most_common(8))
print("goal kinds:", dict(goal_desc))


def reconstruct(gid):
    """returns player -> [minutes, goals, assists]"""
    out = {}
    start = {}
    end = {}
    for pid, t in lin[gid].items():
        if t == "starting_lineup":
            start[pid] = 0
            end[pid] = 90
    for e in sorted(ev[gid], key=lambda x: int(x["minute"] or 0)):
        m = min(int(e["minute"] or 0), 90)
        if e["type"] == "Substitutions":
            o, i = e["player_id"], e["player_in_id"]
            if o in start:
                end[o] = m
            if i:
                start[i] = m
                end[i] = 90
        elif e["type"] == "Cards":
            d = e["description"].lower()
            if "red" in d or "second yellow" in d:
                if e["player_id"] in start:
                    end[e["player_id"]] = m
    for pid in start:
        out[pid] = [max(end[pid] - start[pid], 0), 0, 0]
    for e in ev[gid]:
        if e["type"] != "Goals":
            continue
        d = e["description"]
        if "wn-goal" in d or "wn goal" in d:
            continue
        if e["player_id"] in out:
            out[e["player_id"]][1] += 1
        a = e["player_assist_id"]
        if a and a in out:
            out[a][2] += 1
    return out


rec = {}
for gid in lin:
    for pid, v in reconstruct(gid).items():
        rec[(gid, pid)] = v
truth = {}
for a in rd("appearances"):
    if G.get(a["game_id"]) in TEST:
        truth[(a["game_id"], a["player_id"])] = [int(a["minutes_played"] or 0), int(a["goals"] or 0), int(a["assists"] or 0)]
both = [k for k in truth if k in rec]
print(f"appearances rows: {len(truth)} | reconstructed rows for same games: {sum(1 for k in rec if G.get(k[0]) in TEST)} | matched: {len(both)}")
ex = sum(1 for k in both if truth[k][0] == rec[k][0])
w5 = sum(1 for k in both if abs(truth[k][0] - rec[k][0]) <= 5)
print(f"minutes exact: {100*ex/len(both):.1f}% | within 5 min: {100*w5/len(both):.1f}%")
print(f"goals exact: {100*sum(1 for k in both if truth[k][1]==rec[k][1])/len(both):.2f}% | assists exact: {100*sum(1 for k in both if truth[k][2]==rec[k][2])/len(both):.2f}%")
print("total minutes truth vs rec:", sum(truth[k][0] for k in both), sum(rec[k][0] for k in both),
      "| goals:", sum(truth[k][1] for k in both), sum(rec[k][1] for k in both),
      "| assists:", sum(truth[k][2] for k in both), sum(rec[k][2] for k in both))
missing = [k for k in truth if k not in rec]
print("in appearances but not reconstructed:", len(missing), "| reconstructed with >0 min but not in appearances:",
      sum(1 for k in rec if G.get(k[0]) in TEST and k not in truth and rec[k][0] > 0))

# season aggregates for short leagues from reconstruction
sagg = collections.defaultdict(lambda: [0, 0, 0, 0])
bench = collections.Counter()
for (gid, pid), v in rec.items():
    c, s = G[gid]
    if c in SHORT:
        x = sagg[(pid, s, c)]
        x[0] += v[0]; x[1] += v[1]; x[2] += v[2]; x[3] += 1 if v[0] > 0 else 0
for gid, d in lin.items():
    c, s = G[gid]
    if c in SHORT:
        for pid, t in d.items():
            if t != "starting_lineup":
                bench[(pid, s, c)] += 1
print("\nRegionalne lige, rekonstruisano (igrac-sezona):")
for c in SHORT:
    ks = [k for k in sagg if k[2] == c]
    y = [k for k in ks if (age_at(k[0], datetime.date(k[1], 7, 1)) or 99) < 22]
    y450 = [k for k in y if sagg[k][0] >= 450]
    y900 = [k for k in y if sagg[k][0] >= 900]
    print(f"  {NAME[c]:15} igrac-sezona {len(ks):5} | mladji od 22: {len(y):4} | od toga 450+ min: {len(y450):4} | 900+ min: {len(y900):4}")

# ---------------------------------------------------------------- 2. movers between leagues
print("\n" + "=" * 30, "2. PRELASCI IZMEDJU LIGA (14 liga s punom historijom)")
main = {}
for (pid, s, c), v in agg.items():
    if v[0] >= 900:
        if (pid, s) not in main or v[0] > main[(pid, s)][1][0]:
            main[(pid, s)] = (c, v)
pairs = collections.defaultdict(list)
for (pid, s), (c, v) in main.items():
    nx = main.get((pid, s + 1))
    if nx and nx[0] != c:
        pairs[(c, nx[0])].append((pid, v, nx[1]))
tot = sum(len(v) for v in pairs.values())
print("ukupno prelazaka (900+ min prije i poslije, uzastopne sezone):", tot, "| parova liga:", len(pairs),
      "| parova s 15+ prelazaka:", sum(1 for v in pairs.values() if len(v) >= 15))
# league "ease" for attacking output via weighted least squares on pair-level log ratios (attack+midfield only)
und = collections.defaultdict(lambda: [0.0, 0.0, 0.0, 0.0, 0])  # (A,B) sorted: GA_A, min_A, GA_B, min_B, n
for (a, b), lst in pairs.items():
    for pid, va, vb in lst:
        p = players.get(pid)
        if not p or p["position"] not in ("Attack", "Midfield"):
            continue
        k = (a, b) if a < b else (b, a)
        x = und[k]
        if a < b:
            x[0] += va[1] + va[2]; x[1] += va[0]; x[2] += vb[1] + vb[2]; x[3] += vb[0]
        else:
            x[2] += va[1] + va[2]; x[3] += va[0]; x[0] += vb[1] + vb[2]; x[1] += vb[0]
        x[4] += 1
idx = {c: i for i, c in enumerate(FULL)}
n = len(FULL)
# normal equations for min sum w (e_b - e_a - y)^2 with sum e = 0
A = [[0.0] * n for _ in range(n)]
bvec = [0.0] * n
used = 0
for (a, b), x in und.items():
    if x[4] < 8 or x[0] == 0 or x[2] == 0:
        continue
    y = math.log((x[2] / x[3]) / (x[0] / x[1]))  # log(rate in b / rate in a) for the same players
    w = x[4]
    used += x[4]
    ia, ib = idx[a], idx[b]
    A[ia][ia] += w; A[ib][ib] += w; A[ia][ib] -= w; A[ib][ia] -= w
    bvec[ib] += w * y; bvec[ia] -= w * y
for i in range(n):
    for j in range(n):
        A[i][j] += 1.0  # ridge on the mean -> sum e = 0
# gaussian elimination
M = [row[:] + [bvec[i]] for i, row in enumerate(A)]
for i in range(n):
    piv = max(range(i, n), key=lambda r: abs(M[r][i]))
    M[i], M[piv] = M[piv], M[i]
    for r in range(n):
        if r != i:
            f = M[r][i] / M[i][i]
            for cc in range(i, n + 1):
                M[r][cc] -= f * M[i][cc]
e = [M[i][n] / M[i][i] for i in range(n)]
print("napadaci i vezni, prelazaka u procjeni:", used)
print("koliko je lako ostvariti gol+asistenciju (1.00 = prosjek 14 liga; manje = teza liga):")
for c, val in sorted(zip(FULL, e), key=lambda t: t[1]):
    print(f"  {NAME[c]:13} {math.exp(val):.2f}")
print("primjeri parova (isti igraci, G+A na 90 prije -> poslije):")
for (a, b) in [("NL1", "GB1"), ("NL1", "L1"), ("BE1", "GB1"), ("PO1", "GB1"), ("PO1", "ES1"), ("FR1", "GB1"), ("DK1", "NL1"), ("SC1", "GB1"), ("BE1", "NL1")]:
    k = (a, b) if a < b else (b, a)
    x = und.get(k)
    if not x:
        continue
    ra, rb = 90 * x[0] / x[1], 90 * x[2] / x[3]
    if a > b:
        ra, rb = rb, ra
    print(f"  {NAME[a]} <-> {NAME[b]}: n={x[4]}  {NAME[a]} {ra:.3f}  {NAME[b]} {rb:.3f}")

# bridge players for short leagues
print("\nIgraci regionalnih liga koji imaju sezonu s 900+ min u nekoj od 14 liga (most za koeficijent):")
hist = collections.defaultdict(set)
for (pid, s, c), v in agg.items():
    if v[0] >= 900:
        hist[pid].add(c)
for c in SHORT:
    ps = {k[0] for k in sagg if k[2] == c and sagg[k][0] >= 450}
    br = [p for p in ps if p in hist]
    print(f"  {NAME[c]:15} igraca s 450+ min: {len(ps):4} | od toga 'most': {len(br):4}")

# ---------------------------------------------------------------- 3. relative age
print("\n" + "=" * 30, "3. RASPODJELA RODJENJA PO KVARTALIMA")
seen = {k[0] for k in agg} | {k[0] for k in sagg}


def qdist(ids):
    q = collections.Counter()
    for pid in ids:
        d = dob(pid)
        if d:
            q[(d.month - 1) // 3 + 1] += 1
    t = sum(q.values())
    return t, [100 * q[i] / t for i in (1, 2, 3, 4)]


t, q = qdist(seen)
print(f"svi igraci u evropskim prvim ligama: n={t}  Q1 {q[0]:.1f}%  Q2 {q[1]:.1f}%  Q3 {q[2]:.1f}%  Q4 {q[3]:.1f}%")
for country in ["England", "Spain", "Germany", "France", "Netherlands", "Italy", "Belgium", "Portugal", "Croatia", "Serbia", "Bosnia-Herzegovina", "Poland", "Czech Republic", "Romania"]:
    ids = [p for p in seen if players.get(p, {}).get("country_of_birth") == country]
    if len(ids) < 100:
        continue
    t, q = qdist(ids)
    print(f"  rodjeni u {country:20} n={t:5}  Q1 {q[0]:.1f}  Q2 {q[1]:.1f}  Q3 {q[2]:.1f}  Q4 {q[3]:.1f}")
young = {k[0] for k, v in agg.items() if v[0] >= 900 and (age_at(k[0], datetime.date(k[1], 7, 1)) or 99) < 20}
t, q = qdist(young)
print(f"igraci koji su prije 20. godine imali sezonu s 900+ min: n={t}  Q1 {q[0]:.1f}  Q2 {q[1]:.1f}  Q3 {q[2]:.1f}  Q4 {q[3]:.1f}")

# ---------------------------------------------------------------- 4. preliminary signal check
print("\n" + "=" * 30, "4. PRELIMINARNA PROVJERA SIGNALA")
vals = collections.defaultdict(list)
for v in rd("player_valuations"):
    try:
        vals[v["player_id"]].append((datetime.date.fromisoformat(v["date"][:10]), float(v["market_value_in_eur"])))
    except ValueError:
        pass
for p in vals:
    vals[p].sort()


def val_in(pid, d0, d1):
    """latest valuation with d0 <= date <= d1"""
    lst = vals.get(pid)
    if not lst:
        return None
    i = bisect.bisect_right(lst, (d1, float("inf"))) - 1
    if i >= 0 and lst[i][0] >= d0:
        return lst[i][1]
    return None


rows = []
for (pid, s, c), v in agg.items():
    if not (2012 <= s <= 2021) or v[0] < 900:
        continue
    p = players.get(pid)
    if not p or p["position"] not in ("Attack", "Midfield"):
        continue
    a = age_at(pid, datetime.date(s, 7, 1))
    if a is None or a >= 22:
        continue
    v0 = val_in(pid, datetime.date(s + 1, 1, 1), datetime.date(s + 1, 8, 31))
    v1 = val_in(pid, datetime.date(s + 4, 1, 1), datetime.date(s + 4, 8, 31))
    if not v0:
        continue
    rows.append({"pid": pid, "s": s, "c": c, "pos": p["position"], "ga90": 90 * (v[1] + v[2]) / v[0], "v0": v0, "v1": v1, "age": a})
print("mladi (<22) napadaci/vezni, 900+ min, sezone 2012-2021, s vrijednoscu na kraju sezone:", len(rows),
      "| s vrijednoscu 3 godine kasnije:", sum(1 for r in rows if r["v1"]))
# percentile of ga90 within league-season-position among ALL players (not only young) would be better; use young cohort + all-age reference
ref = collections.defaultdict(list)
for (pid, s, c), v in agg.items():
    if v[0] >= 900:
        p = players.get(pid)
        if p and p["position"] in ("Attack", "Midfield"):
            ref[(s, c, p["position"])].append(90 * (v[1] + v[2]) / v[0])
for k in ref:
    ref[k].sort()
for r in rows:
    lst = ref[(r["s"], r["c"], r["pos"])]
    r["pct"] = bisect.bisect_left(lst, r["ga90"]) / len(lst)
have = [r for r in rows if r["v1"]]


def rate(lst, thr=2.0):
    return (100 * sum(1 for r in lst if r["v1"] / r["v0"] >= thr) / len(lst)) if lst else float("nan")


def med(lst):
    x = sorted(r["v1"] / r["v0"] for r in lst)
    return x[len(x) // 2] if x else float("nan")


print(f"svi: n={len(have)} | udvostrucili vrijednost za 3 god: {rate(have):.1f}% | medijan omjera: {med(have):.2f}")
for cap in (1e6, 2e6, 5e6):
    cheap = [r for r in have if r["v0"] <= cap]
    top = [r for r in cheap if r["pct"] >= 0.75]
    rest = [r for r in cheap if r["pct"] < 0.75]
    low = [r for r in cheap if r["pct"] < 0.25]
    print(f"vrijednost <= {cap/1e6:.0f}M: n={len(cheap)} | gornja cetvrtina ucinka n={len(top)}: udvostrucili {rate(top):.1f}% (medijan x{med(top):.2f})"
          f" | ostali n={len(rest)}: {rate(rest):.1f}% (x{med(rest):.2f}) | donja cetvrtina n={len(low)}: {rate(low):.1f}%")
# by league strength group
BIG5 = {"GB1", "ES1", "IT1", "L1", "FR1"}
for name, grp in (("top 5 liga", BIG5), ("ostalih 9 liga", set(FULL) - BIG5)):
    cheap = [r for r in have if r["v0"] <= 2e6 and r["c"] in grp]
    top = [r for r in cheap if r["pct"] >= 0.75]
    rest = [r for r in cheap if r["pct"] < 0.75]
    print(f"  {name}, vrijednost <= 2M: gornja cetvrtina n={len(top)} udvostrucili {rate(top):.1f}% | ostali n={len(rest)} {rate(rest):.1f}%")
# rank correlation
def spearman(xs, ys):
    def rk(a):
        o = sorted(range(len(a)), key=lambda i: a[i]); r = [0] * len(a)
        for i, j in enumerate(o): r[j] = i
        return r
    rx, ry = rk(xs), rk(ys); nn = len(xs)
    mx = (nn - 1) / 2
    num = sum((a - mx) * (b - mx) for a, b in zip(rx, ry)); den = sum((a - mx) ** 2 for a in rx)
    return num / den
print("Spearman (percentil ucinka, log omjer vrijednosti):", round(spearman([r["pct"] for r in have], [math.log(r["v1"] / r["v0"]) for r in have]), 3))
print("Spearman (dob, log omjer vrijednosti):", round(spearman([r["age"] for r in have], [math.log(r["v1"] / r["v0"]) for r in have]), 3))

# ---------------------------------------------------------------- 5. current radar population
print("\n" + "=" * 30, "5. KOGA RADAR DANAS POKRIVA (sezona 2025/26, mladji od 22 na 1.7.2025)")
cur = collections.defaultdict(list)
for (pid, s, c), v in list(agg.items()) + list(sagg.items()):
    if s == 2025:
        a = age_at(pid, datetime.date(2025, 7, 1))
        if a is not None and a < 22:
            mv = players[pid]["market_value_in_eur"]
            cur[c].append((v[0], float(mv) if mv else None))
print("liga | mladih u postavama | 450+ min | 450+ min i vrijednost <= 500k | <= 1M")
for c in sorted(cur, key=lambda c: (c in FULL, NAME[c])):
    l = cur[c]
    m450 = [x for x in l if x[0] >= 450]
    print(f"  {NAME[c]:15} {'(2 sezone)' if c in SHORT else '(14 sezona)':12} {len(l):4} | {len(m450):4} | {sum(1 for x in m450 if x[1] and x[1] <= 5e5):4} | {sum(1 for x in m450 if x[1] and x[1] <= 1e6):4}")
# valuation history depth for players in short leagues
print("\nHistorija trzisnih vrijednosti igraca regionalnih liga:")
for c in SHORT:
    ps = {k[0] for k in sagg if k[2] == c}
    n = [len(vals.get(p, [])) for p in ps]
    n.sort()
    first = sorted(vals[p][0][0].year for p in ps if vals.get(p))
    print(f"  {NAME[c]:15} igraca {len(ps):4} | s barem jednom vrijednoscu {sum(1 for x in n if x>0):4} | medijan zapisa po igracu {n[len(n)//2]} | medijan prve godine {first[len(first)//2] if first else None}")
fees = [t["transfer_fee"] for t in rd("transfers")]
nz = sum(1 for f in fees if f not in ("", "0.000", "0", "0.0"))
print(f"\ntransferi: {len(fees)} | s poznatom naknadom > 0: {nz} ({100*nz/len(fees):.1f}%)")
