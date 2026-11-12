"""Census of the open Transfermarkt dataset: what each European first-tier league holds.
Usage: python3 -I census.py <data_dir>
"""
import csv, gzip, sys, collections, datetime, json

D = sys.argv[1]


def rd(name):
    return csv.DictReader(gzip.open(f"{D}/{name}.csv.gz", "rt"))


comps = {c["competition_id"]: c for c in rd("competitions")}
EU = {k for k, c in comps.items() if c["type"] == "domestic_league" and c["confederation"] == "europa"}

players = {p["player_id"]: p for p in rd("players")}


def dob(pid):
    p = players.get(pid)
    if not p or not p["date_of_birth"]:
        return None
    try:
        return datetime.date.fromisoformat(p["date_of_birth"][:10])
    except ValueError:
        return None


def age_at_start(pid, season):
    d = dob(pid)
    if not d:
        return None
    return (datetime.date(int(season), 7, 1) - d).days / 365.25


G = {}
games_per = collections.Counter()
seasons = collections.defaultdict(set)
for g in rd("games"):
    G[g["game_id"]] = (g["competition_id"], g["season"])
    if g["competition_id"] in EU:
        games_per[g["competition_id"]] += 1
        seasons[g["competition_id"]].add(int(g["season"]))

# appearances -> player-season-league aggregates
agg = collections.defaultdict(lambda: [0, 0, 0, 0])  # minutes, goals, assists, apps
app_rows = collections.Counter()
app_players = collections.defaultdict(set)
for a in rd("appearances"):
    c, s = G.get(a["game_id"], (None, None))
    if c not in EU:
        continue
    app_rows[c] += 1
    app_players[c].add(a["player_id"])
    k = (a["player_id"], int(s), c)
    v = agg[k]
    v[0] += int(a["minutes_played"] or 0)
    v[1] += int(a["goals"] or 0)
    v[2] += int(a["assists"] or 0)
    v[3] += 1

lin_rows = collections.Counter()
lin_players = collections.defaultdict(set)
for l in rd("game_lineups"):
    c = G.get(l["game_id"], (None,))[0]
    if c in EU:
        lin_rows[c] += 1
        lin_players[c].add(l["player_id"])

ev_goals = collections.Counter()
for e in rd("game_events"):
    c = G.get(e["game_id"], (None,))[0]
    if c in EU and e["type"] == "Goals":
        ev_goals[c] += 1

val_rows = collections.Counter()
for v in rd("player_valuations"):
    c = v["player_club_domestic_competition_id"]
    if c in EU:
        val_rows[c] += 1

# young player-seasons with real minutes
u21 = collections.Counter()
u21_bt = collections.Counter()  # seasons 2012..2021: at least 3 seasons of follow-up
for (pid, s, c), v in agg.items():
    if v[0] < 900:
        continue
    a = age_at_start(pid, s)
    if a is not None and a < 22:
        u21[c] += 1
        if s <= 2021:
            u21_bt[c] += 1

rows = []
for c in sorted(EU):
    ss = sorted(seasons[c])
    rows.append({
        "id": c, "country": comps[c]["country_name"],
        "first": ss[0] if ss else None, "last": ss[-1] if ss else None, "n_seasons": len(ss),
        "games": games_per[c], "app_rows": app_rows[c], "app_players": len(app_players[c]),
        "lin_rows": lin_rows[c], "lin_players": len(lin_players[c]), "goals_ev": ev_goals[c],
        "val_rows": val_rows[c], "u21_900": u21[c], "u21_900_bt": u21_bt[c],
    })
rows.sort(key=lambda r: (-r["app_rows"], -r["lin_rows"]))
hdr = ["id", "country", "first", "last", "n_seasons", "games", "app_rows", "app_players", "lin_rows",
       "lin_players", "goals_ev", "val_rows", "u21_900", "u21_900_bt"]
print("\t".join(hdr))
for r in rows:
    print("\t".join(str(r[h]) for h in hdr))

full = [r for r in rows if r["app_rows"] > 0]
print("\nTOTAL full-history leagues:", len(full),
      "| app rows:", sum(r["app_rows"] for r in full),
      "| U21 900+ player-seasons:", sum(r["u21_900"] for r in full),
      "| of which <=2021:", sum(r["u21_900_bt"] for r in full))

# completeness of player profile for players who appear in EU leagues
ids = set().union(*app_players.values()) | set().union(*lin_players.values())
n = len(ids)
have = collections.Counter()
for pid in ids:
    p = players.get(pid)
    if not p:
        have["missing_profile"] += 1
        continue
    for f in ["date_of_birth", "position", "sub_position", "foot", "height_in_cm", "market_value_in_eur",
              "highest_market_value_in_eur", "contract_expiration_date", "country_of_citizenship"]:
        if p[f] not in ("", None, "0"):
            have[f] += 1
print("\nplayers seen in EU first tiers:", n)
for k, v in have.items():
    print(f"  {k}: {v} ({100*v/n:.1f}%)")

json.dump({f"{k[0]}|{k[1]}|{k[2]}": v for k, v in agg.items()}, open(sys.argv[2], "w"))
