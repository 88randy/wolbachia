"""Signed custody service and single HTTP boundary; PostgreSQL execution belongs to CI."""

from dataclasses import replace
from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from inventory.exceptions import InventoryConflictError
from inventory.masters import MasterChange, revise_location
from tests.inventory_support import AT, inventory_context
from uploads.access import UploadActor

pytestmark = pytest.mark.django_db
TRANSFER_CODES = (
    "transfer.read",
    "transfer.create",
    "transfer.dispatch",
    "transfer.receive",
    "discrepancy.read",
    "discrepancy.close",
)


@pytest.fixture
def custody(org_a, make_member, monkeypatch, request):
    monkeypatch.setattr("inventory.selectors.server_now", lambda: AT)
    monkeypatch.setattr("inventory.conditions.server_now", lambda: AT + timedelta(hours=1))
    biological = getattr(request, "param", False)
    context = inventory_context(org_a, make_member, quantity="5", biological=biological)
    context.profile.permission_codes = [*context.profile.permission_codes, *TRANSFER_CODES]
    context.profile.save(update_fields=["permission_codes"])
    destination = revise_location(
        MasterChange(
            context.actor,
            {
                "code": "TRANSFER-DEST",
                "center_id": context.center.pk,
                "name": "Synthetic destination",
                "kind": "warehouse",
                "owner_id": context.member.pk,
                "quadrant_id": None,
                "geometry": {"type": "Point", "coordinates": [-99, 19]},
                "is_insecticide_free": True,
            },
        )
    ).location
    if biological:
        from inventory.conditions import (
            ConditionCapture,
            record_condition,
            record_condition_at_location,
        )

        for at in (AT - timedelta(hours=10), AT):
            record_condition(
                ConditionCapture(context.actor, context.lot.pk, at, Decimal("15"), Decimal("35"))
            )
            record_condition_at_location(
                ConditionCapture(
                    context.actor, context.lot.pk, at, Decimal("15"), Decimal("35"), destination.pk
                )
            )
    return context, destination


def verified_upload(actor):
    """Real immutable synthetic receipts, no filesystem/image-library re-test."""
    from uploads.models import Upload, UploadLease, UploadSource, UploadVerification

    upload = Upload.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        uploader=actor.user,
        device_id=actor.device_id,
        content_type="image/png",
        size_bytes=1,
        sha256="a" * 64,
    )
    lease = UploadLease.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        upload=upload,
        revision=1,
        expires_at=AT + timedelta(minutes=15),
    )
    source = UploadSource.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        upload=upload,
        lease=lease,
        object_key="synthetic-" + uuid4().hex,
        size_bytes=1,
        sha256="a" * 64,
    )
    UploadVerification.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        upload=upload,
        source=source,
        object_key="synthetic-" + uuid4().hex,
        size_bytes=1,
        sha256="b" * 64,
        content_type="image/png",
        width=1,
        height=1,
    )
    return upload.public_id


def prepared(custody, quantity="3"):
    from inventory.transfers.commands import PrepareTransferCommand
    from inventory.transfers.services import prepare_transfer

    context, destination = custody
    return prepare_transfer(
        PrepareTransferCommand(
            context.actor,
            {
                "code": "TRANSFER-" + uuid4().hex[:12],
                "origin_id": context.location.pk,
                "destination_id": destination.pk,
                "lines": [
                    {
                        "lot_id": context.lot.pk,
                        "piece_id": None,
                        "quantity": Decimal(quantity),
                        "unit_version_id": context.lot.admission.lot_version.supply_version_id,
                    }
                ],
            },
        )
    )


def dispatch_request(actor, result):
    from inventory.transfers.commands import DispatchTransferCommand

    return DispatchTransferCommand(
        actor,
        result.event.transfer_id,
        {
            "command_id": uuid4(),
            "signature_upload_id": verified_upload(actor),
            "expected_revision": result.event.revision,
        },
    )


def receive_request(actor, result, quantity="3", *, missing=False):
    from inventory.transfers.commands import ReceiveTransferCommand

    line = result.event.transfer.lines.get()
    evidence = [verified_upload(actor)] if missing else []
    return ReceiveTransferCommand(
        actor,
        result.event.transfer_id,
        {
            "command_id": uuid4(),
            "signature_upload_id": verified_upload(actor),
            "expected_revision": result.event.revision,
            "evidence_ids": evidence,
            "scanned": [
                {
                    "kind": "expected",
                    "scan_id": uuid4(),
                    "line_id": line.pk,
                    "quantity": Decimal(quantity),
                }
            ],
            "missing": [
                {
                    "line_id": line.pk,
                    "quantity": Decimal("3") - Decimal(quantity),
                    "evidence_ids": evidence,
                }
            ]
            if missing
            else [],
        },
    )


def test_prepare_has_no_stock_and_dispatch_receive_exact_old_replay_is_once(custody):
    from inventory.models import StockMovement
    from inventory.transfers.services import dispatch_transfer, receive_transfer

    context, _destination = custody
    first = prepared(custody)
    assert StockMovement.objects.filter(lot=context.lot).count() == 1
    request = dispatch_request(context.actor, first)
    sent = dispatch_transfer(request)
    reception = receive_request(context.actor, sent)
    received = receive_transfer(reception)
    replay = dispatch_transfer(request)
    assert replay.event.pk == sent.event.pk
    assert replay.event.revision == 2 < received.event.revision
    assert receive_transfer(reception).event.pk == received.event.pk
    assert list(
        StockMovement.objects.filter(lot=context.lot)
        .order_by("created_at")
        .values_list("quantity", flat=True)
    ) == [Decimal("5"), Decimal("-3"), Decimal("3")]
    with pytest.raises(InventoryConflictError):
        dispatch_transfer(replace(request, values={**request.values, "expected_revision": 2}))


