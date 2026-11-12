"""The results block of README.md must equal what the data files give."""

import importlib.util
import json
import re
import shutil
from pathlib import Path
from types import ModuleType

ROOT = Path(__file__).resolve().parents[2]


def _load() -> ModuleType:
    path = ROOT / "scripts" / "readme_numbers.py"
    spec = importlib.util.spec_from_file_location("readme_numbers", path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _copy_repo(target: Path) -> Path:
    shutil.copy(ROOT / "README.md", target / "README.md")
    data = target / "app" / "public" / "data"
    data.mkdir(parents=True)
    for name in ("evidence.json", "meta.json"):
        shutil.copy(ROOT / "app" / "public" / "data" / name, data / name)
    return target


def test_committed_block_matches_committed_data() -> None:
    module = _load()
    assert module.run(ROOT, check=True) == 0


def test_changed_number_fails_the_check(tmp_path: Path) -> None:
    module = _load()
    root = _copy_repo(tmp_path)
    path = root / "app" / "public" / "data" / "evidence.json"
    evidence = json.loads(path.read_text(encoding="utf-8"))
    evidence["backtest"]["budgets"][0]["rows"][0]["hits"] += 1
    path.write_text(json.dumps(evidence), encoding="utf-8")
    assert module.run(root, check=True) == 1


def test_missing_markers_give_a_clear_error(tmp_path: Path, capsys: object) -> None:
    module = _load()
    root = _copy_repo(tmp_path)
    (root / "README.md").write_text("# No markers here\n", encoding="utf-8")
    assert module.run(root, check=False) == 2
    assert "marker" in capsys.readouterr().out  # type: ignore[attr-defined]


def test_missing_key_gives_one_clear_line(tmp_path: Path, capsys: object) -> None:
    module = _load()
    root = _copy_repo(tmp_path)
    path = root / "app" / "public" / "data" / "evidence.json"
    evidence = json.loads(path.read_text(encoding="utf-8"))
    del evidence["backtest"]["by_season"]
    path.write_text(json.dumps(evidence), encoding="utf-8")
    before = (root / "README.md").read_text(encoding="utf-8")
    assert module.run(root, check=False) == 2
    assert "unexpected shape" in capsys.readouterr().out  # type: ignore[attr-defined]
    assert (root / "README.md").read_text(encoding="utf-8") == before


def test_wrong_shape_gives_one_clear_line(tmp_path: Path, capsys: object) -> None:
    module = _load()
    root = _copy_repo(tmp_path)
    path = root / "app" / "public" / "data" / "evidence.json"
    evidence = json.loads(path.read_text(encoding="utf-8"))
    evidence["backtest"]["test_seasons"] = []
    path.write_text(json.dumps(evidence), encoding="utf-8")
    assert module.run(root, check=True) == 2
    assert "unexpected shape" in capsys.readouterr().out  # type: ignore[attr-defined]


def test_invalid_json_gives_one_clear_line(tmp_path: Path, capsys: object) -> None:
    module = _load()
    root = _copy_repo(tmp_path)
    (root / "app" / "public" / "data" / "meta.json").write_text("{not json", encoding="utf-8")
    assert module.run(root, check=True) == 2
    assert "cannot do it" in capsys.readouterr().out  # type: ignore[attr-defined]


def test_missing_data_file_gives_one_clear_line(tmp_path: Path, capsys: object) -> None:
    module = _load()
    root = _copy_repo(tmp_path)
    (root / "app" / "public" / "data" / "meta.json").unlink()
    assert module.run(root, check=True) == 2
    assert "cannot do it" in capsys.readouterr().out  # type: ignore[attr-defined]


def test_rewrite_is_idempotent(tmp_path: Path) -> None:
    module = _load()
    root = _copy_repo(tmp_path)
    text = (root / "README.md").read_text(encoding="utf-8")
    block = module.build_block(root)
    (root / "README.md").write_text(module.fill(text, block + "\nstale"), encoding="utf-8")
    assert module.run(root, check=False) == 0
    first = (root / "README.md").read_text(encoding="utf-8")
    assert first == text
    assert module.run(root, check=False) == 0
    assert (root / "README.md").read_text(encoding="utf-8") == first


def test_no_percentage_typed_outside_the_block() -> None:
    module = _load()
    text = (ROOT / "README.md").read_text(encoding="utf-8")
    outside = text.split(module.START)[0] + text.split(module.END)[1]
    assert re.search(r"\d\s*%|%\s*\d", outside) is None


def test_every_environment_setting_of_the_code_is_named() -> None:
    text = (ROOT / "README.md").read_text(encoding="utf-8")
    names: set[str] = set()
    for path in (ROOT / "pipeline" / "fairscout").glob("*.py"):
        names.update(re.findall(r'"(FAIRSCOUT_[A-Z_]+)"', path.read_text(encoding="utf-8")))
    assert names, "the code reads no FAIRSCOUT_ setting"
    assert sorted(name for name in names if f"`{name}" not in text) == []


def test_every_make_target_is_named() -> None:
    text = (ROOT / "README.md").read_text(encoding="utf-8")
    makefile = (ROOT / "Makefile").read_text(encoding="utf-8")
    targets = re.findall(r"^([A-Za-z0-9][A-Za-z0-9_-]*):(?!=)", makefile, flags=re.MULTILINE)
    assert targets, "the Makefile has no target"
    assert [target for target in targets if f"`make {target}`" not in text] == []

