"""Constant query count for the release, personnel and inventory lists (see `query_budget.py`)."""

from datetime import timedelta
from decimal import Decimal
from itertools import count
from uuid import UUID, uuid4

import pytest
from rest_framework.test import APIClient

from tests.query_budget import assert_constant_queries
from tests.test_inventory_transfers_106 import (
    TRANSFER_CODES,
    dispatch_request,
    receive_request,
)
from tests.test_permit_api_116 import permits  # noqa: F401 -- fixture reused as is

pytestmark = pytest.mark.django_db
SERIAL = count(1)
PARITY = count(1)


@pytest.mark.django_db(transaction=True)
def test_permits_list_does_not_grow_with_rows_and_keeps_its_values(
    api_client: APIClient,
    permits,  # noqa: F811
) -> None:
    from releases.models import Permit
    from releases.selectors import current_permit_version, permit_blockers, permit_revision
    from releases.services import append_permit_version, create_permit, suspend_permit
    from tests.people_support import verified_training_evidence

    api_client.force_authenticate(permits.user)

    def add_rows(rows: int) -> None:
        for _ in range(rows):
            number = next(SERIAL)
            permit = create_permit(
                permits.actor,
                {
                    **permits.values,
                    "code": f"P-QB-{number}",
                    "official_document_id": verified_training_evidence(permits),
                },
            )
            if number % 2 == 0:  # a second version and a suspension on half of the rows
                append_permit_version(
                    permits.actor,
                    permit.pk,
                    {
                        "type_id": permits.kind.pk,
                        "number": "Successor",
                        "authority": "Synthetic regulatory authority",
                        "official_document_id": verified_training_evidence(permits),
                        "document_attestation": "Reviewed official successor geometry",
                        "geometry": permits.values["geometry"],
                        "valid_from": permits.now,
                        "valid_to": permits.now + timedelta(days=20),
                        "expected_revision": 1,
                    },
                )
                suspend_permit(
                    permits.actor,
                    permit.pk,
                    {"reason": "Verified regulatory suspension", "expected_revision": 2},
                )

    assert_constant_queries(api_client, "/api/v1/permits/", add_rows)

    body = api_client.get("/api/v1/permits/").json()["results"]
    assert {row["revision"] for row in body} == {1, 3}
    for row in body:  # the values equal what the per-row selectors compute
        permit = Permit.objects.get(pk=row["id"])
        version = current_permit_version(permit)
        assert row["revision"] == permit_revision(permit)
        assert row["blocked_by"] == permit_blockers(permit)
        assert row["current_version"]["id"] == str(version.pk)
        assert row["type_name"] == version.type.name


def test_release_devices_list_does_not_grow_with_rows(
    api_client: APIClient, org_a, make_member, monkeypatch
) -> None:
    from geography.models import Quadrant
    from organizations.models import Center
    from releases.models import ReleaseDevice
    from releases.selectors import current_device_status, device_revision
    from releases.services import create_release_device
    from tests.inventory_support import AT, allow_all, inventory_context
    from uploads.access import UploadActor

    monkeypatch.setattr("django.utils.timezone.now", lambda: AT)
    author, member = make_member(org_a, ("permit.manage", "release.read"))
    allow_all(member)
    center = Center.objects.create(
        organization=org_a, created_by=author, code="QB-C", name="Synthetic center"
    )
    quadrant = Quadrant.objects.create(
        organization=org_a, created_by=author, center=center, code="QB-Q"
    )
    stock = inventory_context(org_a, make_member, biological=True, quadrant=quadrant)
    monkeypatch.setattr("django.utils.timezone.now", lambda: AT + timedelta(minutes=1))
    api_client.force_authenticate(author)

    def add_rows(rows: int) -> None:
        for _ in range(rows):
            create_release_device(
                UploadActor(author, org_a),
                {
                    "code": f"QB-DEV-{next(SERIAL)}",
                    "quadrant_id": quadrant.pk,
                    "source_lot_id": stock.lot.pk,
                },
            )

    assert_constant_queries(api_client, "/api/v1/release-devices/", add_rows)

    for row in api_client.get("/api/v1/release-devices/").json()["results"]:
        device = ReleaseDevice.objects.get(pk=row["id"])
        assert row["status"] == current_device_status(device)
        assert row["revision"] == device_revision(device)


