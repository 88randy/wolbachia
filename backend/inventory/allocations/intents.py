"""Authentic prepared HTTP evidence parents; preparation has zero operational effects."""

from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid4

from django.http import Http404

from core.snapshots import snapshot_hash
from inventory.allocations.commands import IntentExecution, SupplyOutcome
from inventory.allocations.models import (
    InventoryIntent,
    InventoryIntentExecution,
    OriginReleaseProof,
    Reconciliation,
    ReturnDeclaration,
)
from inventory.allocations.permissions import ALLOCATE, BAG_DISPOSE, RECONCILE, WRITE_OFF
from inventory.allocations.scope import (
    assignment_contexts,
    location_context,
    require_assignment,
    require_contexts,
    require_current_courier,
)
from inventory.allocations.transactions import (
    SupplyParticipants,
    assignment_participants,
    supply_transaction,
)
from inventory.exceptions import InventoryConflictError
from inventory.models import Location, Lot, Piece, SupplyTypeVersion
from inventory.transfers.policy import json_facts
from uploads.access import UploadActor

KIND_PERMISSION = {
    "assignment_release": ALLOCATE,
    "release_cancel": ALLOCATE,
    "return_accept": RECONCILE,
    "reconcile_justify": RECONCILE,
    "lot_write_off": WRITE_OFF,
    "bag_disposal": BAG_DISPOSE,
}


@dataclass(frozen=True)
class IntentSubjects:
    fields: dict[str, Any]
    contexts: list[dict[str, Any]]
    participants: SupplyParticipants


def prepare_inventory_intent(actor: UploadActor, values: dict[str, Any]) -> SupplyOutcome:
    subjects = intent_subjects(actor, values)
    with supply_transaction(actor, subjects.participants):
        current = intent_subjects(actor, values)
        if current.participants != subjects.participants:
            from inventory.exceptions import InventoryInProgressError

            raise InventoryInProgressError
        subjects = current
        canonical = json_facts(values)
        digest = snapshot_hash(canonical)
        old = InventoryIntent.objects.filter(
            organization=actor.organization, command_id=values["command_id"]
        ).first()
        if old is not None:
            authorize_intent(actor, old)
            if old.created_by_id != actor.user.pk or old.input_hash != digest:
                raise InventoryConflictError("supply_command_conflict")
            return SupplyOutcome(201, old.prepared_response, True)
        identifier = uuid4()
        response = {
            "intent": {
                "id": str(identifier),
                "kind": values["kind"],
                "expected_revision": values["expected_revision"],
                "input_hash": digest,
                "evidence": canonical.get("evidence", []),
            }
        }
        InventoryIntent.objects.create(
            id=identifier,
            organization=actor.organization,
            created_by=actor.user,
            command_id=values["command_id"],
            kind=values["kind"],
            expected_revision=values["expected_revision"],
            canonical_input=canonical,
            input_hash=digest,
            declared_evidence=canonical.get("evidence", []),
            prepared_response=response,
            **subjects.fields,
        )
        return SupplyOutcome(201, response)


def intent_subjects(actor: UploadActor, values: dict[str, Any]) -> IntentSubjects:
    kind = values["kind"]
    permission = KIND_PERMISSION.get(kind)
    if permission is None:
        raise Http404
    if kind == "bag_disposal":
        from inventory.allocations.bag_dependencies import bag_intent_subjects

        return bag_intent_subjects(actor, values)
    if kind == "lot_write_off":
        return _lot_subjects(actor, values)
    return _assignment_subjects(actor, values, permission)


def _assignment_subjects(
    actor: UploadActor, values: dict[str, Any], permission: str
) -> IntentSubjects:
    fields: dict[str, Any] = {}
    if values["kind"] == "release_cancel":
        release = (
            OriginReleaseProof.objects.filter(
                organization=actor.organization, pk=values["release_id"]
            )
            .select_related("version")
            .first()
        )
        if release is None:
            raise Http404
        fields["release"] = release
        assignment_id = release.version.assignment_id
    elif values["kind"] == "return_accept":
        declaration = (
            ReturnDeclaration.objects.filter(
                organization=actor.organization, pk=values["declaration_id"]
            )
            .select_related("event", "destination")
            .first()
        )
        if declaration is None:
            raise Http404
        fields["declaration"] = declaration
        assignment_id = declaration.event.assignment_id
    elif values["kind"] == "reconcile_justify":
        reconciliation = Reconciliation.objects.filter(
            organization=actor.organization, pk=values["reconciliation_id"]
        ).first()
        if reconciliation is None:
            raise Http404
        fields["reconciliation"] = reconciliation
        assignment_id = reconciliation.assignment_id
    else:
        assignment_id = values["assignment_id"]
    assignment = require_assignment(actor, assignment_id, permission)
    fields["assignment"] = assignment
    contexts = assignment_contexts(assignment)
    if "declaration" in fields:
        contexts.append(location_context(fields["declaration"].destination))
    require_contexts(actor, permission, contexts)
    if values["kind"] == "assignment_release":
        require_current_courier(assignment.courier, actor.organization, contexts)
    return IntentSubjects(fields, contexts, assignment_participants(assignment))


