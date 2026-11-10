"""Personnel projections contain only work facts and explicitly authorized training summaries."""

from typing import Any

from django.db.models import QuerySet

from accounts.models import AccessLog, Device, Personnel
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


def operational_projection(person: Personnel, viewer: Membership) -> dict[str, Any]:
    """DP03 allowlist: no identity credentials, RFC metadata, evaluations or issuer proof."""
    from people.models import Certification
    from people.selectors import scoped_facts

    certifications = scoped_facts(
        Certification.objects.filter(
            organization=viewer.organization,
            subject_id=person.membership.user_id,
            center_id=person.center_id,
            quadrant=person.quadrant,
        ),
        effective_scope(viewer),
        "training.read",
    ).select_related("training_version__training")
    at = server_now()
    return {
        "id": person.membership.user_id,
        "display_name": person.display_name,
        "center_id": person.center_id,
        "quadrant_id": person.quadrant_id,
        "work_email": person.work_email,
        "work_phone": person.work_phone,
        "is_active": person.membership.is_active,
        "profiles": list(
            person.membership.profiles.filter(organization=viewer.organization, is_active=True)
            .order_by("slug")
            .values_list("slug", flat=True)
        ),
        "trainings": [
            {
                "training_code": row.training_version.training.code,
                "valid_from": row.valid_from,
                "valid_to": row.valid_to,
                "is_revoked": row.revocations.filter(effective_from__lte=at).exists(),
            }
            for row in certifications
        ],
        "devices": list(
            Device.objects.filter(
                organization=viewer.organization,
                sessions__user_id=person.membership.user_id,
                sessions__revoked_at__isnull=True,
                is_revoked=False,
            )
            .order_by("id")
            .values("id", "label")
            .distinct()
        ),
    }


def scoped_access_log(membership: Membership) -> QuerySet[AccessLog]:
    from people.selectors import scoped_facts

    return scoped_facts(
        AccessLog.objects.filter(organization_id=membership.organization_id),
        effective_scope(membership),
        "access_log.read",
    ).order_by("-created_at", "-id")