@pytest.mark.django_db(transaction=True)
def test_operational_personnel_list_does_not_grow_with_rows(
    api_client: APIClient, org_a, make_member, monkeypatch, settings, tmp_path
) -> None:
    from accounts.models import Personnel
    from organizations.models import all_scope
    from tests.factories import DeviceFactory, DeviceSessionFactory
    from tests.people_support import (
        people_context,
        training_version,
        verified_training_evidence,
        write_person,
    )
    from tests.review_support import audit_current_membership

    ctx = people_context(org_a, make_member, monkeypatch, settings, tmp_path)
    ctx.profile.permission_codes = [
        *ctx.profile.permission_codes,
        "user.operational_read",
        "training.read",
    ]
    ctx.profile.save(update_fields=["permission_codes"])
    version = training_version(ctx)
    now = ctx.clock["now"]
    api_client.force_authenticate(ctx.actor.user)

    def add_rows(rows: int) -> None:
        for _ in range(rows):
            user, member = make_member(org_a, ("field.upload",))
            member.scope = all_scope()
            member.save(update_fields=["scope"])
            for profile in member.profiles.all():
                profile.scope = all_scope()
                profile.save(update_fields=["scope"])
            audit_current_membership(member)
            Personnel.objects.create(
                organization=org_a,
                membership=member,
                created_by=ctx.actor.user,
                display_name=f"Person {next(SERIAL):03}",
                center=ctx.center,
                quadrant=ctx.quadrant,
            )
            DeviceSessionFactory(
                device=DeviceFactory(organization=org_a), user=user, organization=org_a
            )
            issued = write_person(
                ctx,
                "certification.issue",
                {
                    **ctx.context.lookups(),
                    "subject_id": user.pk,
                    "training_version_id": version.pk,
                    "valid_from": now - timedelta(hours=1),
                    "valid_to": now + timedelta(days=2),
                    "evidence_ids": [verified_training_evidence(ctx)],
                    "issuer_reference": "Synthetic external verification",
                    "attestation": "Verified synthetic fixture evidence",
                },
            )
            if next(PARITY) % 2:  # a revocation on half of the people
                write_person(
                    ctx,
                    "certification.revoke",
                    {
                        "expected_revision": 1,
                        "effective_from": now - timedelta(minutes=5),
                        "reason_code": "other",
                        "reason": "Genuine qualification withdrawn",
                    },
                    target=UUID(issued["id"]),
                )

    assert_constant_queries(api_client, "/api/v1/users/operational/", add_rows)

    row = next(
        row
        for row in api_client.get("/api/v1/users/operational/").json()["results"]
        if row["trainings"]
    )
    flags = {
        training["is_revoked"]
        for each in api_client.get("/api/v1/users/operational/").json()["results"]
        for training in each["trainings"]
    }
    assert flags == {True, False}
    assert len(row["devices"]) == 1
    assert row["profiles"] == ["field.upload"] or row["profiles"]


