"""#103 acceptance -> tests (each domain rule is exercised at one layer).

* Barrier allocation/clearance: test_clearance_races_with_use_without_losing_other_blocks.
* Clearance authorization/evidence: test_clearance_requires_grant_evidence_and_revision.
* Immutable service/fuel history: test_history_guards_and_catalog_void_preserve_dependents.
* Fuel retry/partial/unknown/boundaries/close: test_fuel_intervals_keep_capture_and_close.
* Contract wiring/isolation: test_fleet_endpoints_deny_foreign_and_unscoped_relations;
  schema export + test_openapi_contract and test_fleet_payloads cover schema/input wiring.
"""

import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import DatabaseError, connection, transaction
from rest_framework.test import APIClient

from core.exceptions import FieldValidationError, ImmutableRecordError
from fleet.exceptions import FleetConflictError
from fleet.models import FuelLoad, InspectionClearance
from fleet.services import ClearanceRequest, clear_fault
from organizations.models import Center
from shifts.models import MotorcycleBlockEvent, Shift
from tests.factories import MotorcycleFactory
from tests.shift_support import close_event, make_check_items, open_event
from tests.sync_support import event, make_phone, run_in_threads
from tests.uploads_support import verified_upload

pytestmark = pytest.mark.django_db


@pytest.fixture
def make_member(make_member):
    from tests.fleet_support import grant_fleet_scope

    return lambda *args, **kwargs: grant_fleet_scope(make_member(*args, **kwargs))


def fuel(shift_id, code, km, **changes):
    return event(
        type="fuel.load",
        shift_id=str(shift_id),
        payload={
            "motorcycle_id": code,
            "litres": "1.000",
            "amount": "25.00",
            "currency": "MXN",
            "odometer_km": km,
            "receipt_upload_id": None,
            "is_full_refill": True,
            **changes,
        },
    )


@pytest.mark.parametrize(
    ("km", "status"), [(13500, "ok"), (18000, "ok"), (13499, "review"), (18001, "review")]
)
def test_fuel_intervals_keep_capture_and_close(org_a, make_member, km, status):
    from django.utils import timezone

    from rules.models import RuleParameter, RuleParameterVersion

    # Fixed values supplied by #99; versions predate all captures in this test.
    for key, value in [("fuel_efficiency_min_km_l", 15), ("fuel_efficiency_max_km_l", 60)]:
        parameter, _ = RuleParameter.objects.get_or_create(
            organization=org_a, key=key, defaults={"value_type": "decimal", "unit": "km_l"}
        )
        RuleParameterVersion.objects.create(
            organization=org_a,
            parameter=parameter,
            value=value,
            effective_from=timezone.now() - timedelta(days=1),
            effective_date=timezone.now().date() - timedelta(days=1),
            reason="Test bounds",
        )
    make_check_items(org_a)
    motorcycle = MotorcycleFactory(organization=org_a)
    phone = make_phone(make_member, org_a, codes=("field_event.sync",))
    shift_id = uuid.uuid4()
    assert (
        phone.sync([open_event(motorcycle.code, shift_id)]).data["results"][0]["status"]
        == "accepted"
    )
    first = fuel(shift_id, motorcycle.code, 12000)
    assert phone.sync([first]).data["results"][0]["status"] == "accepted"
    assert FuelLoad.objects.get(event_id=first["id"]).efficiency_status == "unavailable"
    capture = fuel(shift_id, motorcycle.code, km, litres="100.000")
    answer = phone.sync([capture])
    retry = phone.sync([capture])
    assert answer.data["results"] == retry.data["results"]
    if status == "ok":
        row = FuelLoad.objects.get(event_id=capture["id"])
        assert FuelLoad.objects.filter(event_id=capture["id"]).count() == 1
        assert row.efficiency_status == status
        assert not row.provisional
        assert row.efficiency_km_l == Decimal(km - 12000) / 100
        assert row.receipt_pending
        assert row.rule_provenance
        assert row.threshold_min == 15
        assert row.threshold_max == 60
        assert row.event.status == "accepted"
    else:
        from reviews.models import ReviewSourceSnapshot

        assert not FuelLoad.objects.filter(event_id=capture["id"]).exists()
        facts = ReviewSourceSnapshot.objects.get(source_event_id=capture["id"]).facts["owner"]
        assert facts["fuel_assessment"]["efficiency_status"] == "review"
        assert Decimal(facts["fuel_assessment"]["efficiency_km_l"]) == Decimal(km - 12000) / 100
        assert facts["fuel"]["thresholds"]["rule_provenance"]
    if status == "review":
        probe = fuel(shift_id, motorcycle.code, 12030)
        assert phone.sync([probe]).data["results"][0]["status"] == "accepted"
        assert FuelLoad.objects.get(event_id=probe["id"]).baseline.event_id == uuid.UUID(
            first["id"]
        )
    partial = fuel(shift_id, motorcycle.code, km, is_full_refill=False)
    phone.sync([partial])
    following = fuel(shift_id, motorcycle.code, km + 20)
    phone.sync([following])
    assert FuelLoad.objects.get(event_id=following["id"]).efficiency_status == "unavailable"
    closed = phone.sync([close_event(shift_id, km + 20)])
    assert closed.data["results"][0]["status"] == "accepted"
    assert Shift.objects.get(pk=shift_id).status == "closed"


