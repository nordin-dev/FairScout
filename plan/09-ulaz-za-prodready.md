# 09 — Ulaz za prodready

Sve što prodready traži prije prvog sprinta, složeno po njegovim koracima. Tekstovi koji se unose su na engleskom, kao i kod i interfejs. Oznake (`feat-…`, `S-001`) prate oblik koji prodready očekuje.

**Stanje od 12. 11. 2026.:** sadržaj je unesen u prodready (projekat Fair Scout). Tamo je backlog presložen u 38 priča i 5 sprintova, SP-0 do SP-4, da zadovolji pravila prodreadyja (najviše 8 priča po sprintu, provjera izgradnje na kraju svakog sprinta). Brojevi priča i sprintova u poglavljima 9 i 10 ovdje zato više ne odgovaraju; važi backlog u prodreadyju.

Ovo je priprema, ne zamjena za prodready uputstva: prije svakog koraka čita se njegov vodič u prodreadyju, pa se ovaj sadržaj po potrebi prilagodi. Brojevi priča pretpostavljaju da se priče unose ovim redom u prazan projekat.

## 0. Redoslijed

| Korak | Šta se unosi | Odakle |
|---|---|---|
| Projekat | Naziv i tehnologije | Poglavlje 1 |
| Upoznavanje (discovery) | Pet oblasti, funkcije, prvo izdanje | Poglavlje 2; ulazni dokumenti su `01`, `02`, `04`, `06` |
| Vizija | Moduli, funkcije, korisničke putanje | Poglavlje 3 |
| Opseg | Cilj, u opsegu, van opsega, pretpostavke, arhitektura | Poglavlje 4 |
| Putanje i ekrani | Persone, ekrani, veze, kritične putanje | Poglavlje 5 |
| Žičani okviri | Četiri stranice s četiri stanja, pod `.prodready/wireframes/` | `04-frontend-dizajn.md` i `dizajn/mockup.html` |
| UI ugovor | Rute, navigacija, raspored, komponente, pravila tokena | Poglavlje 6 |
| Arhitektura | Odjeljci i odluke | Poglavlje 7 |
| Rizici | Registar | Poglavlje 8 |
| Priče | 30 priča | Poglavlje 9 |
| Sprintovi | Tri sprinta | Poglavlje 10 |

## 1. Projekat

| Polje | Vrijednost |
|---|---|
| Name | Fair Scout |
| Stack | python, pandas, scikit-learn, vite, react, typescript |
| Brownfield | false |

## 2. Upoznavanje

| Oblast | Sažetak za unos |
|---|---|
| vision | Radar for a scout at a small-budget club: 3 personas, 4 journeys, 8 modules, 35 features. Finds undervalued young players in 23 leagues and proves the method with a backtest. |
| data_model | 9 source tables in, 4 static JSON files out: players, leagues, evidence, meta. No database. One flow with state: blind pick goes from brief to comparison to reveal. |
| tech_stack | Python pipeline with pandas and scikit-learn; Vite, React and TypeScript app reading static JSON. No sign-in. No runtime integrations. Optional offline language-model batch. |
| ui | 5 screens: blind, player, radar, time machine, evidence. 23 shared components. Tokens, type scale and a working mockup exist. Presentation view by default, method details on demand. Desktop from 1280 px, light theme. |
| business_rules | Definitions: young player, decision value, outcome, hit. Tier rule A, B, C. League factor from moves or estimate. 12 quality checks before export. 8 risks. |

Ulazni dokumenti (unosi se samo vrsta i naziv): prd "Fair Scout PRD"; requirements "Software requirements"; design "Frontend design and mockup"; schema "Data contract samples"; notes "Data and model notes"; notes "Jury scoring map".

Pitanje koje zatvara samo vlasnik projekta: podaci sadrže imena i datume rođenja profesionalnih igrača iz javnog izvora, među njima trojicu mlađih od 18 godina. Odluka vlasnika od 12. 11. 2026.: podaci se smiju prikazati, a igrači mlađi od 18 godina se ne skrivaju; ostaju označeni.

**Prvo izdanje, unutra:** data preparation for 23 leagues; league factor; outlook model with backtest; export to JSON; blind pick; player card with rating receipt and outlook; radar with filters and table; evidence screen; provenance footer.
**Prvo izdanje, vani:** accounts; live data; Bosnian league; women's football; mobile layout; dark theme; search by name; PDF export.

## 3. Vizija

**Product name:** Fair Scout
**Tagline:** A radar that looks at the game, not the name.
**Overview:** Fair Scout helps a scout at a small-budget club decide who is worth a trip. It ranks young players from 23 European first tiers inside the scout's budget, converts output from different leagues to one scale, explains every rating step by step, and shows how often players ranked this high have succeeded in the past. In the blind pick the scout first says what he is looking for, then chooses among three candidates whose name, club, league and price stay hidden until he has chosen. An evidence screen shows the backtest against simple rules and lists what the model does not know.

### Moduli i funkcije

