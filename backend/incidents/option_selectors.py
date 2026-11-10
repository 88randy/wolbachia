"""Action-paired incident options, with complete eligibility before count/page."""

from typing import Any, cast

from django.db.models import CharField, Exists, F, OuterRef, Q, QuerySet, UUIDField, Value
from django.db.models.functions import Coalesce, Concat, NullIf, Trim
from django.http import Http404

from field_sync.selectors import captured_scope, membership_snapshots
from geography.models import Quadrant
from incidents.configuration import eligible_configuration_scope
from incidents.models import Incident
from incidents.selectors import ResourceContext, require_context
from organizations.models import Center, Membership, Profile
from organizations.scope import contains, safe_scope
from organizations.selectors import filter_by_scope
from organizations.services import ADMINISTRATION_PERMISSIONS
from uploads.access import UploadActor, current_scope

CONTEXT_FIELDS = (
    "center_id",
    "center_code",
    "center_name",
    "quadrant_id",
    "quadrant_code",
    "choice_id",
)


def context_options(actor: UploadActor, values: dict[str, Any]) -> QuerySet[Any]:
    permission = "incident.create" if values["action"] == "create" else "incident.read"
    scope = current_scope(actor)
    centers = filter_by_scope(
        Center.objects.filter(organization=actor.organization), scope, permission
    )
    quadrants = filter_by_scope(
        Quadrant.objects.filter(organization=actor.organization), scope, permission
    )
    if "center" in values:
        if not centers.filter(pk=values["center"]).exists():
            raise Http404
        centers = centers.filter(pk=values["center"])
        quadrants = quadrants.filter(center_id=values["center"])
    search = values.get("search", "")
    center_rows = (
        centers.filter(Q(code__icontains=search) | Q(name__icontains=search))
        .order_by()
        .annotate(
            center_id=F("pk"),
            center_code=F("code"),
            center_name=F("name"),
            quadrant_id=Value(None, UUIDField()),
            quadrant_code=Value(None, CharField()),
            choice_id=F("pk"),
        )
        .values(*CONTEXT_FIELDS)
    )
    quadrant_rows = (
        quadrants.filter(
            Q(code__icontains=search)
            | Q(center__name__icontains=search)
            | Q(center__code__icontains=search)
        )
        .order_by()
        .annotate(
            center_code=F("center__code"),
            center_name=F("center__name"),
            quadrant_id=F("pk"),
            quadrant_code=F("code"),
            choice_id=F("pk"),
        )
        .values(*CONTEXT_FIELDS)
    )
    return cast(
        QuerySet[Any],
        center_rows.union(quadrant_rows).order_by("center_code", "quadrant_code", "choice_id"),
    )


def _allowed_scopes(query: QuerySet[Any], context: ResourceContext) -> list[Any]:
    allowed = []
    for raw in query.order_by().values_list("scope", flat=True).distinct():
        normalized = safe_scope(raw)
        if contains(normalized["centers"], str(context.center_id)) and contains(
            normalized["quadrants"], str(context.quadrant_id) if context.quadrant_id else None
        ):
            allowed.append(raw)
    return allowed


def eligible_owners(actor: UploadActor, incident: Incident) -> QuerySet[Membership]:
    """Mirror eligible_owner: independent whole-pair read/close; terminal codes are a union.

    Discover raw JSON only (O(distinct scopes)); the final query rechecks each current
    active relationship. New raw scopes may be omitted until refresh, never broadened.
    """
    context = ResourceContext(incident.center_id, incident.quadrant_id)
    require_context(current_scope(actor), "incident.reassign", context)
    members = Membership.objects.filter(
        organization=actor.organization,
        organization__is_active=True,
        is_active=True,
        user__is_active=True,
    )
    profiles = Profile.objects.filter(
        organization=actor.organization, is_active=True, memberships__in=members
    )
    member_scopes = _allowed_scopes(members, context)
    assigned = Profile.objects.filter(
        organization=actor.organization, is_active=True, memberships__pk=OuterRef("pk")
    )
    query = members.filter(~Exists(assigned.filter(slug="government")), scope__in=member_scopes)
    for permission in ("incident.read", "incident.close"):
        raw = _allowed_scopes(profiles.filter(permission_codes__contains=[permission]), context)
        query = query.filter(
            Exists(assigned.filter(permission_codes__contains=[permission], scope__in=raw))
        )
    if incident.stage == 2:  # type: ignore[attr-defined]  # scoped current event annotation
        for permission in sorted(ADMINISTRATION_PERMISSIONS):
            query = query.filter(Exists(assigned.filter(permission_codes__contains=[permission])))
    return query


def owner_options(actor: UploadActor, incident: Incident, search: str) -> QuerySet[Any]:
    return (
        eligible_owners(actor, incident)
        .annotate(
            label=Coalesce(
                NullIf(Trim(Concat("user__first_name", Value(" "), "user__last_name")), Value("")),
                "user__username",
                output_field=CharField(),
            )
        )
        .filter(label__icontains=search)
        .order_by("label", "pk")
    )


def configuration_owner_options(actor: UploadActor, values: dict[str, Any]) -> list[dict[str, Any]]:
    """Resolve eligible names from one current membership/profile snapshot before paging."""
    members = (
        membership_snapshots(actor.organization)
        .annotate(
            label=Coalesce(
                NullIf(Trim(Concat("user__first_name", Value(" "), "user__last_name")), Value("")),
                "user__username",
                output_field=CharField(),
            )
        )
        .filter(label__icontains=values.get("search", ""))
        .order_by("label", "pk")
    )
    if "membership_id" in values:
        members = members.filter(pk=values["membership_id"])
    rows = []
    for member in members:
        scope = captured_scope(member)
        if eligible_configuration_scope(scope):
            rows.append(
                {
                    "membership_id": member.pk,
                    "label": str(member.label),
                    "is_terminal_eligible": eligible_configuration_scope(scope, terminal=True),
                }
            )
    return rows
