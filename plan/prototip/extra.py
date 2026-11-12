"""Extra checks on the prepared player-season table.
Usage: python -I extra.py <rows.json>
"""
import json, sys, math, collections
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import roc_auc_score

J = json.load(open(sys.argv[1]))
rows, FULL, NAME, HMED, big5 = J["rows"], set(J["FULL"]), J["NAME"], J["HMED"], {k: set(v) for k, v in J["big5"].items()}
BIG5 = {"GB1", "ES1", "IT1", "L1", "FR1"}
young = [r for r in rows if r["s"] - r["yob"] <= 21]
lab = [r for r in young if r["c"] in FULL and r["s"] <= 2022 and r["v1"]]
for r in lab:
    r["y"] = int(r["v1"] >= 2 * r["v0"])
    r["y2"] = int(r["v1"] >= 2 * r["v0"] and r["v1"] >= 1e6)
# objective outcome: 900+ minutes in a top-5 league in one of the next three seasons (only for players outside the top 5)
obj = [r for r in young if r["c"] in FULL and r["c"] not in BIG5 and r["s"] <= 2022]
for r in obj:
    r["o"] = int(any((r["s"] + k) in big5.get(r["pid"], ()) for k in (1, 2, 3)))


def fx(r, extra=False):
    lv = math.log(r["v0"])
    f = [r["age"], r["min"], r["share"], r["g90"], r["a90"], r["ga_pct"], lv,
         math.log(r["v0"] / r["vprev"]) if r["vprev"] else 0.0, 0.0 if r["vprev"] else 1.0, r["prev_min"], r["ppg"],
         r["club_med"], lv - r["club_med"], r["lg_med"], r["h"] or HMED,
         float(r["pos"] == "Attack"), float(r["pos"] == "Midfield"), float(r["pos"] == "Defender"), float(r["pos"] == "Goalkeeper")]
    if extra:
        f.append((r["q"] - 1) / 3)
    return f


def gb():
    return HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=250, l2_regularization=1.0,
                                          min_samples_leaf=30, random_state=0)


def lr():
    return make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=3000))


def walk(data, target, extra=False, cap=5e6):
    out = []
    for T in range(2017, 2023):
        tr = [r for r in data if r["s"] <= T - 3 and r["v0"] <= cap]
        te = [r for r in data if r["s"] == T and r["v0"] <= cap]
        Xtr = np.array([fx(r, extra) for r in tr]); ytr = np.array([r[target] for r in tr])
        Xte = np.array([fx(r, extra) for r in te])
        a = gb().fit(Xtr, ytr).predict_proba(Xte)[:, 1]; b = lr().fit(Xtr, ytr).predict_proba(Xte)[:, 1]
        for r, x, z in zip(te, a, b):
            out.append({**r, "gb": float(x), "lr": float(z), "ens": float((x + z) / 2), "T": T})
    return out


def topk(sub, score, target, frac):
    rng = np.random.default_rng(0)
    hit = n = 0
    for T in sorted({r["T"] for r in sub}):
        g = [r for r in sub if r["T"] == T]
        k = max(1, round(frac * len(g)))
        g = sorted(g, key=lambda r: (-score(r), rng.random()))[:k]
        hit += sum(r[target] for r in g); n += k
    return hit, n


def report(sub, target, title):
    y = np.array([r[target] for r in sub])
    print(f"\n--- {title}: n={len(sub)} | osnovna stopa {100*y.mean():.1f}%")
    sc = {"model GB": lambda r: r["gb"], "model LR": lambda r: r["lr"], "model prosjek GB+LR": lambda r: r["ens"],
          "samo G+A/90": lambda r: r["g90"] + r["a90"], "samo najmladji": lambda r: -r["age"],
          "samo najjeftiniji": lambda r: -r["v0"], "samo najvise minuta": lambda r: r["min"]}
    for name, f in sc.items():
        s = np.array([f(r) for r in sub])
        res = []
        for frac in (0.1, 0.2):
            h, n = topk(sub, f, target, frac)
            p = h / n
            se = math.sqrt(p * (1 - p) / n)
            res.append(f"top {int(frac*100)}%: {100*p:.1f}% ±{196*se:.0f} (n={n})")
        print(f"  {name:22} AUC {roc_auc_score(y, s):.3f} | " + " | ".join(res))


print("=== A. Odakle dolaze podaci za ucenje (mladi s poznatim ishodom, sezone 2012-2022)")
cnt = collections.defaultdict(lambda: [0, 0, 0])
for r in lab:
    c = cnt[r["c"]]
    c[0] += 1; c[1] += r["v0"] <= 1e6; c[2] += r["v0"] <= 5e5
for c, v in sorted(cnt.items(), key=lambda t: -t[1][1]):
    print(f"  {NAME[c]:13} svi mladi {v[0]:4} | do 1M {v[1]:4} | do 500k {v[2]:4}")
print("  UKUPNO", [sum(v[i] for v in cnt.values()) for i in range(3)])

print("\n=== D1. Glavna meta: vrijednost se barem udvostrucila za 3 godine")
P = walk(lab, "y")
report([r for r in P if r["v0"] <= 1e6], "y", "mladi do 1M")
report([r for r in P if r["v0"] <= 5e5], "y", "mladi do 500k")

