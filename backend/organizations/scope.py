"""Explicit scope algebra. No database lookups or implicit all grants."""

from dataclasses import dataclass
from typing import Literal, TypedDict
from uuid import UUID

ScopeMode = Literal["none", "selected", "all"]


class Dimension(TypedDict):
    mode: ScopeMode
    ids: list[str]


class WorkScope(TypedDict):
    centers: Dimension
    quadrants: Dimension


def normalize_scope(value: object) -> WorkScope:
    """Validate canonical UUIDs, both keys and explicit modes; reject ambiguous grants."""
    if not isinstance(value, dict) or set(value) != {"centers", "quadrants"}:
        raise ValueError("Use centers and quadrants with explicit modes and UUID ids.")
    return WorkScope(centers=_dimension(value["centers"]), quadrants=_dimension(value["quadrants"]))


def _dimension(value: object) -> Dimension:
    if not isinstance(value, dict) or set(value) != {"mode", "ids"}:
        raise ValueError("Each dimension requires mode and ids.")
    mode, ids = value["mode"], value["ids"]
    if mode not in ("none", "selected", "all") or not isinstance(ids, list):
        raise ValueError("Invalid scope mode or ids.")
    if mode != "selected" and ids:
        raise ValueError("Only selected scopes can carry ids.")
    try:
        normalized = sorted({str(UUID(item)) for item in ids if isinstance(item, str)})
    except (ValueError, AttributeError) as error:
        raise ValueError("Scope ids must be UUID strings.") from error
    if len(normalized) != len(ids):
        raise ValueError("Scope ids must be unique UUID strings.")
    return Dimension(mode=mode, ids=normalized)


def deny_scope() -> WorkScope:
    return WorkScope(
        centers=Dimension(mode="none", ids=[]), quadrants=Dimension(mode="none", ids=[])
    )


def safe_scope(value: object) -> WorkScope:
    """Malformed persisted configuration fails closed, including the legacy array shape."""
    try:
        return normalize_scope(value)
    except ValueError:
        return deny_scope()


def intersect(left: Dimension, right: Dimension) -> Dimension:
    if left["mode"] == "none" or right["mode"] == "none":
        return Dimension(mode="none", ids=[])
    if left["mode"] == "all":
        return right
    if right["mode"] == "all":
        return left
    return Dimension(mode="selected", ids=sorted(set(left["ids"]) & set(right["ids"])))


def contains(dimension: Dimension, identifier: str | None) -> bool:
    """No applicable dimension (None) requires only the action permission."""
    return (
        identifier is None
        or dimension["mode"] == "all"
        or (dimension["mode"] == "selected" and identifier in dimension["ids"])
    )


@dataclass(frozen=True)
class EffectiveScope:
    grants: tuple[tuple[frozenset[str], WorkScope], ...]

    @property
    def permissions(self) -> frozenset[str]:
        return frozenset(code for codes, _scope in self.grants for code in codes)

    def allows(
        self, permission: str, center: str | None = None, quadrant: str | None = None
    ) -> bool:  # noqa: PLR0913 -- action and its two independent dimensions
        """One profile must grant the action and both dimensions; never mix unrelated grants."""
        return any(
            permission in codes
            and contains(scope["centers"], center)
            and contains(scope["quadrants"], quadrant)
            for codes, scope in self.grants
        )
