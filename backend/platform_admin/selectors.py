"""Platform reads. Only organization metadata, centers and admin identities; never business data."""

from dataclasses import dataclass

from django.db.models import Count, IntegerField, OuterRef, QuerySet, Subquery
from django.db.models.functions import Coalesce

from accounts.models import User
from organizations.models import Center, Membership, Organization
from organizations.services import ADMIN_PROFILE_SLUG
from platform_admin.models import PlatformAdmin, PlatformAuditEntry

HISTORY_LIMIT = 50


def is_platform_admin(user: object) -> bool:
    """True only for an active user holding an active platform role."""
    if not getattr(user, "is_authenticated", False) or not getattr(user, "is_active", False):
        return False
    user_id = getattr(user, "pk", None)
    if user_id is None:
        return False
    return PlatformAdmin.objects.filter(user_id=user_id, is_active=True).exists()


def list_organizations() -> QuerySet[Organization]:
    """Every organization with its active member and center counts."""
    # Organization FKs use related_name="+", so the counts are correlated subqueries.
    members = (
        Membership.objects.filter(
            organization_id=OuterRef("pk"), is_active=True, user__is_active=True
        )
        .order_by()
        .values("organization_id")
        .annotate(total=Count("id"))
        .values("total")
    )
    centers = (
        Center.objects.filter(organization_id=OuterRef("pk"), is_active=True)
        .order_by()
        .values("organization_id")
        .annotate(total=Count("id"))
        .values("total")
    )
    return Organization.objects.annotate(
        users_count=Coalesce(Subquery(members, output_field=IntegerField()), 0),
        centers_count=Coalesce(Subquery(centers, output_field=IntegerField()), 0),
    )


def organization_centers(organization: Organization) -> list[Center]:
    return list(Center.objects.filter(organization=organization).order_by("code", "id"))


def organization_admins(organization: Organization) -> list[User]:
    """Users with an active membership that carries the seeded admin profile."""
    user_ids = Membership.objects.filter(
        organization=organization,
        is_active=True,
        profiles__slug=ADMIN_PROFILE_SLUG,
        profiles__organization=organization,
    ).values("user_id")
    return list(User.objects.filter(pk__in=user_ids).order_by("username"))


def organization_history(organization: Organization) -> list[PlatformAuditEntry]:
    return list(
        PlatformAuditEntry.objects.filter(organization=organization)
        .select_related("actor")
        .order_by("-created_at", "-id")[:HISTORY_LIMIT]
    )


@dataclass(frozen=True)
class Availability:
    slug_available: bool | None
    username_available: bool | None


def availability(slug: str | None, username: str | None) -> Availability:
    return Availability(
        slug_available=None if not slug else not Organization.objects.filter(slug=slug).exists(),
        username_available=None
        if not username
        else not User.objects.filter(username__iexact=username).exists(),
    )
