"""Fill the results block of README.md from the data files, or check that it is current.

Without an option the block between the two marker lines is rewritten in place.
With --check nothing is changed and the exit code is 1 when the block differs.
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
START = "<!-- results:start (filled by scripts/readme_numbers.py, do not edit by hand) -->"
END = "<!-- results:end -->"
BUDGETS = (1_000_000, 500_000)


class ReadmeError(Exception):
    """The README cannot be read or has no usable marker lines."""


def _pct(value: float) -> str:
    return f"{value * 100:.1f}%"


def build_block(root: Path) -> str:
    """Return the lines between the markers, built only from evidence.json and meta.json."""
    data = root / "app" / "public" / "data"
    evidence = json.loads((data / "evidence.json").read_text(encoding="utf-8"))
    meta = json.loads((data / "meta.json").read_text(encoding="utf-8"))
    backtest = evidence["backtest"]
    seasons = backtest["test_seasons"]
    share = round(backtest["pick_share"] * 100)
    lines = [
        f"- Source last date: {meta['source_last_date']}.",
        f"- Test seasons: {seasons[0]} to {seasons[-1]} ({len(seasons)} seasons).",
    ]
    by_budget = {b["budget_eur"]: b for b in backtest["budgets"]}
    for budget in BUDGETS:
        item = by_budget[budget]
        lines += [
            "",
            (
                f"Budget {budget:,} EUR: pool of {item['players']:,} players, "
                f"{_pct(item['base_rate'])} of them made it. "
                f"Margin of error: {item['margin_pp']:.1f} percentage points. "
                f"Top {share}% means {item['picks_per_rule']} picks per rule."
            ),
            "",
            "| Rule | Hits | Picks | Rate |",
            "|---|---|---|---|",
        ]
        lines += [
            f"| {r['label']} | {r['hits']} | {r['picks']} | {_pct(r['rate'])} |"
            for r in item["rows"]
        ]
    lines += [
        "",
        f"Product model, top {share}% at {BUDGETS[0]:,} EUR, season by season:",
        "",
        "| Season | Hits | Picks |",
        "|---|---|---|",
    ]
    lines += [f"| {s['season']} | {s['hits']} | {s['picks']} |" for s in backtest["by_season"]]
    return "\n".join(lines)


def fill(text: str, block: str) -> str:
    """Return the README text with the block between the markers replaced."""
    if text.count(START) != 1 or text.count(END) != 1 or text.index(START) > text.index(END):
        raise ReadmeError(f"README.md needs exactly one start marker and one end marker: {START}")
    head, rest = text.split(START, 1)
    tail = rest.split(END, 1)[1]
    return f"{head}{START}\n{block}\n{END}{tail}"


def run(root: Path, *, check: bool) -> int:
    """Rewrite or check the README under root. Return the exit code."""
    readme = root / "README.md"
    try:
        text = readme.read_text(encoding="utf-8")
        new = fill(text, build_block(root))
    except (OSError, ValueError, ReadmeError) as error:
        print(f"readme_numbers: cannot do it: {error}")
        return 2
    except (KeyError, IndexError, TypeError) as error:
        print(f"readme_numbers: a data file has an unexpected shape: {error!r}")
        return 2
    if check:
        if new == text:
            print("readme_numbers: the results block matches the data files")
            return 0
        print("readme_numbers: the results block differs from the data files, run make readme")
        return 1
    if new != text:
        readme.write_text(new, encoding="utf-8")
    print("readme_numbers: the results block is written" if new != text else
          "readme_numbers: the results block was already current")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="change nothing, fail on a difference")
    return run(ROOT, check=parser.parse_args().check)


if __name__ == "__main__":
    sys.exit(main())
