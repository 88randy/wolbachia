"""Supply and location revision writes under the shared organization arbiter."""

from dataclasses import dataclass
from typing import Any, cast
from uuid import UUID

from django.db.models import Model
from django.http import Http404

from core.exceptions import FieldValidationError
from core.models import OrgScopedModel
from inventory.access import require_action, require_scope
from inventory.exceptions import InventoryConflictError
from inventory.models import (
    BiologicalProtocolVersion,
    Location,
    LocationVersion,
    Lot,
    SupplyType,
    SupplyTypeVersion,
)
from inventory.transactions import inventory_transaction
from organizations.models import Center, Membership
from uploads.access import UploadActor


@dataclass(frozen=True)
class MasterChange:
    actor: UploadActor
    values: dict[str, Any]
    identifier: UUID | None = None
    expected_revision: int = 0


def revision_values(record: Model) -> dict[str, Any]:
    """Copy the exact previous immutable snapshot, never a mutable projection."""
    excluded = {"id", "organization", "created_at", "created_by", "revision"}
    return {
        field.attname: getattr(record, field.attname)
        for field in record._meta.fields
        if field.name not in excluded
    }


def require_revision(record: Model | None, expected: int) -> None:
    current = getattr(record, "revision", 0)
    if current != expected:
        raise InventoryConflictError("inventory_revision_conflict", current)


def identity[ModelType: OrgScopedModel](
    model: type[ModelType], command: MasterChange, permission: str
) -> ModelType | None:
    require_action(command.actor, permission)
    if command.identifier is None:
        existing = model.objects.filter(
            organization=command.actor.organization, code=command.values["code"]
        ).first()
        if existing is not None:
            require_scope(command.actor, permission, existing)
            raise FieldValidationError("code", "duplicate_code")
        return None
    record = model.objects.filter(
        organization=command.actor.organization, pk=command.identifier
    ).first()
    if record is None:
        raise Http404
    require_scope(command.actor, permission, record)
    return cast(
        ModelType, model.objects.select_for_update(nowait=True, no_key=True).get(pk=record.pk)
    )


def protocol_values(supply: SupplyTypeVersion) -> dict[str, Any]:
    previous = BiologicalProtocolVersion.objects.filter(supply_version=supply).first()
    return (
        {}
        if previous is None
        else {
            key: value
            for key, value in revision_values(previous).items()
            if key != "supply_version_id"
        }
    )


def revise_supply_type(command: MasterChange) -> SupplyTypeVersion:
    permission = "supply_type.update" if command.identifier else "supply_type.create"
    with inventory_transaction(command.actor):
        target = identity(SupplyType, command, permission)
        previous = target.versions.order_by("-revision").first() if target else None
        require_revision(previous, command.expected_revision)
        _retain_supply_identity(target, previous, command.values)
        protocol = protocol_values(previous) if previous else {}
        protocol.update(command.values.get("protocol", {}))
        values = revision_values(previous) if previous else {}
        values.update(
            {key: value for key, value in command.values.items() if key not in {"code", "protocol"}}
        )
        target = target or SupplyType.objects.create(
            organization=command.actor.organization,
            created_by=command.actor.user,
            code=command.values["code"],
        )
        values.update(supply_type=target, revision=command.expected_revision + 1)
        version = SupplyTypeVersion.objects.create(
            organization=command.actor.organization, created_by=command.actor.user, **values
        )
        if protocol:
            _write_protocol(command.actor, version, protocol)
        return cast(SupplyTypeVersion, version)


def _retain_supply_identity(
    target: SupplyType | None, previous: SupplyTypeVersion | None, values: dict[str, Any]
) -> None:
    if target is None or previous is None:
        return
    if "code" in values and values["code"] != target.code:
        raise InventoryConflictError("inventory_identity_conflict")
    if Lot.objects.filter(supply=target).exists() and any(
        key in values and values[key] != getattr(previous, key)
        for key in ("unit", "identity_kind", "is_biological")
    ):
        raise InventoryConflictError("inventory_has_dependents")


def _write_protocol(actor: UploadActor, supply: SupplyTypeVersion, values: dict[str, Any]) -> None:
    from incidents.models import IncidentTypeVersion
    from inventory.serializers import ProtocolWriteSerializer

    validated = ProtocolWriteSerializer(data=values)
    validated.is_valid(raise_exception=True)
    values = dict(validated.validated_data)

    identifier = values.get("incident_type_id")
    if (
        identifier
        and not IncidentTypeVersion.objects.filter(
            organization=actor.organization, pk=identifier
        ).exists()
    ):
        raise Http404
    BiologicalProtocolVersion.objects.create(
        organization=actor.organization, created_by=actor.user, supply_version=supply, **values
    )