@pytest.mark.parametrize("review_code", ["odometer_decreased", "clock_skew"])
def test_decreased_or_pre_reviewed_fuel_never_enters_metrics(org_a, make_member, review_code):
    from fleet.selectors import motorcycle_metrics

    make_check_items(org_a)
    motorcycle = MotorcycleFactory(organization=org_a)
    phone = make_phone(make_member, org_a, codes=("field_event.sync",))
    shift_id = uuid.uuid4()
    phone.sync([open_event(motorcycle.code, shift_id)])
    km = 11999 if review_code == "odometer_decreased" else 12001
    capture = fuel(shift_id, motorcycle.code, km)
    overrides = {}
    if review_code == "clock_skew":
        from django.utils import timezone

        from tests.sync_support import configure_clock_skew

        configure_clock_skew(org_a)
        overrides["sent_at"] = (timezone.now() + timedelta(days=1)).isoformat()
    result = phone.sync([capture], **overrides).data["results"][0]
    assert result["code"] == review_code
    assert not FuelLoad.objects.filter(event_id=capture["id"]).exists()
    assert motorcycle_metrics(motorcycle)["latest_efficiency"] is None
    assert motorcycle_metrics(motorcycle)["latest_odometer"] == 12000
    foreign_moto = MotorcycleFactory(organization=org_a)
    mismatch = phone.sync([fuel(shift_id, foreign_moto.code, 12001)]).data["results"][0]
    assert mismatch["code"] == "fuel_motorcycle_mismatch"
    assert FuelLoad.objects.count() == 0


def make_fault(motorcycle, user):
    motorcycle.is_blocked = True
    motorcycle.blocked_reason = "severe_check"
    motorcycle.save(update_fields=["is_blocked", "blocked_reason"])
    return MotorcycleBlockEvent.objects.create(
        organization=motorcycle.organization,
        created_by=user,
        motorcycle=motorcycle,
        action="block",
        blocked_reason="severe_check",
        reason="Severe opening inspection",
    )


def test_clearance_requires_grant_evidence_and_revision(org_a, make_member):
    from django.http import Http404

    user, _ = make_member(org_a, ["motorcycle.read"])
    motorcycle = MotorcycleFactory(organization=org_a)
    fault = make_fault(motorcycle, user)
    evidence = verified_upload(org_a, user, fault=fault)
    request = ClearanceRequest(fault.pk, [evidence.public_id], "Inspection completed", 0)
    with pytest.raises(Http404):
        clear_fault(motorcycle, user, request)
    admin, _ = make_member(org_a, ["motorcycle.service_clear"])
    with pytest.raises(FieldValidationError) as missing:
        clear_fault(motorcycle, admin, ClearanceRequest(fault.pk, [], "Inspection completed", 0))
    assert getattr(missing.value, "fields", {}).get("evidence_ids")
    clear_fault(motorcycle, admin, request)
    assert InspectionClearance.objects.filter(fault=fault, reviewer=admin).count() == 1
    with pytest.raises(FleetConflictError) as stale:
        clear_fault(motorcycle, admin, request)
    assert stale.value.code == "motorcycle_revision_conflict"
    assert InspectionClearance.objects.count() == 1


