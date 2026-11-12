"""Personnel projections contain only work facts and explicitly authorized training summaries."""

from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any

from django.db.models import Prefetch, QuerySet

from accounts.models import AccessLog, Device, Personnel
from accounts.personnel_serializers import AccessLogFilterSerializer
from core.time import server_now
from organizations.models import Membership
from organizations.services import effective_scope


def scoped_personnel(membership: Membership, permission: str) -> QuerySet[Personnel]:
    """Apply one paired grant to each real personnel context, before paging or counting."""
    from people.selectors import scoped_facts

    return (
        scoped_facts(
            Personnel.objects.filter(organization_id=membership.organization_id),
            effective_scope(membership),
            permission,
        )
        .select_related("membership__user", "center", "quadrant")
        .order_by("display_name", "id")
    )


def operational_projections(
    people: Sequence[Personnel], viewer: Membership
) -> list[dict[str, Any]]:
    """DP03 allowlist for a page of people: no identity credentials, RFC metadata, evaluations or
    issuer proof. Certifications, revocations, profiles and devices load once for the page."""
    from people.models import Certification, CertificationRevocation
    from people.selectors import scoped_facts

    if not people:
        return []
    user_ids = {person.membership.user_id for person in people}
    at = server_now()
    certifications = (
        scoped_facts(
            Certification.objects.filter(
                organization=viewer.organization,
                subject_id__in=user_ids,
                center_id__in={person.center_id for person in people},
            ),
            effective_scope(viewer),
            "training.read",
        )
        .select_related("training_version__training")
        .prefetch_related(
            Prefetch(
                "revocations",
                queryset=CertificationRevocation.objects.filter(effective_from__lte=at),
                to_attr="revoked_by_now",
            )
        )
    )
    by_context: dict[tuple[Any, Any, Any], list[Certification]] = defaultdict(list)
    for row in certifications:
        by_context[(row.subject_id, row.center_id, row.quadrant_id)].append(row)
    profiles: dict[Any, list[str]] = defaultdict(list)
    for user_id, slug in (
        Membership.profiles.through.objects.filter(
            membership__organization=viewer.organization,
            membership__user_id__in=user_ids,
            profile__organization=viewer.organization,
            profile__is_active=True,
        )
        .order_by("profile__slug")
        .values_list("membership__user_id", "profile__slug")
    ):
        profiles[user_id].append(slug)
    devices: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    for user_id, device_id, label in (
        Device.objects.filter(
            organization=viewer.organization,
            sessions__user_id__in=user_ids,
            sessions__revoked_at__isnull=True,
            is_revoked=False,
        )
        .order_by("id")
        .values_list("sessions__user_id", "id", "label")
        .distinct()
    ):
        devices[user_id].append({"id": device_id, "label": label})
    return [
        {
            "id": person.membership.user_id,
            "display_name": person.display_name,
            "center_id": person.center_id,
            "quadrant_id": person.quadrant_id,
            "work_email": person.work_email,
            "work_phone": person.work_phone,
            "is_active": person.membership.is_active,
            "profiles": profiles[person.membership.user_id],
            "trainings": [
                {
                    "training_code": row.training_version.training.code,
                    "valid_from": row.valid_from,
                    "valid_to": row.valid_to,
                    "is_revoked": bool(getattr(row, "revoked_by_now", [])),
                }
                for row in by_context[
                    (person.membership.user_id, person.center_id, person.quadrant_id)
                ]
            ],
            "devices": devices[person.membership.user_id],
        }
        for person in people
    ]


def scoped_access_log(membership: Membership) -> QuerySet[AccessLog]:
    from people.selectors import scoped_facts

    return scoped_facts(
        AccessLog.objects.filter(organization_id=membership.organization_id),
        effective_scope(membership),
        "access_log.read",
    ).order_by("-created_at", "-id")


def filter_access_log(rows: QuerySet[AccessLog], params: Mapping[str, str]) -> QuerySet[AccessLog]:
    """Optional `action`, `result`, `actor_id`, `created_after`, `created_before` filters (W60)."""
    for key, lookup in (
        ("action", "action"),
        ("result", "result"),
        ("actor_id", "created_by_id"),
        ("created_after", "created_at__gte"),
        ("created_before", "created_at__lt"),
    ):
        value = params.get(key)
        if not value:
            continue
        serializer = AccessLogFilterSerializer(data={key: value})
        serializer.is_valid(raise_exception=True)
        rows = rows.filter(**{lookup: serializer.validated_data[key]})
    return rows
