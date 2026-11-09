"""Concrete prepared-parent and source evidence, verified bytes with current action ACL."""

from typing import Any
from uuid import UUID

from django.http import Http404

from field_sync.models import FieldEvent
from field_sync.registry import EventContext
from inventory.allocations.models import InventoryIntent
from inventory.exceptions import InventoryConflictError
from uploads.access import UploadActor
from uploads.models import AttachmentLink, Upload, UploadVerification


def intent_evidence(
    actor: UploadActor, intent: InventoryIntent, required: tuple[str, ...] = ()
) -> dict[str, Upload]:
    """Only the declared role/UUID on THIS immutable authentic parent is eligible."""
    declared = intent.declared_evidence
    identifiers = {row["upload_id"] for row in declared}
    if len(identifiers) != len(declared):
        raise InventoryConflictError("supply_evidence_required")
    rows = list(
        Upload.objects.filter(organization=actor.organization, public_id__in=identifiers)
        .order_by("pk")
        .select_for_update(nowait=True, no_key=True)
    )
    if len(rows) != len(identifiers):
        raise InventoryConflictError("supply_evidence_required")
    uploads = {str(upload.public_id): upload for upload in rows}
    roles: dict[str, Upload] = {}
    for declaration in declared:
        upload = uploads[declaration["upload_id"]]
        link = AttachmentLink.objects.filter(upload=upload).first()
        if (
            upload.uploader_id != actor.user.pk
            or upload.device_id != actor.device_id
            or not UploadVerification.objects.filter(upload=upload).exists()
            or link is None
            or link.inventory_intent_id != intent.pk
        ):
            raise InventoryConflictError("supply_evidence_required")
        role = declaration["role"]
        if role in roles and role in ("signature", "rpbi"):
            raise InventoryConflictError("supply_evidence_required")
        roles[role] = upload
    if any(role not in roles for role in required):
        raise InventoryConflictError("supply_evidence_required")
    return roles


def source_evidence(
    ctx: EventContext, declarations: dict[str, list[Any]]
) -> dict[str, list[Upload]]:
    from inventory.allocations.review import authorize_source, source_contexts
    from inventory.allocations.scope import allows_supply_vector
    from uploads.access import current_scope

    assignment = authorize_source(ctx, ctx.envelope.payload)
    identifiers = {str(identifier) for values in declarations.values() for identifier in values}
    if not identifiers:
        return {role: [] for role in declarations}
    capability = ctx.review_authorization
    if capability is None:
        scope = current_scope(UploadActor(ctx.user, ctx.organization, ctx.device.pk))
        if not allows_supply_vector(
            scope, "field.upload", source_contexts(ctx, assignment, ctx.envelope.payload)
        ):
            raise InventoryConflictError("supply_evidence_required")
    rows = list(
        Upload.objects.filter(organization=ctx.organization, public_id__in=identifiers)
        .order_by("pk")
        .select_for_update(nowait=True, no_key=True)
    )
    if len(rows) != len(identifiers):
        raise InventoryConflictError("supply_evidence_required")
    lookup = {str(upload.public_id): upload for upload in rows}
    for upload in rows:
        link = AttachmentLink.objects.filter(upload=upload).first()
        if (
            upload.uploader_id != ctx.user.pk
            or upload.device_id != ctx.device.pk
            or not UploadVerification.objects.filter(upload=upload).exists()
            or (link is not None and link.field_event_id != ctx.envelope.id)
        ):
            raise InventoryConflictError("supply_evidence_required")
    return {
        role: [lookup[str(identifier)] for identifier in values]
        for role, values in declarations.items()
    }


def intent_contexts(intent: InventoryIntent) -> list[dict[str, Any]]:
    from inventory.allocations.scope import assignment_contexts, location_context

    assignment, location, bag = intent.assignment, intent.location, intent.bag
    if assignment is not None:
        return list(assignment_contexts(assignment))
    if location is not None:
        return [location_context(location)]
    if bag is not None and bag.reading_id is not None:
        quadrant = bag.reading.ovitrap.sampling_point.block.quadrant
        return [{"center_id": str(quadrant.center_id), "quadrant_id": str(quadrant.pk)}]
    raise Http404


def authorize_intent_attachment(
    actor: UploadActor, identifier: UUID, upload: Upload
) -> dict[str, object]:
    from inventory.allocations.intents import KIND_PERMISSION, authorize_intent
    from inventory.allocations.scope import require_contexts

    intent = InventoryIntent.objects.filter(
        organization=actor.organization, pk=identifier, created_by=actor.user
    ).first()
    if (
        intent is None
        or upload.uploader_id != actor.user.pk
        or upload.device_id != actor.device_id
        or str(upload.public_id) not in {row["upload_id"] for row in intent.declared_evidence}
    ):
        raise Http404
    authorize_intent(actor, intent)
    contexts = intent_contexts(intent)
    for code in (KIND_PERMISSION[intent.kind], "field.upload"):
        require_contexts(actor, code, contexts)
    return {"inventory_intent": intent}


def authorize_intent_download(actor: UploadActor, identifier: UUID) -> None:
    from inventory.allocations.intents import KIND_PERMISSION
    from inventory.allocations.permissions import RECEIVE_OWN, RECONCILE_OWN
    from inventory.allocations.scope import allows_supply_vector
    from uploads.access import current_scope

    intent = InventoryIntent.objects.filter(organization=actor.organization, pk=identifier).first()
    if intent is None:
        raise Http404
    contexts = intent_contexts(intent)
    scope = current_scope(actor)
    own = intent.assignment_id is not None and intent.assignment.courier_id == actor.user.pk
    own_code = (
        RECEIVE_OWN if intent.kind in ("assignment_release", "release_cancel") else RECONCILE_OWN
    )
    if allows_supply_vector(scope, KIND_PERMISSION[intent.kind], contexts) or (
        own and allows_supply_vector(scope, own_code, contexts)
    ):
        return
    raise Http404


def authorize_source_download(actor: UploadActor, event: FieldEvent) -> None:
    from inventory.allocations.permissions import RECONCILE, SOURCE_PERMISSIONS
    from inventory.allocations.scope import allows_supply_vector
    from reviews.inspection import original_source_envelope
    from reviews.scope import subject_facts
    from uploads.access import current_scope

    facts = subject_facts(actor.organization, original_source_envelope(event))
    scope = current_scope(actor)
    if not facts.resolved:
        raise Http404
    if event.created_by_id == actor.user.pk and allows_supply_vector(
        scope, SOURCE_PERMISSIONS[event.type], list(facts.contexts)
    ):
        return
    if not allows_supply_vector(scope, RECONCILE, list(facts.contexts)) or (
        event.status == "in_review"
        and not allows_supply_vector(scope, "review_item.read", list(facts.contexts))
    ):
        raise Http404
