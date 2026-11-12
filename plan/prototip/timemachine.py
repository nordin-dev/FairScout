"""Time machine: the radar run in the past, with the model defined in the plan.
Model: logistic regression, target = value at least doubled AND >= 1M three seasons later.
For season T the model trains only on seasons <= T-3 (their outcome was known by the end of season T).
Pool = ALL young players of season T valued up to 1M (no filtering on what happened later).
Tier A = top 10% of the pool by model score.
Usage: python -I timemachine.py <rows.json> <data_dir> <out.json>
"""
import json, sys, math, csv, gzip, collections, datetime
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline

J = json.load(open(sys.argv[1])); rows = J['rows']; NAME = J['NAME']; FULL = set(J['FULL']); HMED = J['HMED']; CLUB = J['clubs']
D = sys.argv[2]
P = {p['player_id']: p for p in csv.DictReader(gzip.open(D + '/players.csv.gz', 'rt'))}
young = [r for r in rows if r['s'] - r['yob'] <= 21]
for r in young:
    r['y2'] = int(bool(r['v1']) and r['v1'] >= 2 * r['v0'] and r['v1'] >= 1e6)

def fx(r):
    lv = math.log(r['v0'])
    return [r['age'], r['min'], r['share'], r['g90'], r['a90'], r['ga_pct'], lv,
            math.log(r['v0'] / r['vprev']) if r['vprev'] else 0.0, 0.0 if r['vprev'] else 1.0, r['prev_min'], r['ppg'],
            r['club_med'], lv - r['club_med'], r['lg_med'], r['h'] or HMED,
            float(r['pos'] == 'Attack'), float(r['pos'] == 'Midfield'), float(r['pos'] == 'Defender'), float(r['pos'] == 'Goalkeeper')]

def model(train):
    return make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=3000)).fit(np.array([fx(r) for r in train]), np.array([r['y2'] for r in train]))

lab = [r for r in young if r['c'] in FULL and r['s'] <= 2022 and r['v1']]
vals = collections.defaultdict(list)
for v in csv.DictReader(gzip.open(D + '/player_valuations.csv.gz', 'rt')):
    try: vals[v['player_id']].append((v['date'][:10], float(v['market_value_in_eur'])))
    except ValueError: pass
for k in vals: vals[k].sort()

out = {'seasons': [], 'tiers': {}, 'bih': {}}
allpicks = collections.defaultdict(list)
print('=== VREMEPLOV: radar pusten unazad (logisticka regresija, stroza meta, bazen do 1M, bez filtriranja po ishodu)')
tot = collections.Counter()
for T in range(2017, 2023):
    train = [r for r in young if r['c'] in FULL and r['s'] <= T - 3 and r['v0'] <= 5e6]
    m = model(train)
    pool = [r for r in young if r['c'] in FULL and r['s'] == T and r['v0'] <= 1e6]
    sc = m.predict_proba(np.array([fx(r) for r in pool]))[:, 1]
    order = sorted(range(len(pool)), key=lambda i: -sc[i])
    kA = max(1, round(0.10 * len(pool))); kB = max(1, round(0.20 * len(pool)))
    for rank, i in enumerate(order):
        tier = 'A' if rank < kA else ('B' if rank < kB else 'C')
        r = pool[i]; allpicks[tier].append(r)
        tot[(tier, 'n')] += 1; tot[(tier, 'hit')] += r['y2']; tot[(tier, 'unknown')] += (r['v1'] is None)
    A = [pool[i] for i in order[:kA]]
    hits = sum(r['y2'] for r in A); base = np.mean([r['y2'] for r in pool])
    print(f"sezona {T}/{str(T+1)[2:]}: ucenje na sezonama 2012-{T-3} ({len(train)} redova) | bazen {len(pool)} | rang A {kA}: uspjelo {hits} ({100*hits/kA:.0f}%) | cijeli bazen {100*base:.0f}%")
    if T >= 2019:
        picks = []
        for rank, r in enumerate(A, 1):
            p = P[r['pid']]
            picks.append({'rank': rank, 'id': r['pid'], 'name': p['name'], 'club': CLUB.get(r['club'], ''), 'league': NAME[r['c']], 'position': p['sub_position'] or r['pos'],
                          'age': round(r['age'], 1), 'value_then': r['v0'], 'value_3y': r['v1'], 'made_it': bool(r['y2']),
                          'value_peak': float(p['highest_market_value_in_eur']) if p['highest_market_value_in_eur'] else None,
                          'value_latest': float(p['market_value_in_eur']) if p['market_value_in_eur'] else None,
                          'history': [[d, v] for d, v in vals.get(r['pid'], [])]})
        out['seasons'].append({'season': f"{T}/{str(T+1)[2:]}", 'decision_date': f"{T+1}-06-30", 'outcome_date': f"{T+4}-06-30",
                               'trained_on': f"2012/13–{T-3}/{str(T-2)[2:]}", 'training_rows': len(train), 'pool': len(pool),
                               'pool_rate': round(float(base), 3), 'picks': picks, 'hits': int(hits)})
