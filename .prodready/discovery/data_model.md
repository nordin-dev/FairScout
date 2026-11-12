# Data and domain

## Context

All data comes from the open Transfermarkt dataset (github.com/dcaribou/transfermarkt-datasets). Nine compressed CSV tables are downloaded once into `data/raw/` (about 240 MB, not in version control). The pipeline turns them into five JSON files in `app/public/data/`, which are the only thing the app reads.

## Source tables

`competitions`, `games`, `appearances`, `game_lineups`, `game_events`, `player_valuations`, `transfers`, `players`, `clubs`, each as `<name>.csv.gz` from `https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/<name>.csv.gz`.

Coverage: 23 European first tiers.

- 14 leagues with 14 seasons (2012/13 to 2025/26) and rows in `appearances`: Italy, Spain, England, France, Türkiye, Germany, Netherlands, Portugal, Belgium, Russia, Greece, Scotland, Ukraine, Denmark.
- 9 leagues with 2 seasons (2024/25, 2025/26) and no rows in `appearances`: Poland, Serbia, Czech Republic, Romania, Switzerland, Croatia, Austria, Norway, Sweden. Their minutes, goals and assists are rebuilt from `game_lineups` and `game_events`.

Only goals, assists, minutes, cards and line-ups exist. No shots, passes or defensive actions. Market values are community estimates and lag behind form.

Two gaps in the nine short-history leagues, measured on the source tables on 12 November 2026:

- **Line-ups are missing for part of season 2024.** Matches without line-ups: Austria 40 of 164, Switzerland 44 of 202, Croatia 43 of 168, Norway 71 of 240, Romania 70 of 240, Sweden 85 of 240; Poland, Serbia and the Czech Republic are complete. Season 2025 is complete everywhere (2 matches missing in all). Rebuilt minutes of season 2024 are therefore too low for players of those six leagues. This touches one model feature, minutes of the previous season: it must be scaled by the league's share of matches with line-ups, or treated as missing.
- **Norway and Sweden play by calendar year, and the source labels their season one year back.** Their season 2024 ran from March to November 2025; their season 2025 is the 2026 season, with 89 of 240 matches played when the source ends (6 July 2026). For these two leagues the radar season is about a third of a season, and "season start year" in the young-player rule must be the calendar year of the season's first match, not the label. Players there stay in the pool and carry the small-sample flag.

## Definitions

| Term | Definition |
|---|---|
| Season | Named by its start year: season 2025 is 2025/26 |
| Young player | Season start year minus birth year is at most 21, and at least 450 league minutes in the season |
| Decision value | The last valuation between 1 December of the season and 30 June at its end |
| Outcome | The last valuation in the same window three seasons later; empty when there is none |
| Made it | Outcome is at least twice the decision value and at least 1,000,000 EUR. An empty outcome counts as not made it |
| Radar pool | Young players of 2025/26 with a decision value of at most 1,000,000 EUR, in the 23 leagues |

## The season table (pipeline, intermediate)

One row per player, season and league: player id, season, league id, main club (the club with most minutes), minutes, matches, goals, assists; later extended with decision value, outcome and the made-it mark. Both groups of leagues produce the same columns.

## The five app data files

The samples in `plan/ugovor-podataka/*.sample.json` show every key (keys that start with an underscore are notes and do not exist in real files). `contract/*.schema.json` is the binding description once story S-002 is done. Agreed additions to the samples:

**players.json** — an array. It holds the radar pool and, in addition, every player with Bosnian citizenship (`country_of_citizenship` = "Bosnia-Herzegovina") who has at least 450 league minutes in 2025/26, whatever his age and value.

- `in_pool` (boolean, required): true for the radar pool. When false, `score`, `score_rank_pct`, `tier` and `note` are null and `drivers` and `similar` are empty arrays; all other fields are filled.
- `note_source`: "model", "template" or null.
- `position_group`: "Attack", "Midfield", "Defender" or "Goalkeeper". `position`: the Transfermarkt sub-position, for example "Right Winger", "Centre-Forward", "Attacking Midfield", "Central Midfield", "Defensive Midfield", "Left-Back", "Centre-Back", "Goalkeeper".
- `league_name` is the country in English ("Croatia", "Czech Republic"); `league_id` is the competition id.
- `ga90` = 90 × (goals + assists) / minutes. `league_factor` with `league_factor_source` "moves" or "estimate". `ga90_adj` = `ga90` / `league_factor`.
- `involvement` and `role` are shares from 0 to 1. `pct` holds five whole-number percentiles from 0 to 100: `output`, `scoring`, `creating`, `involvement`, `role`.
- `tier` "A", "B" or "C"; `drivers` as `{sign: "+" | "-", key, text}`; `flags` with `under18`, `low_sample`, `contract_ending`, `born_q4`, `limited_position_data`.
- `similar`: up to three `{id, similarity 0-100, diff}`; the ids are pool players in the same file.
- `citizenship`: country name. `value_history`: `[ISO date, value in EUR]` pairs, oldest first, at most the last 12.

**leagues.json** — `{leagues: [{id, name, seasons, factor, factor_source, pool_1m, pool_500k}]}`, 23 entries.

**evidence.json** — definitions as text; `backtest` with `test_seasons`, `pick_share` and per budget (1,000,000 and 500,000 EUR) the pool size, picks per rule, margin, base rate and `rows` of `{rule, label, hits, picks, rate}` for the top 10% (plus `rows_top20`); `backtest.by_season` as `[{season, hits, picks}]` for all six tested seasons; `tiers` A, B, C with hits, count, rate, the 25th, 50th and 75th percentile of the value multiple and the number without a later value; league moves; the same players in two leagues; birth months; the minutes check.

**timemachine.json** — `as_of` (ISO date of the latest valuation in the source, "today" for the app); `six_seasons` with totals and per-season hits for 2017/18 to 2022/23; `outcome_ranges` per tier; `seasons`: the four latest tested seasons (2019/20 to 2022/23), each with decision date, outcome date, seasons trained on, training rows, pool size, pool rate, hits, and `picks`: the complete tier A in the model's order with rank, id, name, club, league, position, age, `value_then`, `value_3y` (null when there is none), `made_it`, `value_peak`, `value_latest` and `history`.

**meta.json** — build date, source, last date of the source, number of leagues, season range, radar season, pool sizes, model facts, and `default_brief` `{position, max_age, budget_eur, matters}` chosen by rule.

## State

The app keeps, in the browser tab only: the budget, the Details switch, the brief, the blind picks and the section the player card was opened from. Blind pick: brief, then comparison, then revealed. Time machine: then, then revealed. Data load per screen: loading, then ready, empty or error.

## Personal data

Names, birth dates and citizenship of professional players from a public source. Nothing about app users is collected. See decisions D-007 and D-008 in `vision.md`.

## References

- `plan/02-softverski-zahtjevi.md` chapters 7 and 8
- `plan/ugovor-podataka/` samples; `timemachine.sample.json` is real prototype output
