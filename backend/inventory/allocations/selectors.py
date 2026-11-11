"""Current full-vector visibility precedes every list count/order/page and source projection."""

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, cast
from uuid import UUID

from django.db.models import (
    Case,
    CharField,
    Exists,
    OuterRef,
    Prefetch,
    Q,
    QuerySet,
    Value,
    When,
)
from django.http import Http404

from inventory.allocations.models import (
    BagDisposition,
    InventoryIntentExecution,
    OriginReleaseLine,
    OriginReleaseProof,
    Reconciliation,
    ReconciliationVersion,
    ReleaseCancellation,
    SupplyAssignment,
    SupplyAssignmentLine,
    SupplyAssignmentVersion,
    SupplyDiscrepancyDecision,
    SupplyEvent,
    SupplyReceiptLine,
)
from inventory.allocations.permissions import (
    ALLOCATE,
    BAG_DISPOSE,
    RECEIVE_OWN,
    RECONCILE,
    RECONCILE_OWN,
    WRITE_OFF,
)
from inventory.allocations.scope import scoped_assignments
from inventory.allocations.services import assignment_data
from inventory.models import StockMovement
from lab.access import scoped_bags
from organizations.scope import EffectiveScope
from uploads.access import UploadActor, current_scope


def assignment_rows(actor: UploadActor, values: dict[str, Any]) -> QuerySet[SupplyAssignment]:
    allowed = Q(pk__in=[])
    scope = current_scope(actor)
    for permission in (ALLOCATE, RECONCILE, RECEIVE_OWN, RECONCILE_OWN):
        allowed |= Q(pk__in=scoped_assignments(actor, permission, scope).values("pk"))
    rows = SupplyAssignment.objects.filter(organization=actor.organization).filter(allowed)
    if values.get("status") is not None:
        rows = _with_status(rows).filter(_status=values["status"])
    facets = {
        "date": "date",
        "courier": "courier_id",
        "center": "origin__center_id",
        "assignment": "pk",
        "created_at_from": "created_at__gte",
        "created_at_before": "created_at__lt",
    }
    return projection_assignments(
        rows.filter(
            **{lookup: values[key] for key, lookup in facets.items() if key in values}
        ).order_by(values.get("ordering", "-created_at"), "id")
    )


def _with_status(rows: QuerySet[SupplyAssignment]) -> QuerySet[SupplyAssignment]:
    """planned / released / cancelled / received, the same rule as `assignment_lifecycle`."""
    releases = OriginReleaseProof.objects.filter(version__assignment_id=OuterRef("pk"))
    return rows.annotate(
        _has_release=Exists(releases),
        _active=Exists(releases.filter(cancellations__isnull=True)),
        _received=Exists(SupplyEvent.objects.filter(assignment_id=OuterRef("pk"), kind="receive")),
    ).annotate(
        _status=Case(
            When(_has_release=False, then=Value("planned")),
            When(_active=False, then=Value("cancelled")),
            When(_received=True, then=Value("received")),
            default=Value("released"),
            output_field=CharField(),
        )
    )


def reconciliation_rows(actor: UploadActor, values: dict[str, Any]) -> QuerySet[Reconciliation]:
    scope = current_scope(actor)
    allowed = scoped_assignments(actor, RECONCILE, scope).values("pk")
    own = scoped_assignments(actor, RECONCILE_OWN, scope).values("pk")
    rows = Reconciliation.objects.filter(organization=actor.organization).filter(
        Q(assignment_id__in=allowed) | Q(assignment_id__in=own)
    )
    facets = {
        "date": "assignment__date",
        "courier": "assignment__courier_id",
        "center": "assignment__origin__center_id",
        "assignment": "assignment_id",
        "created_at_from": "created_at__gte",
        "created_at_before": "created_at__lt",
    }
    return (
        rows.filter(**{lookup: values[key] for key, lookup in facets.items() if key in values})
        .order_by(values.get("ordering", "-created_at"), "id")
        .prefetch_related(
            Prefetch(
                "assignment",
                queryset=projection_assignments(
                    SupplyAssignment.objects.filter(organization=actor.organization)
                ),
            )
        )
    )