@pytest.mark.parametrize("outcome", ["ack_missing", "recover_dest", "return_origin"])
def test_missing_resolution_is_bounded_preserves_signed_manifest_and_replays(custody, outcome):
    from inventory.models import StockMovement
    from inventory.transfers.commands import ResolutionCommand
    from inventory.transfers.models import Discrepancy, TransferHoldResolution
    from inventory.transfers.services import (
        dispatch_transfer,
        receive_transfer,
        resolve_discrepancy,
    )

    context, destination = custody
    sent = dispatch_transfer(dispatch_request(context.actor, prepared(custody)))
    receipt = receive_transfer(receive_request(context.actor, sent, "2", missing=True))
    discrepancy = Discrepancy.objects.get(receipt_event=receipt.event)
    from inventory.transfers.serializers import DiscrepancySerializer

    pending = DiscrepancySerializer(discrepancy).data
    assert pending["status"] == "open"
    assert pending["transfer"]["outstanding"] == {str(sent.event.transfer.lines.get().pk): "1"}
    actual_receipt = next(
        row for row in pending["transfer"]["events"] if row["id"] == str(receipt.event.pk)
    )
    assert actual_receipt["manifest"]["received"] == {str(sent.event.transfer.lines.get().pk): "2"}
    assert pending["holds"][0]["resolution_id"] is None
    line = discrepancy.lines.get(kind="missing")
    values = {"line_id": line.pk, "kind": outcome, "quantity": Decimal("1")}
    evidence = []
    if outcome != "ack_missing":
        values.update(
            dispatch_event_id=sent.event.pk,
            receipt_event_id=receipt.event.pk,
            signature_upload_id=verified_upload(context.actor),
        )
        evidence = [verified_upload(context.actor)]
    command = ResolutionCommand(
        context.actor,
        discrepancy.pk,
        {
            "expected_revision": 0,
            "reason": "Accountable synthetic resolution",
            "evidence_ids": evidence,
            "resolution": {"outcomes": [values]},
        },
    )
    resolved = resolve_discrepancy(command)
    from inventory.transfers.serializers import TransferEventSerializer

    assert TransferEventSerializer(resolved.event).data["discrepancy_id"] == str(discrepancy.pk)
    assert resolve_discrepancy(command).event.pk == resolved.event.pk
    sent.event.refresh_from_db()
    assert sent.event.manifest["lines"][0]["quantity"] == "3"
    credits = StockMovement.objects.filter(operation__transfer_event=resolved.event)
    assert credits.count() == (0 if outcome == "ack_missing" else 1)
    if credits.exists():
        assert credits.get().location_id == (
            destination.pk if outcome == "recover_dest" else context.location.pk
        )
        assert credits.get().quantity == 1
    assert TransferHoldResolution.objects.filter(resolution__event=resolved.event).exists()
    closed = DiscrepancySerializer(Discrepancy.objects.get(pk=discrepancy.pk)).data
    assert closed["status"] == "closed"
    assert closed["transfer"]["outstanding"] == {}
    assert closed["holds"][0]["resolution_id"] is not None
    if outcome == "recover_dest":
        from rest_framework.exceptions import PermissionDenied

        context.profile.permission_codes.remove("transfer.receive")
        context.profile.save(update_fields=["permission_codes"])
        with pytest.raises(PermissionDenied):
            resolve_discrepancy(command)


def test_unfinished_signature_or_missing_photo_keeps_each_operational_transition_atomic(custody):
    from inventory.transfers.models import TransferEvent
    from inventory.transfers.services import dispatch_transfer, receive_transfer
    from uploads.models import UploadVerification

    context, _ = custody
    first = prepared(custody)
    request = dispatch_request(context.actor, first)
    # A real unverified owned Upload, instead of modifying an immutable verification.
    from uploads.models import Upload

    unfinished = Upload.objects.create(
        organization=context.actor.organization,
        created_by=context.actor.user,
        uploader=context.actor.user,
        content_type="image/png",
        size_bytes=1,
        sha256="c" * 64,
    )
    assert not UploadVerification.objects.filter(upload=unfinished).exists()
    with pytest.raises(InventoryConflictError):
        dispatch_transfer(
            replace(request, values={**request.values, "signature_upload_id": unfinished.public_id})
        )
    assert TransferEvent.objects.filter(transfer=first.event.transfer).count() == 1
    sent = dispatch_transfer(request)
    receipt = receive_request(context.actor, sent, "2", missing=True)
    missing = [{**receipt.values["missing"][0], "evidence_ids": [unfinished.public_id]}]
    with pytest.raises(InventoryConflictError):
        receive_transfer(
            replace(
                receipt,
                values={
                    **receipt.values,
                    "missing": missing,
                    "evidence_ids": [unfinished.public_id],
                },
            )
        )
    assert TransferEvent.objects.filter(transfer=first.event.transfer).count() == 2
    assert not first.event.transfer.discrepancies.exists()


