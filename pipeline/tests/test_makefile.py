"""The setup target must work in a checkout that was set up before."""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_setup_removes_an_old_environment_before_it_creates_one() -> None:
    printed = subprocess.run(
        ["make", "-n", "setup"], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout.splitlines()
    commands = [line.strip() for line in printed]
    assert "rm -rf .venv" in commands, "the setup target does not remove an old environment"
    create = next(i for i, line in enumerate(commands) if line.startswith("uv venv .venv"))
    assert commands.index("rm -rf .venv") < create
