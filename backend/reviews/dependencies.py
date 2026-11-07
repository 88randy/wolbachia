"""Causal quarantine retains identity; it never grants authority or replays children."""

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from field_sync.codes import CAUSAL_PARENT_PENDING
from field_sync.envelope import BatchContext, EventEnvelope
from field_sync.exceptions import EventRejected
from field_sync.models import FieldEvent
from reviews.contracts import HandlerPreparation
from reviews.effect_receipts import is_effective
from reviews.models import ReviewParentClaim


@dataclass(frozen=True)
class BatchCandidates:
    sources: frozenset[UUID] = frozenset()
    parents: dict[tuple[str, UUID], tuple[UUID, ...]] = field(default_factory=dict)
    envelopes: dict[UUID, dict[str, Any]] = field(default_factory=dict)
    captures: dict[UUID, EventEnvelope] = field(default_factory=dict)

    @classmethod
    def from_envelopes(cls, envelopes: list[EventEnvelope]) -> "BatchCandidates":
        from reviews.source_identity import envelope_metadata

        parents: dict[tuple[str, UUID], list[UUID]] = {}
        for event in envelopes:
            keys = []
            if event.type == "shift.open" and event.shift_id is not None:
                keys.append(("shift", event.shift_id))
            if event.type in {"ovitrap.place", "ovitrap.replace"}:
                raw = event.payload.get(
                    "ovitrap_id" if event.type == "ovitrap.place" else "replacement_id"
                )
                try:
                    keys.append(("ovitrap", UUID(str(raw))))
                except ValueError:
                    continue
            for key in keys:
                parents.setdefault(key, []).append(event.id)
        return cls(
            frozenset(event.id for event in envelopes),
            {key: tuple(value) for key, value in parents.items()},
            {event.id: envelope_metadata(event) for event in envelopes},
            {event.id: event for event in envelopes},
        )


def _pending(  # noqa: PLR0913 -- typed identity and exact candidate envelope are distinct immutable facts
    kind: str, identity: UUID, candidate: UUID | None, metadata: dict[str, Any] | None = None
) -> HandlerPreparation:
    return HandlerPreparation(
        dependencies=(
            {
                "kind": kind,
                "declared_id": identity,
                "candidate_source_id": candidate,
                "candidate_envelope": metadata or {},
            },
        ),
        pending_code=CAUSAL_PARENT_PENDING,
    )


def classify_dependencies(
    batch: BatchContext, envelope: EventEnvelope, candidates: BatchCandidates
) -> HandlerPreparation:
    from field_sync.registry import get_handler

    handler = get_handler(envelope.type, envelope.schema_version)
    if handler is None or handler.review_adapter is None:
        return HandlerPreparation()
    if envelope.type in {"transfer.dispatch", "transfer.receive"}:
        from inventory.transfers.dependencies import classify_transfer_dependency

        return classify_transfer_dependency(batch, envelope, candidates)
    if envelope.type == "record.void":
        return _void_dependency(batch, envelope, candidates)
    pending = []
    if (
        envelope.shift_id is not None
        and envelope.type != "shift.open"
        and (envelope.type == "shift.close" or (handler is not None and handler.checks_shift))
    ):
        pending.append(_shift_dependency(batch, envelope, candidates))
    if envelope.type.startswith("ovitrap.") and envelope.type != "ovitrap.place":
        pending.append(_physical_dependency(batch, envelope, candidates))
    dependencies = tuple(dependency for item in pending for dependency in item.dependencies)
    return HandlerPreparation(
        dependencies=dependencies, pending_code=CAUSAL_PARENT_PENDING if dependencies else None
    )


def _shift_dependency(
    batch: BatchContext, envelope: EventEnvelope, candidates: BatchCandidates
) -> HandlerPreparation:
    from shifts.models import Shift

    if envelope.shift_id is None:
        return HandlerPreparation()
    shift = (
        Shift.objects.filter(
            organization=batch.organization, pk=envelope.shift_id, courier=batch.user
        )
        .select_related("opened_event")
        .first()
    )
    if shift is not None and not is_effective(shift.opened_event):
        if envelope.type == "shift.close" and _complete_frame(shift.opened_event):
            return HandlerPreparation()
        return _pending("shift", envelope.shift_id, shift.opened_event_id)
    if shift is None:
        pending = _owned_parent(batch, "shift", envelope.shift_id, candidates)
        if pending is None:
            raise EventRejected("shift_not_open", {"shift_id": str(envelope.shift_id)})
        return pending
    return HandlerPreparation()