print('\nzbirno 2017/18-2022/23:')
for t in 'ABC':
    n, h = tot[(t, 'n')], tot[(t, 'hit')]
    mult = sorted(r['v1'] / r['v0'] for r in allpicks[t] if r['v1'])
    q = lambda f: mult[int(f * (len(mult) - 1))]
    lost = sum(1 for x in mult if x < 1) / len(mult)
    out['tiers'][t] = {'n': n, 'hits': h, 'rate': round(h / n, 3), 'unknown_outcome': tot[(t, 'unknown')],
                       'multiple_p25': round(q(.25), 2), 'multiple_p50': round(q(.5), 2), 'multiple_p75': round(q(.75), 2), 'share_lost_value': round(lost, 3)}
    print(f"  rang {t}: n={n} uspjelo {h} ({100*h/n:.1f}%) | bez kasnije vrijednosti {tot[(t,'unknown')]} | omjer vrijednosti nakon 3 god: p25 x{q(.25):.2f}, medijan x{q(.5):.2f}, p75 x{q(.75):.2f} | izgubili vrijednost {100*lost:.0f}%")
n = sum(tot[(t, 'n')] for t in 'ABC'); h = sum(tot[(t, 'hit')] for t in 'ABC')
print(f"  cijeli bazen: n={n} uspjelo {h} ({100*h/n:.1f}%)")

for s in out['seasons']:
    print(f"\n--- {s['season']} (odluka {s['decision_date']}, model ucio na {s['trained_on']}): rang A, {s['hits']} od {len(s['picks'])} uspjelo; bazen {100*s['pool_rate']:.0f}%")
    for p in s['picks']:
        v3 = f"{p['value_3y']/1e6:5.2f}M" if p['value_3y'] else '   n/a'
        print(f"  {p['rank']:2} {p['name'][:24]:24} {p['age']:4} {p['position'][:16]:16} {p['club'][:22]:22} {p['league'][:11]:11} {p['value_then']/1e6:5.2f}M -> {v3} {'USPIO' if p['made_it'] else '  -  '} vrh {(p['value_peak'] or 0)/1e6:5.1f}M  tacaka historije {len(p['history'])}")

# ------------------------------------------------ players with a Bosnian link, season 2025/26
EASE = {'GB1':0.59,'ES1':0.69,'IT1':0.71,'FR1':0.78,'L1':0.80,'RU1':1.00,'TR1':1.03,'PO1':1.04,'NL1':1.15,'DK1':1.21,'BE1':1.21,'GR1':1.24,'SC1':1.53,'UKR1':1.62,
        'C1':1.20,'A1':1.27,'NO1':1.31,'KR1':1.36,'SE1':1.36,'PL1':1.39,'RO1':1.39,'SER1':1.42,'TS1':1.46}
cur = [r for r in rows if r['s'] == 2025]
for r in cur: r['adj'] = (r['g90'] + r['a90']) / EASE[r['c']]
refp = collections.defaultdict(list)
for r in cur: refp[r['pos']].append(r['adj'])
for k in refp: refp[k].sort()
import bisect
final = model([r for r in young if r['c'] in FULL and r['s'] <= 2022 and r['v0'] <= 5e6])
pool25 = [r for r in young if r['s'] == 2025 and r['v0'] <= 1e6]
sc = final.predict_proba(np.array([fx(r) for r in pool25]))[:, 1]
order = sorted(range(len(pool25)), key=lambda i: -sc[i]); kA = round(.1 * len(pool25)); kB = round(.2 * len(pool25))
tier25 = {pool25[i]['pid']: ('A' if rk < kA else 'B' if rk < kB else 'C') for rk, i in enumerate(order)}
bih = lambda pid: 'Bosnia' in (P[pid]['country_of_citizenship'] or '')
B = sorted([r for r in cur if bih(r['pid'])], key=lambda r: r['age'])
lst = []
for r in B:
    p = P[r['pid']]
    lst.append({'name': p['name'], 'age': round(r['age'], 1), 'position': p['sub_position'] or r['pos'], 'club': CLUB.get(r['club'], ''), 'league': NAME[r['c']],
                'value': r['v0'], 'minutes': r['min'], 'goals': round(r['g90'] * r['min'] / 90), 'assists': round(r['a90'] * r['min'] / 90),
                'rating': round(100 * bisect.bisect_left(refp[r['pos']], r['adj']) / len(refp[r['pos']])), 'tier': tier25.get(r['pid']),
                'citizenship': p['country_of_citizenship'], 'born_in': p['country_of_birth']})
out['bih'] = {'season': '2025/26', 'players': len(lst), 'aged_23_or_under': sum(1 for x in lst if x['age'] <= 24.5), 'young_pool_definition': sum(1 for r in B if r['s'] - r['yob'] <= 21), 'in_radar_pool_1m': sum(1 for r in B if r['pid'] in tier25), 'list': lst}
print(f"\n=== NASI VANI 2025/26: {len(lst)} igraca s bh. drzavljanstvom (450+ min); do 21 god (definicija bazena): {out['bih']['young_pool_definition']}; u bazenu radara do 1M: {out['bih']['in_radar_pool_1m']}. Najmladjih 14:")
for x in lst[:14]:
    print(f"  {x['name'][:24]:24} {x['age']:4} {x['position'][:16]:16} {x['club'][:22]:22} {x['league'][:11]:11} {x['value']/1e6:5.2f}M  min {x['minutes']:4}  {x['goals']}+{x['assists']}  ocjena {x['rating']:3}  rang {x['tier'] or '-'}  ({x['citizenship']}/{x['born_in']})")
print('  bazen 2025/26 do 1M:', len(pool25), '| rang A:', kA)
json.dump(out, open(sys.argv[3], 'w'), ensure_ascii=False)
