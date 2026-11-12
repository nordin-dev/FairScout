"""Backtest on the full pool: every young player of the season counts, also those with no valuation three seasons later (counted as 'did not make it').
Usage: python -I evidence2.py <rows.json> <out.json>
"""
import json, sys, math, collections
import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import roc_auc_score
J = json.load(open(sys.argv[1])); rows = J['rows']; FULL = set(J['FULL']); HMED = J['HMED']
young = [r for r in rows if r['s'] - r['yob'] <= 21]
for r in young: r['y2'] = int(bool(r['v1']) and r['v1'] >= 2 * r['v0'] and r['v1'] >= 1e6)
lab = [r for r in young if r['c'] in FULL and r['s'] <= 2022 and r['v1']]
def fx(r):
    lv = math.log(r['v0'])
    return [r['age'], r['min'], r['share'], r['g90'], r['a90'], r['ga_pct'], lv, math.log(r['v0'] / r['vprev']) if r['vprev'] else 0.0, 0.0 if r['vprev'] else 1.0,
            r['prev_min'], r['ppg'], r['club_med'], lv - r['club_med'], r['lg_med'], r['h'] or HMED,
            float(r['pos'] == 'Attack'), float(r['pos'] == 'Midfield'), float(r['pos'] == 'Defender'), float(r['pos'] == 'Goalkeeper')]
lr = lambda: make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=3000))
gb = lambda: HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=250, l2_regularization=1.0, min_samples_leaf=30, random_state=0)
P = []
for T in range(2017, 2023):
    tr = [r for r in lab if r['s'] <= T - 3 and r['v0'] <= 5e6]
    # variant: also learn from players whose later valuation is missing (they are known failures by then)
    tr_all = [r for r in young if r['c'] in FULL and r['s'] <= T - 3 and r['v0'] <= 5e6]
    te = [r for r in young if r['c'] in FULL and r['s'] == T and r['v0'] <= 5e6]
    X = np.array([fx(r) for r in tr]); y = np.array([r['y2'] for r in tr]); Xt = np.array([fx(r) for r in te])
    a = lr().fit(X, y).predict_proba(Xt)[:, 1]; b = gb().fit(X, y).predict_proba(Xt)[:, 1]
    Xa = np.array([fx(r) for r in tr_all]); ya = np.array([r['y2'] for r in tr_all])
    a2 = lr().fit(Xa, ya).predict_proba(Xt)[:, 1]; b2 = gb().fit(Xa, ya).predict_proba(Xt)[:, 1]
    for r, s1, s2, s3, s4 in zip(te, a, b, a2, b2): P.append({**r, 'lr': float(s1), 'gb': float(s2), 'lr_all': float(s3), 'gb_all': float(s4), 'T': T})
RULES = [('model_lr', 'Model, logisticka regresija', lambda r: r['lr']), ('model_gb', 'Model, gradient boosting', lambda r: r['gb']),
         ('model_lr_all', 'LR, ucenje na svim igracima', lambda r: r['lr_all']), ('model_gb_all', 'GB, ucenje na svim igracima', lambda r: r['gb_all']),
         ('most_minutes', 'Najvise minuta', lambda r: r['min']), ('most_goals_assists', 'Najvise golova i asistencija', lambda r: r['g90'] + r['a90']),
         ('youngest', 'Najmladji', lambda r: -r['age']), ('cheapest', 'Najjeftiniji', lambda r: -r['v0'])]
out = {}
for cap in (1e6, 5e5):
    sub = [r for r in P if r['v0'] <= cap]; y = np.array([r['y2'] for r in sub])
    print(f"\n=== bazen do {int(cap/1000)}k: {len(sub)} igraca | uspjelo {int(y.sum())} ({100*y.mean():.1f}%) | bez kasnije vrijednosti {sum(1 for r in sub if not r['v1'])}")
    res = []
    rng = np.random.default_rng(0)
    for key, label, f in RULES:
        line = []
        for frac in (0.10, 0.20):
            hit = n = 0; per = []
            for T in range(2017, 2023):
                g = [r for r in sub if r['T'] == T]; k = max(1, round(frac * len(g)))
                top = sorted(g, key=lambda r: (-f(r), rng.random()))[:k]
                h = sum(r['y2'] for r in top); hit += h; n += k; per.append(f"{h}/{k}")
            p = hit / n; se = 196 * math.sqrt(p * (1 - p) / n)
            line.append((hit, n, p, se, per))
        auc = roc_auc_score(y, [f(r) for r in sub])
        print(f"  {label:30} top10%: {line[0][0]:3}/{line[0][1]:3} = {100*line[0][2]:4.1f}% ±{line[0][3]:.0f} | top20%: {100*line[1][2]:4.1f}% | AUC {auc:.3f} | po sezonama {' '.join(line[0][4])}")
        res.append({'rule': key, 'hits': line[0][0], 'picks': line[0][1], 'rate': round(line[0][2], 3), 'margin_pp': round(line[0][3]), 'rate_top20': round(line[1][2], 3), 'auc': round(float(auc), 3), 'by_season': line[0][4]})
    out[str(int(cap))] = {'players': len(sub), 'base_rate': round(float(y.mean()), 3), 'rows': res}
json.dump(out, open(sys.argv[2], 'w'), indent=1)
