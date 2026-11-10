"""Genuine B03/B08/B10/permit writers for release safety and race tests."""

from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

from django.utils import timezone

from geography.models import Block, PointVersion, QuadrantVersion, SamplingPoint
from inventory.allocations.commands import AssignmentWrite, ConfigurationWrite, IntentExecution
from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
from inventory.allocations.models import OriginReleaseLine, SupplyAssignment, SupplyReceiptLine
from inventory.allocations.permissions import ADMIN_CODES
from inventory.allocations.services import write_assignment
from inventory.allocations.transit import publish_transit_configuration
from inventory.conditions import ConditionCapture, record_condition
from inventory.services import LotChange, revise_lot
from releases.models import Release
from releases.planning import schedule_release
from releases.services import create_permit, create_permit_type, create_release_device
from reviews.actions import ReviewDecisionRequest, decide_review
from reviews.models import ReviewItem
from tests.factories import MotorcycleFactory
from tests.inventory_support import AT, inventory_context
from tests.people_support import certify, people_context, require_training, training_version
from tests.review_support import audit_current_membership
from tests.shift_support import make_check_items, open_event
from tests.sync_support import event, make_phone
from tests.test_inventory_transfers_106 import verified_upload
from uploads.access import UploadActor

GEOMETRY = {
    "type": "Polygon",
    "coordinates": [[[-99.1, 18.9], [-98.9, 18.9], [-98.9, 19.1], [-99.1, 19.1], [-99.1, 18.9]]],
}


def grant_release_codes(member, codes):
    profile = member.profiles.get()
    profile.permission_codes = list(dict.fromkeys([*profile.permission_codes, *codes]))
    profile.revision += 1
    profile.save(update_fields=["permission_codes", "revision"])
    audit_current_membership(member)
    return profile


def release_setup(organization, make_member, monkeypatch, settings, tmp_path):
    people = people_context(organization, make_member, monkeypatch, settings, tmp_path)
    people.clock["now"] = AT
    people.phone = make_phone(
        lambda *_args, **_kwargs: (people.phone.user, people.subject), organization
    )
    grant_release_codes(
        people.subject,
        (*ADMIN_CODES, "field.upload", "release.read", "reading.read", "ovitrap.read"),
    )
    stock = inventory_context(
        organization, make_member, biological=True, quantity="10", quadrant=people.quadrant
    )
    stock.version = revise_lot(
        LotChange(
            stock.actor,
            {"expires_at": AT + timedelta(hours=1)},
            stock.lot.pk,
            stock.version.revision,
        )
    )
    grant_release_codes(
        stock.member,
        (
            *ADMIN_CODES,
            "permit.manage",
            "permit.suspend",
            "release.read",
            "schedule.manage",
            "review_item.read",
            "review_item.decide",
            "shift.read",
            "shift.validate",
            "training.read",
        ),
    )
    monkeypatch.setattr("incidents.tasks.publish_incident_notices.delay", lambda *_args: None)
    for at in (AT - timedelta(hours=10), AT):
        record_condition(
            ConditionCapture(stock.actor, stock.lot.pk, at, Decimal("15"), Decimal("35"))
        )
    course = training_version(people)
    require_training(people, course)
    certify(people, course)
    point = release_point(people, stock.actor)
    permit, version, device = regulatory_facts(stock, point)
    make_check_items(organization)
    opened = open_event(MotorcycleFactory(organization=organization, center=stock.center).code)
    response = people.phone.sync([opened])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["status"] == "accepted", response.data
    context = SimpleNamespace(
        organization=organization,
        people=people,
        clock=people.clock,
        actor=stock.actor,
        reviewer=stock.actor,
        member=stock.member,
        profile=stock.profile,
        stock=stock,
        phone=people.phone,
        courier_actor=UploadActor(people.phone.user, organization, people.phone.device_id),
        center=stock.center,
        quadrant=people.quadrant,
        point=point,
        permit=permit,
        permit_version=version,
        device=device,
        training_version=course,
        shift_id=UUID(opened["shift_id"]),
        lot=stock.lot,
    )
    context.task = schedule_release(
        stock.actor,
        permit.pk,
        {
            "point_id": point.pk,
            "courier_id": people.phone.user.pk,
            "due_date": AT.astimezone(timezone.get_current_timezone()).date(),
            "expected_revision": 1,
        },
    )
    context.receipt_line = credit_courier(context)
    context.capture = release_capture(context)
    return context


def release_point(people, actor):
    QuadrantVersion.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        quadrant=people.quadrant,
        geometry=GEOMETRY,
        revision=1,
        effective_from=AT - timedelta(days=2),
    )
    block = Block.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        quadrant=people.quadrant,
        code="R116-B",
    )
    point = SamplingPoint.objects.create(
        organization=actor.organization, created_by=actor.user, block=block, code="R116-P"
    )
    PointVersion.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        point=point,
        location=[-99.0, 19.0],
        version=1,
        effective_from=AT - timedelta(days=2),
    )
    return point


