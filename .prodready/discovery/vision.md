# Vision and scope

## Context

Fair Scout is built for the AI Sports Analytics Hackathon (12 November 2026, pitch of three minutes). The working documents are in `plan/` and are written in Bosnian; this note and the four next to it are the English digest that builders and reviewers work from. Where a note and a plan document disagree, the note is newer.

## The product in one sentence

A scout at a small-budget club gets a short, explained list of undervalued young players from 23 European first tiers, and proof on past seasons that the ranking works.

## Users

| Role | What they do |
|---|---|
| Scout | States what he is looking for, makes a blind pick, works through the ranked radar |
| Sporting director | Reads how a rating was built and how far to trust it, to defend a recommendation |
| Juror | Follows the walkthrough: blind pick, player card, radar, time machine, evidence |

There are no accounts. Every visitor sees the same public data.

## The five screens

1. **Blind pick** (`/blind`): the scout sets a brief (position, age, budget, up to two priorities), then chooses among three candidates whose name, club, league and price are covered until he has chosen. The reveal shows who they are and whether the model agrees.
2. **Player card** (`/player/:id`): rating in four steps, outlook tier with reasons and flags, projection, similar players, a short note. It is opened from a player, not from the top bar.
3. **Radar** (`/radar`): ranked list inside the budget with filters; a second view lists players with a Bosnian passport.
4. **Time machine** (`/time-machine`): the radar of an earlier season exactly as the model would have produced it, then what happened to every player on it.
5. **Evidence** (`/evidence`): the model against four simple rules, the biggest riser of each season, what the model cannot see.

## First release

In: data preparation for 23 leagues, league strength factor, outlook model tested on past seasons with every player counted, five app data files behind quality checks, the five screens, source line on every screen, method details on demand.

Out: accounts and sign-in, live data, the Bosnian league and lower tiers, women's football, playing style and video, mobile layout, dark theme, search by name, PDF export.

## Decisions of the owner

| Id | Decision |
|---|---|
| D-007 | The open Transfermarkt data may be shown to the jury in this non-commercial prototype. The source is named on every screen. |
| D-008 | Players under 18 are shown like any other player and keep an under-18 flag. The radar filter "Aged 18 or older" exists and is off by default. |
| D-010 | Scout notes are written by a language model without an API key: the pipeline calls the Claude command-line program that runs on the team's machine. When that program is missing, not signed in or fails, the note is a template sentence labelled "Summary". The app never calls a model. |
| D-011 | The app runs from the local static build only. It is not published at a public address. |

## Rules that shape every screen

- Screens are looked at, not read: a title, large figures, labels of a few words. At most 160 words and numbers per screen in the default view. Method detail sits behind the Details switch.
- Every number shown comes from the data files. No number is typed into a component or copied from the prototype.
- The product ranks players and shows past outcomes of similar players. It never predicts a price for one player and never says "forecast".

## References

- `plan/01-PRD.md` — problem, users, solution parts, risks
- `plan/02-softverski-zahtjevi.md` — requirements with ids (FR-P, FR-M, FR-A, FR-L, NFR)
- `plan/06-podaci-i-model.md` — data and model notes, including the corrected backtest