@pytest.mark.usefixtures("void_catalog")
def test_history_guards_and_catalog_void_preserve_dependents(org_a, make_member):
    from datetime import date

    from fleet.services import append_service, void_history

    user, _ = make_member(org_a, ["motorcycle.manage"])
    motorcycle = MotorcycleFactory(organization=org_a)
    record = append_service(
        motorcycle,
        user,
        {
            "kind": "routine",
            "performed_at": date(2026, 1, 1),
            "odometer_km": 100,
            "service_interval_km": 1000,
            "service_interval_days": 30,
        },
    )
    from fleet.selectors import motorcycle_metrics

    metrics = motorcycle_metrics(motorcycle)
    assert metrics["next_service_due_km"] == 1100
    assert str(metrics["next_service_due_date"]) == "2026-01-31"
    from tests.factories import FieldEventFactory, ShiftFactory

    shift = ShiftFactory(organization=org_a, motorcycle=motorcycle)
    fuel_event = FieldEventFactory(organization=org_a, created_by=user, type="fuel.load")
    load = FuelLoad.objects.create(
        organization=org_a,
        created_by=user,
        event=fuel_event,
        shift=shift,
        motorcycle=motorcycle,
        litres=1,
        amount=25,
        currency="MXN",
        odometer_km=101,
        receipt_pending=True,
        is_full_refill=True,
        efficiency_status="unavailable",
    )
    dependent = FuelLoad.objects.create(
        organization=org_a,
        created_by=user,
        event=FieldEventFactory(organization=org_a, created_by=user, type="fuel.load"),
        shift=shift,
        motorcycle=motorcycle,
        litres=1,
        amount=25,
        currency="MXN",
        odometer_km=121,
        receipt_pending=True,
        is_full_refill=True,
        efficiency_status="ok",
        efficiency_km_l=20,
        baseline=load,
    )
    for original in [record, load]:
        with pytest.raises(ImmutableRecordError):
            original.save(update_fields=["odometer_km"])
    for sql in [
        "UPDATE fleet_fuelload SET odometer_km=1 WHERE id=%s",
        "DELETE FROM fleet_fuelload WHERE id=%s",
    ]:
        with (
            pytest.raises(DatabaseError, match="insert-only"),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute(sql, [load.pk])
    for sql in [
        "UPDATE fleet_servicerecord SET odometer_km=1 WHERE id=%s",
        "DELETE FROM fleet_servicerecord WHERE id=%s",
    ]:
        with (
            pytest.raises(DatabaseError, match="insert-only"),
            transaction.atomic(),
            connection.cursor() as cursor,
        ):
            cursor.execute(sql, [record.pk])
    void_history(record, user, {"reason_code": "other", "reason": "Incorrect service reading"})
    record.refresh_from_db()
    dependent.refresh_from_db()
    assert dependent.baseline_id == load.pk
    assert dependent.baseline.odometer_km == 101
    assert record.odometer_km == 100
    assert record.voided_by == user
    assert motorcycle_metrics(motorcycle)["last_service"] is None


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("other_block", [False, True])
def test_clearance_races_with_use_without_losing_other_blocks(org_a, make_member, other_block):
    make_check_items(org_a)
    reviewer, _ = make_member(org_a, ["motorcycle.service_clear"])
    motorcycle = MotorcycleFactory(organization=org_a)
    fault = make_fault(motorcycle, reviewer)
    if other_block:
        MotorcycleBlockEvent.objects.create(
            organization=org_a,
            motorcycle=motorcycle,
            action="block",
            blocked_reason="service_overdue",
            reason="Configured service due",
        )
    first, second = (
        make_phone(make_member, org_a, codes=("field_event.sync",)),
        make_phone(make_member, org_a, codes=("field_event.sync",)),
    )
    evidence = verified_upload(org_a, reviewer, fault=fault)
    request = ClearanceRequest(fault.pk, [evidence.public_id], "Inspection completed", 0)
    # run_in_threads uses a barrier and separate DB connections; all contenders take Motorcycle.
    answers = run_in_threads(
        lambda: clear_fault(motorcycle, reviewer, request),
        lambda: first.sync([open_event(motorcycle.code)]),
        lambda: second.sync([open_event(motorcycle.code)]),
    )
    from field_sync.exceptions import SyncInProgressError

    assert all(
        not isinstance(answer, Exception) or isinstance(answer, SyncInProgressError)
        for answer in answers
    ), answers
    if isinstance(answers[0], SyncInProgressError):
        clear_fault(motorcycle, reviewer, request)
    assert all(answer.status_code in (200, 429) for answer in answers[1:])
    motorcycle.refresh_from_db()
    assert InspectionClearance.objects.filter(fault=fault).count() == 1
    open_count = Shift.objects.filter(motorcycle=motorcycle, status="open").count()
    assert open_count <= 1
    if other_block:
        assert motorcycle.is_blocked
        assert motorcycle.blocked_reason == "service_overdue"
        assert open_count == 0
    else:
        assert not motorcycle.is_blocked
        # A contender blocked before clearance may retry safely; exactly one can use it.
        first.sync([open_event(motorcycle.code)])
        second.sync([open_event(motorcycle.code)])
        assert Shift.objects.filter(motorcycle=motorcycle, status="open").count() == 1


def test_fleet_endpoints_deny_foreign_and_unscoped_relations(org_a, org_b, make_member):
    center = Center.objects.create(organization=org_a, code="C-1", name="Center")
    other_center = Center.objects.create(organization=org_a, code="C-2", name="Other")
    visible = MotorcycleFactory(organization=org_a, center=center)
    hidden = MotorcycleFactory(organization=org_a, center=other_center)
    foreign = MotorcycleFactory(organization=org_b)
    unassigned = MotorcycleFactory(organization=org_a)
    user, membership = make_member(org_a)
    client = APIClient()
    client.force_authenticate(user)
    assert client.get("/api/v1/motorcycles/").status_code == 403
    for path in [
        f"/api/v1/motorcycles/{visible.pk}/services/",
        "/api/v1/fuel-loads/",
        "/api/v1/incidents/",
    ]:
        assert client.get(path).status_code == 403
    assert (
        client.post(f"/api/v1/motorcycles/{visible.pk}/clear-fault/", {}, format="json").status_code
        == 403
    )

    profile = membership.profiles.get()
    profile.permission_codes = ["motorcycle.read", "motorcycle.manage"]
    profile.save()
    from tests.factories import FieldEventFactory, ShiftFactory

    for motorcycle in [visible, hidden, foreign, unassigned]:
        shift = ShiftFactory(organization=motorcycle.organization, motorcycle=motorcycle)
        FuelLoad.objects.create(
            organization=motorcycle.organization,
            created_by=shift.courier,
            event=FieldEventFactory(
                organization=motorcycle.organization, created_by=shift.courier, type="fuel.load"
            ),
            shift=shift,
            motorcycle=motorcycle,
            litres=1,
            amount=25,
            currency="MXN",
            odometer_km=12000,
            receipt_pending=True,
            is_full_refill=True,
            efficiency_status="unavailable",
        )
        MotorcycleBlockEvent.objects.create(
            organization=motorcycle.organization,
            created_by=shift.courier,
            motorcycle=motorcycle,
            action="block",
            blocked_reason="severe_check",
            reason="Severe check",
        )
    membership.scope = {
        "centers": {"mode": "selected", "ids": [str(center.pk)]},
        "quadrants": {"mode": "selected", "ids": [str(uuid.uuid4())]},
    }
    membership.save()
    listing = client.get("/api/v1/motorcycles/")
    assert listing.status_code == 200
    assert [row["id"] for row in listing.data["results"]] == [str(visible.pk)]
    for path in ["/api/v1/fuel-loads/", "/api/v1/incidents/"]:
        response = client.get(path)
        assert response.status_code == 200
        assert [str(row["motorcycle"]) for row in response.data["results"]] == [str(visible.pk)]

    for motorcycle in [hidden, foreign, unassigned]:
        assert client.get(f"/api/v1/motorcycles/{motorcycle.pk}/services/").status_code == 404
    created = client.post(
        f"/api/v1/motorcycles/{visible.pk}/services/",
        {
            "kind": "inspection",
            "performed_at": "2026-01-01",
            "odometer_km": 100,
        },
        format="json",
    )
    assert created.status_code == 201
    assert client.get(f"/api/v1/motorcycles/{visible.pk}/services/").data["count"] == 1
    # A quadrant grant never widens a denied center, and create/PATCH cannot move a row out of scope.
    assert (
        client.patch(
            f"/api/v1/motorcycles/{visible.pk}/", {"center": str(other_center.pk)}, format="json"
        ).status_code
        == 404
    )
    assert (
        client.post(
            "/api/v1/motorcycles/", {"code": "NEW", "center": str(other_center.pk)}, format="json"
        ).status_code
        == 404
    )
    membership.scope["centers"] = {"mode": "selected", "ids": []}
    membership.save()
    assert client.get("/api/v1/motorcycles/").data["results"] == []