def regulatory_facts(stock, point):
    actor = stock.actor
    kind = create_permit_type(
        actor,
        {
            "code": "R116-T",
            "name": "Synthetic permit type",
            "requirements": {"max_gps_accuracy_m": 15},
        },
    )
    permit = create_permit(
        actor,
        {
            "code": "R116-PERMIT",
            "quadrant_id": point.quadrant_id,
            "type_id": kind.pk,
            "number": "R116-OFFICIAL",
            "authority": "Synthetic authority",
            "official_document_id": verified_upload(actor),
            "document_attestation": "Reviewed synthetic official document and geometry",
            "geometry": GEOMETRY,
            "valid_from": AT - timedelta(days=1),
            "valid_to": AT + timedelta(days=2),
        },
    )
    device = create_release_device(
        actor,
        {
            "code": "R116-DEVICE",
            "quadrant_id": point.quadrant_id,
            "source_lot_id": stock.lot.pk,
        },
    )
    return permit, permit.versions.get(), device


def credit_courier(context):
    stock = context.stock
    policy = publish_transit_configuration(
        ConfigurationWrite(
            stock.actor,
            stock.supply.pk,
            {
                "supply_version_id": stock.supply_version.pk,
                "expected_revision": 0,
                "name": "Synthetic reviewed transit",
                "procedure": "Review synthetic photos",
                "reference": "Synthetic fixture only",
                "mode": "manual_evidence_review",
                "proof_roles": ["photo"],
                "is_active": True,
            },
        )
    )
    planned = write_assignment(
        AssignmentWrite(
            stock.actor,
            {
                "command_id": uuid4(),
                "courier_id": context.phone.user.pk,
                "origin_id": stock.location.pk,
                "date": AT.astimezone(timezone.get_current_timezone()).date(),
                "shift_id": context.shift_id,
                "lines": [
                    {
                        "id": uuid4(),
                        "lot_id": stock.lot.pk,
                        "piece_id": None,
                        "unit_version_id": stock.supply_version.pk,
                        "quantity": Decimal("10"),
                    }
                ],
            },
        )
    )
    assignment_id = UUID(planned.body["assignment"]["id"])
    context.assignment = SupplyAssignment.objects.get(pk=assignment_id)
    prepared = prepare_inventory_intent(
        stock.actor,
        {
            "command_id": uuid4(),
            "kind": "assignment_release",
            "assignment_id": assignment_id,
            "expected_revision": 1,
            "evidence": [],
        },
    )
    executed = execute_inventory_intent(
        stock.actor,
        IntentExecution(
            UUID(prepared.body["intent"]["id"]),
            "assignment_release",
            assignment_id,
        ),
    )
    release_id = UUID(executed.body["release"]["id"])
    line = OriginReleaseLine.objects.get(release_id=release_id)
    source = event(
        type="supplies.receive",
        shift_id=str(context.shift_id),
        payload={
            "command_id": str(uuid4()),
            "assignment_id": str(assignment_id),
            "expected_revision": 0,
            "plan_revision": 1,
            "release_id": str(release_id),
            "signature_upload_id": str(verified_upload(context.courier_actor)),
            "actual_lines": [
                {"id": str(uuid4()), "release_line_id": str(line.pk), "quantity": "10"}
            ],
            "discrepancies": [],
        },
    )
    response = context.phone.sync([source])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["status"] == "accepted", response.data
    context.transit_policy = policy
    context.receipt_capture = source
    return SupplyReceiptLine.objects.get(receipt__event__declared_source_uuid=source["id"])


def release_capture(context, *, quantity="2", task_id=None):
    return event(
        type="release.record",
        shift_id=str(context.shift_id),
        gps={"lat": 19.0, "lng": -99.0, "accuracy_m": 3},
        payload={
            "permit_id": str(context.permit.pk),
            "release_device_id": str(context.device.pk),
            "lot_id": str(context.lot.pk),
            "quantity": quantity,
            "schedule_task_id": str(task_id or context.task["task_id"]),
            "training_version": str(context.training_version.pk),
            "evidence_ids": [str(verified_upload(context.courier_actor))],
        },
    )


def accept_release(context, capture=None):
    capture = capture or context.capture
    response = context.phone.sync([capture])
    assert response.status_code == 200, response.data
    assert response.data["results"][0]["code"] == "release_transit_review_required", response.data
    item = ReviewItem.objects.get(field_event_id=capture["id"])
    decide_review(
        context.reviewer,
        item.pk,
        ReviewDecisionRequest(
            "accept",
            0,
            "Reviewed exact original transit photos and current safety",
        ),
    )
    return Release.objects.get(declared_event_id=capture["id"])


def additional_release_task(context, code):
    """A distinct real point/plan/owner lets another command share retained custody."""
    point = SamplingPoint.objects.create(
        organization=context.organization,
        created_by=context.actor.user,
        block=context.point.block,
        code=code,
    )
    original = context.point.versions.get()
    PointVersion.objects.create(
        organization=context.organization,
        created_by=context.actor.user,
        point=point,
        location=[-98.999, 19.0],
        version=1,
        effective_from=original.effective_from,
    )
    return schedule_release(
        context.actor,
        context.permit.pk,
        {
            "point_id": point.pk,
            "courier_id": context.phone.user.pk,
            "due_date": context.task["due_date"],
            "expected_revision": 1,
        },
    )
