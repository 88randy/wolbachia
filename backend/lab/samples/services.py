"""Once-only collection and reception, followed by an explicit append-only result chain."""

from dataclasses import dataclass
from typing import Any, cast
from uuid import UUID

from django.http import Http404

from catalogs.models import CatalogItem, CatalogSnapshot
from core.snapshots import snapshot_hash
from core.time import server_now
from core.void_reason import validate_void_reason, visible_length
from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from inventory.models import LotVersion
from lab.commands import canonical_values
from lab.exceptions import LabConflictError
from lab.methods import method_pin
from lab.samples.methods import wolbachia_method
from lab.samples.models import (
    SampleCommandReceipt,
    SampleReceipt,
    WolbachiaResultAttempt,
    WolbachiaSample,
)
from lab.samples.sources import (
    SampleSource as SampleSource,
)
from lab.samples.sources import (
    require_source_scope as require_source_scope,
)
from lab.samples.sources import (
    resolve_source as resolve_source,
)
from lab.samples.sources import (
    source_is_effective,
)
from lab.transactions import LabParticipants, lab_transaction
from uploads.access import UploadActor


@dataclass(frozen=True)
class SampleCommand:
    action: str
    command_id: UUID
    values: dict[str, Any]


def _origin(ctx: EventContext, values: dict[str, Any]) -> dict[str, Any]:
    archived = CatalogSnapshot.objects.filter(
        organization=ctx.organization, version=ctx.envelope.catalog_version
    ).first()
    if archived is None:
        raise EventNeedsReview("sample_configuration_unavailable")
    matches = [
        item
        for catalog in archived.content.get("catalogs", [])
        if catalog.get("slug") == "sample-origin"
        for item in catalog.get("items", [])
        if item.get("code") == values["origin_code"]
    ]
    if len(matches) != 1:
        raise EventRejected("sample_inaccessible")
    chosen = matches[0]
    item = CatalogItem.objects.filter(
        organization=ctx.organization,
        pk=chosen.get("id"),
        catalog__slug="sample-origin",
        code=values["origin_code"],
        is_active=True,
    ).first()
    if item is None:
        raise EventNeedsReview("sample_configuration_unavailable")
    text = validate_void_reason(values.get("other_text", ""), enforce_minimum=False)
    if bool(visible_length(text)) != bool(item.is_other) or (text and not item.is_other):
        raise EventRejected("invalid_payload")
    return dict(chosen)


def validate_collection(ctx: EventContext, values: dict[str, Any]) -> dict[str, Any]:
    """Capture immutable proof before review rollback; current authority remains independent."""
    source = resolve_source(ctx.organization, values["source_ref"])
    actor = UploadActor(ctx.user, ctx.organization, ctx.device.pk)
    for permission in ("field_event.sync", "sample.collect"):
        require_source_scope(actor, source, permission)
    if source.event_id is not None and source.author_id != ctx.user.pk:
        raise EventRejected("sample_inaccessible")
    if not source_is_effective(source):
        raise EventRejected("sample_source_unavailable")
    if (
        source.event_id is not None
        and not FieldEvent.objects.filter(
            pk=source.event_id, device_time__lte=ctx.envelope.device_time
        ).exists()
    ):
        raise EventRejected("sample_source_unavailable")
    origin = _origin(ctx, values)
    facts = _method_facts(ctx, values)
    provenance = dict(source.provenance)
    if source.lot_id:
        version = (
            LotVersion.objects.filter(
                organization=ctx.organization,
                lot_id=source.lot_id,
                created_at__lte=ctx.envelope.device_time,
            )
            .order_by("-revision")
            .first()
        )
        if version is None:
            raise EventRejected("sample_source_unavailable")
        provenance["lot_version_id"] = str(version.pk)
    if ctx.envelope.gps is None:
        raise EventRejected("invalid_payload")
    return {
        "version": 1,
        "origin": origin,
        "method": facts,
        "source": provenance,
        "payload_sha256": ctx.envelope.payload_info.sha256,
        "rules_version": ctx.envelope.rules_version,
        "catalog_version": ctx.envelope.catalog_version,
    }


def _method_facts(ctx: EventContext, values: dict[str, Any]) -> dict[str, Any]:
    try:
        version, verification = wolbachia_method(
            ctx.organization, values["method_version"], ctx.envelope.device_time
        )
        wolbachia_method(ctx.organization, values["method_version"], server_now())
    except LabConflictError as error:
        raise EventNeedsReview("sample_configuration_unavailable") from error
    return {"version": method_pin(version), "verification_id": str(verification.pk)}


def collect_sample(ctx: EventContext, values: dict[str, Any]) -> WolbachiaSample:
    facts = validate_collection(ctx, values)
    ctx.observed_facts["sample"] = facts
    if ctx.review_code and not ctx.acknowledges(ctx.review_code):
        raise EventNeedsReview(ctx.review_code)
    if facts["origin"].get("requires_photo") and not values.get("evidence_ids"):
        raise EventNeedsReview("sample_evidence_required")
    if values.get("evidence_ids"):
        from uploads.gates import require_event_evidence

        try:
            require_event_evidence(ctx, [str(identifier) for identifier in values["evidence_ids"]])
        except EventNeedsReview as error:
            if error.code in {"clock_skew", "final_upload_after_revoke", "causal_parent_pending"}:
                raise
            raise EventNeedsReview("sample_evidence_required") from error
    if (
        WolbachiaSample.objects.filter(pk=values["sample_id"]).exists()
        or WolbachiaSample.objects.filter(
            organization=ctx.organization, code=values["code"]
        ).exists()
    ):
        raise EventRejected("sample_state_conflict")
    source = resolve_source(ctx.organization, values["source_ref"])
    gps = ctx.envelope.gps
    return WolbachiaSample.objects.create(
        id=values["sample_id"],
        organization=ctx.organization,
        created_by=ctx.user,
        event_id=ctx.envelope.id,
        code=values["code"],
        center_id=source.center_id,
        quadrant_id=source.quadrant_id,
        reading_id=source.reading_id,
        lot_id=source.lot_id,
        release_id=source.release_id,
        method_version_id=values["method_version"],
        origin_snapshot=facts["origin"],
        other_text=values.get("other_text", ""),
        source_provenance=facts,
        location=[gps.lng, gps.lat] if gps else [],
        device_time=ctx.envelope.device_time,
        server_received_at=ctx.server_received_at,
    )


