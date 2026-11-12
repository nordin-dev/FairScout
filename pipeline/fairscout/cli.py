"""Command entry of the pipeline: `python -m fairscout <step>`."""

import argparse
import sys
from collections.abc import Callable, Sequence
from pathlib import Path

from fairscout import (
    backtest,
    config,
    export,
    ingest,
    leagues,
    model,
    notes,
    rating,
    rebuild,
    seasons,
    tiers,
    timemachine,
    values,
)
from fairscout.errors import StepError

type Step = Callable[[argparse.Namespace], None]


def announce_download(table: str) -> None:
    """Say on stderr that the download of a table starts, so a long wait is not taken for a hang."""
    print(f"downloading {table} ...", file=sys.stderr, flush=True)


def run_ingest(options: argparse.Namespace) -> None:
    """Run the step `ingest`: a progress line before each download, then one line per table."""
    for report in ingest.ingest_tables(
        config.raw_dir(), force=options.force, announce=announce_download
    ):
        origin = "downloaded" if report.downloaded else "already present"
        print(f"{report.table}: {report.rows} rows ({origin})", flush=True)


def run_seasons(options: argparse.Namespace) -> None:
    """Run the step `seasons` and print three counts: the rows written and the two left out."""
    built = seasons.write_seasons(config.raw_dir(), config.work_dir())
    print(f"{seasons.SEASONS_FILE}: {len(built.table)} rows", flush=True)
    print(
        f"left out, competition outside the 14 first tiers: {built.outside_leagues} appearances",
        flush=True,
    )
    print(f"left out, no match record: {built.without_match} appearances", flush=True)


def run_rebuild(options: argparse.Namespace) -> None:
    """Run the step `rebuild` and print the rows written and the matches skipped."""
    built = rebuild.write_short_seasons(config.raw_dir(), config.work_dir())
    print(f"{rebuild.SEASONS_FILE}: {len(built.table)} rows", flush=True)
    print(f"skipped, match without line-ups: {built.skipped_no_lineups} matches", flush=True)


def run_values(options: argparse.Namespace) -> None:
    """Run the step `values` and print the rows written, the rows left out and the outcomes."""
    built = values.write_values(config.raw_dir(), config.work_dir())
    table = built.table
    known = int(table["outcome_known"].sum())
    empty = int(table["value_outcome"].isna().sum())
    print(f"{values.SEASONS_FILE}: {len(table)} rows", flush=True)
    print(f"left out, no decision value: {built.excluded} player-seasons", flush=True)
    print(f"outcome known: {known} rows", flush=True)
    print(f"outcome empty: {empty} rows", flush=True)
    print(f"made it: {int(table['made_it'].sum())} rows", flush=True)
    print(f"latest valuation in the source: {built.latest_valuation:%Y-%m-%d}", flush=True)
    last_known = table.loc[table["outcome_known"], "season"].max()
    print(f"latest season with a known outcome: {last_known}", flush=True)


def run_leagues(options: argparse.Namespace) -> None:
    """Run the step `leagues`: one line per league and the two counts of moves."""
    built = leagues.write_leagues(config.raw_dir(), config.work_dir())
    for row in built.table.itertuples(index=False):
        print(f"{row.league_name}: {row.factor:.4f} ({row.factor_source})", flush=True)
    print(f"moves found: {built.moves_total}", flush=True)
    print(f"moves used for factors: {built.moves_used}", flush=True)


def run_rating(options: argparse.Namespace) -> None:
    """Run the step `rating` and print the counts that show what the table holds."""
    for line in rating.write_rating(config.raw_dir(), config.work_dir()).report:
        print(line, flush=True)


def run_model(options: argparse.Namespace) -> None:
    """Run the step `model` and print the training set, the pool and the line-up shares."""
    for line in model.write_model(config.raw_dir(), config.work_dir()).report:
        print(line, flush=True)


def run_backtest(options: argparse.Namespace) -> None:
    """Run the step `backtest` and print the report of the six test seasons."""
    for line in backtest.write_backtest(config.work_dir()).report:
        print(line, flush=True)


def run_tiers(options: argparse.Namespace) -> None:
    """Run the step `tiers` and print the tier counts, the past statistics and the flags."""
    for line in tiers.write_tiers(config.raw_dir(), config.work_dir()).report:
        print(line, flush=True)


def run_timemachine(options: argparse.Namespace) -> None:
    """Run the step `timemachine` and print one line for each of the six test seasons."""
    built = timemachine.write_timemachine(config.raw_dir(), config.work_dir())
    for line in built.report:
        print(line, flush=True)


def run_notes(options: argparse.Namespace) -> None:
    """Run the step `notes`: write one note per pool player and print the counts per reason."""
    src = export.read_sources(config.raw_dir(), config.work_dir(), with_notes=False)
    records, _, _ = export.build_players(src)
    for line in notes.write_notes(records, src.tier_stats, config.work_dir()).report():
        print(line, flush=True)


def out_dir_of(options: argparse.Namespace) -> Path:
    """Return the folder to write the data files to: the `--out` option or the app's folder."""
    chosen: Path | None = options.out
    return chosen if chosen is not None else export.default_out_dir()


def run_export(options: argparse.Namespace) -> None:
    """Run the step `export`: assemble, check and write the five files, then print the report."""
    run = export.run_export(config.raw_dir(), config.work_dir(), out_dir_of(options))
    for line in run.report():
        print(line, flush=True)


def pipeline_steps() -> list[tuple[str, Step]]:
    """Return every step of the `all` command in the order they run."""
    return [
        ("ingest", run_ingest),
        ("seasons", run_seasons),
        ("rebuild", run_rebuild),
        ("values", run_values),
        ("leagues", run_leagues),
        ("rating", run_rating),
        ("model", run_model),
        ("backtest", run_backtest),
        ("tiers", run_tiers),
        ("timemachine", run_timemachine),
        ("notes", run_notes),
        ("export", run_export),
    ]


