# Fair Scout

Fair Scout helps a football scout find young players whose market value is likely to rise, using open Transfermarkt data. It is for a scout with a small budget who cannot watch every league. It has five screens: a blind pick, a radar, a player card, a time machine and an evidence page.

## Where the data comes from

The data is the open Transfermarkt dataset, `dcaribou/transfermarkt-datasets` on GitHub. It is a public community dataset. Fair Scout is a non-commercial prototype built for a hackathon. It covers 23 European first tiers and the seasons 2012/13 to 2025/26. Fourteen leagues have all fourteen seasons. Nine regional leagues have two (2024/25 and 2025/26). The source's last date is given under Results.


## Definitions

- **Season**: named by its start year. Season 2025 is 2025/26.
- **Young player**: season start year minus birth year is at most 21, and at least 450 league minutes in the season.
- **Decision value**: the last market value between 1 December of the season and 30 June at its end.
- **Outcome**: the last market value in the same window three seasons later. It is empty when there is none.
- **Made it**: the outcome is at least twice the decision value and at least 1,000,000 EUR. An empty outcome counts as not made it.
- **Radar pool**: young players of 2025/26 with a decision value of at most 1,000,000 EUR, in the 23 leagues.

## Method

**Rating, in four steps.**

1. Output is 90 x (goals + assists) / minutes.
2. Output is divided by the league factor, which says how much easier a goal or assist is in that league.
3. The adjusted output is turned into a percentile among young players of the same position group in 2025/26.
4. That percentile, from 0 to 100, is the rating.

**League factor.** It is measured from attackers and midfielders with at least 900 minutes in each of two seasons in a row who changed league. For the nine regional leagues it is estimated from a line fitted on the measured leagues, and the app marks it as an estimate.

**Outlook model.** A logistic regression with 19 inputs, all known at decision time. They are: age; playing time and role; goals and assists per 90 and the percentile of output; the player's value and how it changed over 12 months; minutes of the previous season; the team's points per match; the value of team-mates and of the league; height; and the position group.

**Test on past seasons.** For each test season the model trains only on seasons at least three years earlier. Every player in the pool is counted. A player with no value three years later counts as not made it. The best-scoring tenth of the pool is compared with four simple rules and a second model. No setting was tuned to improve the result.

**Tiers and reasons.** The best-scoring tenth of the pool is tier A, the next tenth tier B, the rest tier C. A tier is shown with the share of past players in it who made it, never as a chance for one player. Each player has up to three reasons for and one against, taken from a fixed list of short phrases.

## Results

A script fills this block from `app/public/data/evidence.json` and `app/public/data/meta.json`, and a test fails when it differs. Run `make readme` to refill it. No result is typed anywhere else in this file.

<!-- results:start (filled by scripts/readme_numbers.py, do not edit by hand) -->
- Source last date: 2026-07-06.
- Test seasons: 2017/18 to 2022/23 (6 seasons).

Budget 1,000,000 EUR: pool of 1,336 players, 29.6% of them made it. Margin of error: 7.8 percentage points. Top 10% means 133 picks per rule.

| Rule | Hits | Picks | Rate |
|---|---|---|---|
| Model, logistic regression | 68 | 133 | 51.1% |
| Model, gradient boosting | 60 | 133 | 45.1% |
| Most minutes played | 59 | 133 | 44.4% |
| Most goals and assists | 49 | 133 | 36.8% |
| Youngest | 48 | 133 | 36.1% |
| Cheapest | 16 | 133 | 12.0% |

Budget 500,000 EUR: pool of 733 players, 22.8% of them made it. Margin of error: 9.6 percentage points. Top 10% means 74 picks per rule.

| Rule | Hits | Picks | Rate |
|---|---|---|---|
| Model, logistic regression | 31 | 74 | 41.9% |
| Model, gradient boosting | 33 | 74 | 44.6% |
| Most minutes played | 28 | 74 | 37.8% |
| Most goals and assists | 12 | 74 | 16.2% |
| Youngest | 25 | 74 | 33.8% |
| Cheapest | 9 | 74 | 12.2% |

Product model, top 10% at 1,000,000 EUR, season by season:

