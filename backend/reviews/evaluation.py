"""Safe inspection states; operational permission is proved again inside the transaction."""

from dataclasses import dataclass
from typing import Any

from field_sync.exceptions import EventNeedsReview, EventRejected
from field_sync.models import FieldEvent
from field_sync.permissions import FIELD_EVENT_SYNC
from field_sync.registry import EventContext, get_handler
from organizations.scope import EffectiveScope
from reviews.authority import historical_authority
from reviews.contracts import ReviewAuthorization
from reviews.exceptions import ReviewBlockedError
from reviews.inspection import ExistingEffect, original_source_envelope
from reviews.models import ReviewEffectReceipt, ReviewSourceSnapshot
from reviews.policies import ReviewPolicyFacts, acceptance_blockers
from reviews.scope import SubjectFacts, subject_allows, subject_facts


@dataclass(frozen=True)
class ReviewEvaluation:
    subjects: SubjectFacts
    context: EventContext | None
    legacy: ExistingEffect
    blockers: tuple[str, ...]
    proof_ids: tuple[str, ...] = ()

    @property
    def can_accept(self) -> bool:
        return not self.blockers


def inspect_review(source: FieldEvent) -> ReviewEvaluation:
    handler = get_handler(source.type, source.schema_version)
    adapter = None if handler is None else handler.review_adapter
    if source.created_by is None or source.device.organization_id != source.organization_id:
        return ReviewEvaluation(
            SubjectFacts(), None, ExistingEffect(), ("source_identity_unavailable",)
        )
    try:
        envelope = original_source_envelope(source)
    except ValueError:
        return ReviewEvaluation(
            SubjectFacts(), None, ExistingEffect(), ("source_identity_unavailable",)
        )
    subjects = subject_facts(source.organization, envelope)
    authority = historical_authority(source.organization, source.created_by_id, source.device_time)
    historical_scope = authority.scope
    if subjects.resource_kind == "motorcycle":
        # Motorcycle allocation has no capture-time history. A current center or
        # lazy snapshot cannot prove its old assignment; explicit all grants are
        # independent of that unknown allocation. Selected capture scope remains
        # unavailable until an actual historical allocation proof exists.
        historical_scope = EffectiveScope(
            tuple(
                (codes, grant)
                for codes, grant in authority.scope.grants
                if grant["centers"]["mode"] == "all"
            )
        )
    codes = frozenset() if adapter is None else adapter.reviewable_codes
    snapshot = ReviewSourceSnapshot.objects.filter(source_event=source).first()
    source_facts = {} if snapshot is None else snapshot.facts
    observed = frozenset([source.status_code, *source_facts.get("observed_codes", [])]) & codes
    prohibited = tuple(code for code in source_facts.get("observed_codes", []) if code not in codes)
    required = _community_permissions(source, envelope)
    if source.type in {"incident.report", "emergency.accident"}:
        required.append("incident.create")
    if subjects.resource_kind == "transfer":
        required.append(subjects.facts["transfer_action"])
    permission_proved = all(
        subject_allows(historical_scope, permission, subjects) for permission in required
    )
    capability = ReviewAuthorization(
        source.pk,
        source.payload_sha256,
        historical_scope,
        authority.proof_ids,
        observed,
        owner_facts=source_facts.get("owner", {}),
        pending_code=source_facts.get("pending_code"),
    )
    context = EventContext(
        source.organization,
        source.created_by,
        source.device,
        envelope,
        source.server_received_at,
        source.status_code,
        capability,
    )
    try:
        legacy = ExistingEffect() if adapter is None else adapter.inspect_existing(source, context)
    except (EventNeedsReview, EventRejected) as error:
        legacy = ExistingEffect("unavailable", blockers=(error.code,))
    except ReviewBlockedError as error:
        legacy = ExistingEffect("none", blockers=tuple(item["reason"] for item in error.blocked_by))
    if (
        legacy.state == "complete_owned"
        and source.status == "in_review"
        and snapshot is not None
        and snapshot.policy_version == "reviews.v1"
        and not ReviewEffectReceipt.objects.filter(source_event=source).exists()
    ):
        legacy = ExistingEffect("partial", blockers=("unexpected_materialization",))
    facts = ReviewPolicyFacts(
        source_status=source.status,
        source_code=source.status_code,
        has_adapter=adapter is not None,
        has_original_identity=source.created_by_id is not None,
        has_historical_authority=authority.unavailable is None
        and permission_proved
        and source.device_time <= source.server_received_at,
        allowed_observations=codes,
        mandatory_blockers=legacy.blockers
        + prohibited
        + (("source_voided",) if source.voided_at is not None else ()),
    )
    blockers = acceptance_blockers(facts)
    if not subjects.resolved:
        blockers = tuple(dict.fromkeys((*blockers, "source_scope_unavailable")))
    return ReviewEvaluation(subjects, context, legacy, blockers, authority.proof_ids)


def _community_permissions(source: FieldEvent, envelope: Any) -> list[str]:  # noqa: ANN401 -- canonical validated envelope
    required = [FIELD_EVENT_SYNC]
    if source.type == "community.activity":
        required.append("community_activity.create")
        if envelope.payload.get("incident_id") is not None:
            required.append("incident.read")
    if (
        source.type == "record.void"
        and envelope.voids_event_id is not None
        and FieldEvent.objects.filter(
            organization=source.organization,
            pk=envelope.voids_event_id,
            type="community.activity",
            created_by=source.created_by,
        ).exists()
    ):
        required.append("community_activity.void")
    return required


def evaluation_payload(evaluation: ReviewEvaluation) -> dict[str, Any]:
    return {
        "can_accept": evaluation.can_accept,
        "blockers": list(evaluation.blockers),
        "legacy_state": evaluation.legacy.state,
        "subjects": list(evaluation.subjects.contexts),
        "scope_resolved": evaluation.subjects.resolved,
        "authority_proof_ids": list(evaluation.proof_ids),
    }
