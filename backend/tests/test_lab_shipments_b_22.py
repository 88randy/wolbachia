"""B22 notification, one ledger debit, frozen provenance and current scope owners."""

import threading
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from decimal import Decimal
from uuid import uuid4

import pytest
from django.db import close_old_connections
from django.test import override_settings

from core.exceptions import FieldValidationError
from geography.models import Quadrant
from inventory.exceptions import InventoryInProgressError
from inventory.masters import MasterChange, revise_location, revise_supply_type
from inventory.models import StockMovement, StockOperation
from inventory.services import LotChange, revise_lot
from lab.exceptions import LabConflictError
from lab.shipments.models import DeliveryReceipt, MaterialRequestVoid, UiebShipment
from lab.shipments.selectors import shipment_projection
from lab.shipments.services import (
    create_request,
    create_shipment,
    deliver_material,
    record_notification,
    validate_shipment_reason,
    void_request,
)
from organizations.models import Center, all_scope
from tests.factories import ProfileFactory, UserFactory
from tests.inventory_support import AT, inventory_context
from tests.lab_support import capture_bag, lab_context
from tests.ovitrap_support import envelope, ingest
from tests.uploads_support import verified_upload
from uploads.access import UploadActor
from uploads.models import AttachmentLink, Upload

SHIPMENT_CODES = (
    "shipment.read",
    "shipment.create",
    "shipment.void",
    "material_request.read",
    "material_request.create",
    "material_request.notify",
    "material_request.deliver",
    "material_request.void",
)


def grant_shipment_codes(profile):
    profile.permission_codes = [*profile.permission_codes, *SHIPMENT_CODES]
    profile.save(update_fields=["permission_codes"])


def request_for(context):
    return create_request(
        context.actor,
        {
            "recipient_institution": "Synthetic receiving institution",
            "lot_id": context.lot.pk,
            "location_id": context.location.pk,
            "quantity": Decimal(1),
        },
    )


def notify_request(context, request):
    proof = verified_upload(context.actor.organization, context.actor.user)
    record_notification(
        context.actor,
        request.pk,
        {
            "reference": "SYNTHETIC-NOTIFICATION-118",
            "date": AT.date(),
            "evidence_ids": [proof.public_id],
        },
    )
    return proof


def delivery_values(signature, revision=1):
    return {
        "command_id": uuid4(),
        "signature_upload_id": signature.public_id,
        "expected_revision": revision,
    }


@pytest.fixture
def material_context(org_a, make_member, monkeypatch):
    monkeypatch.setattr("django.utils.timezone.now", lambda: AT)
    context = inventory_context(org_a, make_member)
    grant_shipment_codes(context.profile)
    return context


@pytest.mark.django_db
def test_delivery_requires_recorded_verified_notification_before_any_stock_effect(material_context):
    context = material_context
    request = request_for(context)
    signature = verified_upload(context.actor.organization, context.actor.user)

    with pytest.raises(LabConflictError) as blocked:
        deliver_material(context.actor, request.pk, delivery_values(signature, revision=0))

    assert blocked.value.code == "cenaprece_notification_required"
    assert blocked.value.blocked_by[0]["reason"] == "cenaprece_notification_required"
    assert not DeliveryReceipt.objects.exists()
    assert not StockOperation.objects.filter(source_kind="material_delivery").exists()
    assert not AttachmentLink.objects.filter(upload=signature).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("signature_kind", ["unverified", "wrong_owner"])
def test_signature_must_be_verified_and_owned_before_receipt_or_debit(
    material_context, signature_kind
):
    context = material_context
    request = request_for(context)
    notify_request(context, request)
    if signature_kind == "wrong_owner":
        signature = verified_upload(context.actor.organization, UserFactory())
    else:
        signature = Upload.objects.create(
            organization=context.actor.organization,
            created_by=context.actor.user,
            uploader=context.actor.user,
            content_type="image/png",
            size_bytes=1,
            sha256="0" * 64,
        )

    with pytest.raises(LabConflictError) as blocked:
        deliver_material(context.actor, request.pk, delivery_values(signature))

    assert blocked.value.code == "material_evidence_required"
    assert not DeliveryReceipt.objects.exists()
    assert not StockOperation.objects.filter(source_kind="material_delivery").exists()
    assert not AttachmentLink.objects.filter(upload=signature).exists()