print("\n=== D2. Stroza meta: udvostrucio I dosegao najmanje 1M")
P2 = walk(lab, "y2")
report([r for r in P2 if r["v0"] <= 1e6], "y2", "mladi do 1M")
report([r for r in P2 if r["v0"] <= 5e5], "y2", "mladi do 500k")

print("\n=== E. Objektivna meta: 900+ minuta u ligi petice u naredne 3 sezone (igraci izvan liga petice)")
P3 = walk(obj, "o", cap=1e9)
report(P3, "o", "svi mladi izvan liga petice")
report([r for r in P3 if r["v0"] <= 1e6], "o", "mladi do 1M")
report([r for r in P3 if r["v0"] <= 2e6], "o", "mladi do 2M")
# does the value-model ranking also predict the objective outcome?
om = {(r["pid"], r["s"]): r["o"] for r in obj}
sub = [dict(r, o=om[(r["pid"], r["s"])]) for r in P if (r["pid"], r["s"]) in om and r["v0"] <= 1e6]
h, n = topk(sub, lambda r: r["gb"], "o", 0.1)
print(f"\n  model za rast vrijednosti, top 10% (do 1M, izvan petice): {h}/{n} = {100*h/n:.1f}% zaigralo u ligi petice | osnovna stopa {100*np.mean([r['o'] for r in sub]):.1f}%")

print("\n=== B. Kvartal rodjenja uz kontrolu dobi")
bands = [(0, 19.5), (19.5, 20.5), (20.5, 21.5), (21.5, 23)]
for lo, hi in bands:
    g = [r for r in lab if lo <= r["age"] < hi]
    line = []
    for q in (1, 2, 3, 4):
        x = [r["y"] for r in g if r["q"] == q]
        line.append(f"Q{q}: n={len(x)} {100*np.mean(x):.1f}%")
    print(f"  dob {lo}-{hi}: " + " | ".join(line))
X = np.array([fx(r, True) + [float(r["s"] == s) for s in range(2013, 2023)] for r in lab])
y = np.array([r["y"] for r in lab])
pid = np.array([r["pid"] for r in lab])
mu, sd = X.mean(0), X.std(0) + 1e-9
Xs = (X - mu) / sd
QI = 19
m = LogisticRegression(C=1.0, max_iter=3000).fit(Xs, y)
orq = math.exp(m.coef_[0][QI] / sd[QI])
print(f"  logisticka regresija (sve osobine + sezona): omjer sansi Q4 naspram Q1 = {orq:.2f}")
rng = np.random.default_rng(0)
upid = np.unique(pid)
idx_by = collections.defaultdict(list)
for i, p in enumerate(pid):
    idx_by[p].append(i)
ors = []
for _ in range(300):
    samp = rng.choice(upid, len(upid))
    ii = np.concatenate([idx_by[p] for p in samp])
    mm = LogisticRegression(C=1.0, max_iter=2000).fit(Xs[ii], y[ii])
    ors.append(math.exp(mm.coef_[0][QI] / sd[QI]))
print(f"  bootstrap po igracu (300): 95% interval {np.percentile(ors, 2.5):.2f} - {np.percentile(ors, 97.5):.2f} | udio ispod 1.0: {np.mean(np.array(ors) < 1):.3f}")
# same for the objective outcome
Xo = np.array([fx(r, True) + [float(r["s"] == s) for s in range(2013, 2023)] for r in obj]); yo = np.array([r["o"] for r in obj])
muo, sdo = Xo.mean(0), Xo.std(0) + 1e-9
mo = LogisticRegression(C=1.0, max_iter=3000).fit((Xo - muo) / sdo, yo)
print(f"  ista regresija za objektivnu metu (liga petice): omjer sansi Q4 naspram Q1 = {math.exp(mo.coef_[0][QI] / sdo[QI]):.2f}")
print("  udio po kvartalu medju mladima (po igracu):", {q: sum(1 for p in {r['pid']: r for r in lab}.values() if p['q'] == q) for q in (1, 2, 3, 4)})

print("\n=== C. Da li podatak o kvartalu rodjenja popravlja model (glavna meta, do 1M)")
Pq = walk(lab, "y", extra=True)
for name, PP in (("bez kvartala", P), ("s kvartalom", Pq)):
    sub = [r for r in PP if r["v0"] <= 1e6]
    yy = np.array([r["y"] for r in sub])
    res = []
    for key in ("gb", "lr", "ens"):
        h, n = topk(sub, lambda r: r[key], "y", 0.1)
        res.append(f"{key}: AUC {roc_auc_score(yy, [r[key] for r in sub]):.3f}, top10% {100*h/n:.1f}%")
    print(f"  {name:13} " + " | ".join(res))
for name, PP in (("bez kvartala", P), ("s kvartalom", Pq)):
    line = []
    for q in (1, 2, 3, 4):
        g = [r for r in PP if r["q"] == q]
        line.append(f"Q{q}: stvarno {100*np.mean([r['y'] for r in g]):.1f}% model {100*np.mean([r['ens'] for r in g]):.1f}%")
    print(f"  {name:13} " + " | ".join(line))