def _physical_dependency(
    batch: BatchContext, envelope: EventEnvelope, candidates: BatchCandidates
) -> HandlerPreparation:
    from ovitraps.models import Ovitrap

    raw = envelope.payload.get("ovitrap_id")
    if raw:
        identity = UUID(str(raw))
        physical = (
            Ovitrap.objects.filter(organization=batch.organization, client_uuid=identity)
            .select_related("event")
            .first()
        )
        if physical is not None and not is_effective(physical.event):
            _require_physical_scope(batch, envelope)
            return _pending("ovitrap", identity, physical.event_id)
        if physical is None:
            pending = _owned_parent(batch, "ovitrap", identity, candidates)
            if pending is None:
                raise EventRejected("ovitrap_inaccessible")
            return pending
    return HandlerPreparation()


def _void_dependency(
    batch: BatchContext, envelope: EventEnvelope, candidates: BatchCandidates
) -> HandlerPreparation:
    identifier = envelope.voids_event_id
    if identifier is None:
        return HandlerPreparation()
    target = FieldEvent.objects.filter(
        organization=batch.organization, pk=identifier, created_by=batch.user
    ).first()
    from reviews.safety import has_pending_severe_source

    if target is not None and has_pending_severe_source(target.pk):
        return _pending("void_target", target.pk, target.pk)
    # The existence test deliberately disqualifies a known foreign candidate.
    if (
        target is None
        and identifier in candidates.sources
        and not FieldEvent.objects.filter(pk=identifier).exists()
    ):
        return _pending("void_target", identifier, identifier, candidates.envelopes.get(identifier))
    return HandlerPreparation()


def _complete_frame(source: FieldEvent) -> bool:
    from reviews.inspection import inspect_shift, original_source_envelope

    try:
        return inspect_shift(source, original_source_envelope(source)).state == "complete_owned"
    except ValueError:
        return False


def _owned_parent(  # noqa: PLR0913 -- actor, typed parent key and batch-only candidates
    batch: BatchContext, kind: str, identity: UUID, candidates: BatchCandidates
) -> HandlerPreparation | None:
    claims = ReviewParentClaim.objects.filter(kind=kind, identity=identity)
    if kind == "ovitrap":
        claims = claims.filter(organization=batch.organization)
    claim = claims.select_related("source_event").first()
    if claim is not None:
        source = claim.source_event
        if (
            source.organization_id == batch.organization.pk
            and (kind == "ovitrap" or source.created_by_id == batch.user.pk)
            and source.status != "rejected"
        ):
            if kind == "ovitrap":
                from reviews.inspection import original_source_envelope

                try:
                    parent_envelope = original_source_envelope(source)
                except ValueError:
                    return None
                _require_physical_scope(batch, parent_envelope)
            return _pending(kind, identity, source.pk)
        return None
    return _batch_parent(batch, candidates, (kind, identity))


def _batch_parent(
    batch: BatchContext, candidates: BatchCandidates, key: tuple[str, UUID]
) -> HandlerPreparation | None:
    kind, identity = key
    options = candidates.parents.get(key, ())
    if kind == "shift":
        from shifts.models import Shift

        if Shift.objects.filter(pk=identity).exists():
            return None
    if len(options) == 1:
        if kind == "ovitrap":
            from reviews.source_identity import envelope_metadata

            candidate = candidates.captures.get(options[0])
            if candidate is None or envelope_metadata(candidate) != candidates.envelopes.get(
                options[0]
            ):
                return None
            _require_physical_scope(batch, candidate)
        return _pending(kind, identity, options[0], candidates.envelopes.get(options[0]))
    return None


def _require_physical_scope(batch: BatchContext, envelope: EventEnvelope) -> None:
    from reviews.scope import subject_facts, vector_allows
    from uploads.access import UploadActor, current_scope

    subjects = subject_facts(batch.organization, envelope)
    scope = current_scope(UploadActor(batch.user, batch.organization, batch.device.pk))
    if not vector_allows(scope, "field_event.sync", subjects.contexts, subjects.resolved):
        raise EventRejected("ovitrap_inaccessible")


def parent_claims(envelope: EventEnvelope, subjects_resolved: bool) -> tuple[dict[str, Any], ...]:
    if not subjects_resolved:
        return ()
    if envelope.type == "shift.open" and envelope.shift_id is not None:
        return ({"kind": "shift", "identity": envelope.shift_id},)
    if envelope.type in {"ovitrap.place", "ovitrap.replace"}:
        key = "ovitrap_id" if envelope.type == "ovitrap.place" else "replacement_id"
        return ({"kind": "ovitrap", "identity": UUID(str(envelope.payload[key]))},)
    return ()
