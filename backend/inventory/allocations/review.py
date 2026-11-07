"""Concrete B10 source authority and observations; canonical review owns all decisions."""

from typing import Any, cast
from uuid import UUID

from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from core.snapshots import snapshot_hash
from field_sync.exceptions import EventRejected, SyncInProgressError
from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from inventory.allocations.models import (
    OriginReleaseProof,
    SupplyAssignment,
    SupplyEvent,
    SupplyReceiptLine,
)
from inventory.allocations.permissions import RECONCILE, SOURCE_PERMISSIONS
from inventory.allocations.scope import allows_supply_vector, assignment_contexts, location_context
from inventory.models import Location
from inventory.transactions import require_inventory_lock
from ovitraps.models import Ovitrap, OvitrapReading
from reviews.contracts import ReviewAdapter
from reviews.exceptions import ReviewBlockedError
from reviews.inspection import ExistingEffect
from uploads.access import UploadActor, current_scope

SUPPLY_REVIEW_CODES = frozenset(
    {
        "clock_skew",
        "final_upload_after_revoke",
        "causal_parent_pending",
        "supply_assignment_changed",
        "supply_state_conflict",
        "supply_evidence_required",
        "supply_transit_unavailable",
        "void_reason_code_deactivated",
    }
)


def source_contexts(
    ctx: EventContext, assignment: SupplyAssignment, data: dict[str, Any]
) -> list[dict[str, Any]]:
    contexts: list[dict[str, Any]] = list(assignment_contexts(assignment))
    for row in data.get("returned", []):
        location = Location.objects.filter(
            organization=ctx.organization, pk=row["destination_id"]
        ).first()
        if location is None:
            raise EventRejected("supply_inaccessible")
        contexts.append(location_context(location))
    for row in data.get("used", []):
        if row.get("work_kind") == "field_event":
            point = work_point(ctx, row["work_source_id"], allow_pending=True)
            contexts.append(
                {
                    "center_id": str(point.block.quadrant.center_id),
                    "quadrant_id": str(point.block.quadrant_id),
                }
            )
    return contexts


def work_point(ctx: EventContext, identifier: UUID, *, allow_pending: bool = False) -> Any:  # noqa: ANN401 -- genuine SamplingPoint from the exact real source
    source = FieldEvent.objects.filter(
        organization=ctx.organization,
        pk=identifier,
        created_by=ctx.user,
        type__in=("ovitrap.place", "ovitrap.check"),
    ).first()
    from reviews.effect_receipts import is_effective

    if source is None or (
        not allow_pending and (source.voided_at is not None or not is_effective(source))
    ):
        raise EventRejected("supply_inaccessible")
    placed = (
        Ovitrap.objects.filter(organization=ctx.organization, event=source)
        .select_related("sampling_point__block__quadrant")
        .first()
    )
    if placed is not None:
        return placed.sampling_point
    reading = (
        OvitrapReading.objects.filter(organization=ctx.organization, event=source)
        .select_related("ovitrap__sampling_point__block__quadrant")
        .first()
    )
    if reading is None:
        raise EventRejected("supply_inaccessible")
    return reading.ovitrap.sampling_point


def authorize_source(ctx: EventContext, data: dict[str, Any]) -> SupplyAssignment:
    try:
        assignment = _authorized_source(ctx, data)
    except (Http404, PermissionDenied, KeyError, TypeError, ValueError, AttributeError):
        raise EventRejected("supply_inaccessible") from None
    return cast(SupplyAssignment, assignment)


def _authorized_source(
    ctx: EventContext, data: dict[str, Any], *, inspection: bool = False
) -> SupplyAssignment:
    identifier = UUID(str(data["assignment_id"]))
    assignment = (
        SupplyAssignment.objects.filter(
            organization=ctx.organization, pk=identifier, courier=ctx.user
        )
        .select_related("origin__center", "origin__quadrant")
        .first()
    )
    if assignment is None:
        raise Http404
    contexts = source_contexts(ctx, assignment, data)
    capability = ctx.review_authorization
    scope = (
        capability.historical_scope
        if capability
        else current_scope(UploadActor(ctx.user, ctx.organization, ctx.device.pk))
    )
    permission = SOURCE_PERMISSIONS[ctx.envelope.type]
    if any(
        not allows_supply_vector(scope, code, contexts) for code in (permission, "field_event.sync")
    ):
        raise Http404
    if capability is not None and not inspection:
        if capability.reviewer_actor is None:
            raise Http404
        reviewer = current_scope(capability.reviewer_actor)
        if any(
            not allows_supply_vector(reviewer, code, contexts)
            for code in (RECONCILE, "review_item.decide")
        ):
            raise Http404
    return cast(SupplyAssignment, assignment)