def test_transfer_http_default_deny_and_opaque_foreign_reference_before_cas(
    custody,
    api_client,
    make_member,
    org_b,
):
    context, _ = custody
    first = prepared(custody)
    user, _member = make_member(context.actor.organization)
    api_client.force_authenticate(user)
    url = f"/api/v1/transfers/{first.event.transfer_id}/dispatch/"
    assert api_client.post(url, {}, format="json").status_code == 403
    other, _ = make_member(org_b, TRANSFER_CODES)
    api_client.force_authenticate(other)
    assert api_client.post(url, {"expected_revision": -1}, format="json").status_code == 404
    from geography.models import Quadrant
    from organizations.models import Center
    from tests.inventory_support import allow_all

    outside = Center.objects.create(
        organization=context.actor.organization,
        created_by=context.actor.user,
        code="HTTP-OUTSIDE",
        name="Synthetic outside center",
    )
    scoped_user, scoped_member = make_member(context.actor.organization, TRANSFER_CODES)
    allow_all(scoped_member)
    scoped_member.scope = {
        "centers": {"mode": "selected", "ids": [str(outside.pk)]},
        "quadrants": {"mode": "none", "ids": []},
    }
    scoped_member.save(update_fields=["scope"])
    api_client.force_authenticate(scoped_user)
    assert api_client.post(url, {"expected_revision": -1}, format="json").status_code == 404
    quadrant = Quadrant.objects.create(
        organization=context.actor.organization,
        created_by=context.actor.user,
        center=context.center,
        code="HTTP-Q",
    )
    destination = revise_location(
        MasterChange(
            context.actor,
            {
                "code": "HTTP-Q-DEST",
                "center_id": context.center.pk,
                "quadrant_id": quadrant.pk,
                "name": "Synthetic scoped store",
                "kind": "warehouse",
                "owner_id": context.member.pk,
                "geometry": {"type": "Point", "coordinates": [-99, 19]},
                "is_insecticide_free": True,
            },
        )
    ).location
    quadrant_transfer = prepared((context, destination))
    scoped_member.scope = {
        "centers": {"mode": "selected", "ids": [str(context.center.pk)]},
        "quadrants": {"mode": "none", "ids": []},
    }
    scoped_member.save(update_fields=["scope"])
    assert (
        api_client.post(
            f"/api/v1/transfers/{quadrant_transfer.event.transfer_id}/dispatch/",
            {"expected_revision": -1},
            format="json",
        ).status_code
        == 404
    )
    api_client.force_authenticate(context.actor.user)
    assert api_client.get(f"/api/v1/transfers/{uuid4()}/").status_code == 404
    from inventory.transfers.policy import json_facts

    result = api_client.post(
        url, json_facts(dispatch_request(context.actor, first).values), format="json"
    )
    assert result.status_code == 201, result.data
    assert str(result.data["transfer_id"]) == str(first.event.transfer_id)


def test_lost_reply_does_not_restore_revoked_action_or_reveal_old_receipt(custody):
    from inventory.transfers.services import dispatch_transfer

    context, _ = custody
    command = dispatch_request(context.actor, prepared(custody))
    dispatch_transfer(command)
    context.profile.permission_codes = [
        code for code in context.profile.permission_codes if code != "transfer.dispatch"
    ]
    context.profile.save(update_fields=["permission_codes"])
    from rest_framework.exceptions import PermissionDenied

    with pytest.raises(PermissionDenied):
        dispatch_transfer(command)