def _lot_subjects(actor: UploadActor, values: dict[str, Any]) -> IntentSubjects:
    lot = Lot.objects.filter(organization=actor.organization, pk=values["lot_id"]).first()
    location = Location.objects.filter(
        organization=actor.organization, pk=values["location_id"]
    ).first()
    unit = SupplyTypeVersion.objects.filter(
        organization=actor.organization, pk=values["unit_version_id"]
    ).first()
    piece = (
        None
        if values.get("piece_id") is None
        else Piece.objects.filter(
            organization=actor.organization, lot=lot, pk=values["piece_id"]
        ).first()
    )
    if lot is None or location is None or unit is None or unit.supply_type_id != lot.supply_id:
        raise Http404
    if values.get("piece_id") is not None and piece is None:
        raise Http404
    from organizations.models import Membership

    owner = (
        Membership.objects.filter(
            organization=actor.organization,
            user_id=values["owner_id"],
            is_active=True,
            user__is_active=True,
        )
        .select_related("user")
        .first()
    )
    if owner is None:
        raise Http404
    contexts = [location_context(location)]
    require_contexts(actor, WRITE_OFF, contexts)
    require_contexts(UploadActor(owner.user, actor.organization), WRITE_OFF, contexts)
    fields = {"lot": lot, "location": location, "unit_version": unit, "piece": piece}
    return IntentSubjects(fields, contexts, SupplyParticipants(users=(owner.user_id,)))


def authorize_intent(actor: UploadActor, intent: InventoryIntent) -> IntentSubjects:
    if intent.organization_id != actor.organization.pk or intent.created_by_id != actor.user.pk:
        raise Http404
    return intent_subjects(actor, intent.canonical_input)


def get_inventory_intent(actor: UploadActor, identifier: UUID) -> SupplyOutcome:
    intent = InventoryIntent.objects.filter(organization=actor.organization, pk=identifier).first()
    if intent is None:
        raise Http404
    authorize_intent(actor, intent)
    execution = InventoryIntentExecution.objects.filter(intent=intent).first()
    body = {
        **intent.prepared_response,
        "execution": None
        if execution is None
        else {
            "status": execution.response_status,
            "response": execution.response,
            "written_revision": execution.written_revision,
        },
    }
    return SupplyOutcome(200, body)


def execute_inventory_intent(actor: UploadActor, command: IntentExecution) -> SupplyOutcome:
    intent = InventoryIntent.objects.filter(
        organization=actor.organization, pk=command.intent_id
    ).first()
    if (
        intent is None
        or intent.kind != command.kind
        or not _target_matches(intent, command.target_id)
    ):
        raise Http404
    subjects = authorize_intent(actor, intent)
    with supply_transaction(actor, subjects.participants):
        if authorize_intent(actor, intent).participants != subjects.participants:
            from inventory.exceptions import InventoryInProgressError

            raise InventoryInProgressError
        old = InventoryIntentExecution.objects.filter(intent=intent).first()
        if old is not None:
            return SupplyOutcome(old.response_status, old.response, True)
        execution_id = uuid4()
        outcome, revision = _execute(actor, intent, execution_id)
        execution = InventoryIntentExecution.objects.create(
            id=execution_id,
            organization=intent.organization,
            created_by=actor.user,
            intent=intent,
            response_status=outcome.status,
            response=outcome.body,
            written_revision=revision,
        )
        from inventory.allocations.history import stored_execution

        stored_execution(execution)
        return outcome


def _execute(
    actor: UploadActor, intent: InventoryIntent, execution_id: UUID
) -> tuple[SupplyOutcome, int]:
    if intent.kind in ("assignment_release", "release_cancel"):
        from inventory.allocations.services import execute_release

        return execute_release(actor, intent, execution_id)
    if intent.kind in ("return_accept", "reconcile_justify"):
        from inventory.allocations.reconciliation import execute_reconciliation_intent

        return execute_reconciliation_intent(actor, intent, execution_id)
    from inventory.allocations.write_offs import execute_write_off

    return execute_write_off(actor, intent, execution_id)


def _target_matches(intent: InventoryIntent, identifier: UUID | None) -> bool:
    if identifier is None:
        return intent.kind in ("lot_write_off", "bag_disposal")
    actual = (
        intent.reconciliation_id
        if intent.kind in ("return_accept", "reconcile_justify")
        else intent.assignment_id
    )
    if intent.kind == "return_accept":
        assignment = intent.assignment
        if assignment is None:
            return False
        actual = assignment.reconciliation.pk
    return str(identifier) == str(actual)