| Season | Hits | Picks |
|---|---|---|
| 2017/18 | 15 | 23 |
| 2018/19 | 10 | 22 |
| 2019/20 | 17 | 22 |
| 2020/21 | 7 | 23 |
| 2021/22 | 9 | 20 |
| 2022/23 | 10 | 23 |
<!-- results:end -->

## Limits

1. Market value is a community estimate and lags behind form.
2. Defenders and goalkeepers are rated on role and team context, not on their own actions. The source has no shots, passes or defensive actions.
3. The nine regional leagues have two seasons of data. The model is applied there, not tested.
4. In six of the nine regional leagues, line-ups are missing for about a fifth to about a third of the 2024/25 matches. The model's input for last season's minutes is scaled up by the share of matches that have line-ups there, which is an estimate, not a count. Norway and Sweden were a third through their season when the source ends.
5. Under 900 minutes a rating can move a lot. Such players carry a small-sample flag.
6. The model's edge over "most minutes" is inside the margin of error.
7. Results vary a lot between seasons.
8. The tool says who to watch, not who to sign.

## Scout notes

The notes are written during data preparation by the Claude command-line program, installed and signed in on the team's machine. No API key is used, and a key variable set in the shell is not passed on to the program. Without it, or when a note fails its checks, a template sentence built from the player's own numbers is used and labelled "Summary". The app itself never calls a model. Their one setting is the environment variable `FAIRSCOUT_NOTES`, with the values `model` (the default) and `template`.

## Tennis, the second sport

Every screen starts with a choice of sport: football, tennis or basketball. Tennis uses the same idea with its own data and its own model, on all four screens: blind pick, radar, time machine and evidence.

- **Data:** the open ATP tables of Jeff Sackmann / Tennis Abstract (`tennis_atp`: players, weekly rankings, matches at tour, Challenger and entry level), licence CC BY-NC-SA 4.0: attribution required, non-commercial use only. The author's own repository was not reachable on 12 November 2026, so `scripts/tennis_data.py` downloads the tables from an unchanged public fork of it; the last ranking date in the data is shown in the app's footer.
- **Pool:** men under 21 on the ranking date, ranked 101 to 1000.
- **Outcome:** a ranking inside the top 100 at any time in the following three years. Tennis has no market value, so this replaces the rise in value used for football.
- **Model:** a logistic regression on five inputs from the 52 weeks before the ranking date: age, ranking, win rate, share of matches at Challenger level or higher, and wins over top-200 players. The top tenth of the pool by score is tier A, the next tenth tier B, the rest tier C.
- **Test:** walk-forward over past June pools: each year's pool is scored by a model that saw only pools whose three years had already ended. The script prints the result and the evidence screen shows it, next to three simple rules (best ranking, most wins, youngest), the margin of error and the result of each year. The time machine shows, for each tested year, the players the model ranked highest then and what happened to them, and the players it missed.
- **Limits:** the pool is small (about a hundred players at a time); the outcome is a ranking, not money; picking by best ranking alone is already a strong rule and the model's edge over it is inside the margin of error; the data ends at the last ranking date and is not refreshed by `make data`.

`make tennis-data` rebuilds `app/public/data/tennis.json` (a few seconds once the tables are in `data/tennis/`).

## Basketball, the third sport

Basketball follows the same four screens with its own data and model.

- **Data:** the public statistics of EuroLeague and EuroCup (EuroLeague Basketball), seasons 2007/08 to 2025/26: one line per player and season, and the players' birth dates, heights, positions and countries. `scripts/basketball_data.py` downloads them from the competitions' public API.
- **Pool:** players under 23 at the start of a season with at least five games in either competition and under 18 minutes per game: young players with a small role.
- **Outcome:** a season with at least ten games and at least 20 minutes per game in either competition within the three following seasons ("became a rotation player").
- **Model:** a logistic regression on six inputs of the season: age, minutes per game, index rating and points per 40 minutes, games played, and whether the club plays in the EuroLeague. Tiers are cut as for the other sports.
- **Test:** walk-forward over ten past seasons; the script prints the result and the evidence screen shows it next to three simple rules (most minutes, best index rating per game, youngest), with the margin of error and each season's result.
- **Limits:** the pools are small (a few dozen players a season); the outcome is playing time, not money; a player who leaves for the NBA or for a league outside these two competitions has no later season in the data and counts as not reached; domestic leagues, where most young players are, are not covered, so the pool holds only those who already sit on the bench of a EuroLeague or EuroCup club. The pool's limits of age and minutes were set after a look at how many players each choice leaves.