def test_explicit_destination_conditions_need_no_stock_and_initial_readings_do_not_certify_it(
    org_a,
    make_member,
    monkeypatch,
):
    from inventory.conditions import (
        ConditionCapture,
        record_condition,
        record_condition_at_location,
    )
    from inventory.models import StockMovement
    from inventory.selectors import current_lot, lot_safety, lot_versions
    from inventory.transfers.services import dispatch_transfer, receive_transfer
    from organizations.models import Center
    from tests.inventory_support import capture, configure_incident

    monkeypatch.setattr("inventory.conditions.server_now", lambda: AT + timedelta(hours=1))
    monkeypatch.setattr("inventory.selectors.server_now", lambda: AT)
    context = inventory_context(org_a, make_member, biological=True)
    admitted_unit = context.lot.admission.lot_version.supply_version_id
    configure_incident(context)
    assert context.supply_version.pk != admitted_unit
    assert (
        StockMovement.objects.get(lot=context.lot, location=context.location).unit_version_id
        == admitted_unit
    )
    context.profile.permission_codes = [*context.profile.permission_codes, *TRANSFER_CODES]
    context.profile.save(update_fields=["permission_codes"])
    center = Center.objects.create(
        organization=org_a,
        created_by=context.actor.user,
        code="CONDITION-B",
        name="Synthetic measured destination",
    )
    destination = revise_location(
        MasterChange(
            context.actor,
            {
                "code": "CONDITION-DEST",
                "center_id": center.pk,
                "quadrant_id": None,
                "name": "Synthetic destination",
                "kind": "warehouse",
                "owner_id": context.member.pk,
                "geometry": {"type": "Point", "coordinates": [-99, 19]},
                "is_insecticide_free": True,
            },
        )
    ).location
    for at in (AT - timedelta(hours=10), AT):
        original = record_condition(capture(context, at, "15", "35"))
        replay = record_condition_at_location(
            ConditionCapture(
                context.actor, context.lot.pk, at, Decimal("15"), Decimal("35"), context.location.pk
            )
        )
        assert (replay.pk, replay.content_hash) == (original.pk, original.content_hash)
    with pytest.raises(InventoryConflictError):
        record_condition_at_location(
            ConditionCapture(
                context.actor, context.lot.pk, AT, Decimal("16"), Decimal("35"), context.location.pk
            )
        )
    assert (
        "condition_slot_missing" in lot_safety(current_lot(context.lot), AT, destination).blocked_by
    )
    for at in (AT - timedelta(hours=10), AT):
        command = ConditionCapture(
            context.actor, context.lot.pk, at, Decimal("15"), Decimal("35"), destination.pk
        )
        reading = record_condition_at_location(command)
        assert record_condition_at_location(command).pk == reading.pk
        assert reading.capture_location_id == destination.pk
    assert lot_safety(current_lot(context.lot), AT, destination).status == "available"
    assert not StockMovement.objects.filter(lot=context.lot, location=destination).exists()
    preparation = prepared((context, destination))
    assert preparation.event.transfer.lines.get().unit_version_id == admitted_unit
    sent = dispatch_transfer(dispatch_request(context.actor, preparation))
    receive_transfer(receive_request(context.actor, sent))
    actual = lot_versions(context.actor, "lot.read", destination).get(lot=context.lot)
    assert actual.computed_status == lot_safety(actual, AT, destination).status == "available"
    breach = record_condition_at_location(
        ConditionCapture(
            context.actor,
            context.lot.pk,
            AT + timedelta(minutes=1),
            Decimal("21"),
            Decimal("35"),
            destination.pk,
        )
    )
    assert breach.breach.incident_link.incident.center_id == center.pk != context.center.pk
    actual = lot_versions(context.actor, "lot.read", destination).get(lot=context.lot)
    assert actual.computed_status == lot_safety(actual, AT, destination).status == "blocked"
    assert actual.blocker_condition_breach
    # A legacy omitted-location retry cannot reinterpret the old instant after a
    # draft changes its initial store within the same immutable scope pair.
    from inventory.services import LotChange, revise_lot

    draft = revise_lot(
        LotChange(
            context.actor,
            {
                "code": "LEGACY-CONTEXT-DRAFT",
                "supply_id": context.supply.pk,
                "initial_location_id": context.location.pk,
                "provenance": "Synthetic location-context draft",
            },
        )
    )
    old = record_condition(
        ConditionCapture(context.actor, draft.lot_id, AT, Decimal("15"), Decimal("35"))
    )
    same_pair = revise_location(
        MasterChange(
            context.actor,
            {
                "code": "SAME-PAIR-STORE",
                "center_id": context.center.pk,
                "quadrant_id": None,
                "name": "Synthetic other initial store",
                "kind": "warehouse",
                "owner_id": context.member.pk,
                "geometry": {"type": "Point", "coordinates": [-99, 19]},
                "is_insecticide_free": True,
            },
        )
    ).location
    revise_lot(
        LotChange(
            context.actor, {"initial_location_id": same_pair.pk}, draft.lot_id, draft.revision
        )
    )
    with pytest.raises(InventoryConflictError):
        record_condition(
            ConditionCapture(context.actor, draft.lot_id, AT, Decimal("15"), Decimal("35"))
        )
    old.refresh_from_db()
    assert old.location_version.location_id == context.location.pk


@pytest.mark.parametrize("failure", ["other_hold", "late_effect"])
@pytest.mark.parametrize("custody", [True], indirect=True)
def test_resolution_failure_rolls_back_own_hold_release_and_every_credit(
    custody, monkeypatch, failure
):
    from inventory.models import StockMovement
    from inventory.transfers.commands import ResolutionCommand
    from inventory.transfers.models import (
        Discrepancy,
        DiscrepancyResolution,
        TransferHoldResolution,
    )
    from inventory.transfers.services import (
        dispatch_transfer,
        receive_transfer,
        resolve_discrepancy,
    )

    context, destination = custody
    sent = dispatch_transfer(dispatch_request(context.actor, prepared(custody)))
    received = receive_transfer(receive_request(context.actor, sent, "2", missing=True))
    discrepancy = Discrepancy.objects.get(receipt_event=received.event)
    if failure == "other_hold":
        from inventory.conditions import ConditionCapture, record_condition_at_location

        record_condition_at_location(
            ConditionCapture(
                context.actor,
                context.lot.pk,
                AT + timedelta(minutes=1),
                Decimal("21"),
                Decimal("35"),
                destination.pk,
            )
        )
    else:

        def fail_effect(*args):
            raise InventoryConflictError("transfer_dependent_effects")

        monkeypatch.setattr("inventory.transfers.resolutions.append_stock", fail_effect)
    before = StockMovement.objects.filter(lot=context.lot).count()
    command = ResolutionCommand(
        context.actor,
        discrepancy.pk,
        {
            "expected_revision": 0,
            "reason": "Accountable recovery attempt",
            "evidence_ids": [verified_upload(context.actor)],
            "resolution": {
                "outcomes": [
                    {
                        "line_id": discrepancy.lines.get().pk,
                        "kind": "recover_dest",
                        "quantity": Decimal("1"),
                        "dispatch_event_id": sent.event.pk,
                        "receipt_event_id": received.event.pk,
                        "signature_upload_id": verified_upload(context.actor),
                    }
                ]
            },
        },
    )
    with pytest.raises(InventoryConflictError):
        resolve_discrepancy(command)
    assert not DiscrepancyResolution.objects.filter(discrepancy=discrepancy).exists()
    assert not TransferHoldResolution.objects.filter(hold__discrepancy=discrepancy).exists()
    assert StockMovement.objects.filter(lot=context.lot).count() == before


