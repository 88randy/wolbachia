"""Read-only qualification under the caller's existing Organization arbitration."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from django.db.models import QuerySet

from geography.models import Quadrant
from organizations.models import Center, Membership, Organization
from organizations.scope import contains, safe_scope
from people.models import (
    ActionTrainingRequirementVersion,
    Certification,
    CertificationRevocation,
    TrainingVersion,
)
from people.permissions import PeopleContext


@dataclass(frozen=True)
class AssessmentQuery:
    organization: Organization
    subject_id: UUID
    action: str
    context: PeopleContext
    at: datetime
    known_at: datetime


def _requirements(query: AssessmentQuery) -> QuerySet[ActionTrainingRequirementVersion]:
    return ActionTrainingRequirementVersion.objects.filter(
        organization=query.organization,
        action=query.action,
        **query.context.lookups(),
        created_at__lte=query.known_at,
    )


def _version_map(value: object) -> dict[UUID, tuple[UUID, ...]] | None:
    if not isinstance(value, dict) or not value:
        return None
    try:
        result = {
            UUID(key): tuple(UUID(item) for item in values)
            for key, values in value.items()
            if isinstance(key, str)
            and isinstance(values, list)
            and values
            and all(isinstance(item, str) for item in values)
        }
    except (ValueError, TypeError, AttributeError):
        return None
    return result if len(result) == len(value) else None


def _subject_available(query: AssessmentQuery) -> bool:
    if not Center.objects.filter(
        pk=query.context.center_id, organization=query.organization, is_active=True
    ).exists():
        return False
    if (
        query.context.quadrant_id is not None
        and not Quadrant.objects.filter(
            pk=query.context.quadrant_id,
            organization=query.organization,
            center_id=query.context.center_id,
        ).exists()
    ):
        return False
    member = Membership.objects.filter(
        organization=query.organization,
        user_id=query.subject_id,
        is_active=True,
        user__is_active=True,
        organization__is_active=True,
    ).first()
    if member is None:
        return False
    bound = safe_scope(member.scope)
    return contains(bound["centers"], str(query.context.center_id)) and contains(
        bound["quadrants"],
        None if query.context.quadrant_id is None else str(query.context.quadrant_id),
    )


def _certificates(query: AssessmentQuery) -> QuerySet[Certification]:
    revoked = CertificationRevocation.objects.filter(
        organization=query.organization,
        effective_from__lte=query.at,
        created_at__lte=query.known_at,
    ).values("certification_id")
    return (
        Certification.objects.filter(
            organization=query.organization,
            subject_id=query.subject_id,
            **query.context.lookups(),
            created_at__lte=query.known_at,
        )
        .exclude(pk__in=revoked)
        .select_related("training_version")
    )


def _boundary(query: AssessmentQuery, training_ids: tuple[UUID, ...]) -> datetime | None:
    values: list[datetime] = []
    values.extend(
        _requirements(query)
        .filter(effective_from__gt=query.at)
        .values_list("effective_from", flat=True)
    )
    for start, end in (
        _certificates(query)
        .filter(training_version__training_id__in=training_ids)
        .values_list("valid_from", "valid_to")
    ):
        values.extend(value for value in (start, end) if value > query.at)
    values.extend(
        CertificationRevocation.objects.filter(
            organization=query.organization,
            certification__subject_id=query.subject_id,
            **query.context.lookups("certification__"),
            certification__training_version__training_id__in=training_ids,
            created_at__lte=query.known_at,
            effective_from__gt=query.at,
        ).values_list("effective_from", flat=True)
    )
    values.extend(
        TrainingVersion.objects.filter(
            organization=query.organization,
            training_id__in=training_ids,
            created_at__lte=query.known_at,
            effective_from__gt=query.at,
        ).values_list("effective_from", flat=True)
    )
    return min(values) if values else None


def _select_certificates(
    query: AssessmentQuery, expected: dict[UUID, tuple[UUID, ...]]
) -> tuple[list[Certification], list[str]]:
    selected: list[Certification] = []
    blockers: list[str] = []
    for training_id, accepted in expected.items():
        versions = TrainingVersion.objects.filter(
            organization=query.organization,
            training_id=training_id,
            created_at__lte=query.known_at,
        )
        latest = (
            versions.filter(effective_from__lte=query.at)
            .order_by("-effective_from", "-version")
            .first()
        )
        pins = list(versions.filter(pk__in=accepted))
        if (
            latest is None
            or not latest.is_active
            or len(pins) != len(set(accepted))
            or any(
                not pin.is_active
                or not isinstance(pin.enabled_actions, list)
                or query.action not in pin.enabled_actions
                for pin in pins
            )
        ):
            blockers.append("training_configuration_unavailable")
            continue
        certificate = (
            _certificates(query)
            .filter(
                training_version_id__in=accepted,
                training_version__effective_from__lte=query.at,
                valid_from__lte=query.at,
                valid_to__gt=query.at,
            )
            .order_by("-valid_to", "id")
            .first()
        )
        if certificate is None:
            blockers.append("certification_missing_or_expired")
        else:
            selected.append(certificate)
    return selected, blockers


def assess_training_eligibility(query: AssessmentQuery) -> dict[str, Any]:
    """Factual assessment only: an arbitrary retrospective query creates no receipt."""
    if query.at.tzinfo is None or query.known_at.tzinfo is None:
        raise ValueError("Aware assessment clocks required")
    requirement = (
        _requirements(query)
        .filter(effective_from__lte=query.at)
        .order_by("-effective_from", "-revision")
        .first()
    )
    expected = None if requirement is None else _version_map(requirement.acceptable_versions)
    certificates, blockers = (
        ([], ["training_requirements_unavailable"])
        if expected is None
        else _select_certificates(query, expected)
    )
    if not _subject_available(query):
        blockers.append("subject_unavailable")
    next_change = _boundary(query, tuple(() if expected is None else expected))
    eligible = not blockers
    start = (
        max(
            [
                requirement.effective_from,
                *(max(row.valid_from, row.training_version.effective_from) for row in certificates),
            ]
        )
        if eligible and requirement
        else None
    )
    end = (
        min(
            [
                *(row.valid_to for row in certificates),
                *([] if next_change is None else [next_change]),
            ]
        )
        if eligible
        else next_change
    )
    return {
        "subject_id": str(query.subject_id),
        "action": query.action,
        **query.context.payload(),
        "training_eligible": eligible,
        "requirement_version_id": None if requirement is None else str(requirement.pk),
        "certification_ids": [str(row.pk) for row in certificates],
        "training_version_ids": [str(row.training_version_id) for row in certificates],
        "revocation_ids": [
            str(value)
            for value in CertificationRevocation.objects.filter(
                organization=query.organization,
                certification__subject_id=query.subject_id,
                **query.context.lookups("certification__"),
                effective_from__lte=query.at,
                created_at__lte=query.known_at,
            )
            .order_by("pk")
            .values_list("pk", flat=True)
        ],
        "valid_from": None if start is None else start.isoformat(),
        "valid_until": None if end is None else end.isoformat(),
        "next_change_at": None if next_change is None else next_change.isoformat(),
        "blockers": sorted(set(blockers)),
    }