@pytest.mark.django_db
def test_delivery_replay_returns_same_receipt_and_one_debit_but_changed_command_conflicts(
    material_context,
):
    context = material_context
    request = request_for(context)
    notification = notify_request(context, request)
    signature = verified_upload(context.actor.organization, context.actor.user)
    values = delivery_values(signature)

    receipt = deliver_material(context.actor, request.pk, values)
    replay = deliver_material(context.actor, request.pk, values)

    assert replay.pk == receipt.pk
    assert DeliveryReceipt.objects.count() == 1
    operation = StockOperation.objects.get(source_kind="material_delivery")
    assert operation.material_delivery_id == receipt.pk
    movement = StockMovement.objects.get(operation=operation)
    assert (movement.lot_id, movement.location_id, movement.quantity) == (
        context.lot.pk,
        context.location.pk,
        Decimal(-1),
    )
    assert (
        AttachmentLink.objects.filter(
            upload__in=[notification, signature], material_request=request
        ).count()
        == 2
    )
    with pytest.raises(LabConflictError) as conflict:
        deliver_material(context.actor, request.pk, {**values, "expected_revision": 2})
    assert conflict.value.code == "material_command_conflict"
    assert StockMovement.objects.filter(operation=operation).count() == 1


@pytest.mark.django_db
def test_stale_delivery_cas_and_void_after_delivery_preserve_the_signed_movement(material_context):
    context = material_context
    request = request_for(context)
    notify_request(context, request)
    signature = verified_upload(context.actor.organization, context.actor.user)
    with pytest.raises(LabConflictError) as stale:
        deliver_material(context.actor, request.pk, delivery_values(signature, revision=0))
    assert stale.value.code == "material_revision_conflict"
    assert not DeliveryReceipt.objects.exists()

    receipt = deliver_material(context.actor, request.pk, delivery_values(signature))
    with pytest.raises(LabConflictError) as dependent:
        void_request(context.actor, request.pk, "Preserve the already signed external delivery")

    assert dependent.value.code == "material_state_conflict"
    assert not MaterialRequestVoid.objects.exists()
    assert StockOperation.objects.get(material_delivery=receipt).movements.get().quantity == -1


@pytest.mark.django_db
def test_delivery_uses_actual_admitted_stock_unit_after_later_metadata_revision(material_context):
    context = material_context
    admitted_unit = context.supply_version
    latest_unit = revise_supply_type(
        MasterChange(
            context.actor,
            {"label": "Revised synthetic metadata label"},
            context.supply.pk,
            admitted_unit.revision,
        )
    )
    revised = revise_lot(
        LotChange(
            context.actor,
            {"supply_version_id": latest_unit.pk},
            context.lot.pk,
            context.version.revision,
        )
    )
    assert revised.supply_version_id == latest_unit.pk

    request = request_for(context)
    notify_request(context, request)
    signature = verified_upload(context.actor.organization, context.actor.user)
    receipt = deliver_material(context.actor, request.pk, delivery_values(signature))

    assert request.unit_version_id == admitted_unit.pk
    debit = StockMovement.objects.get(operation__material_delivery=receipt)
    assert (debit.unit_version_id, debit.quantity) == (admitted_unit.pk, Decimal(-1))
    assert StockMovement.objects.filter(operation__material_delivery=receipt).count() == 1


@pytest.mark.django_db
def test_destination_only_actor_can_deliver_genuine_transferred_stock_from_current_custody(
    material_context, make_member
):
    from inventory.transfers.services import dispatch_transfer, receive_transfer
    from tests.test_inventory_transfers_106 import (
        TRANSFER_CODES,
        dispatch_request,
        prepared,
        receive_request,
    )

    context = material_context
    context.profile.permission_codes = [*context.profile.permission_codes, *TRANSFER_CODES]
    context.profile.save(update_fields=["permission_codes"])
    destination_center = Center.objects.create(
        organization=context.actor.organization,
        created_by=context.actor.user,
        code="C-118-DESTINATION",
        name="Synthetic receiving center",
    )
    destination = revise_location(
        MasterChange(
            context.actor,
            {
                "code": "LOC-118-DESTINATION",
                "center_id": destination_center.pk,
                "name": "Synthetic receiving warehouse",
                "kind": "warehouse",
                "owner_id": context.member.pk,
                "quadrant_id": None,
                "geometry": {"type": "Point", "coordinates": [-99, 19]},
                "is_insecticide_free": True,
            },
        )
    ).location
    transfer = prepared((context, destination), quantity="2")
    dispatched = dispatch_transfer(dispatch_request(context.actor, transfer))
    receive_transfer(receive_request(context.actor, dispatched, quantity="2"))
    receiver, membership = make_member(
        context.actor.organization, [*SHIPMENT_CODES, "field.upload", "lot.read"]
    )
    membership.scope = all_scope()
    membership.save(update_fields=["scope"])
    profile = membership.profiles.get()
    profile.scope = {
        "centers": {"mode": "selected", "ids": [str(destination_center.pk)]},
        "quadrants": {"mode": "none", "ids": []},
    }
    profile.save(update_fields=["scope"])
    context.actor = UploadActor(receiver, context.actor.organization)

    request = create_request(
        context.actor,
        {
            "recipient_institution": "Synthetic destination recipient",
            "lot_id": context.lot.pk,
            "location_id": destination.pk,
            "quantity": Decimal(1),
        },
    )
    notify_request(context, request)
    signature = verified_upload(context.actor.organization, context.actor.user)
    receipt = deliver_material(context.actor, request.pk, delivery_values(signature))

    debit = StockMovement.objects.get(operation__material_delivery=receipt)
    assert (debit.location_id, debit.unit_version_id, debit.quantity) == (
        destination.pk,
        context.supply_version.pk,
        Decimal(-1),
    )
    assert context.lot.center_id != destination_center.pk


