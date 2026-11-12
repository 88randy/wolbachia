# ruff: noqa: PLR0913 -- seed helpers pass explicit row facts
"""Demo flows the history does not cover: delivery states, warehouse transfers, fleet services.

Every step finds its rows by a stable code or command id, so a rerun creates nothing twice. All
dates are relative to the organization's local today (writes through the real services).
"""

from datetime import timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.db.models import Max
from django.utils import timezone

from accounts.models import Device, User
from core.time import local_today
from fleet.services import append_letter, append_service
from inventory.allocations.commands import IntentExecution
from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
from inventory.allocations.models import OriginReleaseProof, SupplyAssignment
from inventory.models import Location, Lot
from inventory.transfers.commands import (
    DispatchTransferCommand,
    PrepareTransferCommand,
    ReceiveTransferCommand,
)
from inventory.transfers.models import Transfer
from inventory.transfers.services import dispatch_transfer, prepare_transfer, receive_transfer
from organizations.demo_seed import people, training
from organizations.demo_seed.field import demo_id
from organizations.models import Membership, Organization
from shifts.models import Motorcycle, Shift
from uploads.access import UploadActor

CANCEL_REASON_CODE = "data-entry-error"
CANCEL_REASON = "Plan liberado por error; se corrige y se vuelve a planear."


def _assignment_for(organization: Organization, username: str) -> SupplyAssignment | None:
    user = User.objects.get(username=username)
    return (
        SupplyAssignment.objects.filter(
            organization=organization,
            courier=user,
            date=local_today(organization.timezone, timezone.now()),
        )
        .order_by("-created_at")
        .first()
    )


def _release(admin: UploadActor, assignment: SupplyAssignment, tag: str) -> UUID:
    """Release a planned delivery (warehouse step); returns the release id."""
    existing = OriginReleaseProof.objects.filter(version__assignment=assignment).first()
    if existing is not None:
        return existing.pk
    prepared = prepare_inventory_intent(
        admin,
        {
            "command_id": demo_id(f"flows:release-intent:{tag}"),
            "kind": "assignment_release",
            "assignment_id": assignment.pk,
            "expected_revision": 1,
            "evidence": [],
        },
    )
    executed = execute_inventory_intent(
        admin,
        IntentExecution(UUID(prepared.body["intent"]["id"]), "assignment_release", assignment.pk),
    )
    return UUID(executed.body["release"]["id"])


def ensure_delivery_states(organization: Organization, admin: UploadActor) -> None:
    """Today's deliveries in every state: planned (the rest), released and cancelled.

    Past deliveries are received and reconciled by the history; Carlos keeps a planned one so the
    warehouse can release it live.
    """
    released = _assignment_for(organization, "demo-courier-2")
    if released is not None:
        _release(admin, released, "released")
    cancelled = _assignment_for(organization, "demo-courier-3")
    if cancelled is None:
        return
    release_id = _release(admin, cancelled, "cancelled")
    if OriginReleaseProof.objects.get(pk=release_id).cancellations.exists():
        return
    prepared = prepare_inventory_intent(
        admin,
        {
            "command_id": demo_id("flows:cancel-intent"),
            "kind": "release_cancel",
            "release_id": release_id,
            "expected_revision": 1,
            "evidence": [],
            "reason_code": CANCEL_REASON_CODE,
            "reason": CANCEL_REASON,
        },
    )
    execute_inventory_intent(
        admin,
        IntentExecution(UUID(prepared.body["intent"]["id"]), "release_cancel", cancelled.pk),
    )


def _prepare(
    actor: UploadActor, code: str, route: tuple[Location, Location], lot: Lot, qty: str
) -> None:
    version = lot.supply.versions.order_by("-revision").first()
    values = {
        "code": code,
        "origin_id": route[0].pk,
        "destination_id": route[1].pk,
        "lines": [
            {
                "lot_id": lot.pk,
                "piece_id": None,
                "unit_version_id": version.pk,
                "quantity": Decimal(qty),
            }
        ],
    }
    prepare_transfer(PrepareTransferCommand(actor, values))


def _dispatch(actor: UploadActor, transfer: Transfer) -> None:
    values = {
        "command_id": demo_id(f"flows:dispatch:{transfer.code}"),
        "expected_revision": 1,
        "signature_upload_id": training._evidence(actor),
    }
    dispatch_transfer(DispatchTransferCommand(actor, transfer.pk, values))


def _receive(actor: UploadActor, transfer: Transfer, *, missing: int) -> None:
    line = transfer.lines.get()
    quantity = line.quantity
    scanned_quantity = quantity - missing
    values: dict[str, Any] = {
        "command_id": demo_id(f"flows:receive:{transfer.code}"),
        "expected_revision": 2,
        "signature_upload_id": training._evidence(actor),
        "scanned": [
            {
                "scan_id": str(demo_id(f"flows:scan:{transfer.code}")),
                "kind": "expected",
                "line_id": str(line.pk),
                "quantity": str(scanned_quantity),
            }
        ],
        "missing": [],
        "evidence_ids": [],
    }
    if missing:
        photo = training._evidence(actor)
        values["evidence_ids"] = [photo]
        values["missing"] = [
            {"line_id": str(line.pk), "quantity": str(missing), "evidence_ids": [photo]}
        ]
    receive_transfer(ReceiveTransferCommand(actor, transfer.pk, values))


