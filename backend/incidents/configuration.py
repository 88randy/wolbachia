"""Named chain configuration and guards serialized by Organization, without late User locks."""

from typing import Any
from uuid import UUID

from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from catalogs.models import Catalog, CatalogItem
from catalogs.services import CatalogItemSpec, create_catalog_item
from core.exceptions import FieldValidationError
from field_sync.selectors import captured_scope, membership_snapshots
from incidents.exceptions import IncidentConfigurationUnavailableError, IncidentConflictError
from incidents.models import IncidentTypeVersion
from incidents.permissions import INCIDENT_CLOSE, INCIDENT_MANAGE_TYPE, INCIDENT_READ
from incidents.selectors import ResourceContext, latest_types, projected_incidents
from organizations.models import Membership, Organization
from organizations.scope import EffectiveScope, intersect
from organizations.services import ADMINISTRATION_PERMISSIONS
from uploads.access import UploadActor, current_scope


def eligible_owner(  # noqa: PLR0913 -- identity, tenant, paired scope and terminal capability
    identifier: UUID | None,
    organization: Organization,
    context: ResourceContext | None,
    *,
    terminal: bool = False,
) -> Membership | None:
    if identifier is None:
        return None
    member = membership_snapshots(organization).filter(pk=identifier, user__is_active=True).first()
    if member is None:
        return None
    scope = captured_scope(member)
    if context is None:
        return member if eligible_configuration_scope(scope, terminal=terminal) else None
    center = str(context.center_id) if context else None
    quadrant = str(context.quadrant_id) if context and context.quadrant_id else None
    if not all(scope.allows(code, center, quadrant) for code in (INCIDENT_READ, INCIDENT_CLOSE)):
        return None
    if terminal and not scope.permissions >= ADMINISTRATION_PERMISSIONS:
        return None
    return member


def eligible_configuration_scope(scope: EffectiveScope, *, terminal: bool = False) -> bool:
    """Configuration options and writes share the exact current named-owner predicate."""
    return (
        _potential_center_scope(scope)
        and scope.permissions >= {INCIDENT_READ, INCIDENT_CLOSE}
        and (not terminal or scope.permissions >= ADMINISTRATION_PERMISSIONS)
    )


def _potential_center_scope(scope: EffectiveScope) -> bool:
    """A global named terminal needs some possible shared center; none is never a roster."""
    reads = [grant["centers"] for codes, grant in scope.grants if INCIDENT_READ in codes]
    closes = [grant["centers"] for codes, grant in scope.grants if INCIDENT_CLOSE in codes]
    return any(
        common["mode"] == "all" or bool(common["ids"])
        for read in reads
        for close in closes
        if (common := intersect(read, close))
    )


def chain(
    version: IncidentTypeVersion, context: ResourceContext
) -> tuple[Membership | None, Membership | None, Membership]:
    terminal = eligible_owner(version.terminal_id, version.organization, context, terminal=True)
    if terminal is None:
        raise IncidentConfigurationUnavailableError
    return (
        eligible_owner(version.supervisor_id, version.organization, context),
        eligible_owner(version.coordinator_id, version.organization, context),
        terminal,
    )


def preserve_terminal_owners(organization: Organization) -> None:
    """Called after configuration edits inside their existing Org transaction; raises to roll back."""
    for version in latest_types(organization).filter(is_active=True):
        if eligible_owner(version.terminal_id, organization, None, terminal=True) is None:
            raise IncidentConflictError("terminal_owner_dependency")
    for incident in (
        projected_incidents(organization).filter(state="open").select_related("type_version")
    ):
        context = ResourceContext(incident.center_id, incident.quadrant_id)
        terminal_id = (
            incident.owner_id if incident.stage == 2 else incident.type_version.terminal_id
        )
        if eligible_owner(terminal_id, organization, context, terminal=True) is None:
            raise IncidentConflictError("terminal_owner_dependency")


def write_type(
    actor: UploadActor, data: dict[str, Any], item_id: UUID | None = None
) -> IncidentTypeVersion:
    from incidents.transactions import incident_transaction

    with incident_transaction(actor):
        if not current_scope(actor).allows(INCIDENT_MANAGE_TYPE):
            raise PermissionDenied
        catalog = (
            Catalog.objects.select_for_update(nowait=True, no_key=True)
            .filter(organization=actor.organization, slug="incident-type")
            .first()
        )
        if catalog is None:
            raise IncidentConfigurationUnavailableError
        if item_id:
            item = (
                CatalogItem.objects.select_for_update(nowait=True, no_key=True)
                .filter(catalog=catalog, pk=item_id)
                .first()
            )
            if item is None:
                raise Http404
        else:
            item = create_catalog_item(
                catalog,
                CatalogItemSpec(
                    code=data["code"], label_es=data["label"], icon=data.get("icon", "")
                ),
                actor.user,
            )
        previous = IncidentTypeVersion.objects.filter(item=item).order_by("-revision").first()
        revision = previous.revision if previous else 0
        if data.get("expected_revision", 0) != revision:
            raise IncidentConflictError("revision", revision)
        values = {
            name: data[name] if name in data else getattr(previous, name)
            for name in (
                "severity",
                "supervisor_id",
                "coordinator_id",
                "terminal_id",
                "supervisor_sla_seconds",
                "coordinator_sla_seconds",
                "report_evidence_min",
                "close_evidence_min",
                "blocker_kinds",
                "is_active",
            )
            if name in data or previous is not None
        }
        if (
            not {"terminal_id", "supervisor_sla_seconds", "coordinator_sla_seconds", "severity"}
            <= values.keys()
        ):
            raise IncidentConfigurationUnavailableError
        if not Membership.objects.filter(
            organization=actor.organization, pk=values["terminal_id"]
        ).exists():
            raise Http404
        if eligible_owner(values["terminal_id"], actor.organization, None, terminal=True) is None:
            raise IncidentConfigurationUnavailableError
        _validate_type(actor, item, values, data)
        return IncidentTypeVersion.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            item=item,
            revision=revision + 1,
            code=item.code,
            label=data.get("label", previous.label if previous else item.label_es),
            icon=data.get("icon", previous.icon if previous else item.icon),
            is_other=item.is_other,
            **values,
        )


def _validate_type(  # noqa: PLR0913 -- current identity, stable item and proposed configuration/metadata
    actor: UploadActor, item: CatalogItem, values: dict[str, Any], data: dict[str, Any]
) -> None:
    validate_unique_blocker_kinds(values.get("blocker_kinds", []))
    for name in ("supervisor_id", "coordinator_id"):
        if not values.get(name):
            continue
        if not Membership.objects.filter(organization=actor.organization, pk=values[name]).exists():
            raise Http404
        if name in data and eligible_owner(values[name], actor.organization, None) is None:
            raise IncidentConfigurationUnavailableError
    if item.is_other and (not values.get("is_active", True) or "label" in data or "icon" in data):
        raise IncidentConflictError("protected_other")
    if item.code == "emergency-accident" and values["severity"] != "critical":
        raise IncidentConflictError("critical_type")


def validate_unique_blocker_kinds(value: list[str]) -> list[str]:
    """Reject ambiguous configuration before any immutable type version can retain it."""
    if len(value) != len(set(value)):
        raise FieldValidationError("blocker_kinds", "duplicate_blocker_kind")
    return value
