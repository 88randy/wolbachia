"""Minimal action-scoped form options; eligibility precedes SQL count and paging."""

from dataclasses import dataclass
from typing import Any, cast
from uuid import UUID

from django.db.models import (
    Case,
    CharField,
    Exists,
    F,
    OuterRef,
    Q,
    QuerySet,
    UUIDField,
    Value,
    When,
)
from django.db.models.functions import Coalesce, Concat, NullIf, Trim
from django.http import Http404

from geography.models import Quadrant
from incidents.selectors import latest_types
from inventory.access import require_action, require_scope, scoped_inventory
from inventory.models import Location, LocationVersion, Lot, SupplyType
from inventory.selectors import current_lot
from organizations.models import Center, Membership, Profile
from organizations.scope import contains, safe_scope
from uploads.access import UploadActor, current_scope


@dataclass(frozen=True)
class Placement:
    center: Center
    quadrant_id: UUID | None


def active_center(actor: UploadActor, identifier: UUID) -> Center:
    center = Center.objects.filter(
        organization=actor.organization, pk=identifier, is_active=True
    ).first()
    if center is None:
        raise Http404
    return cast(Center, center)


def owner_placement(actor: UploadActor, values: dict[str, Any]) -> Placement:
    permission = "location.update" if "location" in values else "location.create"
    require_action(actor, permission)
    if "location" in values:
        location = Location.objects.filter(
            organization=actor.organization, pk=values["location"]
        ).first()
        if location is None:
            raise Http404
        require_scope(actor, permission, location)
        return Placement(active_center(actor, location.center_id), location.quadrant_id)
    center = active_center(actor, values["center"])
    require_scope(actor, permission, center)
    quadrant_id = values["quadrant"]
    if quadrant_id is not None:
        quadrant = Quadrant.objects.filter(
            organization=actor.organization, center=center, pk=quadrant_id
        ).first()
        if quadrant is None:
            raise Http404
        require_scope(actor, permission, quadrant)
    return Placement(center, quadrant_id)


def _allowed_raw_scopes(query: QuerySet[Any], placement: Placement) -> list[Any]:
    allowed = []
    for raw in query.order_by().values_list("scope", flat=True).distinct():
        scope = safe_scope(raw)
        if contains(scope["centers"], str(placement.center.pk)) and contains(
            scope["quadrants"], str(placement.quadrant_id) if placement.quadrant_id else None
        ):
            allowed.append(raw)
    return allowed


def eligible_location_owners(actor: UploadActor, placement: Placement) -> QuerySet[Membership]:
    """O(D) raw scopes, not a roster; final lazy predicates recheck revocations.

    D can approach N: never cap or broaden the allowed JSON values. A new raw
    scope after discovery can be omitted until refresh; revoked grants cannot qualify.
    """
    members = Membership.objects.filter(
        organization=actor.organization,
        organization__is_active=True,
        is_active=True,
        user__is_active=True,
    )
    profiles = Profile.objects.filter(
        organization=actor.organization,
        is_active=True,
        memberships__in=members,
        permission_codes__contains=["location.read"],
    )
    member_scopes = _allowed_raw_scopes(members, placement)
    profile_scopes = _allowed_raw_scopes(profiles, placement)
    if not member_scopes or not profile_scopes:
        return members.none()
    assigned = Profile.objects.filter(
        organization=actor.organization, is_active=True, memberships__pk=OuterRef("pk")
    )
    return members.filter(
        Exists(
            assigned.filter(permission_codes__contains=["location.read"], scope__in=profile_scopes)
        ),
        ~Exists(assigned.filter(slug="government")),
        scope__in=member_scopes,
    )


def _display_label() -> Coalesce:
    return Coalesce(
        NullIf(Trim(Concat("user__first_name", Value(" "), "user__last_name")), Value("")),
        "user__username",
        output_field=CharField(),
    )


def owner_options(actor: UploadActor, values: dict[str, Any]) -> QuerySet[Any]:
    eligible = eligible_location_owners(actor, owner_placement(actor, values))
    names = eligible.annotate(_name=_display_label())
    duplicates = names.filter(_name=OuterRef("_name")).exclude(pk=OuterRef("pk"))
    query = names.annotate(
        label=Case(
            When(
                Exists(duplicates),
                then=Concat(F("_name"), Value(" ("), "user__username", Value(")")),
            ),
            default=F("_name"),
            output_field=CharField(),
        )
    )
    query = query.filter(label__icontains=values.get("search", ""))
    return query.order_by(values.get("ordering", "label"), "pk")


