"""Find similar players: the three nearest players of the same position group.

Pure functions, no tables are read. Inside a position group each numeric part of the profile
(adjusted goals per 90, adjusted assists per 90, role, age, height) is standardised to mean 0
and deviation 1, foot is a mark (same 0, different 1, unknown on either side 0.5), and the
distance is weighted Euclidean. The similarity shown is 100 times one minus the distance divided
by the 95th percentile of all pair distances of the group, not below 0: a display scale, not a
probability.
"""

from collections.abc import Callable, Mapping
from typing import Any, Final

import numpy as np
import numpy.typing as npt
import pandas as pd

from fairscout.errors import StepError

MAX_SIMILAR: Final = 3
MIN_GROUP: Final = 4
PERCENTILE: Final = 95
PERCENT: Final = 100
TIE_DECIMALS: Final = 9
NUMERIC_WEIGHT: Final = 1.0
FOOT_WEIGHT: Final = 0.5
UNKNOWN_FOOT: Final = 0.5
MIN_HEIGHT_CM: Final = 140
MAX_HEIGHT_CM: Final = 215
NUMERIC_PARTS: Final[tuple[str, ...]] = ("g90_adj", "a90_adj", "role", "age", "height_in_cm")
PARTS: Final[tuple[str, ...]] = (*NUMERIC_PARTS, "foot")
WEIGHTS: Final[tuple[float, ...]] = (*([NUMERIC_WEIGHT] * len(NUMERIC_PARTS)), FOOT_WEIGHT)
FOOT_PART: Final = len(NUMERIC_PARTS)
SIMILAR_OVERALL: Final = "similar overall"
REQUIRED: Final[tuple[str, ...]] = ("player_id", "position_group", "foot", *NUMERIC_PARTS)

type Floats = npt.NDArray[np.float64]


def number_text(value: float, decimals: int) -> str:
    """Write a size with a fixed number of decimals."""
    return f"{abs(value):.{decimals}f}"


# For each numeric part: the words for a higher and a lower value of the other player.
TEMPLATES: Final[dict[str, tuple[Callable[[float], str], Callable[[float], str]]]] = {
    "g90_adj": (
        lambda v: f"{number_text(v, 2)} more goals per 90",
        lambda v: f"{number_text(v, 2)} fewer goals per 90",
    ),
    "a90_adj": (
        lambda v: f"{number_text(v, 2)} more assists per 90",
        lambda v: f"{number_text(v, 2)} fewer assists per 90",
    ),
    "role": (lambda v: "larger role in his team", lambda v: "smaller role in his team"),
    "age": (
        lambda v: f"older by {number_text(v, 1)} years",
        lambda v: f"younger by {number_text(v, 1)} years",
    ),
    "height_in_cm": (
        lambda v: f"taller by {number_text(v, 0)} cm",
        lambda v: f"shorter by {number_text(v, 0)} cm",
    ),
}


def standardise(values: Floats) -> Floats:
    """Mean 0 and deviation 1; a part with no spread, or nothing known, counts as 0."""
    known = values[~np.isnan(values)]
    if known.size == 0:
        return np.zeros_like(values)
    spread = float(known.std())
    if spread == 0.0:
        return np.zeros_like(values)
    return np.nan_to_num((values - float(known.mean())) / spread, nan=0.0)


def plausible_height(value: object) -> float | None:
    """A height in centimetres when it is a number inside the bounds, else None: not known."""
    number = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.isna(number) or not MIN_HEIGHT_CM <= float(number) <= MAX_HEIGHT_CM:
        return None
    return float(number)


def known_values(group: pd.DataFrame, part: str) -> Floats:
    """The values of one numeric part, NaN where not known (a height outside the bounds too)."""
    values: Floats = pd.to_numeric(group[part], errors="coerce").to_numpy(dtype="float64")
    if part == "height_in_cm":
        values = np.where((values < MIN_HEIGHT_CM) | (values > MAX_HEIGHT_CM), np.nan, values)
    return values


def numeric_column(group: pd.DataFrame, part: str) -> Floats:
    """The raw values of one numeric part; a missing height takes the group's median."""
    values = known_values(group, part)
    if part == "height_in_cm" and not np.isnan(values).all():
        values = np.where(np.isnan(values), np.nanmedian(values), values)
    return values