def run_all(options: argparse.Namespace) -> None:
    """Run every step in order, without downloading again, and print the pool size at the end."""
    options.force = False
    for name, step in pipeline_steps():
        print(f"== {name}", file=sys.stderr, flush=True)
        step(options)
    print(f"pool size: {export.last_pool_size(out_dir_of(options))}", flush=True)


def build_parser() -> argparse.ArgumentParser:
    """Describe the command line: one sub-command per pipeline step."""
    parser = argparse.ArgumentParser(
        prog="python -m fairscout", description="Fair Scout data preparation."
    )
    steps = parser.add_subparsers(dest="step", metavar="step", required=True)
    ingest_step = steps.add_parser(
        "ingest",
        help="download the nine source tables and check them",
        description="Download the nine source tables into the raw data folder and check them.",
    )
    ingest_step.add_argument(
        "--force",
        action="store_true",
        help="download every table again, also when it is already present",
    )
    ingest_step.set_defaults(run=run_ingest)
    seasons_step = steps.add_parser(
        "seasons",
        help="build the season table of the 14 long-history leagues",
        description=(
            "Build one row per player, season and league from the appearances in the 14 "
            "long-history leagues and write it into the work data folder."
        ),
    )
    seasons_step.set_defaults(run=run_seasons)
    rebuild_step = steps.add_parser(
        "rebuild",
        help="rebuild the season table of the nine short-history leagues",
        description=(
            "Rebuild minutes, goals and assists of the nine short-history leagues from "
            "line-ups and match events and write the season table into the work data folder."
        ),
    )
    rebuild_step.set_defaults(run=run_rebuild)
    values_step = steps.add_parser(
        "values",
        help="attach the decision value and the value three seasons later",
        description=(
            "Attach to every player-season the value at its end and three seasons later, "
            "and the made-it mark, and write the season table into the work data folder."
        ),
    )
    values_step.set_defaults(run=run_values)
    leagues_step = steps.add_parser(
        "leagues",
        help="compute the league strength factors",
        description=(
            "Compute one factor per league from players who moved between the 14 long-history "
            "leagues, estimate the nine short-history leagues, and write the factor table and "
            "its evidence into the work data folder."
        ),
    )
    leagues_step.set_defaults(run=run_leagues)
    rating_step = steps.add_parser(
        "rating",
        help="rate players against peers of the same age and position",
        description=(
            "Compute adjusted output, goal involvement and role for every player-season and "
            "five percentiles for the young players of the radar season, and write the rated "
            "table into the work data folder."
        ),
    )
    rating_step.set_defaults(run=run_rating)
    model_step = steps.add_parser(
        "model",
        help="train the outlook model and score the radar pool",
        description=(
            "Build the 19 features of every young player-season, train the logistic "
            "regression and the gradient boosting on the seasons whose outcome is known, "
            "and write the feature table, the scores of the radar pool and the model facts "
            "into the work data folder."
        ),
    )
    model_step.set_defaults(run=run_model)
    backtest_step = steps.add_parser(
        "backtest",
        help="test the model on past seasons against simple rules",
        description=(
            "Score the six test seasons 2017/18 to 2022/23 with the model, trained only on "
            "seasons at least three earlier, compare it with four simple rules and write the "
            "report and the scored pools into the work data folder."
        ),
    )
    backtest_step.set_defaults(run=run_backtest)
    tiers_step = steps.add_parser(
        "tiers",
        help="assign tiers, reasons and caution flags to the radar pool",
        description=(
            "Cut today's pool into tiers A, B and C, attach the hit rates and value multiples "
            "of the same tiers in the six test seasons, give every player plain reasons and "
            "five caution flags, and write the table and the statistics into the work folder."
        ),
    )
    tiers_step.set_defaults(run=run_tiers)
    timemachine_step = steps.add_parser(
        "timemachine",
        help="produce the lists of past seasons for the time machine",
        description=(
            "Score the six test seasons with the scoring function of today's radar, check the "
            "lists and write the lists of the four latest seasons into the work data folder."
        ),
    )
    timemachine_step.set_defaults(run=run_timemachine)
    notes_step = steps.add_parser(
        "notes",
        help="write a short scout note for every pool player",
        description=(
            "Write a note of at most two sentences for every pool player with the Claude "
            "command-line program on this machine, check its numbers and length, replace "
            "any failed note by a template sentence and write notes.json into the work "
            "folder. FAIRSCOUT_NOTES=template never starts the program."
        ),
    )
    notes_step.set_defaults(run=run_notes)
    out_help = "folder for the five data files (default: app/public/data in the checkout)"
    export_step = steps.add_parser(
        "export",
        help="check the data and write the five app data files",
        description=(
            "Assemble players, leagues, evidence, time machine and meta, run the fifteen "
            "quality checks and write the files only when every check and schema passed."
        ),
    )
    export_step.add_argument("--out", type=Path, default=None, help=out_help)
    export_step.set_defaults(run=run_export)
    all_step = steps.add_parser(
        "all",
        help="run every step, from the source tables to the five files",
        description=(
            "Run ingest (without downloading present tables), seasons, rebuild, values, "
            "leagues, rating, model, backtest, tiers, timemachine, notes and export in order."
        ),
    )
    all_step.add_argument("--out", type=Path, default=None, help=out_help)
    all_step.set_defaults(run=run_all)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the chosen step. Return 0 when it finished and 1 when it stopped on an error."""
    options = build_parser().parse_args(argv)
    step: Step = options.run
    try:
        step(options)
    except StepError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0
