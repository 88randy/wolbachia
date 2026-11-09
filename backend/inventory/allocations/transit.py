"""Named authored configuration, never a seeded biological recipe or certification."""

from typing import Any

from django.http import Http404

from inventory.access import require_scope
from inventory.allocations.commands import ConfigurationWrite
from inventory.allocations.models import (
    CourierTransitPolicyVersion,
    SupplyMaterialMappingVersion,
    SupplyReceiptLine,
)
from inventory.exceptions import InventoryConflictError
from inventory.models import SupplyType, SupplyTypeVersion
from inventory.transactions import inventory_transaction
from inventory.transfers.policy import stock_quantity
from uploads.access import UploadActor


def publish_transit_configuration(
    command: ConfigurationWrite,
) -> CourierTransitPolicyVersion | SupplyMaterialMappingVersion:
    actor, supply_id, values = command.actor, command.supply_id, command.values
    supply = SupplyType.objects.filter(organization=actor.organization, pk=supply_id).first()
    if supply is None:
        raise Http404
    require_scope(actor, "supply_type.update", supply)
    with inventory_transaction(actor):
        require_scope(actor, "supply_type.update", supply)
        unit = SupplyTypeVersion.objects.filter(
            organization=actor.organization, supply_type=supply, pk=values["supply_version_id"]
        ).first()
        if unit is None:
            raise Http404
        if command.mapping:
            return _publish_mapping(actor, unit, values)
        return _publish_policy(actor, unit, values)


def _publish_mapping(
    actor: UploadActor, unit: SupplyTypeVersion, values: dict[str, Any]
) -> SupplyMaterialMappingVersion:
    old = SupplyMaterialMappingVersion.objects.filter(
        supply_version=unit, action=values["action"]
    ).first()
    _configuration_cas(old, values["expected_revision"])
    return SupplyMaterialMappingVersion.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        supply_version=unit,
        revision=1 if old is None else old.revision + 1,
        action=values["action"],
        quantity=stock_quantity(values["quantity"]),
        reference=values["reference"],
        is_active=values["is_active"],
    )


def _publish_policy(
    actor: UploadActor, unit: SupplyTypeVersion, values: dict[str, Any]
) -> CourierTransitPolicyVersion:
    old = CourierTransitPolicyVersion.objects.filter(supply_version=unit).first()
    _configuration_cas(old, values["expected_revision"])
    return CourierTransitPolicyVersion.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        supply_version=unit,
        revision=1 if old is None else old.revision + 1,
        name=values["name"],
        procedure=values["procedure"],
        reference=values["reference"],
        mode=values["mode"],
        proof_roles=values["proof_roles"],
        is_active=values["is_active"],
    )


def _configuration_cas(old: Any, expected: int) -> None:  # noqa: ANN401 -- two real immutable configuration models
    revision = 0 if old is None else old.revision
    if expected != revision:
        raise InventoryConflictError("supply_configuration_conflict", revision)


def require_transit_use(
    line: SupplyReceiptLine, values: dict[str, Any]
) -> tuple[CourierTransitPolicyVersion, dict[str, Any]]:
    from core.time import server_now
    from field_sync.exceptions import EventNeedsReview
    from inventory.policy import LotSafetySnapshot, evaluate_transit_lot
    from inventory.selectors import (
        current_lot,
        current_supply,
        missing_fields,
        protocol_ready,
        unresolved_breaches,
    )
    from inventory.transfers.models import TransferHold

    release_line = line.release_line
    unit = release_line.line.unit_version
    policy = CourierTransitPolicyVersion.objects.filter(
        organization=line.organization, supply_version=unit, pk=values["transit_policy_id"]
    ).first()
    latest = CourierTransitPolicyVersion.objects.filter(supply_version=unit).first()
    if (
        policy is None
        or latest is None
        or latest.pk != policy.pk
        or not policy.is_active
        or policy.mode != "manual_evidence_review"
        or release_line.transit_policy_id != policy.pk
        or not values["transit_evidence_ids"]
    ):
        raise EventNeedsReview("supply_transit_unavailable")
    version = current_lot(release_line.line.lot)
    holds = TransferHold.objects.filter(
        lot=version.lot,
        location=release_line.release.version.assignment.origin,
        resolution__isnull=True,
    )
    snapshot = LotSafetySnapshot(
        unit.is_biological,
        current_supply(version.lot.supply).is_active,
        missing_fields(version),
        version.expires_at,
        protocol_ready(version.protocol),
        None,
        None,
        frozenset(),
        tuple(str(pk) for pk in unresolved_breaches(version.lot).values_list("pk", flat=True)),
        tuple(str(pk) for pk in holds.values_list("pk", flat=True)),
    )
    safety = evaluate_transit_lot(snapshot, server_now())
    if safety.status != "available":
        raise EventNeedsReview("supply_transit_unavailable")
    return policy, {
        "policy_id": str(policy.pk),
        "release_line_id": str(release_line.pk),
        "release_manifest_hash": release_line.release.manifest_hash,
        "evidence_ids": [str(identifier) for identifier in values["transit_evidence_ids"]],
        "lot_version_id": str(version.pk),
        "mode": policy.mode,
    }