| Modul | Funkcija | Naziv | Prioritet | Priče |
|---|---|---|---|---|
| `data-pipeline` Data preparation | `feat-ingest` | Download and validate source tables | must | S-001 |
| | `feat-season-stats` | Season statistics for 23 leagues | must | S-002, S-003 |
| | `feat-values` | Decision value and outcome | must | S-004 |
| | `feat-export` | Export app data with quality checks | must | S-011 |
| `context-rating` Context-adjusted rating | `feat-league-factor` | League strength factor | must | S-005 |
| | `feat-adjusted-output` | Adjusted output, involvement and role | must | S-006 |
| | `feat-percentiles` | Percentiles by age and position | must | S-006 |
| `outlook-model` Outlook model | `feat-training-set` | Training set and model | must | S-007 |
| | `feat-backtest` | Walk-forward backtest on the full pool, and past radars for the time machine | must | S-008, S-027 |
| | `feat-tiers` | Tiers with historical hit rates and outcome ranges | must | S-009 |
| | `feat-drivers` | Reasons behind a ranking | must | S-009 |
| `blind-pick` Blind pick | `feat-brief` | The scout's brief: position, age, budget, priorities | must | S-026 |
| | `feat-blind-trio` | Three unnamed candidates for the brief | must | S-014 |
| | `feat-reveal` | Reveal after choosing | must | S-014 |
| | `feat-verdict` | My pick, the model's pick, the raw-goals pick | must | S-014 |
| `player-card` Player card | `feat-rating-receipt` | Four-step rating | must | S-015 |
| | `feat-outlook-panel` | Outlook tier and drivers | must | S-016 |
| | `feat-flags` | Flags: sample, birth quarter, age, contract | should | S-009, S-016 |
| | `feat-similar` | Similar players inside the budget | should | S-010, S-017 |
| | `feat-projection` | Where the player could be in three years | should | S-029 |
| | `feat-scout-note` | Scout note from the numbers | should | S-012, S-017 |
| `radar` Radar | `feat-radar-filters` | Budget and other filters | must | S-018 |
| | `feat-radar-table` | Ranked table | must | S-018 |
| | `feat-passport-view` | Players with a Bosnian passport | should | S-030 |
| | `feat-value-outlook-chart` | Value against outlook chart | should | S-019 |
| `evidence` Evidence | `feat-backtest-chart` | Backtest chart | must | S-020 |
| | `feat-league-chart` | Biggest riser of each season; league difficulty in details | must | S-021 |
| | `feat-birth-chart` | Birth-month finding, in details | should | S-021 |
| | `feat-limits` | What the model cannot see | must | S-021 |
| | `feat-time-machine` | The radar with the calendar turned back, then the outcome | must | S-028 |
| `app-shell` App shell | `feat-navigation` | Three numbered sections and a player card opened from a player | must | S-013 |
| | `feat-budget` | One budget for every screen | must | S-013 |
| | `feat-provenance` | Source line on every screen | must | S-013 |
| | `feat-demo-keys` | Keyboard control for the demo | should | S-013 |
| | `feat-details` | Presentation view with method details on demand | must | S-013 |

