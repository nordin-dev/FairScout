# Business rules and risks

## Context

These are the calculations and rules that decide what the product shows. They come from `plan/02-softverski-zahtjevi.md` chapters 3, 4, 8 and 9 and from the corrected prototype (`plan/06-podaci-i-model.md`).

## Rating

| Term | Rule |
|---|---|
| Output | 90 × (goals + assists) / minutes |
| League factor | How much easier a goal or assist is in the league than on average across the 14 measured leagues; 1.00 is average, lower is harder |
| Adjusted output | Output divided by the league factor, to two decimals |
| League adjustment shown on the card | 1 − 1 / factor, as a percentage. Factor 1.36 gives −26% |
| Rating | Percentile of adjusted output, 0 to 100 (`pct.output`) |
| Scoring, creating, playing time | Percentiles of adjusted goals per 90, adjusted assists per 90 and role |
| Goal involvement | (goals + assists) / (team goals × the player's share of team minutes), at most 1 |
| Role | Minutes / (team matches × 90) |
| Percentile group | Young players of the same position group across the 23 leagues, season 2025/26; a group under 30 falls back to the whole position group |

## League factor

Measured for 14 leagues from attackers and midfielders who played at least 900 minutes in each of two consecutive seasons in two different leagues. For each pair of leagues their goals, assists and minutes are summed on both sides and the ratio of rates is taken. Factors come from weighted least squares on the logarithms of those ratios, weighted by the number of players, with the mean logarithm fixed at zero. Pairs with fewer than eight players are left out. England must come out lowest; the rank correlation with median league value must be −0.7 or lower.

Estimated for the nine short-history leagues from a line fitted on the measured leagues: log factor against the median log value of the league's players. Russia and Ukraine are left out of that fit because their values are distorted since 2022. Every factor must lie between 0.3 and 2.5 and carries its source: "moves" or "estimate".

## Outlook model

- Training set: every young player from the 14 long-history leagues, seasons 2012/13 to 2022/23, decision value up to 5,000,000 EUR. A player with no value three seasons later is a negative example.
- Target: made it.
- 19 features, all known at decision time: age at season end; minutes; role; goals per 90; assists per 90; percentile of output within league, season and position; log value; value change over 12 months and a mark that it is missing; minutes of the previous season; team points per match; median value of team-mates; value relative to team-mates; median value of the league; height; four position-group marks.
- Product model: logistic regression on standardised features. Challenger: gradient boosting with shallow trees. Fixed seeds.
- The scoring function for a decision season trains on every season whose outcome was already known then (at least three seasons earlier) and scores that season's pool.

## Test on past seasons

- Test seasons 2017/18 to 2022/23. For each, the model trains only on seasons at least three earlier.
- The pool is every young player of the season inside the budget (1,000,000 and 500,000 EUR). A player with no value three seasons later counts as not made it. Leaving such players out inflated every rate in the first prototype; that must not be repeated.
- Report: hits, picks and rate of the top 10% and top 20% for both models and four simple rules (most minutes, most goals and assists, youngest, cheapest), with the pool rate and the margin of error, and the top 10% per season.
- Results are reported as measured. No setting is tuned to improve them.

## Tiers, reasons, flags

- Inside the pool: top 10% by score is tier A, next 10% tier B, the rest tier C. Each tier is shown with the share of past players in that tier who made it, never with a probability for one player.
- Reasons: contribution = coefficient × standardised value. Up to three for and one against, each a phrase of four words or fewer from a fixed dictionary.
- Flags: under 18; small sample (under 900 minutes); contract ending within 12 months; born October to December; limited position data (defenders and goalkeepers).
- Projection on the card: today's value × the tier's 25th, 50th and 75th percentile multiples. It is a range of past outcomes, not a forecast.

## Time machine

The list of a past season is the top 10% of that season's full pool, in the model's order, misses included, produced by the same scoring function as today's radar. Success is always measured three seasons after the radar's date; today's value is an extra column that does not change the count. The default season is the latest one that can be checked, not the best one. Prices are labelled "price then": the value is a lagging estimate, and the claim is that the model flagged the player, not that he could be bought at that price.

## Blind pick

Matching players are pool players of the chosen position, age limit and budget. The three candidates are: the model's top, the top by raw goals and assists, and the best remaining match for the scout's priorities (mean of the chosen scores). No player appears twice. The order is shuffled by a seed from the brief, so the same brief always gives the same three in the same order.

## Similarity

Inside a position group each player is a standardised vector of adjusted goals per 90, adjusted assists per 90, role, age, height and foot. Distance is weighted Euclidean. Similarity = 100 × (1 − distance / the group's 95th-percentile distance), at least 0. It is a display scale, not a probability, and it does not describe playing style.

## Quality checks before export (all fifteen must pass)

1. Each of the nine tables has its expected columns and more than zero rows.
2. Rebuilt minutes on the test leagues are within 5 minutes in at least 99% of appearances.
3. No player has more minutes than his team played.
4. Every pool player has a birth date, a position group and a value.
5. Every league has a factor between 0.3 and 2.5.
6. England has the lowest factor of the 14 leagues.
7. No test season is in its own training set.
8. Hits plus misses equal picks in every row of the report.
9. Counts per tier add up to the pool size.
10. No player is similar to himself.
11. Every note contains only numbers from its input record.
12. The output files pass the schema check.
13. In the time machine no training row is from a season less than three before the one shown.
14. The time machine pool holds every young player of the season up to 1,000,000 EUR, whatever the later outcome.
15. The time machine list is exactly the top 10% of the pool, in the model's order.

## Known limits (shown in the product)

Market value is a community estimate and lags behind form. Defenders and goalkeepers are rated on role and team context, not their own actions. The nine regional leagues have two seasons of data; the model is applied there, not tested. In six of them line-ups are missing for a fifth to a third of the 2024/25 matches, and in Norway and Sweden the current season is only a third played. Under 900 minutes a rating can move a lot. The model's edge over "most minutes" is within the margin of error. Results vary a lot between seasons.

## Risks

The register is in prodready (RISK-001 to RISK-011). The ones that bind builders: show measured numbers also when they are weaker than the prototype's; do not let any screen drift from the mockup; bundle data and fonts; mark estimated league factors on screen; never show a number that failed a check.