def test_current_custody_b_to_c_does_not_require_admission_a_or_grant_counterpart_history(
    custody,
    api_client,
):
    from inventory.services import LotChange, revise_lot
    from inventory.transfers.commands import PrepareTransferCommand
    from inventory.transfers.services import dispatch_transfer, prepare_transfer, receive_transfer
    from organizations.models import Center
    from tests.factories import ProfileFactory

    context, _ = custody
    coded = revise_lot(
        LotChange(
            context.actor,
            {
                "code": str(uuid4()),
                "supply_id": context.supply.pk,
                "initial_location_id": context.location.pk,
                "quantity": Decimal("3"),
                "provenance": "Synthetic UUID-looking human code",
            },
        )
    )
    context = replace(context, lot=coded.lot, version=coded)
    places = []
    for name in ("B", "C"):
        center = Center.objects.create(
            organization=context.actor.organization,
            created_by=context.actor.user,
            code=f"C-CUSTODY-{name}",
            name=f"Synthetic center {name}",
        )
        places.append(
            revise_location(
                MasterChange(
                    context.actor,
                    {
                        "code": f"LOC-CUSTODY-{name}",
                        "center_id": center.pk,
                        "quadrant_id": None,
                        "name": f"Synthetic {name}",
                        "kind": "warehouse",
                        "owner_id": context.member.pk,
                        "geometry": {"type": "Point", "coordinates": [-99, 19]},
                        "is_insecticide_free": True,
                    },
                )
            ).location
        )
    destination, following = places
    first = prepared((context, destination))
    sent = dispatch_transfer(dispatch_request(context.actor, first))
    receive_transfer(receive_request(context.actor, sent))
    # Being the original author is no substitute for present admission scope.
    user, member, profile = context.actor.user, context.member, context.profile
    profile.permission_codes = ["lot.read", "location.read"]
    profile.scope = {
        "centers": {"mode": "selected", "ids": [str(destination.center_id)]},
        "quadrants": {"mode": "none", "ids": []},
    }
    profile.save(update_fields=["scope", "permission_codes"])
    transport = ProfileFactory(
        organization=context.actor.organization,
        permission_codes=["transfer.create", "transfer.dispatch", "transfer.read", "field.upload"],
        scope={
            "centers": {"mode": "selected", "ids": [str(place.center_id) for place in places]},
            "quadrants": {"mode": "none", "ids": []},
        },
    )
    member.profiles.add(transport)
    actor = UploadActor(user, context.actor.organization)
    api_client.force_authenticate(user)
    lot_url = f"/api/v1/lots/{context.lot.pk}/"
    assert api_client.get(lot_url).status_code == 409
    metadata = api_client.get(lot_url, {"custody_location": destination.pk})
    assert metadata.status_code == 200
    assert metadata.data["created_by"] is None
    assert metadata.data["safety_location_id"] == str(destination.pk)
    assert api_client.get(f"/api/v1/transfers/{first.event.transfer_id}/").status_code == 404
    onward = prepare_transfer(
        PrepareTransferCommand(
            actor,
            {
                "code": "B-TO-C",
                "origin_id": destination.pk,
                "destination_id": following.pk,
                "lines": [
                    {
                        "lot_id": context.lot.pk,
                        "piece_id": None,
                        "quantity": Decimal("3"),
                        "unit_version_id": context.supply_version.pk,
                    }
                ],
            },
        )
    )
    dispatch_transfer(dispatch_request(actor, onward))
    assert api_client.get(lot_url, {"custody_location": destination.pk}).status_code == 404
    history = api_client.get(
        f"/api/v1/locations/{destination.pk}/movements/", {"lot": context.lot.pk}
    )
    assert history.status_code == 200
    assert len(history.data["results"]) == 2
    assert {row["quantity"] for row in history.data["results"]} == {"3.000000", "-3.000000"}
    assert all(
        "destination" not in row and "manifest" not in row for row in history.data["results"]
    )
    movements = f"/api/v1/locations/{destination.pk}/movements/"
    filters = {
        "lot_code": ["UNKNOWN", f" {context.lot.code} "],
        "lot": str(context.lot.pk),
        "piece": "none",
        "unit": "piece",
        "ordering": "quantity",
        "page_size": 1,
    }
    first_page = api_client.get(movements, filters)
    second_page = api_client.get(movements, {**filters, "page": 2})
    assert first_page.status_code == second_page.status_code == 200
    assert first_page.data["count"] == second_page.data["count"] == 2
    pages = first_page.data["results"] + second_page.data["results"]
    assert [row["quantity"] for row in pages] == ["-3.000000", "3.000000"]
    assert {(row["id"], row["operation_id"]) for row in pages} == {
        (row["id"], row["operation_id"]) for row in history.data["results"]
    }
    operation = pages[0]["operation_id"]
    exact_operation = api_client.get(movements, {**filters, "operation": operation})
    assert exact_operation.status_code == 200
    assert exact_operation.data["count"] == 1
    assert exact_operation.data["results"][0]["id"] == pages[0]["id"]
    assert api_client.get(lot_url, {"custody_location": destination.pk}).status_code == 404
    profile.scope["centers"]["ids"].append(str(following.center_id))
    profile.save(update_fields=["scope"])
    elsewhere = api_client.get(
        f"/api/v1/locations/{following.pk}/movements/", {"lot_code": context.lot.code}
    )
    assert elsewhere.status_code == 200
    assert elsewhere.data["count"] == 0