@override_settings(VOID_REASON_MIN_LENGTH=1)
def test_shipment_void_still_requires_ten_visible_characters_when_global_minimum_is_lower():
    with pytest.raises(FieldValidationError) as short:
        validate_shipment_reason("12345\u200b 6789")

    assert short.value.fields == {
        "reason": [{"code": "void_reason_too_short", "params": {"min_length": 10}}]
    }


@pytest.mark.django_db
def test_lot_correction_flags_supersession_and_appends_a_linked_frozen_shipment(material_context):
    context = material_context
    values = {
        "source_ids": [context.lot.pk],
        "cutoff": AT,
        "recipient_institution": "Synthetic UIEB recipient",
    }
    original = create_shipment(context.actor, values)
    frozen, digest = deepcopy(original.source_snapshot), original.content_hash
    assert not shipment_projection(context.actor, original)["is_superseded"]

    revised = revise_lot(
        LotChange(
            context.actor,
            {"observations": "Correct the synthetic authored provenance note"},
            context.lot.pk,
            context.version.revision,
        )
    )
    assert shipment_projection(context.actor, original)["is_superseded"]
    correction = create_shipment(
        context.actor,
        {
            **values,
            "supersedes_id": original.pk,
            "reason": "The source lot has a later authored correction",
        },
    )

    original.refresh_from_db()
    assert (original.source_snapshot, original.content_hash) == (frozen, digest)
    assert correction.supersedes_id == original.pk
    assert correction.source_snapshot[0]["version_id"] == str(revised.pk)
    assert correction.content_hash != digest
    assert UiebShipment.objects.count() == 2
    assert shipment_projection(context.actor, original)["rfc"] == ""


@pytest.mark.django_db
def test_bag_source_void_flags_shipment_without_rewriting_original_clocks_or_snapshot(monkeypatch):
    from tests.lab_support import AT as LAB_AT

    context = lab_context(monkeypatch)
    grant_shipment_codes(context.field.profile)
    bag = capture_bag(context, "SHIPMENT-118")
    shipment = create_shipment(
        context.actor,
        {
            "source_ids": [bag.pk],
            "cutoff": LAB_AT,
            "recipient_institution": "Synthetic UIEB recipient",
        },
    )
    frozen = deepcopy(shipment.source_snapshot)
    source = frozen[0]
    assert source["source_event_id"] == str(bag.event_id)
    assert source["payload_sha256"] == bag.event.payload_sha256
    assert source["device_time"] == bag.event.device_time.isoformat()
    assert source["server_received_at"] == bag.event.server_received_at.isoformat()

    cancellation = envelope(
        context.field,
        "record.void",
        voids_event_id=bag.event_id,
        payload={"reason_code": "other", "reason": "Correct the original captured bag source"},
    )
    assert ingest(context.field, cancellation).status == "accepted"

    shipment.refresh_from_db()
    bag.event.refresh_from_db()
    assert shipment.source_snapshot == frozen
    assert bag.event.status == "accepted"
    assert bag.event.voided_at is not None
    assert shipment_projection(context.actor, shipment)["is_superseded"]


