"""Write immutable capture observations after operational rollback, under retained locks."""

from typing import Any

from core.time import server_now
from field_sync.envelope import BatchContext, EventEnvelope
from field_sync.models import FieldEvent
from field_sync.selectors import captured_scope, membership_snapshots
from ovitraps.codes import STALE_IDENTITY
from reviews.contracts import HandlerPreparation
from reviews.dependencies import parent_claims
from reviews.models import (
    ReviewDependency,
    ReviewParentClaim,
    ReviewSourceSnapshot,
    ReviewSubjectScope,
)
from reviews.source_identity import envelope_metadata


def store_source_facts(  # noqa: PLR0913 -- capture identity and retained preparation are separate facts
    batch: BatchContext, envelope: EventEnvelope, source: FieldEvent, prepared: HandlerPreparation
) -> None:
    if source.status == "rejected":
        return
    member = membership_snapshots(batch.organization).filter(user=batch.user).first()
    grants = (
        []
        if member is None
        else [
            {"permissions": sorted(codes), "scope": scope}
            for codes, scope in captured_scope(member).grants
        ]
    )
    severe = source.type == "shift.open" and any(
        line.get("result") == "severe" for line in envelope.payload.get("checks", [])
    )
    ReviewSourceSnapshot.objects.create(
        organization=batch.organization,
        created_by=batch.user,
        source_event=source,
        original_envelope=envelope_metadata(envelope),
        sent_at=batch.sent_at,
        observed_session_id=batch.observed_session_id,
        observed_pair_id=batch.observed_pair_id,
        ingestion_authority={"observed_at": server_now().isoformat(), "grants": grants},
        resource_kind=prepared.subjects.resource_kind,
        resource_id=prepared.subjects.resource_id,
        has_severe_observation=severe,
        facts={
            "pending_code": prepared.pending_code,
            "owner": prepared.owner_facts,
            "observed_codes": list(prepared.observed_codes),
        },
    )
    ReviewSubjectScope.objects.create(
        organization=batch.organization,
        created_by=batch.user,
        source_event=source,
        revision=1,
        is_resolved=prepared.subjects.resolved,
        contexts=list(prepared.subjects.contexts),
        proof={"kind": "ingestion_subject"},
    )
    for dependency in prepared.dependencies:
        ReviewDependency.objects.create(
            organization=batch.organization,
            created_by=batch.user,
            source_event=source,
            **dependency,
        )
    for claim in parent_claims(envelope, prepared.subjects.resolved):
        if _materialized_stale_replacement(source, claim, prepared.observed_codes):
            continue
        ReviewParentClaim.objects.create(
            organization=batch.organization, created_by=batch.user, source_event=source, **claim
        )
    if severe and source.status == "in_review":
        from incidents.notices import enqueue_notice

        enqueue_notice("critical_review", source.pk)
    from reviews.history import publish_source_shift_invalidation

    publish_source_shift_invalidation(source)


def _materialized_stale_replacement(
    source: FieldEvent, claim: dict[str, Any], observed_codes: tuple[str, ...]
) -> bool:
    """An existing physical identity retains its original parent claim."""
    if (
        source.type != "ovitrap.replace"
        or source.status != "in_review"
        or claim["kind"] != "ovitrap"
        or STALE_IDENTITY not in observed_codes
    ):
        return False
    from ovitraps.models import Ovitrap

    return Ovitrap.objects.filter(
        organization=source.organization, client_uuid=claim["identity"]
    ).exists()
