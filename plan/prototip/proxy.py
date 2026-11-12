"""League-level proxy for leagues without enough movers + pool facts. Usage: python -I proxy.py <rows.json> <data_dir>"""
import json, sys, math, csv, gzip, collections, datetime
import numpy as np
J = json.load(open(sys.argv[1])); rows = J["rows"]; NAME = J["NAME"]; FULL = set(J["FULL"])
E = {"GB1":0.59,"ES1":0.69,"IT1":0.71,"FR1":0.78,"L1":0.80,"RU1":1.00,"TR1":1.03,"PO1":1.04,"NL1":1.15,"DK1":1.21,"BE1":1.21,"GR1":1.24,"SC1":1.53,"UKR1":1.62}
med = collections.defaultdict(list)
for r in rows:
    if r["s"] in (2024, 2025):
        med[r["c"]].append(math.log(r["v0"]))
m = {c: float(np.median(v)) for c, v in med.items()}
xs = np.array([m[c] for c in E]); ys = np.array([math.log(E[c]) for c in E])
b, a = np.polyfit(xs, ys, 1)
r = np.corrcoef(xs, ys)[0, 1]
def rk(v): 
    o = np.argsort(v); k = np.empty(len(v)); k[o] = np.arange(len(v)); return k
print(f"14 liga: Pearson r(ln koef, medijan ln vrijednosti) = {r:.2f} | Spearman = {np.corrcoef(rk(xs), rk(ys))[0,1]:.2f} | nagib {b:.3f}")
ex = [c for c in E if c not in ("RU1", "UKR1")]
xs2 = np.array([m[c] for c in ex]); ys2 = np.array([math.log(E[c]) for c in ex]); b2, a2 = np.polyfit(xs2, ys2, 1)
print(f"bez Rusije i Ukrajine: r = {np.corrcoef(xs2, ys2)[0,1]:.2f} | nagib {b2:.3f}")
print("liga | medijan vrijednosti igraca (EUR) | koef iz prelazaka | koef iz vrijednosti (svih 14) | (bez RU/UKR)")
for c in sorted(m, key=lambda c: -m[c]):
    print(f"  {NAME[c]:15} {math.exp(m[c])/1e6:6.2f}M | {E.get(c, float('nan')):5.2f} | {math.exp(a + b*m[c]):5.2f} | {math.exp(a2 + b2*m[c]):5.2f}")
resid = [abs(math.exp(a2 + b2*m[c]) - E[c]) for c in ex]
print("prosjecna apsolutna greska proxyja na 12 liga:", round(float(np.mean(resid)), 2))
# pool facts
P = {p["player_id"]: p for p in csv.DictReader(gzip.open(sys.argv[2] + "/players.csv.gz", "rt"))}
pool = [r for r in rows if r["s"] == 2025 and r["s"] - r["yob"] <= 21 and r["v0"] <= 1e6]
REG = {"KR1", "SER1", "PL1", "TS1", "RO1"}
print("\nbazen radara (mladi, 450+ min, do 1M, sezona 2025/26):", len(pool), "| pet regionalnih liga:", sum(1 for r in pool if r["c"] in REG))
u18 = [r for r in pool if r["age"] < 18]
print("mladji od 18 na kraju sezone:", len(u18), "| u pet regionalnih:", sum(1 for r in u18 if r["c"] in REG))
ce = [P[r["pid"]]["contract_expiration_date"][:10] for r in pool]
have = [c for c in ce if c]
print("s poznatim istekom ugovora:", len(have), f"({100*len(have)/len(pool):.0f}%)", "| istice do 30.6.2027:", sum(1 for c in have if c <= "2027-06-30"))
pos = collections.Counter(r["pos"] for r in pool); print("pozicije:", dict(pos))
print("s visinom:", sum(1 for r in pool if r["h"]), "| s jacom nogom:", sum(1 for r in pool if P[r['pid']]['foot']), "| s detaljnom pozicijom:", sum(1 for r in pool if P[r['pid']]['sub_position']))
q = collections.Counter(r["q"] for r in pool); print("kvartal rodjenja u bazenu:", {k: q[k] for k in (1,2,3,4)})
vals = sorted(r["v0"] for r in pool); print("vrijednosti: min", vals[0], "medijan", vals[len(vals)//2], "| do 250k:", sum(1 for v in vals if v <= 2.5e5), "| do 500k:", sum(1 for v in vals if v <= 5e5))