def protocol_type_options(actor: UploadActor, values: dict[str, Any]) -> QuerySet[Any]:
    permission = "supply_type.update" if "supply" in values else "supply_type.create"
    require_action(actor, permission)
    if "supply" in values:
        supply = SupplyType.objects.filter(
            organization=actor.organization, pk=values["supply"]
        ).first()
        if supply is None:
            raise Http404
        require_scope(actor, permission, supply)
    search = values.get("search", "")
    return (
        latest_types(actor.organization)
        .filter(is_active=True, item__is_active=True)
        .filter(Q(code__icontains=search) | Q(label__icontains=search))
        .order_by("code", "id")
    )


CHOICE_FIELDS = ("kind", "quadrant_id", "choice_code", "location_id", "is_read_only", "choice_id")


def _center_choice(actor: UploadActor, placement: Placement, permission: str) -> QuerySet[Any]:
    query = Center.objects.filter(pk=placement.center.pk, is_active=True)
    if not current_scope(actor).allows(permission, str(placement.center.pk), None):
        query = query.none()
    kind = "center_only" if permission == "location.create" else "center_only_draft"
    result = (
        query.order_by()
        .annotate(
            kind=Value(kind),
            quadrant_id=Value(None, UUIDField()),
            choice_code=Value(None, CharField()),
            location_id=Value(None, UUIDField()),
            is_read_only=Value(False),
            choice_id=F("pk"),
        )
        .values(*CHOICE_FIELDS)
    )
    return cast(QuerySet[Any], result)


def _location_choices(
    query: QuerySet[Any], search: str, *, is_read_only: bool = False
) -> QuerySet[Any]:
    result = (
        query.filter(code__icontains=search)
        .order_by()
        .annotate(
            kind=Value("location"),
            choice_code=F("code"),
            location_id=F("pk"),
            is_read_only=Value(is_read_only),
            choice_id=F("pk"),
        )
        .values(*CHOICE_FIELDS)
    )
    return cast(QuerySet[Any], result)


def placement_options(actor: UploadActor, values: dict[str, Any]) -> QuerySet[Any]:
    if "lot" in values:
        return _lot_update_options(actor, values)
    permission = values["action"]
    require_action(actor, permission)
    center = active_center(actor, values["center"])
    require_scope(actor, permission, center)
    placement = Placement(center, None)
    search = values.get("search", "")
    explicit = _center_choice(actor, placement, permission)
    if search:
        explicit = explicit.none()
    if permission == "location.create":
        from organizations.selectors import filter_by_effective_scope

        members = actor.user.memberships.get(organization=actor.organization, is_active=True)
        query = filter_by_effective_scope(
            Quadrant.objects.filter(organization=actor.organization, center=center),
            members,
            permission,
        )
        choices = (
            query.filter(code__icontains=search)
            .order_by()
            .annotate(
                kind=Value("quadrant"),
                quadrant_id=F("pk"),
                choice_code=F("code"),
                location_id=Value(None, UUIDField()),
                is_read_only=Value(False),
                choice_id=F("pk"),
            )
            .values(*CHOICE_FIELDS)
        )
    else:
        query = scoped_inventory(Location.objects.filter(center=center), actor, permission)
        choices = _location_choices(query, search)
    return cast(QuerySet[Any], choices.union(explicit).order_by("kind", "choice_code", "choice_id"))


def _lot_update_options(actor: UploadActor, values: dict[str, Any]) -> QuerySet[Any]:
    require_action(actor, "lot.update")
    lot = scoped_inventory(Lot.objects.filter(pk=values["lot"]), actor, "lot.update").first()
    if lot is None:
        raise Http404
    center = active_center(actor, lot.center_id)
    version = current_lot(lot)
    admission = getattr(lot, "admission", None)
    search = values.get("search", "")
    if admission is not None:
        # Identity/code are immutable; resolve only the exact retained location FK.
        retained = (
            LocationVersion.objects.filter(
                organization=actor.organization,
                pk__in=[version.location_version_id] if version.location_version_id else [],
                location__code__icontains=search,
            )
            .order_by()
            .values("id")
            .annotate(
                kind=Value("location"),
                quadrant_id=F("location__quadrant_id"),
                choice_code=F("location__code"),
                is_read_only=Value(True),
                choice_id=F("pk"),
            )
            .values(*CHOICE_FIELDS)
            .order_by("kind", "choice_code", "choice_id")
        )
        return cast(QuerySet[Any], retained)
    query = scoped_inventory(
        Location.objects.filter(center=center, quadrant_id=lot.quadrant_id), actor, "lot.update"
    )
    choices = _location_choices(query, search)
    if lot.quadrant_id is None and not search:
        choices = choices.union(_center_choice(actor, Placement(center, None), "lot.update"))
    return choices.order_by("kind", "choice_code", "choice_id")