def projection_assignments(rows: QuerySet[SupplyAssignment]) -> QuerySet[SupplyAssignment]:
    """One bounded set of immutable rows per page/bundle, independent of assignment count."""
    release_rows = (
        OriginReleaseProof.objects.select_related("created_by")
        .order_by("pk")
        .prefetch_related(
            Prefetch("lines", queryset=OriginReleaseLine.objects.order_by("pk")),
            Prefetch(
                "cancellations",
                queryset=ReleaseCancellation.objects.select_related("created_by").order_by("pk"),
            ),
        )
    )
    versions = SupplyAssignmentVersion.objects.order_by("-revision").prefetch_related(
        Prefetch(
            "lines", queryset=SupplyAssignmentLine.objects.order_by("pk"), to_attr="_supply_lines"
        ),
        Prefetch("releases", queryset=release_rows, to_attr="_supply_release_proofs"),
    )
    receipts = (
        SupplyEvent.objects.filter(kind="receive", source_link__isnull=False)
        .select_related("receipt__signature", "source_link", "void_audit", "created_by")
        .order_by("revision")
        .prefetch_related(
            Prefetch("receipt__lines", queryset=SupplyReceiptLine.objects.order_by("pk"))
        )
    )
    frames = ReconciliationVersion.objects.order_by("-revision").prefetch_related(
        Prefetch("justifications", queryset=SupplyDiscrepancyDecision.objects.order_by("pk"))
    )
    return rows.select_related(
        "origin", "reconciliation", "reconciliation__discrepancy"
    ).prefetch_related(
        Prefetch("versions", queryset=versions, to_attr="_supply_plan_versions"),
        Prefetch("events", queryset=receipts, to_attr="_supply_receipt_events"),
        Prefetch("reconciliation__versions", queryset=frames, to_attr="_supply_frames"),
    )


def prepared_projection(assignment: SupplyAssignment) -> SupplyAssignment:
    if not hasattr(assignment, "_supply_plan_versions"):
        return projection_assignments(
            SupplyAssignment.objects.filter(
                organization_id=assignment.organization_id, pk=assignment.pk
            )
        ).get()
    return assignment


def assignment_projection(assignment: SupplyAssignment) -> dict[str, Any]:
    assignment = prepared_projection(assignment)
    versions = cast(list[SupplyAssignmentVersion], assignment._supply_plan_versions)  # type: ignore[attr-defined]
    if not versions:
        raise Http404
    version = versions[0]
    lines = cast(list[SupplyAssignmentLine], version._supply_lines)  # type: ignore[attr-defined]
    data = assignment_data(assignment, version, lines)
    data["lifecycle"] = assignment_lifecycle(assignment, version)
    return data


def _person(user: Any) -> str:  # noqa: ANN401 -- the immutable record's author
    name = f"{user.first_name} {user.last_name}".strip()
    return name or str(user.username)


def assignment_lifecycle(
    assignment: SupplyAssignment, version: SupplyAssignmentVersion
) -> dict[str, Any]:
    """Where this plan stands: planned, released (reserved for the courier), cancelled or received.

    Read-only facts of rows the projection already loads; a cancelled release means the same plan
    can be corrected and released again.
    """
    del version
    versions = cast(list[SupplyAssignmentVersion], assignment._supply_plan_versions)  # type: ignore[attr-defined]
    proofs = sorted(
        (
            proof
            for each in versions
            for proof in cast(list[OriginReleaseProof], getattr(each, "_supply_release_proofs", []))
        ),
        key=lambda proof: proof.created_at,
    )
    release = proofs[-1] if proofs else None
    cancellation = None
    if release is not None:
        cancelled = list(release.cancellations.all())
        cancellation = cancelled[-1] if cancelled else None
    received = bool(getattr(assignment, "_supply_receipt_events", []))
    status = "planned"
    if release is not None:
        status = "cancelled" if cancellation is not None else "received" if received else "released"
    from inventory.allocations.signature_mode import signature_facts

    receivers = [
        _person(event.created_by)
        for event in getattr(assignment, "_supply_receipt_events", [])
        if getattr(event, "created_by", None) is not None
    ]
    signature = (
        None
        if release is None or cancellation is not None
        else signature_facts(release.proof, receivers[-1] if receivers else None)
    )
    return {
        "status": status,
        "signature": signature,
        "release_id": None if release is None else str(release.pk),
        "released_at": None if release is None else release.created_at.isoformat(),
        "released_by_name": None if release is None else _person(release.created_by),
        "cancelled_at": None if cancellation is None else cancellation.created_at.isoformat(),
        "cancelled_by_name": None if cancellation is None else _person(cancellation.created_by),
        "cancel_reason_code": None if cancellation is None else cancellation.reason_code,
        "cancel_reason": None if cancellation is None else cancellation.reason,
    }


def reconciliation_projection(reconciliation: Reconciliation) -> dict[str, Any]:
    assignment = prepared_projection(reconciliation.assignment)
    reconciliation = assignment.reconciliation
    frames = cast(list[ReconciliationVersion], reconciliation._supply_frames)  # type: ignore[attr-defined]
    frame = frames[0] if frames else None
    discrepancy = getattr(reconciliation, "discrepancy", None)
    return {
        "id": str(reconciliation.pk),
        "assignment": assignment_projection(assignment),
        "revision": 0 if frame is None else frame.revision,
        "frame_id": None if frame is None else str(frame.pk),
        "frame": None if frame is None else frame.frame,
        "discrepancy_id": None if discrepancy is None else str(discrepancy.pk),
        "justification_ids": []
        if frame is None
        else [str(decision.pk) for decision in frame.justifications.all()],
    }


