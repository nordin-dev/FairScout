.PHONY: setup typecheck lint build test verify data dev preview health demo demo-check demo-record readme tennis-data basketball-data

# Can be run again at any time: an environment from an earlier run is replaced.
setup:
	rm -rf .venv
	uv venv .venv --python 3.12
	uv pip install -p .venv --require-hashes -r pipeline/requirements.lock
	uv pip install -p .venv --no-deps -e pipeline
	npm --prefix app ci

typecheck:
	@echo "typecheck: pipeline (mypy)"
	@.venv/bin/mypy pipeline/fairscout
	@echo "typecheck: app (tsc)"
	@npm --prefix app run typecheck --silent

lint:
	@echo "lint: pipeline (ruff)"
	@.venv/bin/ruff check pipeline
	@echo "lint: app (eslint)"
	@npm --prefix app run lint --silent

build:
	@echo "build: pipeline (compileall)"
	@.venv/bin/python -m compileall -q pipeline/fairscout
	@echo "build: app (vite)"
	@npm --prefix app run build --silent

test:
	@echo "test: pipeline (pytest)"
	@.venv/bin/pytest pipeline/tests -q
	@echo "test: app (vitest)"
	@npm --prefix app run test --silent
	@echo "test: health check (node --test)"
	@node --test scripts/*.test.mjs

verify:
	@$(MAKE) --no-print-directory typecheck
	@$(MAKE) --no-print-directory lint
	@$(MAKE) --no-print-directory build
	@$(MAKE) --no-print-directory test
	@echo "verify: all steps passed"

data:
	.venv/bin/python -m fairscout all

dev:
	npm --prefix app run dev

preview:
	npm --prefix app run preview

health:
	npm --prefix app run build
	node scripts/healthcheck.mjs

# The built app, served as static files for the demo (run `make build` first).
demo:
	node scripts/serve.mjs

# The demo walkthrough in a real browser (mouse and keyboard, deep link, network off), three times in a row, on the production build.
demo-check:
	npm --prefix app run e2e -- --project=chromium-1440 --repeat-each=3

# One slow walkthrough filmed with Chrome's screencast; the video lands in demo/walkthrough.webm (not under version control).
demo-record:
	npm --prefix app run e2e -- --project=record

readme:
	python3 scripts/readme_numbers.py

# Rebuilds the tennis data file of the app from the open ATP tables (downloads the ones that are missing).
tennis-data:
	.venv/bin/python scripts/tennis_data.py

# Rebuilds the basketball data file of the app from the public EuroLeague and EuroCup statistics (downloads the seasons that are missing).
basketball-data:
	.venv/bin/python scripts/basketball_data.py