def custody_phone(context):
    from tests.review_support import audit_current_membership
    from tests.sync_support import make_phone

    context.profile.permission_codes = [
        *context.profile.permission_codes,
        "field_event.sync",
        "field.bootstrap",
    ]
    context.profile.save(update_fields=["permission_codes"])
    audit_current_membership(context.member)
    return make_phone(
        lambda *_args, **_kwargs: (context.actor.user, context.member), context.actor.organization
    )


def test_actual_cross_author_sources_review_once_keep_original_signatures_and_history(
    custody,
    make_member,
    void_catalog,
):
    from django.utils import timezone

    from field_sync.models import CourierChange, FieldEvent
    from inventory.models import StockOperation
    from inventory.transfers.models import TransferSourceLink
    from inventory.transfers.policy import json_facts
    from organizations.models import Membership
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.exceptions import ReviewBlockedError
    from reviews.models import (
        HistoryPublicationReceipt,
        ReviewDependencyResolution,
        ReviewEffectReceipt,
        ReviewItem,
    )
    from tests.inventory_support import allow_all
    from tests.review_support import audit_current_membership
    from tests.sync_support import configure_clock_skew, event, make_phone
    from uploads.models import AttachmentLink

    context, _ = custody
    configure_clock_skew(context.actor.organization)
    phone = custody_phone(context)
    first = prepared(custody)
    sender = replace(context.actor, device_id=phone.device_id)
    command = dispatch_request(sender, first)
    sent = event(
        type="transfer.dispatch",
        payload=json_facts({"transfer_id": first.event.transfer_id, **command.values}),
    )
    response = phone.sync([sent], sent_at=(timezone.now() - timedelta(hours=1)).isoformat())
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["code"] == "clock_skew"
    source = FieldEvent.objects.get(pk=sent["id"])
    original = (
        source.payload_sha256,
        source.status,
        source.status_code,
        source.device_time,
        source.server_received_at,
    )
    assert not StockOperation.objects.filter(transfer_event__transfer=first.event.transfer).exists()
    receiver = make_phone(
        make_member,
        context.actor.organization,
        codes=("field_event.sync", "field.bootstrap", "field.upload", "transfer.receive"),
    )
    member = Membership.objects.get(user=receiver.user, organization=context.actor.organization)
    allow_all(member)
    audit_current_membership(member)
    actor = UploadActor(receiver.user, context.actor.organization, receiver.device_id)
    line = first.event.transfer.lines.get()
    received = event(
        type="transfer.receive",
        payload=json_facts(
            {
                "transfer_id": first.event.transfer_id,
                "command_id": uuid4(),
                "expected_revision": 2,
                "signature_upload_id": verified_upload(actor),
                "dispatch_source_event_id": source.pk,
                "evidence_ids": [],
                "missing": [],
                "scanned": [
                    {
                        "kind": "expected",
                        "scan_id": uuid4(),
                        "line_id": line.pk,
                        "quantity": Decimal("3"),
                    }
                ],
            }
        ),
    )
    response = receiver.sync([received])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["code"] == "causal_parent_pending"
    child = ReviewItem.objects.get(field_event_id=received["id"])
    parent = ReviewItem.objects.get(field_event=source)
    reviewer_user, reviewer_member = make_member(
        context.actor.organization,
        ("review_item.read", "review_item.decide", "transfer.dispatch", "transfer.receive"),
    )
    allow_all(reviewer_member)
    reviewer = UploadActor(reviewer_user, context.actor.organization)
    request = ReviewDecisionRequest(
        "accept", 0, "Verify original signed custody and retained capture proof"
    )
    with pytest.raises(ReviewBlockedError):
        decide_review(reviewer, child.pk, request)
    assert not StockOperation.objects.filter(transfer_event__transfer=first.event.transfer).exists()
    decide_review(reviewer, parent.pk, request)
    decide_review(reviewer, child.pk, request)
    assert StockOperation.objects.filter(transfer_event__transfer=first.event.transfer).count() == 2
    assert TransferSourceLink.objects.filter(event__transfer=first.event.transfer).count() == 2
    assert (
        ReviewEffectReceipt.objects.filter(
            source_event_id__in=[source.pk, child.field_event_id]
        ).count()
        == 2
    )
    dependency = ReviewDependencyResolution.objects.get(dependency__source_event=child.field_event)
    assert dependency.parent_source_id == source.pk
    assert child.field_event.created_by_id != source.created_by_id
    assert phone.sync([sent]).data["results"][0]["status"] == "in_review"
    source.refresh_from_db()
    assert original == (
        source.payload_sha256,
        source.status,
        source.status_code,
        source.device_time,
        source.server_received_at,
    )
    link = AttachmentLink.objects.get(upload__public_id=command.values["signature_upload_id"])
    assert (link.field_event_id, link.transfer_event_id) == (source.pk, None)
    changes = CourierChange.objects.filter(resource_type="history.transfer_custody")
    assert set(changes.values_list("courier_id", flat=True)) == {phone.user.pk, receiver.user.pk}
    assert (
        HistoryPublicationReceipt.objects.filter(resource_type="history.transfer_custody").count()
        == 2
    )
    # A consumed signed source cannot be erased by a generic source correction.
    correction = event(
        type="record.void",
        voids_event_id=str(source.pk),
        payload={"reason_code": "other", "reason": "Cannot erase consumed signed custody effects"},
    )
    assert phone.sync([correction]).data["results"][0]["code"] == "transfer_void_blocked"
    source.refresh_from_db()
    assert source.voided_at is None
    assert StockOperation.objects.filter(transfer_event__transfer=first.event.transfer).count() == 2