@pytest.mark.django_db
def test_request_http_default_deny_and_org_center_quadrant_concealment(
    org_a, org_b, make_member, api_client, monkeypatch
):
    monkeypatch.setattr("django.utils.timezone.now", lambda: AT)
    center = Center.objects.create(organization=org_a, code="C-118", name="Synthetic center")
    visible_quadrant = Quadrant.objects.create(
        organization=org_a, center=center, code="Q-118-VISIBLE"
    )
    hidden_quadrant = Quadrant.objects.create(
        organization=org_a, center=center, code="Q-118-HIDDEN"
    )
    contexts = [
        inventory_context(org_a, make_member, quadrant=visible_quadrant),
        inventory_context(org_a, make_member, quadrant=hidden_quadrant),
        inventory_context(org_a, make_member),
        inventory_context(org_b, make_member),
    ]
    requests = []
    for context in contexts:
        grant_shipment_codes(context.profile)
        requests.append(request_for(context))
    actor = contexts[0]
    api_client.force_authenticate(actor.actor.user)
    actor.profile.permission_codes = []
    actor.profile.save(update_fields=["permission_codes"])
    assert api_client.get("/api/v1/material-requests/").status_code == 403
    assert api_client.get("/api/v1/uieb-shipments/").status_code == 403

    actor.profile.permission_codes = ["material_request.read", "material_request.create"]
    actor.profile.scope = {
        "centers": {"mode": "selected", "ids": [str(center.pk)]},
        "quadrants": {"mode": "selected", "ids": [str(visible_quadrant.pk)]},
    }
    actor.profile.save(update_fields=["permission_codes", "scope"])
    unrelated = ProfileFactory(
        organization=org_a, permission_codes=["location.read"], scope=all_scope()
    )
    actor.member.profiles.add(unrelated)
    assert api_client.get(f"/api/v1/material-requests/{requests[0].pk}/").status_code == 200
    for request in requests[1:]:
        assert api_client.get(f"/api/v1/material-requests/{request.pk}/").status_code == 404
    assert api_client.get("/api/v1/material-requests/").json()["count"] == 1
    assert (
        api_client.post(
            "/api/v1/material-requests/",
            {
                "recipient_institution": "Synthetic recipient",
                "location_id": str(actor.location.pk),
                "lot_id": str(contexts[-1].lot.pk),
                "quantity": "1",
            },
            format="json",
        ).status_code
        == 404
    )
    from rest_framework.test import APIClient

    session_client = APIClient(enforce_csrf_checks=True)
    session_client.force_login(actor.actor.user)
    own_request = {
        "recipient_institution": "Synthetic session recipient",
        "location_id": str(actor.location.pk),
        "lot_id": str(actor.lot.pk),
        "quantity": "1",
    }
    assert (
        session_client.post("/api/v1/material-requests/", own_request, format="json").status_code
        == 403
    )
    assert session_client.get("/api/v1/auth/csrf/").status_code == 204
    token = session_client.cookies["csrftoken"].value
    created = session_client.post(
        "/api/v1/material-requests/",
        own_request,
        format="json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert created.status_code == 201
    assert created.data["lot_id"] == str(actor.lot.pk)


def run_delivery(actor, identifier, values):
    close_old_connections()
    try:
        return deliver_material(actor, identifier, values)
    finally:
        close_old_connections()


@pytest.mark.django_db(transaction=True)
def test_competing_delivery_returns_retryable_contention_then_exact_once_replay(
    material_context, monkeypatch
):
    from lab.shipments.services import append_material_delivery_stock

    context = material_context
    request = request_for(context)
    notify_request(context, request)
    signature = verified_upload(context.actor.organization, context.actor.user)
    values = delivery_values(signature)
    entered, release = threading.Event(), threading.Event()

    def hold_committing_delivery(receipt, actor):
        append_material_delivery_stock(receipt, actor)
        entered.set()
        assert release.wait(10)

    monkeypatch.setattr(
        "lab.shipments.services.append_material_delivery_stock", hold_committing_delivery
    )
    with ThreadPoolExecutor(max_workers=1) as pool:
        winner = pool.submit(run_delivery, context.actor, request.pk, values)
        try:
            assert entered.wait(10)
            with pytest.raises(InventoryInProgressError):
                deliver_material(context.actor, request.pk, values)
        finally:
            release.set()
        receipt = winner.result()

    assert deliver_material(context.actor, request.pk, values).pk == receipt.pk
    assert DeliveryReceipt.objects.count() == 1
    operation = StockOperation.objects.get(source_kind="material_delivery")
    assert operation.material_delivery_id == receipt.pk
    assert StockMovement.objects.filter(operation=operation).get().quantity == -1