def source_references(ctx: EventContext) -> set[UUID]:
    data = ctx.envelope.payload
    assignment = authorize_source(ctx, data)
    identifiers: set[UUID] = set()
    for kind in ("used", "returned", "shrinkage"):
        for row in data.get(kind, []):
            for key in ("receipt_source_event_id", "work_source_id"):
                if key not in row:
                    continue
                identifier = UUID(str(row[key]))
                query = FieldEvent.objects.filter(
                    organization=ctx.organization, pk=identifier, created_by=assignment.courier
                )
                if key == "receipt_source_event_id":
                    query = query.filter(
                        type="supplies.receive", payload__assignment_id=str(assignment.pk)
                    )
                identifiers.update(query.values_list("pk", flat=True))
    return identifiers


def source_participants(ctx: EventContext) -> tuple[UUID, ...]:
    try:
        assignment = authorize_source(ctx, ctx.envelope.payload)
        identifiers = source_references(ctx)
    except (EventRejected, KeyError, TypeError, ValueError):
        return ()  # Normal per-event validation retains its opaque error precedence.
    from inventory.allocations.transactions import assignment_participants

    humans = {
        *assignment_participants(assignment).users,
        *FieldEvent.objects.filter(pk__in=identifiers).values_list("created_by_id", flat=True),
    }
    if None in humans:
        raise SyncInProgressError
    return tuple(sorted(humans))