Veze između modula: `data-pipeline` → `context-rating` (data-dependency, season statistics); `context-rating` → `outlook-model` (data-dependency, adjusted features); `outlook-model` → `data-pipeline` (handoff, scores and evidence for export); `blind-pick` → `player-card` (navigation, open the model's pick); `radar` → `player-card` (navigation, open a row); `player-card` → `evidence` (navigation, how the tier was measured).

### Korisničke putanje

| Oznaka | Persona | Cilj | Koraci (modul) | Ishod | Mjere |
|---|---|---|---|---|---|
| `blind-check` | Scout | Choose a candidate for one position without knowing who is who | Say what I am looking for (blind-pick) → compare three unnamed candidates (blind-pick) → pick one (blind-pick) → see who they are and whether the model agrees (blind-pick) → open the model's pick (player-card) | The scout has his own pick, made on what the players do, and knows where he and the model disagree | Brief to reveal under 30 s; reveal under 0.5 s |
| `weekend-shortlist` | Scout | Decide who is worth a trip this weekend | Set the budget (app-shell) → read the ranked list (radar) → open a player (player-card) → check similar players (player-card) | A list of up to ten names with reasons | List in under 10 s; filtering under 100 ms |
| `defend-recommendation` | Sporting director | Understand and defend a recommendation | Read the rating receipt (player-card) → read the outlook and drivers (player-card) → read the scout note (player-card) → check the evidence (evidence) | A recommendation that can be explained to the board | Every number has unit, comparison and source |
| `jury-walkthrough` | Juror | Understand problem, tool and proof in three minutes | Blind pick (blind-pick) → player card (player-card) → radar (radar) → time machine (evidence) → evidence (evidence) | The demo runs start to finish without a stall | Walkthrough in 2:40 with speech; no network after load |

## 4. Opseg

**Objective:** Give a scout at a small-budget club a short, explained list of undervalued young players from 23 European first tiers, and prove the method with a backtest, in a demo that runs offline in under 75 seconds.

**In scope**
- Season statistics for 23 leagues, including rebuilt minutes for nine leagues without an appearances table
- League strength factor from player moves, with estimates where history is short
- Outlook model with a walk-forward backtest against four simple rules
- Tiers A, B and C with historical hit rates, and reasons for each ranking
- Four screens: blind pick, player card, radar, evidence
- Similar players inside the budget and a scout note written offline
- Source line on every screen and a list of what the model does not know

**Out of scope**
- Accounts, sign-in and any server
- Live data and automatic updates
- The Bosnian league, lower tiers and women's football: no data in the source
- Playing style, video and tracking data
- Mobile layout and dark theme

**Assumptions**
- Interface and pitch are in English; all interface text sits in one file per language
- What the model learns in 14 long-history leagues carries over to nine short-history leagues; this cannot be backtested
- The open dataset may be used for a non-commercial hackathon prototype; terms of use are unconfirmed
- Numbers from the prototype will be re-derived in project code before they are shown

**Integrations**
- Open Transfermarkt dataset, nine CSV tables, downloaded once
- Language model API, used offline in the pipeline for scout notes; optional

**Architecture**
- A Python pipeline turns nine source tables into five static JSON files
- The time machine runs the radar's own scoring function with an earlier date, so past lists are made exactly as today's list
- A Vite, React and TypeScript app reads only those files; no server and no database
- Quality checks run before export; a failed check leaves the previous files untouched
- Components and charts are hand-built from the mockup; no UI kit and no chart library
- Fonts and data are bundled, so the app works with the network off

## 5. Putanje i ekrani

Persone: `scout` (Scout, app); `director` (Sporting director, app); `juror` (Juror, app).

| Ekran | Ruta | Naslov | Funkcije | Stranica žičanog okvira |
|---|---|---|---|---|
| `blind` | `/blind` | Blind pick | feat-blind-trio, feat-reveal, feat-verdict | Blind pick |
| `player` | `/player/:id` | Player card | feat-rating-receipt, feat-outlook-panel, feat-flags, feat-similar, feat-scout-note | Player card |
| `radar` | `/radar` | Radar | feat-radar-filters, feat-radar-table, feat-value-outlook-chart | Radar |
| `time` | `/time-machine` | Time machine | feat-time-machine | Time machine |
| `evidence` | `/evidence` | Evidence | feat-backtest-chart, feat-league-chart, feat-birth-chart, feat-limits | Evidence |

Veze: `blind` → `player` (cta, Open the model's pick); `radar` → `player` (nav, Open a row); `player` → `player` (nav, Open a similar player); `player` → `evidence` (nav, How the tier was measured); `time` → `evidence` (nav, All six seasons in one chart); gornja traka povezuje `blind`, `radar`, `time` i `evidence`; s kartice igrača se vraća linkom na ekran s kojeg je otvorena.

Kritične putanje, prolaze se prije završetka sprinta:
- **Jury walkthrough** (juror): `blind` → `player` → `radar` → `time` → `evidence`
- **Weekend shortlist** (scout): `radar` → `player`

## 6. UI ugovor

| Ruta | Ekran | Raspored | Grupa navigacije |
|---|---|---|---|
| `/blind` | Blind pick | app-shell | main |
| `/player/:id` | Player card | app-shell | detail |
| `/radar` | Radar | app-shell | main |
| `/time-machine` | Time machine | app-shell | main |
| `/evidence` | Evidence | app-shell | main |

Navigacija, grupa `main`: 1 Blind pick, 2 Radar, 3 Time machine, 4 Evidence. Kartica igrača nije u navigaciji: otvara se iz ekrana `blind` i `radar` i ima link za povratak. Korijenska adresa preusmjerava na `/blind`.

Raspored `app-shell` sadrži: top bar, budget chip, provenance footer. Koriste ga sva četiri ekrana.

Zajedničke komponente:

| Komponenta | Gdje se koristi |
|---|---|
| Sheet | svi ekrani |
| ChoiceChips | blind |
| RedactionBar | blind, radar |
| BigStatRow | blind |
| Tag | blind |
| RatingSteps | player |
| DotRow | player |
| FactTile | player |
| NumberPair | evidence |
| Meter | radar, detalji na kartici |
| TierBadge | blind, player, radar |
| Flag | player, radar, evidence |
| Button | blind |
| DataTable | radar |
| Tooltip | svi ekrani |
| BarRanking | evidence |
| MonthColumns | evidence |
| DotScale | evidence, u detaljima |
| ValueOutlookPlot | radar |
| ValueChart | player, time |
| PastRadarList | time |
| SegmentSwitch | radar |
| DetailBlock | blind, player, evidence |

Pravila tokena:
1. Colour comes only from the named tokens; no raw hex values in components.
2. One data colour, the accent; grey marks context.
3. Text never uses the data colour.
4. Corner radius is 2 px; 4 px only on the data end of a bar.
5. No shadows and no gradients.
6. Charts are drawn on the sheet surface only.
7. Two font families: IBM Plex Sans and IBM Plex Mono.
8. Tabular figures only where numbers align in a column.

## 7. Arhitektura

| Odjeljak | Sadržaj |
|---|---|
| system_architecture | Two parts joined only by files. The pipeline prepares data and model output once. The app is a static site that reads five JSON files. |
| data_flow | Source tables → season statistics → league factor → adjusted rating → model and backtest → tiers, drivers, flags, similar players → quality checks → JSON → app. |
| entities | Player (identity, season numbers, rating, scores, tier, drivers, flags, similar, note); League (factor, source); Evidence (backtest rows, tier rates, birth months); Meta (build facts, default brief). In the app only: Brief and the scout's blind picks. |
| state_machines | Blind pick: brief → comparison → revealed, and back to brief. Data load per screen: loading → ready, empty or error. |
| api_structure | No server interface. The contract is the shape of the five JSON files, described in the software requirements. |
| security_architecture | No accounts and no user input stored. No keys in the repository or the app. Only public data. Players under 18 are flagged and shown. |
| deployment | Static build served by any static host or a local preview. Works with the network off after first load. |
| integrations | Open dataset download, once. Language model call, offline and optional. |

Odluke:

| Oznaka | Odluka | Zašto | Odbačeno |
|---|---|---|---|
| ADR-001 | Static JSON files, no server | The demo must not depend on the network; the data changes once | A database with an API |
| ADR-002 | Logistic regression is the product model; gradient boosting is the challenger | Its reasons can be shown faithfully; accuracy is the same within the margin | Gradient boosting as the only model |
| ADR-003 | Show tiers with historical hit rates, not probabilities | Raw probabilities were under-calibrated; a measured rate can be checked | A percentage score per player |
| ADR-004 | Scout notes are written offline in the pipeline | No key in the browser, no live call during the demo, every note can be checked | A live chat with the model |
| ADR-005 | Hand-built components and charts | Four chart types; full control of the look; no generic appearance | A UI kit and a chart library |
| ADR-006 | League factor from player moves; estimate from league value where history is short | Moves compare the same players in two leagues; nine leagues have too few | One factor from league value for all |
| ADR-007 | The time machine runs the radar's own scoring function with an earlier date | A past list is proof only if it is made exactly as today's list; one function leaves no room for picking examples | A hand-made list of success stories |
| ADR-008 | Every player of a season counts in the backtest, also those with no value three seasons later | Leaving them out raised every rate; a scout cannot leave them out either | Testing only on players who still have a value |

## 8. Rizici

Vjerovatnoća i uticaj su od 1 do 5.

| Rizik | Kategorija | V | U | Odgovor | Vlasnik |
|---|---|---|---|---|---|
| Backtest results are weaker than the prototype | technical | 3 | 3 | Show the measured numbers as they are; lead the pitch with the three robust findings on goals, price and league; cap model tuning at two hours | Data lead |
| The interface looks like a generic dashboard | scope | 3 | 4 | Copy tokens and components from the mockup; use no UI kit; compare each screen with its screenshot before the story is done | App lead |
| The demo fails on stage | operational | 2 | 5 | Bundle data and fonts; run the automated walkthrough three times; keep a backup screen recording | App lead |
| The right to use the data is questioned | compliance | 3 | 3 | Name the source on every screen; state that the prototype is non-commercial and that a product would need licensed data | Team |
| League factors for nine leagues are estimates | technical | 5 | 2 | Mark them as estimates in the data and on screen; cross-check with players who played in both groups if time allows | Data lead |
| The build is not finished by the deadline | timeline | 3 | 5 | Build must-have stories first; cut in fixed order: value chart, scout note, similar players; freeze at 13:00 on 12 November | Team |
| Player data includes names, birth dates and three minors | compliance | 2 | 3 | Use only public professional data; flag players under 18; no accounts and no tracking | Team |
| Ratings for defenders and goalkeepers are weak | technical | 5 | 2 | Show role and team context instead of output with a visible limited-data flag; run the demo on an attacker | Data lead |
| The time machine is read as "you could have bought him at that price" | scope | 3 | 3 | Label the column "price then", state in details that the value is a lagging estimate, and say in the pitch that the model flagged him, not that he could be bought | Team |
| Results vary a lot between seasons | technical | 5 | 3 | Show every tested season with its result, the weakest included; default to the latest checkable season; always give the six-season total | Data lead |

## 9. Priče

Vlasnici: **Data** je osoba za podatke i model, **App** osoba za aplikaciju. Bodovi su na skali 1, 2, 3, 5.

### Podaci i model

**S-001 · Download and validate the source tables** — data · 2 · must · `feat-ingest` · Data
As a team member running the pipeline, I want one command that downloads the nine source tables and checks their columns, so that every later step starts from known input.
- AC: The command creates nine files under `data/raw`.
- AC: A missing column stops the run and names the table and the column.
- AC: The run prints the row count of each table.
- Tasks: write the download script; list expected columns per table; write the validation step; keep `data/raw` out of version control.

**S-002 · Aggregate season statistics for the 14 long-history leagues** — data · 2 · must · `feat-season-stats` · depends on S-001 · Data
As a scout, I want each player's season in one row, so that players can be compared.
- AC: One row per player, season and league holds minutes, goals, assists, matches and main club.
- AC: Total minutes per league and season equal the total in the source table.
- AC: A player with two clubs in a season gets the club where he played most minutes.
- Tasks: join appearances to games; aggregate; choose the main club; test the totals.

**S-003 · Rebuild minutes, goals and assists for the nine short-history leagues** — data · 5 · must · `feat-season-stats` · depends on S-001 · Data
As a scout, I want the same season numbers for leagues that lack an appearances table, so that regional players can be rated at all.
- AC: The output has the same columns as S-002.
- AC: On Belgium and the Netherlands 2024/25 at least 99% of appearances are within 5 minutes of the official value.
- AC: On the same test goals match in at least 99.5% of appearances.
- AC: Own goals are not credited and no player has more than 90 minutes in a match.
- Tasks: read line-ups; apply substitution and red-card rules; credit goals and assists from events; test against the appearances table; aggregate to seasons.

**S-004 · Attach decision-time value and three-season outcome** — data · 2 · must · `feat-values` · depends on S-002, S-003 · Data
As a data lead, I want each player-season to carry the value known at the season's end and the value three seasons later, so that success can be defined and learned.
- AC: Decision value is the last valuation between 1 December and 30 June of the season.
- AC: Outcome is the last valuation in the same window three seasons later.
- AC: Players without a decision value are excluded and counted in the log.
- Tasks: sort valuations per player; write the window lookup; attach both values; log exclusions.

**S-005 · Compute league strength factors** — data · 5 · must · `feat-league-factor` · depends on S-002, S-004 · Data
As a scout, I want output from different leagues on one scale, so that a goal in one league can be compared with a goal in another.
- AC: Fourteen leagues get a factor from players with 900 or more minutes before and after a move.
- AC: England has the lowest factor of the fourteen.
- AC: Nine leagues get an estimate from league market value, marked `estimate`.
- AC: Every factor lies between 0.3 and 2.5, and the number of moves used is written to the evidence file.
- Tasks: find movers; compute rate ratios per league pair; fit weighted least squares; fit the estimate on league value; write the leagues file; test the ordering.

**S-006 · Compute adjusted output, goal involvement, role and percentiles** — data · 3 · must · `feat-adjusted-output`, `feat-percentiles` · depends on S-005 · Data
As a scout, I want a rating that accounts for league, team and age, so that I can compare a player with his peers.
- AC: Adjusted output equals raw output divided by the league factor, to two decimals.
- AC: Goal involvement never exceeds 1.
- AC: Percentiles lie between 0 and 100 and compare young players of the same position group across 23 leagues.
- AC: Separate percentiles exist for league-adjusted goals (scoring) and league-adjusted assists (creating).
- AC: A reference group smaller than 30 falls back to the whole position group.
- Tasks: compute team goals and matches; compute the three measures; compute percentiles; test with hand-checked players.

**S-007 · Train the outlook model** — data · 5 · must · `feat-training-set` · depends on S-004, S-006 · Data
As a scout, I want a ranking of who is likely to grow, so that I know where to look first.
- AC: The training set holds every young player from 14 leagues, 2012/13 to 2022/23, valued up to €5M; a player with no value three seasons later is a negative example; its size is printed.
- AC: None of the 19 features uses data from after the season's end.
- AC: Logistic regression and gradient boosting train with fixed seeds.
- AC: The final model trains on all labelled seasons and scores the 2025/26 pool.
- Tasks: build the features; label the outcome; set up both models; store coefficients and scaling; score the pool.

**S-008 · Backtest the model against simple rules** — data · 5 · must · `feat-backtest` · depends on S-007 · Data
As a juror, I want to see how the model would have done in the past, so that I can judge whether to trust it.
- AC: For each test season from 2017/18 to 2022/23 the model trains only on seasons up to three earlier.
- AC: The pool is every young player of the season inside the budget; a player with no value three seasons later counts as not made it.
- AC: The report gives hits, picks and rate for the top 10% and top 20%, for both models and four rules, for budgets up to €1M and up to €500k.
- AC: A check proves that no test season is in its own training set.
- AC: Hits plus misses equal picks in every row, and the report is written to the evidence file.
- Tasks: write the walk-forward loop; write the four rules; compute rates and margins; add the checks; export.

**S-009 · Assign tiers, drivers and flags** — data · 3 · must · `feat-tiers`, `feat-drivers`, `feat-flags` · depends on S-007, S-008 · Data
As a scout, I want a tier and plain reasons for each player, so that I can read the ranking without knowing the model.
- AC: The top 10% of the pool by score is tier A, the next 10% tier B, the rest tier C, and the counts add up to the pool size.
- AC: Each tier carries its historical hit rate and count from the backtest, and the 25th, 50th and 75th percentile of the value multiple three seasons later.
- AC: Every tier A and B player has at least two drivers written as sentences.
- AC: The five flags are true or false for every player.
- Tasks: rank the pool; attach rates; compute feature contributions; map them to sentences; set the flags.

**S-010 · Find similar players** — data · 3 · should · `feat-similar` · depends on S-006 · Data
As a scout, I want players like the one I am looking at, so that I have alternatives I can afford.
- AC: Each pool player has up to three similar players from the same position group.
- AC: A player is never similar to himself.
- AC: Similarity is a number from 0 to 100 and each pair has a one-sentence difference.
- Tasks: build the standardised profile; compute distances; scale to a percentage; write the difference sentence.

**S-011 · Export app data and run quality checks** — data · 3 · must · `feat-export` · depends on S-009 · Data
As an app lead, I want the app's data in a fixed shape, so that screens can be built against it.
- AC: Five JSON files pass the schema check and together stay under 2 MB.
- AC: Each player record carries citizenship and value history.
- AC: A failed quality check stops the export and leaves the previous files untouched.
- AC: The meta file holds build date, source date, pool size and training rows.
- AC: The meta file also holds a default brief for the blind pick that yields at least three matching players.
- Tasks: write the schema; write the twelve checks; write the exporters; choose the default brief; write the meta file.

**S-012 · Write scout notes with a language model** — workflow · 3 · should · `feat-scout-note` · depends on S-011 · Data
As a sporting director, I want a short summary of a player, so that I can pass the recommendation on.
- AC: Each pool player gets a note of at most two short sentences and 25 words, written offline.
- AC: Every number in a note exists in the player's input record; the check is automatic.
- AC: A note that fails the check is replaced by a template sentence.
- AC: No key is stored in the repository or shipped in the app.
- Tasks: define the input record and output schema; write the instruction; run the batch; write the number check; write the template fallback.

**S-027 · Export past radars for the time machine** — data · 3 · must · `feat-backtest` · depends on S-008 · Data
As a juror, I want the list the model would have produced in an earlier season, so that I can see whether it would really have found the players who later made it.
- AC: For each tested season the export holds the complete tier A in the model's order, with value then, value three seasons later, the made-it flag and value history.
- AC: The list comes from the same scoring function as today's radar, run with an earlier date.
- AC: A check at export proves that no training row is from a season later than three before the one shown, that the pool was not filtered by outcome, and that the list is exactly the top 10% of the pool.
- AC: The export also holds the seasons trained on, the number of training rows, the pool size, the pool's rate and the result of every tested season.
- Tasks: turn the scoring into one function with a date argument; run it for the tested seasons; attach outcomes and value history; write the three checks; export.

### Aplikacija

**S-013 · Build the app shell** — interface · 5 · must · `feat-navigation`, `feat-budget`, `feat-provenance`, `feat-demo-keys`, `feat-details` · App
As a scout, I want one frame with my budget and clear sections, so that I always know where I am.
- AC: The top bar shows four numbered sections (blind pick, radar, time machine, evidence) and marks the active one; the player card is not a section and keeps its origin section marked.
- AC: The budget is visible on every screen, and changing it updates radar, similar players and blind pick.
- AC: The source line at the bottom reads its text from the meta file.
- AC: Arrow keys follow the demo order (blind pick, the model's pick once revealed, radar, time machine, evidence), the keys 1 to 4 switch sections, and R reveals on the blind pick and on the time machine.
- AC: A Details switch in the top bar, also on the D key, shows or hides method detail on every screen; it is off by default.
- AC: Tokens and fonts match the mockup, and fonts are bundled.
- Tasks: scaffold the app; copy tokens from the mockup; set up four routes; write the data loader with loading and error states; write the budget store; write the keyboard handler; write the details switch; build the footer.

**S-026 · Let the scout say what he is looking for** — interface · 3 · must · `feat-brief` · route `/blind` · depends on S-013 · App
As a scout, I want to state position, age, budget and what matters most before I see anyone, so that the candidates fit my need and not a general ranking.
- AC: Position, age, budget and up to two priorities are chosen with buttons; nothing is typed.
- AC: The number of matching players updates with every choice.
- AC: The continue button is disabled when fewer than three players match or no priority is chosen, and the screen says to widen the search.
- AC: The default brief comes from the meta file, so the demo starts filled in, and the chosen budget becomes the budget on every screen.
- Tasks: build the choice rows; write the matching and the count; wire the budget to the shared store; write the disabled state.

**S-014 · Let the scout pick among three unnamed candidates** — interface · 5 · must · `feat-blind-trio`, `feat-reveal`, `feat-verdict` · route `/blind` · depends on S-026 · App
As a scout, I want to choose before I know who the players are, so that name and price do not steer me.
- AC: From the players matching the brief three different candidates are chosen: the model's top, the top by raw goals and assists, and the best remaining match for the scout's priorities; the same brief always gives the same three in the same order.
- AC: Each dossier shows three scores out of 100 (creating, scoring, playing time), with the scout's priorities first and emphasised, plus position and age; name and club with league are covered by black bars and cannot be selected or read by a screen reader.
- AC: Picking one reveals all three in under half a second and shows price, goals and tier on every dossier, with a tag on the model's pick and on the player with most goals.
- AC: A one-line verdict says whether the scout and the model agree, and both picks are remembered as "my blind picks".
- AC: A button opens the model's pick, the R key reveals, and "Change" returns to the brief.
- Tasks: write the candidate selection; build the dossier with the three scores; build the redaction bar; write the reveal state and tags; compose the verdict; store the picks.

**S-015 · Show how a player's rating was built** — interface · 5 · must · `feat-rating-receipt` · route `/player/:id` · depends on S-013 · App
As a scout, I want the rating laid out step by step, so that I can check it myself.
- AC: The header shows a back link to where the card was opened from, identity and three fact tiles; a missing value shows a dash.
- AC: Four steps joined by arrows show output per 90 minutes, the league adjustment as a percentage, adjusted output and the rating out of 100, each as one large figure with at most two short lines of text.
- AC: The steps reconcile: output changed by the shown percentage equals adjusted output to two decimals; the league factor appears on hover and in details.
- AC: For defenders and goalkeepers the steps show role and team context, with a limited-data flag.
- AC: The card cannot be opened without a player: an address with no valid player goes to the radar.
- Tasks: build header and tiles; build the four steps; write the hover text and the detail block; write the position variant; write the not-found state.

**S-016 · Show the outlook and what drives it** — interface · 3 · must · `feat-outlook-panel`, `feat-flags` · depends on S-015 · App
As a scout, I want to know how far to trust the rating, so that I do not over-read it.
- AC: The panel shows the tier and two rows of ten dots: "N in 10 players like him made it" and "N in 10 for the average young player".
- AC: N is the historical rate from the evidence file rounded to a whole number; the exact count appears in details.
- AC: Up to three positive reasons and one negative reason are listed, each four words or fewer.
- AC: Each flag has an explanation on hover.
- Tasks: build the tier panel; build the dot rows; render reasons; render flags.

**S-017 · Show similar players and the scout note** — interface · 3 · should · `feat-similar`, `feat-scout-note` · depends on S-015 · App
As a scout, I want affordable alternatives and a short summary, so that I leave the card with options.
- AC: Up to three similar players inside the current budget are listed with league, price and similarity.
- AC: Clicking one opens his card; with fewer than three only those are shown.
- AC: The AI note is at most two short sentences and is hidden when there is none; its origin line appears in details.
- Tasks: filter similar players by budget; build the three rows; build the note strip.

**S-018 · Filter and rank players on the radar** — interface · 5 · must · `feat-radar-filters`, `feat-radar-table` · route `/radar` · depends on S-013 · App
As a scout, I want a ranked list inside my budget, so that I can plan the weekend.
- AC: The title sentence shows how many players match and how many are tier A, and changes with the filters.
- AC: Filters cover budget, position group, league, contract end, adults only, hidden names and my blind picks.
- AC: Defaults are five regional leagues, up to €500k; the adults-only filter is off by default; filtering takes under 100 ms.
- AC: Rows sort by tier, then adjusted output; clicking a row opens the player.
- AC: With no matches the screen offers to reset the filters.
- Tasks: build the filter rail; write the filter logic; build the table; write the title sentence; write the empty state.

**S-019 · Plot value against outlook** — interface · 3 · should · `feat-value-outlook-chart` · depends on S-018 · App
As a scout, I want to see cheap and promising players at a glance, so that I spot the corner worth exploring.
- AC: One dot per player, with value on a log scale.
- AC: Tier A dots are darker and larger; players above the budget are lighter.
- AC: The budget line and the tier A threshold are labelled.
- AC: Clicking a dot opens the player, and hover shows name, value and tier.
- Tasks: write the scales; draw dots and lines; add labels; add hover and click.

**S-020 · Show the backtest evidence** — interface · 3 · must · `feat-backtest-chart` · route `/evidence` · depends on S-013 · App
As a juror, I want the model compared with simple rules, so that I can see what it adds.
- AC: One full-width chart shows our picks and four rules as horizontal bars, with the average as a labelled line and every value printed.
- AC: One sentence above the chart says what "made it" means.
- AC: Sample size and margin appear in details, together with the same chart for budgets up to €500k.
- AC: All numbers come from the evidence file; with the file missing the screen says so and shows no numbers.
- Tasks: build the bar ranking; add the range and the average line; read the evidence file; build the detail chart; write the missing-file state.

**S-021 · Show the biggest risers and the limits** — interface · 3 · must · `feat-league-chart`, `feat-birth-chart`, `feat-limits` · depends on S-020 · App
As a juror, I want the other findings and the limits on one screen, so that I can judge the method as a whole.
- AC: Below the chart a block shows the biggest riser of each time-machine season: name, club, a line of his value, price then and three seasons later, and today's value for older seasons.
- AC: The player is chosen by rule, the highest value three seasons later in that season's tier A; a line below gives the total of all picks and how many did not make it; a click opens the time machine at that season.
- AC: A card states what the model cannot see as four labels and one sentence.
- AC: Details add league difficulty as dots on one scale, with estimated values drawn hollow, the same players in two leagues, and birth months as two figures with twelve small columns.
- AC: Details add the full list of limits, at least five items.
- Tasks: build the riser tile with its value line; write the selection rule and the total line; build the labels card; build the detail blocks for leagues, birth months and limits.

**S-022 · Add loading, empty and error states** — interface · 2 · must · depends on S-014, S-015, S-018, S-020 · App
As a scout, I want the app to say what is happening, so that a slow or failed load does not look broken.
- AC: Each of the four screens has loading, empty and error states as designed.
- AC: The error state offers a retry.
- AC: The layout does not jump between loading and loaded.
- Tasks: build the skeletons; build the empty messages; build the error block with retry.

**S-028 · Turn the calendar back on the radar** — interface · 5 · must · `feat-time-machine` · route `/time-machine` · depends on S-013 · App
As a juror, I want to see a past radar and then what happened, so that the tool's claim is shown on real players.
- AC: Buttons choose among the tested seasons; the default is the latest one that can be checked.
- AC: In the "then" state the title gives the radar's date and the number of players, and the list shows the complete tier A with club, league and price then; no outcome is visible.
- AC: A button, also the R key, reveals the value three seasons later and a made-it mark for every player; the title says how many made it and the line below gives the rate of the whole pool. For older seasons a further column shows today's value, which does not change the count.
- AC: After the first reveal every season button shows its result, the weakest season included.
- AC: Selecting a player shows his value over time with the expected range and, after the reveal, the actual course.
- AC: Details state the seasons trained on, the training rows, the pool size, the rule for players with no later value and the total of all tested seasons.
- Tasks: build the season buttons; build the two-column list; write the reveal state; build the value chart; write the detail text from the export.

**S-029 · Show where a player could be in three years** — interface · 3 · should · `feat-projection` · depends on S-015, S-009 · App
As a scout, I want a sense of how much a player could be worth, so that I can weigh the trip against the upside.
- AC: The card shows the range in which half of past players of the same tier ended and the typical outcome, as two large figures.
- AC: A chart shows his value so far, a fan to that range and a dashed line to the typical outcome.
- AC: The range is today's value times the tier's multiples from the evidence file.
- AC: Details say that this is a range of past outcomes, not a forecast, and what share of such players had no later value.
- Tasks: read the tier multiples; compute the range; reuse the value chart; write the detail text.

**S-030 · Show players with a Bosnian passport** — interface · 2 · should · `feat-passport-view` · depends on S-018 · App
As a scout at a Bosnian club, I want to see our players abroad in one place, so that I can follow them.
- AC: A switch above the radar changes between "In my budget" and "Bosnian passport", each with its count.
- AC: The second view lists players with Bosnian citizenship in the 23 leagues regardless of budget, with club, league, age, price, minutes, goals and assists.
- AC: A rating is shown only where output is meaningful; defenders, goalkeepers and deep midfielders show a limited-data flag.
- AC: Each row says whether the player is inside the current budget, and the title gives the total, the number of young players and the number inside the budget.
- Tasks: filter by citizenship; build the switch; build the table; write the title sentence.

### Provjera, objava, dokumentacija

**S-023 · Test the demo walkthrough end to end** — tests · 2 · must · depends on S-014, S-015, S-018, S-020 · App
As a team, we want the demo checked by a machine, so that it does not fail on stage.
- AC: A browser test runs blind pick, reveal, player card, radar, a budget change and evidence.
- AC: The test fails on any console error and on any network request after load.
- AC: The receipt arithmetic has a unit test.
- AC: The test passes three times in a row.
- Tasks: write the browser test; add the console and network checks; write the unit test; run three times.

**S-024 · Publish the static app and record a backup demo** — ops · 2 · must · depends on S-023 · App
As a team, we want a build that runs anywhere and a recording, so that the pitch survives a failure.
- AC: The production build is served as static files.
- AC: The app works with the network off after the first load.
- AC: A screen recording of the walkthrough exists outside version control.
- Tasks: build for production; serve and test offline; record the walkthrough.

**S-025 · Document method, sources and limits** — docs · 1 · must · Data
As a juror, I want the method written down, so that I can check it after the pitch.
- AC: The README states the data source and its date.
- AC: It defines young player and hit.
- AC: It gives the one command that rebuilds the data, and lists the limits.
- Tasks: write the README; link the plan folder.

## 10. Sprintovi

| Sprint | Priče | Bodovi | Napomena |
|---|---|---|---|
| SP-1 Data and model | S-001 do S-009, S-011, S-027 | 38 | Kritičan put. Završava kad pet JSON fajlova prođe provjere. |
| SP-2 App | S-013 do S-016, S-018, S-020, S-021, S-022, S-026, S-028 | 39 | Ide uporedo sa SP-1, na primjerima iz `ugovor-podataka/`. |
| SP-3 Finish | S-010, S-012, S-017, S-019, S-023, S-024, S-025, S-029, S-030 | 22 | Spajanje sa stvarnim podacima, dorada, provjera demoa. |

Ukupno 99 bodova. Ako ponestane vremena, redom otpadaju S-019, S-030, S-029, S-012, zatim S-010 sa S-017. Vremeplov (S-027 i S-028) se ne reže.