def deactivate_supply_type(command: MasterChange) -> SupplyTypeVersion:
    with inventory_transaction(command.actor):
        target = identity(SupplyType, command, "supply_type.deactivate")
        if target is None:
            raise Http404
        previous = target.versions.order_by("-revision").first()
        if previous is None:
            raise InventoryConflictError("inventory_version_missing")
        if not previous.is_active:
            if not _deactivation_replay(previous, command.expected_revision):
                require_revision(previous, command.expected_revision)
            return cast(SupplyTypeVersion, previous)
        require_revision(previous, command.expected_revision)
        values = revision_values(previous)
        values.update(revision=previous.revision + 1, is_active=False)
        version = SupplyTypeVersion.objects.create(
            organization=command.actor.organization, created_by=command.actor.user, **values
        )
        protocol = protocol_values(previous)
        if protocol:
            _write_protocol(command.actor, version, protocol)
        return cast(SupplyTypeVersion, version)


def _deactivation_replay(previous: SupplyTypeVersion, expected: int) -> bool:
    if expected == previous.revision:
        return True
    return (
        expected == previous.revision - 1
        and SupplyTypeVersion.objects.filter(
            supply_type=previous.supply_type, revision=expected, is_active=True
        ).exists()
    )


def location_relations(command: MasterChange, values: dict[str, Any]) -> tuple[Center, Any]:
    from geography.models import Quadrant

    center = Center.objects.filter(
        organization=command.actor.organization, pk=values["center_id"], is_active=True
    ).first()
    if center is None:
        raise Http404
    require_scope(
        command.actor, "location.update" if command.identifier else "location.create", center
    )
    quadrant = None
    if values.get("quadrant_id"):
        quadrant = Quadrant.objects.filter(
            organization=command.actor.organization, center=center, pk=values["quadrant_id"]
        ).first()
        if quadrant is None:
            raise Http404
        require_scope(
            command.actor, "location.update" if command.identifier else "location.create", quadrant
        )
    return center, quadrant


def _require_location_owner(actor: UploadActor, values: dict[str, Any], target: Location) -> None:
    from organizations.services import effective_scope

    owner = Membership.objects.filter(
        organization=actor.organization, pk=values["owner_id"], is_active=True, user__is_active=True
    ).first()
    if owner is None or not effective_scope(owner).allows(
        "location.read",
        str(target.center_id),
        str(target.quadrant_id) if target.quadrant_id else None,
    ):
        raise Http404


def revise_location(command: MasterChange) -> LocationVersion:
    permission = "location.update" if command.identifier else "location.create"
    with inventory_transaction(command.actor):
        require_action(command.actor, permission)
        placement = (
            location_relations(command, command.values) if command.identifier is None else None
        )
        target = identity(Location, command, permission)
        previous = target.versions.order_by("-revision").first() if target else None
        require_revision(previous, command.expected_revision)
        if target is None:
            if placement is None:
                raise ValueError("A known storage placement is required.")
            center, quadrant = placement
            target = Location.objects.create(
                organization=command.actor.organization,
                created_by=command.actor.user,
                code=command.values["code"],
                center=center,
                quadrant=quadrant,
            )
        scope_values = {"center_id": target.center_id, "quadrant_id": target.quadrant_id}
        scope_values.update(
            {key: value for key, value in command.values.items() if key in scope_values}
        )
        location_relations(command, scope_values)
        _retain_location_identity(target, command.values)
        values = revision_values(previous) if previous else {}
        values.update(
            {
                key: value
                for key, value in command.values.items()
                if key not in {"code", "center_id", "quadrant_id"}
            }
        )
        _require_location_owner(command.actor, values, target)
        values.update(location=target, revision=command.expected_revision + 1)
        return cast(
            LocationVersion,
            LocationVersion.objects.create(
                organization=command.actor.organization, created_by=command.actor.user, **values
            ),
        )


def _retain_location_identity(target: Location, values: dict[str, Any]) -> None:
    for field in ("code", "center_id", "quadrant_id"):
        if field in values and values[field] != getattr(target, field):
            raise InventoryConflictError("inventory_identity_conflict")