def write_off_rows(
    actor: UploadActor, values: dict[str, Any]
) -> QuerySet[InventoryIntentExecution]:
    from inventory.transfers.scope import paired_query
    from uploads.access import current_scope

    allowed = Q(pk__in=[])
    for codes, grant in current_scope(actor).grants:
        if WRITE_OFF in codes:
            allowed |= Q(intent__kind="lot_write_off") & paired_query(
                grant, "intent__location__center_id", "intent__location__quadrant_id"
            )
    bag_ids = scoped_bags(actor, BAG_DISPOSE).values("pk")
    allowed |= Q(intent__kind="bag_disposal", intent__bag_id__in=bag_ids)
    rows = InventoryIntentExecution.objects.filter(organization=actor.organization).filter(allowed)
    if values.get("kind") is not None:
        rows = rows.filter(
            intent__kind="lot_write_off" if values["kind"] == "lot" else "bag_disposal"
        )
    if values.get("center") is not None:
        center = values["center"]
        rows = rows.filter(
            Q(intent__location__center_id=center)
            | Q(intent__bag__reading__ovitrap__sampling_point__block__quadrant__center_id=center)
        )
    if values.get("date") is not None:
        rows = rows.filter(intent__canonical_input__date=values["date"].isoformat())
    if values.get("reason_code") is not None:
        rows = rows.filter(intent__canonical_input__reason_code=values["reason_code"])
    for key, lookup in (
        ("created_at_from", "created_at__gte"),
        ("created_at_before", "created_at__lt"),
    ):
        if values.get(key) is not None:
            rows = rows.filter(**{lookup: values[key]})
    return rows.order_by(values.get("ordering", "-created_at"), "id")


def get_write_off(actor: UploadActor, identifier: UUID, kind: str) -> dict[str, Any]:
    if kind == "bag":
        row = (
            BagDisposition.objects.filter(
                organization=actor.organization,
                bag__in=scoped_bags(actor, BAG_DISPOSE),
                pk=identifier,
            )
            .select_related("execution")
            .first()
        )
        if row is None:
            raise Http404
        return cast(dict[str, Any], row.execution.response["write_off"])
    execution = write_off_rows(actor, {"kind": "lot"}).filter(lot_effect__pk=identifier).first()
    if execution is None:
        raise Http404
    return cast(dict[str, Any], execution.response["write_off"])


@dataclass(frozen=True)
class SupplyMovementVisibility:
    scope: EffectiveScope
    assignments: frozenset[UUID]


def _movement_assignment(movement: StockMovement) -> SupplyAssignment | None:
    source = movement.operation.supply_source
    if source is None:
        return None
    if source.event is not None:
        return source.event.assignment
    if source.compensation is not None:
        return source.compensation.event.assignment
    execution = source.execution
    if source.kind == "supply_return" and execution is not None:
        return execution.return_effect.declaration.event.assignment
    return None


def movement_supply_visibility(
    actor: UploadActor, rows: Iterable[StockMovement]
) -> SupplyMovementVisibility:
    """One captured current scope and one bounded page query; no per-row grant lookups."""
    scope = current_scope(actor)
    identities = {
        assignment.pk for row in rows if (assignment := _movement_assignment(row)) is not None
    }
    allowed = Q(pk__in=[])
    for permission in (ALLOCATE, RECONCILE, RECEIVE_OWN, RECONCILE_OWN):
        allowed |= Q(pk__in=scoped_assignments(actor, permission, scope).values("pk"))
    visible = SupplyAssignment.objects.filter(
        organization=actor.organization, pk__in=identities
    ).filter(allowed)
    return SupplyMovementVisibility(scope, frozenset(visible.values_list("pk", flat=True)))


def movement_supply_source(
    movement: StockMovement, visibility: SupplyMovementVisibility
) -> dict[str, str | None] | None:
    from inventory.allocations.scope import allows_supply_vector, location_context

    source = movement.operation.supply_source
    if source is None:
        return None
    assignment = _movement_assignment(movement)
    source_event_id = None
    if assignment is None:
        execution = source.execution
        if source.kind != "lot_write_off" or execution is None:
            return None
        loss = execution.lot_effect
        if not allows_supply_vector(visibility.scope, WRITE_OFF, [location_context(loss.location)]):
            return None
    elif assignment.pk not in visibility.assignments:
        return None
    elif source.event is not None:
        source_event_id = source.event.declared_source_uuid
    elif source.compensation is not None:
        source_event_id = source.compensation.declared_source_uuid
    elif source.execution is not None:
        source_event_id = source.execution.return_effect.declaration.event.declared_source_uuid
    return {
        "kind": source.kind,
        "id": str(movement.operation.source_id),
        "assignment_id": None if assignment is None else str(assignment.pk),
        "source_event_id": None if source_event_id is None else str(source_event_id),
    }
