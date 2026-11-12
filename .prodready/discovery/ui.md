# Screens and experience

## Context

The design is fixed and approved by the owner. The source of truth is `plan/dizajn/mockup.html`: one self-contained page with the tokens, the class rules, the markup of all five screens and their behaviour. The wireframe pages in `.prodready/wireframes/` are the same mockup opened on one screen each, plus the loading, empty and error states (open with `?state=loading`, `?state=empty`, `?state=error`). Screenshots of the approved look are `plan/dizajn/ekran-*.png`.

Build by porting the mockup: same tokens, same class rules, same layout, same wording. Do not restyle.

## Look

A scouting dossier on paper. Page `--paper`, cards and charts on `--sheet`, text `--ink`, one data colour `--accent` with its ink, light, deep and track variants, grey `--context` for everything that is "the rest". IBM Plex Sans for text and figures, IBM Plex Mono for labels and numbers in tables.

Token rules (binding, from the UI contract):

1. Colour comes only from the named tokens; no raw hex values in components.
2. One data colour, the accent; grey marks context.
3. Text never uses the data colour.
4. Corner radius is 2 px; 4 px only on the data end of a bar.
5. No shadows and no gradients.
6. Charts are drawn on the sheet surface only.
7. Two font families: IBM Plex Sans and IBM Plex Mono, bundled with the app.
8. Tabular figures only where numbers align in a column.

## Frame

Top bar: the name FAIR SCOUT, four numbered sections (01 Blind pick, 02 Radar, 03 Time machine, 04 Evidence) with the active one marked, the Details switch and the budget chip. Footer: the source line, read from `meta.json`. The player card is not a section; while it is open, the section it was opened from stays marked, and a back link returns there.

Keyboard: 1 to 4 open the sections; the right and left arrows follow the demo order (blind pick, the model's pick once revealed, radar, time machine, evidence); R reveals on the blind pick and the time machine; D toggles details; Enter continues from the brief.

## Shared components (one file each in `app/src/components/`)

Sheet, ChoiceChips, RedactionBar, BigStatRow, Tag, RatingSteps, DotRow, FactTile, NumberPair, Meter, TierBadge, Flag, Button, DataTable, Tooltip, BarRanking, MonthColumns, DotScale, ValueOutlookPlot, ValueChart, PastRadarList, SegmentSwitch, DetailBlock, ScreenState.

Each is built once, by the first story that needs it, and imported everywhere else.

## Two levels of detail

Default view, for the room: a title, large figures, labels of at most a few words, no paragraphs; at most 160 words and numbers per screen (the radar table does not count). The Details switch adds the method: sample sizes, margins, definitions, extra charts. Its state holds for all screens and it is off at start.

## States

Every screen that shows data has loading (a skeleton in the layout of the screen, so nothing jumps), empty (a message and, where it helps, an action) and error ("The data could not be loaded.", the file name, a Try again button, no numbers).

## Accessibility

Everything works with the keyboard and focus is visible. Meaning is never carried by colour alone: tiers differ by letter, estimates by a hollow mark, made-it by a filled dot with a text alternative. Text is at least 14 px, labels at least 12 px. Covered names on the blind pick cannot be selected or read by a screen reader before the reveal. Charts have a text alternative. Desktop from 1280 px, light theme only.

## Charts

Hand-built SVG. Lines 2 px, markers at least 8 px, direct labels instead of legends where possible, values printed beside bars so the chart reads without hover. Hover and keyboard focus show the detail of a mark.

## References

- `plan/04-frontend-dizajn.md` — design principles, components, screens, text keys, things to avoid
- `plan/dizajn/make_wireframes.py` — the exact markup of the three extra states
