"""Do the model's picks also progress on the pitch, not only in market value?
Same walk-forward as the time machine (logistic regression trained on value outcome, pool = all young players up to 1M).
Sporting outcomes within the next three seasons, none of them uses market value:
  regular  = a season with 1,800+ league minutes in one of the 14 long-history leagues
  top5     = a season with 900+ league minutes in England, Spain, Italy, Germany or France
Usage: python -I sport.py <rows.json>
"""
import json, sys, math, collections
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
J = json.load(open(sys.argv[1])); rows = J['rows']; FULL = set(J['FULL']); HMED = J['HMED']; big5 = {k: set(v) for k, v in J['big5'].items()}
BIG5 = {'GB1', 'ES1', 'IT1', 'L1', 'FR1'}
mins = collections.defaultdict(dict)
for r in rows:
    if r['c'] in FULL: mins[r['pid']][r['s']] = max(mins[r['pid']].get(r['s'], 0), r['min'])
young = [r for r in rows if r['s'] - r['yob'] <= 21]
for r in young:
    r['y2'] = int(bool(r['v1']) and r['v1'] >= 2 * r['v0'] and r['v1'] >= 1e6)
    nxt = [r['s'] + k for k in (1, 2, 3)]
    r['regular'] = int(any(mins[r['pid']].get(s, 0) >= 1800 for s in nxt))
    r['top5'] = int(any(s in big5.get(r['pid'], ()) for s in nxt))
    r['still'] = int(any(mins[r['pid']].get(s, 0) >= 450 for s in nxt))
def fx(r):
    lv = math.log(r['v0'])
    return [r['age'], r['min'], r['share'], r['g90'], r['a90'], r['ga_pct'], lv, math.log(r['v0'] / r['vprev']) if r['vprev'] else 0.0, 0.0 if r['vprev'] else 1.0,
            r['prev_min'], r['ppg'], r['club_med'], lv - r['club_med'], r['lg_med'], r['h'] or HMED,
            float(r['pos'] == 'Attack'), float(r['pos'] == 'Midfield'), float(r['pos'] == 'Defender'), float(r['pos'] == 'Goalkeeper')]
A, POOL, MINS = [], [], []
for T in range(2017, 2023):
    tr = [r for r in young if r['c'] in FULL and r['s'] <= T - 3 and r['v0'] <= 5e6]
    m = make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=3000)).fit(np.array([fx(r) for r in tr]), np.array([r['y2'] for r in tr]))
    pool = [r for r in young if r['c'] in FULL and r['s'] == T and r['v0'] <= 1e6]
    sc = m.predict_proba(np.array([fx(r) for r in pool]))[:, 1]
    k = max(1, round(0.1 * len(pool)))
    A += [pool[i] for i in np.argsort(-sc)[:k]]; POOL += pool
    MINS += sorted(pool, key=lambda r: -r['min'])[:k]
def rate(lst, key): return 100 * np.mean([r[key] for r in lst]), int(sum(r[key] for r in lst)), len(lst)
print('Sest sezona, bazen do 1M (svi mladi igraci):')
for name, key in (('uspio po vrijednosti (meta modela)', 'y2'), ('postao standardan (1.800+ min u sezoni)', 'regular'), ('zaigrao u ligi petice (900+ min)', 'top5'), ('ostao u prvoj ligi (450+ min)', 'still')):
    a, p, mm = rate(A, key), rate(POOL, key), rate(MINS, key)
    print(f"  {name:42} izbori modela {a[1]:3}/{a[2]} = {a[0]:4.1f}% | cijeli bazen {p[1]:4}/{p[2]} = {p[0]:4.1f}% | pravilo 'najvise minuta' {mm[1]:3}/{mm[2]} = {mm[0]:4.1f}%")
out = [r for r in A if r['c'] not in BIG5]; outp = [r for r in POOL if r['c'] not in BIG5]
a, p = rate(out, 'top5'), rate(outp, 'top5')
print(f"  samo igraci izvan liga petice: zaigrao u ligi petice: izbori modela {a[1]}/{a[2]} = {a[0]:.1f}% | bazen {p[1]}/{p[2]} = {p[0]:.1f}%")
# among picks that "made it" by value, how many also progressed on the pitch
hit = [r for r in A if r['y2']]; miss = [r for r in A if not r['y2']]
print(f"  izbori koji su uspjeli po vrijednosti ({len(hit)}): standardni {100*np.mean([r['regular'] for r in hit]):.0f}%, liga petice {100*np.mean([r['top5'] for r in hit]):.0f}% | oni koji nisu ({len(miss)}): standardni {100*np.mean([r['regular'] for r in miss]):.0f}%, liga petice {100*np.mean([r['top5'] for r in miss]):.0f}%")