def sample_void(ctx: EventContext, target: FieldEvent) -> None:
    source = resolve_source(ctx.organization, target.payload["source_ref"])
    require_source_scope(
        UploadActor(ctx.user, ctx.organization, ctx.device.pk), source, "sample.void"
    )
    reason = validate_void_reason(ctx.envelope.payload.get("reason", ""), enforce_minimum=False)
    if visible_length(reason) < 10:
        raise EventRejected("invalid_payload")
    sample = WolbachiaSample.objects.filter(organization=ctx.organization, event=target).first()
    if sample and (
        SampleReceipt.objects.filter(sample=sample).exists() or sample.attempts.exists()
    ):
        raise EventRejected("sample_void_blocked")


def _sample(actor: UploadActor, identifier: UUID, permission: str) -> WolbachiaSample:
    sample = WolbachiaSample.objects.filter(organization=actor.organization, pk=identifier).first()
    if sample is None:
        raise Http404
    source = SampleSource(sample.center_id, sample.quadrant_id)
    require_source_scope(actor, source, permission)
    return cast(WolbachiaSample, sample)


def execute_sample_command(
    actor: UploadActor, sample_id: UUID, request: SampleCommand
) -> dict[str, Any]:
    """The Organization arbiter serializes the entire receipt/result command chain."""
    permission = {"receive": "sample.receive", "results": "sample.result_create"}.get(
        request.action
    )
    if permission is None:
        raise LabConflictError("sample_state_conflict")
    sample = _sample(actor, sample_id, permission)
    if sample.created_by_id is None:
        raise Http404
    participants = LabParticipants(sources=((sample.event_id, sample.created_by_id),))
    with lab_transaction(actor, extra=participants):
        sample = _sample(actor, sample_id, permission)
        body_hash = snapshot_hash(
            canonical_values(
                {
                    "actor": actor.user.pk,
                    "sample": sample.pk,
                    "action": request.action,
                    "values": request.values,
                }
            )
        )
        saved = SampleCommandReceipt.objects.filter(
            organization=actor.organization, command_id=request.command_id
        ).first()
        if saved:
            if (
                saved.sample_id != sample.pk
                or saved.action != request.action
                or saved.body_hash != body_hash
            ):
                raise LabConflictError("sample_state_conflict")
            return dict(saved.response)
        _require_live_source(sample)
        fact = _append_command(actor, sample, request)
        from lab.samples.selectors import attempt_snapshot, receipt_snapshot

        response = {
            "sample_id": str(sample.pk),
            "receipt": receipt_snapshot(fact) if isinstance(fact, SampleReceipt) else None,
            "attempt": attempt_snapshot(fact) if isinstance(fact, WolbachiaResultAttempt) else None,
        }
        SampleCommandReceipt.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            sample=sample,
            command_id=request.command_id,
            action=request.action,
            body_hash=body_hash,
            response=response,
        )
        return response


def _require_live_source(sample: WolbachiaSample) -> None:
    from reviews.effect_receipts import is_effective

    if not is_effective(sample.event):
        raise LabConflictError("sample_state_conflict")
    source = resolve_source(sample.organization, sample.event.payload["source_ref"])
    if not source_is_effective(source):
        raise LabConflictError("sample_source_unavailable")


def _append_command(
    actor: UploadActor, sample: WolbachiaSample, request: SampleCommand
) -> SampleReceipt | WolbachiaResultAttempt:
    if request.action == "receive":
        if SampleReceipt.objects.filter(sample=sample).exists():
            raise LabConflictError("sample_state_conflict")
        return SampleReceipt.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            sample=sample,
            command_id=request.command_id,
        )
    return _append_result(actor, sample, request)


def _append_result(
    actor: UploadActor, sample: WolbachiaSample, request: SampleCommand
) -> WolbachiaResultAttempt:
    if not SampleReceipt.objects.filter(sample=sample).exists():
        raise LabConflictError("sample_state_conflict")
    from lab.samples.payloads import SampleResultSerializer

    serializer = SampleResultSerializer(data={"command_id": request.command_id, **request.values})
    serializer.is_valid(raise_exception=True)
    values = serializer.validated_data
    latest = sample.attempts.order_by("-revision").first()
    predecessor = values.get("repeat_of")
    if (latest is None and predecessor is not None) or (
        latest is not None and (latest.status == "valid" or predecessor != latest.pk)
    ):
        raise LabConflictError("sample_state_conflict")
    method, verification = wolbachia_method(
        actor.organization, values["method_version"], server_now()
    )
    return WolbachiaResultAttempt.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        sample=sample,
        command_id=request.command_id,
        revision=1 if latest is None else latest.revision + 1,
        repeat_of=latest,
        status=values["status"],
        result=values["result"],
        method_version=method,
        method_verification=verification,
    )