`make basketball-data` rebuilds `app/public/data/basketball.json`.

## Accounts and My picks

A scout can create an account (a name and a password) and log in. Signed in, every revealed blind pick, every radar row and every player card of the three sports has an "Add to my picks" button, and the My picks screen lists the saved players by sport with a link back to each card.

The app has no server, so accounts and lists are kept in the local storage of the browser they were made in: an account made on one computer does not exist on another, also when the app is served from a hosting service. A password is stored as a salted SHA-256 hash, which keeps it out of plain sight and is not protection against someone with access to that computer.

## Run it

You need Python 3.12, the tool `uv`, Node.js with npm, and Chrome or Chromium for the health check and the browser checks.

No environment setting is required: there is no key or account to set up. Two settings are optional. `FAIRSCOUT_NOTES=template make data` writes the template sentences without starting the Claude program; the default, `FAIRSCOUT_NOTES=model`, is described under Scout notes. `FAIRSCOUT_DATA=<folder>` makes the pipeline keep its raw and work tables in that folder instead of `data/` in the checkout; tables already there are read and overwritten. The five data files of the app are written to `app/public/data/` either way.

1. `make setup` installs the Python packages (with `uv`, from the lock file) and the app packages (with `npm ci`). It can be run again at any time: it replaces the Python environment in `.venv`.
2. `make data` rebuilds all data: it runs `python -m fairscout all` from the raw tables in `data/raw/` to the five files in `app/public/data/` and prints the pool size. A source table that is missing from `data/raw/` is downloaded first from the open dataset; tables that are present are not downloaded again. It takes about five minutes on a laptop, about one of them for the scout notes. Without the Claude program the run still finishes, with template sentences as notes.
3. `make verify` checks types, style, build and tests for the pipeline and the app; it stops at the first failure.
4. `make dev` starts the app for development in the browser.
5. `make health` builds the app, serves it and checks that the start page and every data file answer with status 200. It also opens all five screens (`#/blind`, `#/radar`, one player card, `#/time-machine`, `#/evidence`) in headless Chrome with a temporary profile, so it needs Chrome or Chromium installed. At the end it opens the radar once more from a copy of the build in a nested folder, which proves that the build runs from any folder of a web server.

Every other command: `make typecheck`, `make lint`, `make build` and `make test` (the four parts of `make verify`, one by one), `make preview` (serves the built app with the development tool), `make readme` (refills the results block of this file from the data files), and `make demo`, `make demo-check` and `make demo-record`, which are described under Demo.

## Demo

The demo runs from the built app as plain static files, so it needs no network and no development server.

1. `make build` builds the app into `app/dist`; run it first, `make demo` stops with a message if the build is missing.
2. `make demo` serves `app/dist` on 127.0.0.1 and prints the address to open, `http://127.0.0.1:4173/`, which opens on the blind pick. After the first load the whole demo works with the network switched off. A direct address such as `/radar` also works. Another port: `node scripts/serve.mjs --port 5000`. Ctrl+C stops it.

On a hosting service the same server is used: `npm run build` at the root installs and builds the app, `npm start` serves it. When the service sets `PORT`, the server listens on that port on every interface instead of 127.0.0.1 only; `HOST` or `--host` sets the interface outright.
3. `make demo-check` runs the walkthrough in Chrome three times in a row on the production build, served by the same demo server: with the mouse, with the keyboard (the test itself puts the focus on the budget slider, every other step is a key), from the start address, with a direct `/radar` address, and once with every request blocked and the browser offline after the first load. It fails on any console error or network request after the first load.
4. `make demo-record` runs the mouse walkthrough once, slowly, filmed with Chrome's own screencast (it needs only Chrome), and saves the recording as `demo/walkthrough.webm`, which plays in Chrome or VLC. The folder `demo/` is not under version control.

## More

- `plan/` holds the planning documents (in Bosnian).
- `contract/` holds the schemas of the five data files.