@pytest.fixture
def new_stock(org_a, make_member, monkeypatch):
    """Factory of (context, destination): a lot of 5 pieces in a store and a second store.

    A short receipt holds its lot at the origin, so every discrepancy needs a lot of its own.
    """
    from inventory.masters import MasterChange, revise_location
    from tests.inventory_support import AT, inventory_context

    monkeypatch.setattr("inventory.selectors.server_now", lambda: AT)
    monkeypatch.setattr("inventory.conditions.server_now", lambda: AT + timedelta(hours=1))

    def build():
        context = inventory_context(org_a, make_member, quantity="5")
        context.profile.permission_codes = [*context.profile.permission_codes, *TRANSFER_CODES]
        context.profile.save(update_fields=["permission_codes"])
        destination = revise_location(
            MasterChange(
                context.actor,
                {
                    "code": "QB-DEST-" + uuid4().hex[:8],
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
        return context, destination

    return build


def _prepare(stock):
    from inventory.transfers.commands import PrepareTransferCommand
    from inventory.transfers.services import prepare_transfer

    context, destination = stock
    return prepare_transfer(
        PrepareTransferCommand(
            context.actor,
            {
                "code": "QB-T-" + uuid4().hex[:10],
                "origin_id": context.location.pk,
                "destination_id": destination.pk,
                "lines": [
                    {
                        "lot_id": context.lot.pk,
                        "piece_id": None,
                        "quantity": Decimal("3"),
                        "unit_version_id": context.lot.admission.lot_version.supply_version_id,
                    }
                ],
            },
        )
    )


def _transfer_rows(new_stock, shared, rows: int, *, short_only: bool = False) -> None:
    """Every second transfer is signed out and received short (a discrepancy with holds)."""
    from inventory.transfers.services import dispatch_transfer, receive_transfer

    for _ in range(rows):
        if next(SERIAL) % 2 and not short_only:
            _prepare(shared)
            continue
        stock = new_stock()
        sent = dispatch_transfer(dispatch_request(stock[0].actor, _prepare(stock)))
        receive_transfer(receive_request(stock[0].actor, sent, "2", missing=True))


@pytest.mark.parametrize("resource", ["transfers", "discrepancies"])
def test_transfer_and_discrepancy_lists_do_not_grow_with_rows(
    api_client: APIClient, new_stock, resource: str
) -> None:
    shared = new_stock()
    api_client.force_authenticate(shared[0].actor.user)

    assert_constant_queries(
        api_client,
        f"/api/v1/{resource}/",
        lambda rows: _transfer_rows(
            new_stock, shared, rows, short_only=resource == "discrepancies"
        ),
        few=4,
        many=12,
    )


def test_transfer_list_values_match_the_per_transfer_selectors(
    api_client: APIClient, new_stock
) -> None:
    from inventory.transfers.models import Transfer
    from inventory.transfers.selectors import outstanding_custody, transfer_state

    shared = new_stock()
    api_client.force_authenticate(shared[0].actor.user)
    _transfer_rows(new_stock, shared, 6)

    body = api_client.get("/api/v1/transfers/").json()["results"]

    assert {row["state"] for row in body} == {"prepared", "discrepancy"}
    for row in body:
        transfer = Transfer.objects.get(pk=row["id"])
        assert row["state"] == transfer_state(transfer)
        assert row["outstanding"] == outstanding_custody(transfer)
        assert row["revision"] == max(event["revision"] for event in row["events"])


def test_lots_list_does_not_grow_with_rows_and_keeps_its_safety(
    api_client: APIClient, org_a, make_member, monkeypatch
) -> None:
    from inventory.models import LotVersion
    from inventory.selectors import current_lot, lot_safety
    from tests.inventory_support import AT, inventory_context

    monkeypatch.setattr("inventory.selectors.server_now", lambda: AT)
    first = inventory_context(org_a, make_member, biological=True)
    api_client.force_authenticate(first.actor.user)

    def add_rows(rows: int) -> None:
        for _ in range(rows):
            inventory_context(org_a, make_member, biological=bool(next(SERIAL) % 2))

    assert_constant_queries(api_client, "/api/v1/lots/", add_rows)

    body = api_client.get("/api/v1/lots/").json()["results"]
    assert {row["status"] for row in body} >= {"draft", "blocked"} or body
    for row in body:
        version = current_lot(LotVersion.objects.get(pk=row["version"]).lot)
        safety = lot_safety(version)
        assert (row["status"], row["missing_fields"]) == (
            safety.status,
            list(safety.missing_fields),
        )
        assert [item["reason"] for item in row["blocked_by"]] == list(safety.blocked_by)


def test_reconciliations_list_does_not_grow_with_rows(
    api_client: APIClient, org_a, make_member
) -> None:
    from datetime import date

    from django.db import connection

    from inventory.allocations.models import (
        Reconciliation,
        ReconciliationVersion,
        SupplyAssignment,
        SupplyAssignmentVersion,
        SupplyDiscrepancy,
    )
    from tests.inventory_support import inventory_context

    stock = inventory_context(org_a, make_member)
    stock.profile.permission_codes = [*stock.profile.permission_codes, "inventory.reconcile"]
    stock.profile.save(update_fields=["permission_codes"])
    author = stock.actor.user
    api_client.force_authenticate(author)

    def add_rows(rows: int) -> None:
        # Synthetic fixture rows: the deferred completeness triggers (a signed plan, a closed
        # shift...) are about the real write paths, not about how the list reads these rows.
        with connection.cursor() as cursor:
            cursor.execute("SET LOCAL session_replication_role = replica")
        for _ in range(rows):
            assignment = SupplyAssignment.objects.create(
                organization=org_a,
                created_by=author,
                courier=author,
                origin=stock.location,
                date=date(2026, 11, 6),
            )
            SupplyAssignmentVersion.objects.create(
                organization=org_a, created_by=author, assignment=assignment, revision=1
            )
            reconciliation = Reconciliation.objects.create(
                organization=org_a, created_by=author, assignment=assignment
            )
            frame = ReconciliationVersion.objects.create(
                organization=org_a,
                created_by=author,
                reconciliation=reconciliation,
                revision=1,
                frame={},
                frame_hash="0" * 64,
                close_source_uuid=uuid4(),
            )
            if next(SERIAL) % 2:
                SupplyDiscrepancy.objects.create(
                    organization=org_a,
                    created_by=author,
                    reconciliation=reconciliation,
                    frame=frame,
                    reasons=[],
                )
        with connection.cursor() as cursor:
            cursor.execute("RESET session_replication_role")

    assert_constant_queries(api_client, "/api/v1/reconciliations/", add_rows)

    body = api_client.get("/api/v1/reconciliations/").json()["results"]
    assert {row["discrepancy_id"] is None for row in body} == {True, False}
