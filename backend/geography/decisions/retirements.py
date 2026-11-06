"""Exact physical retirement facts consumed by closure, never an inferred old epoch."""

from typing import Any
from uuid import UUID

from geography.models import Quadrant
from ovitraps.lifecycle.selectors import retirement_rows
from ovitraps.models import Ovitrap
from reviews.effect_receipts import effective_effects


def closure_physical(quadrant: Quadrant) -> tuple[list[Ovitrap], list[dict[str, str]]]:
    identities = list(
        Ovitrap.objects.filter(
            organization=quadrant.organization,
            sampling_point__block__quadrant=quadrant,
            event__voided_at__isnull=True,
        )
    )
    lineage, removals = retirement_rows(quadrant.organization)
    replacements = list(effective_effects(lineage.filter(old_trap__in=identities), "event"))
    removed = list(effective_effects(removals.filter(ovitrap__in=identities), "event"))
    proof = [
        {
            "kind": kind,
            "record_id": str(row.pk),
            "event_id": str(row.event_id),
            "physical_id": str(getattr(row, identity)),
        }
        for kind, rows, identity in (
            ("replacement", replacements, "old_trap_id"),
            ("removal", removed, "ovitrap_id"),
        )
        for row in rows
    ]
    retired = {row.old_trap_id for row in replacements} | {row.ovitrap_id for row in removed}
    active = [row for row in identities if row.pk not in retired]
    return active, sorted(proof, key=lambda row: (row["kind"], row["record_id"]))


def closure_dependency(snapshot: Any, source_id: UUID, revision: int) -> bool | None:  # noqa: ANN401 -- validate retained JSON, including unsupported legacy shapes
    """None means unavailable proof; a version1 empty list positively proves no dependency."""
    if (
        not isinstance(snapshot, dict)
        or type(snapshot.get("version")) is not int
        or snapshot["version"] != 1
        or type(snapshot.get("revision")) is not int
        or snapshot["revision"] != revision
        or snapshot.get("blockers") != []
    ):
        return None
    rows = snapshot.get("retirements")
    if not isinstance(rows, list) or any(not _retirement(row) for row in rows):
        return None
    return any(row["event_id"] == str(source_id) for row in rows)


def _retirement(row: Any) -> bool:  # noqa: ANN401 -- validate one retained JSON fact
    if (
        not isinstance(row, dict)
        or set(row) != {"kind", "record_id", "event_id", "physical_id"}
        or row["kind"] not in ("replacement", "removal")
    ):
        return False
    try:
        return all(
            str(UUID(row[key])) == row[key] for key in ("record_id", "event_id", "physical_id")
        )
    except (ValueError, TypeError, AttributeError):
        return False
