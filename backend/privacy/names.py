"""Read-only display names for the regulatory screens: people are shown by name, never by id."""

from django.db.models import OuterRef, QuerySet, Subquery

from accounts.models import Personnel


def person_name(user_field: str) -> Subquery:
    """Display name of the personnel record of the user stored in `user_field` (same organization)."""
    return Subquery(
        Personnel.objects.filter(
            organization_id=OuterRef("organization_id"),
            membership__user_id=OuterRef(user_field),
        ).values("display_name")[:1]
    )


def with_actor_name(rows: QuerySet) -> QuerySet:
    return rows.annotate(actor_name=person_name("created_by_id"))