@pytest.mark.parametrize("extra_kind", ["unidentified_extra", "identified_extra"])
def test_extra_is_uncredited_and_signed_correction_closes_without_second_credit(
    custody, extra_kind
):
    from inventory.models import StockMovement
    from inventory.transfers.commands import ResolutionCommand
    from inventory.transfers.models import Discrepancy, DiscrepancyResolution, TransferHold
    from inventory.transfers.services import (
        dispatch_transfer,
        receive_transfer,
        resolve_discrepancy,
    )

    context, _ = custody
    expected = "3" if extra_kind == "identified_extra" else "1"
    scanned = "4" if extra_kind == "identified_extra" else "1"
    sent = dispatch_transfer(dispatch_request(context.actor, prepared(custody, expected)))
    request = receive_request(context.actor, sent, scanned)
    if extra_kind == "unidentified_extra":
        unknown = {
            "kind": "unidentified_extra",
            "scan_id": uuid4(),
            "unidentified_code": context.lot.code,
            "quantity": Decimal("1"),
        }
        request = replace(
            request, values={**request.values, "scanned": [*request.values["scanned"], unknown]}
        )
    received = receive_transfer(request)
    discrepancy = Discrepancy.objects.get(receipt_event=received.event)
    observation = discrepancy.lines.get()
    assert observation.kind == extra_kind
    assert observation.quantity == 1
    assert observation.line_id is None
    assert received.event.manifest["extras"] == [observation.observation]
    assert not DiscrepancyResolution.objects.filter(discrepancy=discrepancy).exists()
    assert not TransferHold.objects.filter(discrepancy=discrepancy).exists()
    assert received.event.stock_effects.get().movement.quantity == Decimal(expected)
    corrected = dispatch_transfer(dispatch_request(context.actor, prepared(custody, "1")))
    corrected_receipt = receive_transfer(receive_request(context.actor, corrected, "1"))
    before = StockMovement.objects.filter(lot=context.lot).count()
    resolution = resolve_discrepancy(
        ResolutionCommand(
            context.actor,
            discrepancy.pk,
            {
                "expected_revision": 0,
                "reason": "Reference a separately signed actual correction receipt",
                "evidence_ids": [],
                "resolution": {
                    "outcomes": [
                        {
                            "line_id": observation.pk,
                            "kind": "reference_signed_correction",
                            "quantity": Decimal("1"),
                            "correction_transfer_id": corrected.event.transfer_id,
                            "receipt_event_id": corrected_receipt.event.pk,
                        }
                    ]
                },
            },
        )
    )
    assert not resolution.event.stock_effects.exists()
    assert StockMovement.objects.filter(lot=context.lot).count() == before
    assert (
        DiscrepancyResolution.objects.get(discrepancy=discrepancy).event_id == resolution.event.pk
    )


@pytest.mark.parametrize("blocker", ["original_proof", "changed_context", "current_safety"])
def test_review_cannot_invent_original_proof_or_override_current_context_and_safety(
    custody, make_member, blocker, request
):
    from django.utils import timezone

    from inventory.masters import revise_supply_type
    from inventory.transfers.policy import json_facts
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.exceptions import ReviewBlockedError
    from reviews.models import ReviewEffectReceipt, ReviewItem
    from tests.inventory_support import allow_all
    from tests.sync_support import configure_clock_skew, event, make_phone

    context, destination = custody
    configure_clock_skew(context.actor.organization)
    if blocker == "original_proof":
        context.profile.permission_codes.append("field_event.sync")
        context.profile.save(update_fields=["permission_codes"])
        phone = make_phone(
            lambda *_args, **_kwargs: (context.actor.user, context.member),
            context.actor.organization,
        )
    else:
        phone = custody_phone(context)
    first = prepared(custody)
    command = dispatch_request(replace(context.actor, device_id=phone.device_id), first)
    capture = event(
        type="transfer.dispatch",
        payload=json_facts({"transfer_id": first.event.transfer_id, **command.values}),
    )
    response = phone.sync([capture], sent_at=(timezone.now() - timedelta(hours=1)).isoformat())
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["status"] == "in_review"
    item = ReviewItem.objects.get(field_event_id=capture["id"])
    if blocker == "changed_context":
        revise_location(
            MasterChange(context.actor, {"name": "New actual storage revision"}, destination.pk, 1)
        )
    elif blocker == "current_safety":
        revise_supply_type(MasterChange(context.actor, {"is_active": False}, context.supply.pk, 1))
    user, member = make_member(
        context.actor.organization, ("review_item.decide", "transfer.dispatch")
    )
    allow_all(member)
    with pytest.raises(ReviewBlockedError):
        decide_review(
            UploadActor(user, context.actor.organization),
            item.pk,
            ReviewDecisionRequest(
                "accept", 0, "Review cannot create missing original or safety proof"
            ),
        )
    assert not first.event.transfer.stock_effects.exists()
    assert not ReviewEffectReceipt.objects.filter(source_event=item.field_event).exists()
    if blocker == "original_proof":
        from reviews.evaluation import inspect_review
        from tests.review_support import audit_current_membership

        request.getfixturevalue("void_catalog")
        audit_current_membership(context.member)  # genuine proof BEFORE this NEW void capture
        correction = event(
            type="record.void",
            voids_event_id=capture["id"],
            payload={
                "reason_code": "other",
                "reason": "Cancel the real unapplied source without inventing its old authority",
            },
        )
        response = phone.sync(
            [correction], sent_at=(timezone.now() - timedelta(hours=1)).isoformat()
        )
        assert response.status_code == 200, response.data
        correction_item = ReviewItem.objects.get(field_event_id=correction["id"])
        decide_review(
            UploadActor(user, context.actor.organization),
            correction_item.pk,
            ReviewDecisionRequest(
                "accept", 0, "Apply only this genuine no-effects source cancellation"
            ),
        )
        item.field_event.refresh_from_db()
        assert item.field_event.voided_at is not None
        assert first.event.transfer.events.count() == 1
        assert inspect_review(correction_item.field_event).legacy.state == "complete_owned"


