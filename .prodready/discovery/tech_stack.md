# Technical requirements

## Context

Two parts joined only by files: a Python pipeline that runs on a developer machine, and a static web app. No server, no database, no sign-in. The demo must run with the network off.

## Repository layout

```
pipeline/            Python package `fairscout`, its tests and pyproject.toml
contract/            JSON Schemas of the five app data files, with samples
app/                 Vite + React + TypeScript app
app/public/data/     the five JSON files the app reads (written by the pipeline, in version control)
scripts/             static server and health check
data/raw/            the nine source tables (not in version control)
data/work/           intermediate tables (not in version control)
plan/                planning documents (Bosnian), mockup, prototype scripts
.prodready/          wireframes and these notes
```

## Pipeline

- Python 3.12, pandas, numpy, scikit-learn, jsonschema. Dev tools: pytest, ruff, mypy.
- Environment: `uv venv .venv --python 3.12` in the checkout root, then `uv pip install -p .venv --require-hashes -r pipeline/requirements.lock` (exact versions and hashes) and `uv pip install -p .venv --no-deps -e pipeline` (the package itself). The lock file is made with `uv pip compile pipeline/pyproject.toml --extra dev --generate-hashes -o pipeline/requirements.lock`.
- Run as `.venv/bin/python -m fairscout <step>`; steps include `ingest`, `all`, `notes`.
- Data folder: `data/` in the checkout root. In a story worktree `data` is a link to the main checkout's folder. The environment variable `FAIRSCOUT_DATA` overrides the location.
- Logistic regression on standardised features is the product model; gradient boosting with shallow trees is reported beside it. Fixed seeds; the same input gives the same output.
- One scoring function takes the decision season. It serves today's radar (2025/26) and the past radars of the time machine.
- Export: the fifteen quality checks run first; files are written to a temporary folder and moved only when every check passed.

## App

- Vite, React, TypeScript in strict mode, React Router with hash addresses (`#/blind`), so the static build runs from any host or folder; `base: './'`.
- No UI kit, no CSS framework, no chart library, no icon set. Components and charts are built by hand with plain CSS and SVG from the mockup.
- Fonts IBM Plex Sans and IBM Plex Mono are bundled; the app makes no request to another host.
- Tests: Vitest with Testing Library; Playwright (installed Chrome) for the demo walkthrough in the last sprint.
- All interface text lives in `app/src/lib/text.en.ts`.

## Commands (what verify runs)

| Step | Pipeline | App |
|---|---|---|
| Typecheck | `.venv/bin/mypy pipeline/fairscout` | `npm --prefix app run typecheck` |
| Lint | `.venv/bin/ruff check pipeline` | `npm --prefix app run lint` |
| Build | `.venv/bin/python -m compileall -q pipeline/fairscout` (Python has no build step) | `npm --prefix app run build` |
| Tests | `.venv/bin/pytest pipeline/tests -q` | `npm --prefix app run test` |

A part that does not exist yet is not checked. From story S-008 on, `make verify` runs all of the above. Tests that need `data/raw` skip themselves when it is absent and run when it is present.

## Git

- One branch per sprint (`sprint/SP-0`), one branch per story (`story/S-001`) cut from the sprint branch.
- One commit per story, message starting with the story id, for example `S-001: Download and check the source tables`.
- Nothing is pushed per story. The sprint branch is merged and pushed once, when the sprint completes.
- Never commit `data/`, `.venv`, `node_modules`, keys or `.env` files.

## Integrations

- The dataset download, once, without a key.
- A language model for scout notes (decision D-010): the pipeline calls the Claude command-line program installed on the team's machine, which needs no API key. The program runs locally but the model answers from its provider's servers, so writing notes needs a network connection; the demo does not, because notes are stored in the data files. Without the program every note is a template sentence.

## Quality targets

First screen in under 2 seconds; filtering in under 100 milliseconds; zero network requests after load; the five data files under 2 MB together; latest Chrome on a laptop from 1280 px wide.

## References

- `plan/02-softverski-zahtjevi.md` chapters 2 and 6
- `plan/prototip/` — prototype scripts whose logic the pipeline ports; `proto.py` and `extra.py` hold an inflated evaluation and are not to be ported