def foot_marks(feet: list[str | None]) -> Floats:
    """Pair matrix of the foot mark: same 0, different 1, unknown on either side 0.5."""
    known = np.array([f is not None for f in feet])
    codes = np.array([f or "" for f in feet])
    marks: Floats = (codes[:, None] != codes[None, :]).astype("float64")
    unknown = ~(known[:, None] & known[None, :])
    marks[unknown] = UNKNOWN_FOOT
    return marks


def foot_of(value: object) -> str | None:
    """The foot as text, or None when it is not known."""
    if value is None or (isinstance(value, float) and np.isnan(value)) or value is pd.NA:
        return None
    text = str(value).strip().lower()
    return text or None


def part_gaps(group: pd.DataFrame) -> tuple[Floats, Floats, npt.NDArray[np.bool_]]:
    """The weighted standardised gap of every pair for every part, the raw values and what is known.

    The first array has the shape parts x players x players; the others parts x players. The
    raw values hold the filled height, so `known` says which values are real.
    """
    raw = np.array([numeric_column(group, part) for part in NUMERIC_PARTS])
    known = np.array(
        [~np.isnan(known_values(group, part)) for part in NUMERIC_PARTS]
        + [np.array([foot_of(v) is not None for v in group["foot"]])]
    )
    standard = np.array([standardise(row) for row in raw])
    gaps = [WEIGHTS[i] * np.abs(row[:, None] - row[None, :]) for i, row in enumerate(standard)]
    gaps.append(WEIGHTS[FOOT_PART] * foot_marks([foot_of(v) for v in group["foot"]]))
    return np.array(gaps), raw, known


def distances(gaps: Floats) -> Floats:
    """Weighted Euclidean distance of every pair; the gaps already carry the weights."""
    squared: Floats = np.sqrt((gaps**2).sum(axis=0))
    return squared


def similarity_of(distance: float, scale: float) -> int:
    """100 times one minus the distance over the scale, whole, from 0 to 100."""
    if scale <= 0.0:
        return PERCENT if distance <= 0.0 else 0
    return round(max(0.0, PERCENT * (1 - distance / scale)))


def sentence(gaps: Floats, raw: Floats, known: npt.NDArray[np.bool_], me: int, other: int) -> str:
    """The sentence for the largest gap among the parts known for both players."""
    both = known[:, me] & known[:, other]
    shown = np.where(both, gaps[:, me, other], 0.0)
    part = int(np.argmax(shown))
    if shown[part] <= 0.0:
        return SIMILAR_OVERALL
    if part == FOOT_PART:
        return "other foot"
    higher, lower = TEMPLATES[NUMERIC_PARTS[part]]
    difference = float(raw[part][other] - raw[part][me])
    return higher(difference) if difference >= 0 else lower(difference)


def group_lists(group: pd.DataFrame) -> dict[str, list[dict[str, Any]]]:
    """The lists of every player of one position group."""
    ids = [int(v) for v in group["player_id"]]
    count = len(ids)
    if count < MIN_GROUP:
        return {str(pid): [] for pid in ids}
    gaps, raw, known = part_gaps(group)
    dist = distances(gaps)
    scale = float(np.percentile(dist[np.triu_indices(count, k=1)], PERCENTILE))
    result: dict[str, list[dict[str, Any]]] = {}
    for me, pid in enumerate(ids):
        order = sorted(
            (o for o in range(count) if o != me),
            key=lambda o: (round(float(dist[me, o]), TIE_DECIMALS), ids[o]),
        )[:MAX_SIMILAR]
        result[str(pid)] = [
            {
                "id": str(ids[o]),
                "similarity": similarity_of(float(dist[me, o]), scale),
                "diff": sentence(gaps, raw, known, me, o),
            }
            for o in order
        ]
    return result


def find_similar(pool: pd.DataFrame) -> Mapping[str, list[dict[str, Any]]]:
    """For every player id of the pool table, up to three similar players of his group.

    The table has one row per player with `player_id`, `position_group`, `g90_adj`, `a90_adj`,
    `role`, `age`, `height_in_cm` and `foot`.
    """
    missing = [c for c in REQUIRED if c not in pool.columns]
    if missing:
        raise StepError(f"the player table lacks the columns {missing}")
    result: dict[str, list[dict[str, Any]]] = {}
    for _, group in pool.groupby("position_group", sort=True, dropna=False):
        result.update(group_lists(group.sort_values("player_id")))
    return result