def ensure_transfer_flow(
    organization: Organization,
    members: dict[str, Membership],
    device: Device,
    stock_lot: Lot,
    route: tuple[Location, Location],
) -> None:
    """Warehouse transfers in every state: in transit, received complete, received with a
    discrepancy (two bags missing; the stock of the destination is held until it is resolved)."""
    actor = UploadActor(members["demo-warehouse"].user, organization, device.pk)
    plan = (("T-DEMO-02", "10", None), ("T-DEMO-03", "8", 0), ("T-DEMO-04", "12", 2))
    for code, quantity, missing in plan:
        if Transfer.objects.filter(organization=organization, code=code).exists():
            continue
        _prepare(actor, code, route, stock_lot, quantity)
        transfer = Transfer.objects.get(organization=organization, code=code)
        _dispatch(actor, transfer)
        if missing is not None:
            _receive(actor, transfer, missing=missing)


def ensure_fleet_services(organization: Organization, admin: Membership) -> None:
    """Service history per motorcycle: routine, repair and inspection; one due soon, one overdue."""
    today = local_today(organization.timezone, timezone.now())
    last = dict(
        Shift.objects.filter(organization=organization)
        .values_list("motorcycle__code")
        .annotate(top=Max("odometer_close_km"))
    )
    plan = (  # code, kind, days ago, km before the last odometer, interval days, note
        ("M-DEMO-01", "routine", 30, 300, 90, "Cambio de aceite y revisión de frenos."),
        ("M-DEMO-02", "routine", 60, 700, 90, "Cambio de aceite y filtro."),
        ("M-DEMO-02", "repair", 9, 120, None, "Cambio de balatas traseras."),
        (
            "M-DEMO-03",
            "inspection",
            15,
            200,
            None,
            "Revisión general antes del periodo de lluvias.",
        ),
        ("M-DEMO-04", "routine", 27, 250, 30, "Servicio menor; próxima revisión en unos días."),
        ("M-DEMO-05", "routine", 45, 400, 30, "Servicio menor; ya toca el siguiente."),
        ("M-DEMO-06", "routine", 20, 180, 90, "Cambio de aceite y ajuste de cadena."),
    )
    for code, kind, days_ago, km_before, interval, note in plan:
        motorcycle = Motorcycle.objects.get(organization=organization, code=code)
        performed = today - timedelta(days=days_ago)
        if motorcycle.services.filter(performed_at=performed, kind=kind).exists():
            continue
        values: dict[str, Any] = {
            "kind": kind,
            "performed_at": performed,
            "odometer_km": max(0, int(last.get(code) or 0) - km_before),
            "notes": note,
        }
        if interval:
            values["service_interval_days"] = interval
        append_service(motorcycle, admin.user, values)
    _letters(organization, admin, today)


def _letters(organization: Organization, admin: Membership, today: Any) -> None:  # noqa: ANN401
    """One responsibility letter per motorcycle for the courier who rides it."""
    for number, username in enumerate(people.COURIER_USERNAMES, start=1):
        motorcycle = Motorcycle.objects.get(organization=organization, code=f"M-DEMO-{number:02d}")
        if motorcycle.responsibility_letters.exists():
            continue
        courier = User.objects.get(username=username)
        values = {
            "courier": courier.pk,
            "issued_at": today - timedelta(days=45),
            "notes": "Carta responsiva firmada al asignar la motocicleta.",
        }
        append_letter(motorcycle, admin.user, values)


def ensure_notifications(organization: Organization, members: dict[str, Membership]) -> None:
    """A starter inbox: incident notices for the people who handle them, one system note each."""
    from incidents.models import Incident
    from notifications.models import Notification
    from notifications.services import NotificationDraft, publish_notification

    if Notification.objects.filter(organization=organization).exists():
        return
    names = ("demo-admin", "demo-supervisor", "demo-supervisor-2", "demo-coordinator")
    for incident in Incident.objects.filter(organization=organization).order_by("created_at"):
        latest = incident.events.order_by("-revision").first()
        if latest is None:
            continue
        code = "incident.closed" if latest.state == "closed" else "incident.created"
        params = {
            "incident_id": str(incident.pk),
            "event_id": str(latest.pk),
            "revision": latest.revision,
        }
        for name in names:
            draft = NotificationDraft(
                members[name],
                code,
                params,
                center_id=incident.center_id,
                quadrant_id=incident.quadrant_id,
                object_kind="incident",
                object_id=incident.pk,
            )
            publish_notification(draft)
    for member in members.values():
        publish_notification(NotificationDraft(member))