def test_real_fully_returned_source_void_keeps_legs_and_durable_history_across_download_loss(
    custody, void_catalog
):
    from uuid import UUID

    from field_sync.models import CourierChange, FieldEvent
    from inventory.models import StockMovement
    from inventory.transfers.commands import ReceiveTransferCommand, ResolutionCommand
    from inventory.transfers.models import Discrepancy, TransferEvent, TransferVoidAudit
    from inventory.transfers.policy import json_facts
    from inventory.transfers.services import receive_transfer, resolve_discrepancy
    from tests.sync_support import configure_clock_skew, event

    context, _ = custody
    configure_clock_skew(context.actor.organization)
    phone = custody_phone(context)
    first = prepared(custody)
    command = dispatch_request(replace(context.actor, device_id=phone.device_id), first)
    capture = event(
        type="transfer.dispatch",
        payload=json_facts({"transfer_id": first.event.transfer_id, **command.values}),
    )
    response = phone.sync([capture])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["status"] == "accepted"
    sent = TransferEvent.objects.get(declared_source_uuid=capture["id"])
    line = sent.transfer.lines.get()
    photo = verified_upload(context.actor)
    receipt = receive_transfer(
        ReceiveTransferCommand(
            context.actor,
            sent.transfer_id,
            {
                "expected_revision": 2,
                "command_id": uuid4(),
                "signature_upload_id": verified_upload(context.actor),
                "scanned": [],
                "evidence_ids": [photo],
                "missing": [
                    {"line_id": line.pk, "quantity": Decimal("3"), "evidence_ids": [photo]}
                ],
            },
        )
    )
    discrepancy = Discrepancy.objects.get(receipt_event=receipt.event)
    returned = resolve_discrepancy(
        ResolutionCommand(
            context.actor,
            discrepancy.pk,
            {
                "expected_revision": 0,
                "reason": "Actual signed return before correcting the source",
                "evidence_ids": [verified_upload(context.actor)],
                "resolution": {
                    "outcomes": [
                        {
                            "line_id": discrepancy.lines.get().pk,
                            "kind": "return_origin",
                            "quantity": Decimal("3"),
                            "dispatch_event_id": sent.pk,
                            "receipt_event_id": receipt.event.pk,
                            "signature_upload_id": verified_upload(context.actor),
                        }
                    ]
                },
            },
        )
    )
    legs = list(
        StockMovement.objects.filter(lot=context.lot).order_by("pk").values_list("pk", "quantity")
    )
    original_hash = sent.manifest_hash
    context.profile.permission_codes.remove("field.bootstrap")
    context.profile.save(update_fields=["permission_codes"])
    correction = event(
        type="record.void",
        voids_event_id=capture["id"],
        payload={
            "reason_code": "other",
            "reason": "Correct the source after its genuine signed return",
        },
    )
    result = phone.sync([correction])
    assert result.status_code == 200, result.data
    assert result.data["results"][0]["status"] == "accepted"
    assert result.data["changes"]["history"] == []
    assert phone.client.get("/api/v1/field/bootstrap/").status_code == 403
    source = FieldEvent.objects.get(pk=capture["id"])
    assert source.voided_at is not None
    audit = TransferVoidAudit.objects.get(target_event=sent)
    assert audit.void_source_uuid == UUID(correction["id"])
    assert audit.compensation_event_ids == [str(returned.event.pk)]
    sent.refresh_from_db()
    assert sent.manifest_hash == original_hash
    assert legs == list(
        StockMovement.objects.filter(lot=context.lot).order_by("pk").values_list("pk", "quantity")
    )
    latest = CourierChange.objects.filter(
        resource_type="history.transfer_custody", resource_id=str(sent.pk), courier=phone.user
    ).latest("sequence")
    assert latest.payload["voided_at"] is not None
    assert latest.payload["id"] == str(sent.pk)
    context.profile.permission_codes.append("field.bootstrap")
    context.profile.save(update_fields=["permission_codes"])
    bootstrap = phone.client.get("/api/v1/field/bootstrap/")
    assert bootstrap.status_code == 200, bootstrap.data
    retained = next(row for row in bootstrap.data["history"] if row["id"] == str(sent.pk))
    assert retained["voided_at"] is not None