def capture_source_facts(ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
    assignment = authorize_source(ctx, data)
    return _source_facts(ctx, data, assignment)


def _source_facts(
    ctx: EventContext, data: dict[str, Any], assignment: SupplyAssignment
) -> dict[str, Any]:
    release = None
    if ctx.envelope.type == "supplies.receive":
        release = OriginReleaseProof.objects.filter(
            organization=ctx.organization, pk=data["release_id"], version__assignment=assignment
        ).first()
        if release is None:
            raise EventRejected("supply_inaccessible")
    identity = {
        "assignment_id": str(assignment.pk),
        "courier_id": str(assignment.courier_id),
        "origin_id": str(assignment.origin_id),
        "release_hash": None if release is None else release.manifest_hash,
    }
    return {
        "version": 1,
        "available": True,
        **identity,
        "identity_hash": snapshot_hash(identity),
        "observed_at": ctx.server_received_at.isoformat(),
    }


def require_original_facts(
    ctx: EventContext, data: dict[str, Any], *, inspection: bool = False
) -> None:
    capability = ctx.review_authorization
    if capability is None:
        return
    original = capability.owner_facts.get("supplies", {})
    if inspection:
        # Historical inspection precedes reviewer attachment; it cannot apply an effect.
        try:
            assignment = _authorized_source(ctx, data, inspection=True)
        except (Http404, PermissionDenied, KeyError, TypeError, ValueError, AttributeError):
            raise EventRejected("supply_inaccessible") from None
        current = _source_facts(ctx, data, assignment)
    else:
        # Both preparation and execution retain the actual current reviewer checks.
        current = capture_source_facts(ctx, data)
    if (
        not original.get("available")
        or original.get("version") != 1
        or original.get("identity_hash") != current["identity_hash"]
        or capability.source_id != ctx.envelope.id
        or capability.payload_sha256 != ctx.envelope.payload_info.sha256
    ):
        raise ReviewBlockedError(("capture_context_unavailable",))


class SupplyReviewAdapter(ReviewAdapter):
    reviewable_codes = SUPPLY_REVIEW_CODES

    def prepare_boundary(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        require_inventory_lock(ctx.organization.pk)
        assignment = authorize_source(ctx, data)
        SupplyAssignment.objects.select_for_update(nowait=True, no_key=True).get(pk=assignment.pk)
        require_original_facts(ctx, data)
        facts = capture_source_facts(ctx, data)
        ctx.observed_facts["supplies"] = facts
        return {"supplies": facts}

    def capture_observations(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        return {"supplies": ctx.observed_facts.get("supplies") or capture_source_facts(ctx, data)}

    def inspect_existing(self, source: FieldEvent, ctx: EventContext) -> ExistingEffect:
        from reviews.inspection import validated_original_payload
        from reviews.models import ReviewEffectReceipt

        require_original_facts(ctx, validated_original_payload(source), inspection=True)
        event = SupplyEvent.objects.filter(
            organization=source.organization,
            declared_source_uuid=source.pk,
            source_payload_hash=source.payload_sha256,
        ).first()
        if event is None:
            return ExistingEffect()
        if (
            source.status == "in_review"
            and not ReviewEffectReceipt.objects.filter(source_event=source).exists()
        ):
            return ExistingEffect("partial", blockers=("unexpected_materialization",))
        return ExistingEffect("complete_owned", materialization(event))

    def execute_review(self, ctx: EventContext, data: dict[str, Any]) -> dict[str, Any]:
        from inventory.allocations.handlers import apply_source

        return materialization(apply_source(ctx, data))


def materialization(event: SupplyEvent) -> dict[str, Any]:
    return {
        "supply_event_id": str(event.pk),
        "assignment_id": str(event.assignment_id),
        "revision": event.revision,
        "input_hash": event.input_hash,
        "result": event.result.response,
    }


def declared_sources(data: dict[str, Any]) -> dict[UUID, set[str]]:
    references: dict[UUID, set[str]] = {}
    for kind in ("used", "returned", "shrinkage"):
        for row in data.get(kind, []):
            references.setdefault(UUID(str(row["receipt_source_event_id"])), set()).add(
                str(row["receipt_line_id"])
            )
    return references


def classify_supply_dependencies(batch: Any, envelope: Any, candidates: Any) -> Any:  # noqa: ANN401 -- existing concrete batch/envelope/candidate/preparation contracts
    from reviews.contracts import HandlerPreparation
    from reviews.effect_receipts import is_effective

    ctx = EventContext(batch.organization, batch.user, batch.device, envelope, batch.received_at)
    authorize_source(ctx, envelope.payload)
    dependencies = []
    for identifier, lines in declared_sources(envelope.payload).items():
        parent = FieldEvent.objects.filter(organization=batch.organization, pk=identifier).first()
        candidate = candidates.captures.get(identifier)
        parent_data = parent.payload if parent else (candidate.payload if candidate else None)
        parent_type = parent.type if parent else (candidate.type if candidate else None)
        if parent_data is not None:
            actual_ids = {
                str(row["id"])
                for row in parent_data.get("actual_lines", [])
                if isinstance(row, dict) and "id" in row
            }
            if (
                parent_type != "supplies.receive"
                or str(parent_data.get("assignment_id")) != str(envelope.payload["assignment_id"])
                or not lines.issubset(actual_ids)
                or (parent and parent.created_by_id != batch.user.pk)
            ):
                raise EventRejected("supply_inaccessible")
        if parent is not None and is_effective(parent):
            if SupplyReceiptLine.objects.filter(
                pk__in=lines, receipt__event__source_link__source_event=parent
            ).count() != len(lines):
                raise EventRejected("supply_inaccessible")
            continue
        dependencies.append(
            {
                "kind": "supply_source",
                "declared_id": identifier,
                "candidate_source_id": identifier
                if parent is not None or candidate is not None
                else None,
                "candidate_envelope": candidates.envelopes.get(identifier, {}),
            }
        )
    return HandlerPreparation(
        dependencies=tuple(dependencies),
        pending_code="causal_parent_pending" if dependencies else None,
    )


def dependency_parent(source: FieldEvent, dependency: Any) -> FieldEvent | None:  # noqa: ANN401 -- real ReviewDependency
    parent = FieldEvent.objects.filter(
        organization=source.organization,
        pk=dependency.declared_id,
        created_by=source.created_by,
        type="supplies.receive",
    ).first()
    if parent is None or str(parent.payload.get("assignment_id")) != str(
        source.payload.get("assignment_id")
    ):
        return None
    lines = declared_sources(source.payload).get(parent.pk, set())
    if not lines or SupplyReceiptLine.objects.filter(
        pk__in=lines, receipt__event__source_link__source_event=parent
    ).count() != len(lines):
        return None
    return cast(FieldEvent, parent)
