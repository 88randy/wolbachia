"""B-12 acceptance tests: hostile imports, atomic ownership, scoped planning."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta
from threading import Barrier, Event
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.db import DatabaseError, close_old_connections, connection, transaction
from django.utils import timezone

from core.time import epi_week_label, epi_week_start
from field_sync.models import CourierChange
from geography.models import Block, PointVersion, Quadrant, SamplingPoint
from organizations.models import Center, all_scope
from scheduling.csv_import import MAX_UPLOAD_BYTES, parse_csv
from scheduling.exceptions import SchedulingBusyError, SchedulingConflictError
from scheduling.models import (
    AssignmentVersion,
    RiskCategoryVersion,
    RiskImport,
    RiskImportApplication,
    ScheduledTask,
    TaskOwnership,
)
from scheduling.permissions import RISK_IMPORT_APPLY, SCHEDULE_MANAGE, SCHEDULE_READ
from scheduling.selectors import (
    assignment_at,
    courier_current_rows,
    filtered_tasks,
    schedule_revision,
    task_loads,
    task_rows,
    week_start,
)
from scheduling.services import (
    AssignmentChange,
    ImportPreview,
    PendingReassignment,
    apply_import,
    change_assignment,
    generate_schedule,
    preview_import,
    reassign_pending,
    store_upload,
)
from tests.factories import (
    MembershipFactory,
    ProfileFactory,
    RuleParameterFactory,
    RuleParameterVersionFactory,
)


@pytest.mark.parametrize("prefix", ["=", "+", "-", "@", "\t", "\r"])
@pytest.mark.parametrize("column", [0, 1, 2])
def test_csv_formula_cells_are_rejected_without_echoing_attacker_text(prefix, column):
    import csv
    from io import StringIO

    cells = ["B-1", "high", "pilot"]
    cells[column] = prefix + "ATTACK()"
    stream = StringIO(newline="")
    writer = csv.writer(stream)
    writer.writerow(["block_code", "category", "protocol"])
    writer.writerow(cells)
    rows, errors = parse_csv(stream.getvalue().encode())
    assert rows == []
    assert errors == [{"row": 2, "code": "unsafe_cell"}]
    assert "ATTACK" not in str(errors)


@pytest.mark.parametrize(
    ("content", "code"),
    [
        (b"x" * (MAX_UPLOAD_BYTES + 1), "file_too_large"),
        (b"block_code,category\nB,high\nB,low\n", "duplicate_block"),
        (b"block_code,category,category\nB,high,low\n", "invalid_columns"),
        (b"block_code,category,unknown\nB,high,x\n", "invalid_columns"),
        (b"block_code,category\nB,high\x00\n", "unsafe_cell"),
        (b"block_code,category\nB,high\x1b\n", "unsafe_cell"),
        (b"block_code,category\nB,severe\n", "invalid_category"),
        (b"block_code,category\n\xff,high\n", "invalid_utf8"),
    ],
)
def test_csv_limits_duplicates_and_invalid_input_have_coded_errors(content, code):
    _rows, errors = parse_csv(content)
    assert errors[-1]["code"] == code


def test_csv_bom_and_normalization_preserve_protocol_provenance():
    rows, errors = parse_csv(
        "\ufeffblock_code,category,protocol\n B-1 ,high,  pilot  one  \n".encode()
    )
    assert errors == []
    assert rows == [{"block_code": "B-1", "category": "high", "protocol": "pilot one"}]


WEEK = date(2026, 2, 2)
NOW = datetime(2026, 2, 2, 12, tzinfo=UTC)


def planner_setup():
    member = MembershipFactory(scope=all_scope())
    profile = ProfileFactory(
        organization=member.organization,
        scope=all_scope(),
        permission_codes=[SCHEDULE_READ, SCHEDULE_MANAGE, RISK_IMPORT_APPLY, "field_event.sync"],
    )
    member.profiles.add(profile)
    center = Center.objects.create(
        organization=member.organization, code="C-109", name="Planning center"
    )
    quadrant = Quadrant.objects.create(
        organization=member.organization, center=center, code="Q-109"
    )
    point = planning_point(quadrant, "P-109")
    for key, value in {"revisit_interval_days": 7, "daily_task_target": 1}.items():
        parameter = RuleParameterFactory(organization=member.organization, key=key)
        RuleParameterVersionFactory(
            parameter=parameter, value=value, effective_from=NOW - timedelta(days=30)
        )
    return SimpleNamespace(member=member, profile=profile, quadrant=quadrant, point=point)


def planning_point(quadrant, code):
    block = Block.objects.create(organization=quadrant.organization, quadrant=quadrant, code=code)
    point = SamplingPoint.objects.create(organization=quadrant.organization, block=block, code=code)
    PointVersion.objects.create(
        organization=quadrant.organization,
        point=point,
        version=1,
        location=[-99.99, 20.005],
        effective_from=NOW - timedelta(days=30),
    )
    return point


def another_courier(planner):
    member = MembershipFactory(organization=planner.member.organization, scope=all_scope())
    member.profiles.add(planner.profile)
    return member


def preview(planner, content=None, source="official_import"):
    content = (
        content or f"block_code,category,protocol\n{planner.point.block.code},high,pilot\n".encode()
    )
    upload = store_upload(planner.member, "risk.csv", content)
    return preview_import(planner.member, ImportPreview(upload.pk, WEEK, source))


@pytest.mark.parametrize(
    ("day", "convention", "start", "label"),
    [
        (date(2026, 1, 1), "iso", date(2025, 12, 29), "2026-W01"),
        (date(2026, 1, 1), "mmwr", date(2026, 1, 1) - timedelta(days=4), "2025-W53"),
        (date(2026, 2, 8), "mmwr", date(2026, 2, 8), "2026-W06"),
    ],
)
def test_planning_and_capture_share_epi_week_boundaries(day, convention, start, label):
    assert epi_week_start(day, convention) == start
    assert epi_week_label(day, convention) == label


def test_csv_row_and_field_caps_prevent_unbounded_preview():
    _rows, errors = parse_csv(b"block_code,category\n" + b"B,high\n" * 5001)
    assert errors[-1] == {"row": 5002, "code": "too_many_rows"}
    assert (
        parse_csv(b"block_code,category\n" + b"B" * 129 + b",high\n")[1][0]["code"] == "invalid_csv"
    )


@pytest.mark.django_db
@pytest.mark.parametrize("source", ["official_import", "company_rule"])
def test_preview_has_no_effects_apply_replay_preserves_versioned_source(source):
    planner = planner_setup()
    risk_import = preview(planner, source=source)
    assert risk_import.errors == []
    assert not RiskCategoryVersion.objects.exists()
    assert not AssignmentVersion.objects.exists()
    assert not ScheduledTask.objects.exists()
    assert risk_import.applied_at is None
    with pytest.raises(SchedulingConflictError, match="scheduling state") as stale:
        apply_import(planner.member, risk_import.pk, 0)
    assert stale.value.code == "stale_revision"
    application = apply_import(planner.member, risk_import.pk, 1)
    revision = schedule_revision(planner.member.organization)
    assert apply_import(planner.member, risk_import.pk, 1).pk == application.pk
    assert schedule_revision(planner.member.organization) == revision
    version = RiskCategoryVersion.objects.get()
    assert (
        version.category,
        version.source,
        version.origin_id,
        version.protocol,
        version.version,
    ) == ("high", source, risk_import.pk, "pilot", 1)
    assert RiskImportApplication.objects.count() == 1
    assert risk_import.applied_at == application.created_at
    second = preview(planner, source="company_rule")
    apply_import(planner.member, second.pk, 1)
    assert list(
        RiskCategoryVersion.objects.order_by("version").values_list("version", flat=True)
    ) == [1, 2]
    assert RiskCategoryVersion.objects.get(pk=version.pk).source == source


@pytest.mark.django_db
def test_invalid_import_scope_loss_and_policy_mismatch_never_partially_apply():
    planner = planner_setup()
    second = planning_point(planner.quadrant, "P-second")
    invalid = preview(
        planner,
        f"block_code,category\n{planner.point.block.code},high\n{planner.point.block.code},low\n".encode(),
    )
    assert invalid.errors[0]["code"] == "duplicate_block"
    with pytest.raises(SchedulingConflictError) as blocked:
        apply_import(planner.member, invalid.pk, 1)
    assert blocked.value.code == "import_has_errors"
    valid = preview(
        planner,
        f"block_code,category\n{planner.point.block.code},high\n{second.block.code},medium\n".encode(),
    )
    planner.member.scope = {
        "centers": {"mode": "all", "ids": []},
        "quadrants": {"mode": "none", "ids": []},
    }
    planner.member.save(update_fields=["scope"])
    from rest_framework.exceptions import NotFound

    with pytest.raises(NotFound):
        apply_import(planner.member, valid.pk, 1)
    planner.member.scope = all_scope()
    planner.member.save(update_fields=["scope"])
    # A preview made under a different organization epi policy is never silently reinterpreted.
    mismatched = RiskImport.objects.create(
        organization=planner.member.organization,
        created_by=planner.member.user,
        upload=valid.upload,
        file_hash=valid.file_hash,
        preview_rows=valid.preview_rows,
        errors=[],
        source=valid.source,
        week_start=WEEK,
        week_policy={"epi_week": "mmwr", "timezone": planner.member.organization.timezone},
    )
    with pytest.raises(SchedulingConflictError) as mismatch:
        apply_import(planner.member, mismatched.pk, 1)
    assert mismatch.value.code == "import_scope_mismatch"
    assert not RiskCategoryVersion.objects.exists()
    assert not RiskImportApplication.objects.exists()


@pytest.mark.django_db
def test_assignment_at_retains_capture_time_owner_and_rejects_stale_revision():
    planner = planner_setup()
    courier = another_courier(planner)
    with patch("scheduling.services.timezone.now", return_value=NOW):
        change_assignment(
            planner.member, AssignmentChange(planner.quadrant.pk, planner.member.user_id, 0)
        )
    captured = NOW + timedelta(minutes=1)
    with patch("scheduling.services.timezone.now", return_value=NOW + timedelta(minutes=2)):
        change_assignment(planner.member, AssignmentChange(planner.quadrant.pk, courier.user_id, 1))
    assert assignment_at(planner.quadrant, captured).courier_id == planner.member.user_id
    assert assignment_at(planner.quadrant, NOW + timedelta(minutes=3)).courier_id == courier.user_id
    assert AssignmentVersion.objects.count() == 2
    with pytest.raises(SchedulingConflictError) as stale:
        change_assignment(planner.member, AssignmentChange(planner.quadrant.pk, None, 1))
    assert stale.value.code == "stale_revision"


@pytest.mark.django_db
def test_generation_due_risk_order_scope_load_and_target_are_the_returned_tasks():
    planner = planner_setup()
    from tests.ovitrap_support import envelope, ingest, setup_field

    # Real accepted placement effect, not an invented scheduled-action fixture.
    field = setup_field()
    field.member = field.membership
    field.profile.permission_codes += [SCHEDULE_MANAGE, SCHEDULE_READ, RISK_IMPORT_APPLY]
    field.profile.save()
    # Schedule the placement's next revisit in the following epi week.
    parameter = RuleParameterFactory(
        organization=field.batch.organization, key="revisit_interval_days"
    )
    RuleParameterVersionFactory(
        parameter=parameter, value=7, effective_from=NOW - timedelta(days=30)
    )
    assert ingest(field, envelope(field)).status == "accepted"
    with patch("scheduling.services.timezone.now", return_value=NOW + timedelta(days=7)):
        generate_schedule(field.membership, WEEK + timedelta(days=7))
    check = ScheduledTask.objects.get(organization=field.batch.organization)
    assert (check.action, check.due_date) == ("check", date(2026, 2, 11))
    assert check.rule_version_ids["revisit_interval_days"]
    # Planner's two place tasks exceed target=1 but both are retained.
    other = planning_point(planner.quadrant, "A-low")
    high_import = preview(planner)
    apply_import(planner.member, high_import.pk, 1)
    with patch("scheduling.services.timezone.now", return_value=NOW):
        change_assignment(
            planner.member, AssignmentChange(planner.quadrant.pk, planner.member.user_id, 0)
        )
        first = generate_schedule(planner.member, WEEK)
        replay = generate_schedule(planner.member, WEEK)
    assert first["created"] == 2
    assert replay == {"created": 0, "revision": first["revision"]}
    # Different due dates in each risk tier prove risk precedence and due-date tie breaking.
    for point, offset in [(planner.point, 2), (other, 1)]:
        task = ScheduledTask.objects.create(
            organization=planner.member.organization,
            point=point,
            action="check",
            due_date=WEEK + timedelta(days=offset),
        )
        TaskOwnership.objects.create(
            organization=planner.member.organization,
            task=task,
            courier=planner.member.user,
            revision=1,
        )
    tasks = filtered_tasks(planner.member, {"week": WEEK})
    rows = task_rows(tasks, task_loads(tasks))
    assert [(row["point"], row["date"]) for row in rows] == [
        (str(planner.point.pk), WEEK.isoformat()),
        (str(planner.point.pk), (WEEK + timedelta(days=2)).isoformat()),
        (str(other.pk), WEEK.isoformat()),
        (str(other.pk), (WEEK + timedelta(days=1)).isoformat()),
    ]
    assert [(row["load"], row["target"]) for row in rows] == [(4, 1)] * 4
    assert rows[0]["source"] == "official_import"
    assert rows[2]["source"] is None
    assert rows[0]["origin"] == str(high_import.pk)
    import json

    snapshot = courier_current_rows(planner.member, WEEK)
    assert len(snapshot["tasks"]) == 4
    assert json.loads(json.dumps(snapshot)) == snapshot
    hidden = Quadrant.objects.create(
        organization=planner.member.organization, center=planner.quadrant.center, code="Q-hidden"
    )
    hidden_point = planning_point(hidden, "P-hidden")
    ScheduledTask.objects.create(
        organization=planner.member.organization, point=hidden_point, action="place", due_date=WEEK
    )
    planner.member.scope = {
        "centers": {"mode": "all", "ids": []},
        "quadrants": {"mode": "selected", "ids": [str(planner.quadrant.pk)]},
    }
    planner.member.save(update_fields=["scope"])
    assert filtered_tasks(planner.member, {"week": WEEK}).count() == 4
    assert task_loads(filtered_tasks(planner.member, {"week": WEEK})) == {
        str(planner.member.user_id): 4
    }


@pytest.mark.django_db
def test_completed_tasks_abort_entire_reassignment_and_unassigned_tasks_are_explicit():
    from tests.ovitrap_support import envelope, ingest, setup_field

    field = setup_field()
    field.profile.permission_codes += [SCHEDULE_MANAGE, SCHEDULE_READ]
    field.profile.save()
    due = field.batch.sent_at.date()
    task = ScheduledTask.objects.create(
        organization=field.batch.organization, point=field.point, action="place", due_date=due
    )
    extra = ScheduledTask.objects.create(
        organization=field.batch.organization, point=field.point, action="check", due_date=due
    )
    assert ingest(field, envelope(field)).status == "accepted"
    tasks = filtered_tasks(field.membership, {"week": due})
    rows = task_rows(tasks, task_loads(tasks))
    assert all(row["blockers"] == [{"code": "unassigned"}] for row in rows)
    assert next(row for row in rows if row["id"] == str(task.pk))["is_completed"] is True
    with pytest.raises(SchedulingConflictError) as completed:
        reassign_pending(
            field.membership, PendingReassignment((extra.pk, task.pk), field.membership.user_id, 0)
        )
    assert completed.value.code == "task_completed"
    assert completed.value.blocked_by == [
        {"code": "task_completed", "id": str(task.pk), "task_code": task.code}
    ]
    assert not TaskOwnership.objects.exists()
    assert schedule_revision(field.batch.organization) == 0


@pytest.mark.django_db(transaction=True)
def test_racing_reassign_retains_prior_owner_and_loser_has_explicit_conflict():
    planner = planner_setup()
    courier = another_courier(planner)
    with patch("scheduling.services.timezone.now", return_value=NOW):
        change_assignment(
            planner.member, AssignmentChange(planner.quadrant.pk, planner.member.user_id, 0)
        )
        generated = generate_schedule(planner.member, WEEK)
    task = ScheduledTask.objects.get()
    previous = TaskOwnership.objects.get(task=task)
    gate, committed = Barrier(2), Event()

    def race(target):
        close_old_connections()
        try:
            member = (
                type(planner.member)
                .objects.select_related("user", "organization")
                .get(pk=planner.member.pk)
            )
            change = PendingReassignment((task.pk, task.pk), target, generated["revision"])
            gate.wait(timeout=10)
            try:
                result = reassign_pending(member, change)
            except SchedulingConflictError as stale:
                return stale.code
            except SchedulingBusyError:
                assert committed.wait(timeout=10)
                # Retry after the winner commits proves optimistic staleness, not only lock busy.
                with pytest.raises(SchedulingConflictError) as stale:
                    reassign_pending(member, change)
                return stale.value.code
            committed.set()
            return result
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(race, [planner.member.user_id, courier.user_id]))
    assert sum(isinstance(result, dict) for result in results) == 1
    assert "stale_revision" in results
    owners = list(TaskOwnership.objects.filter(task=task).order_by("revision"))
    assert len(owners) == 2
    assert owners[0].pk == previous.pk
    assert owners[1].revision == 2
    winning = next(result for result in results if isinstance(result, dict))
    assert str(owners[1].courier_id) == winning["owners"][0]["courier"]


@pytest.mark.django_db
def test_endpoint_default_deny_and_foreign_org_center_quadrant_isolation(api_client):
    planner, foreign = planner_setup(), planner_setup()
    api_client.force_authenticate(planner.member.user)
    planner.member.profiles.clear()
    assert api_client.get("/api/v1/schedule/", {"week": str(WEEK)}).status_code == 403
    planner.member.profiles.add(planner.profile)
    hidden_center = Center.objects.create(
        organization=planner.member.organization, code="C-hidden", name="Hidden"
    )
    hidden_center_quadrant = Quadrant.objects.create(
        organization=planner.member.organization, center=hidden_center, code="Q-hidden-center"
    )
    hidden_quadrant = Quadrant.objects.create(
        organization=planner.member.organization, center=planner.quadrant.center, code="Q-hidden"
    )
    planner.member.scope = {
        "centers": {"mode": "selected", "ids": [str(planner.quadrant.center_id)]},
        "quadrants": {
            "mode": "selected",
            "ids": [str(planner.quadrant.pk), str(hidden_center_quadrant.pk)],
        },
    }
    planner.member.save(update_fields=["scope"])
    forbidden_tasks = []
    for quadrant in [foreign.quadrant, hidden_center_quadrant, hidden_quadrant]:
        point = planning_point(quadrant, "P-" + quadrant.code)
        forbidden_tasks.append(
            ScheduledTask.objects.create(
                organization=quadrant.organization, point=point, action="place", due_date=WEEK
            )
        )
    generated = api_client.post("/api/v1/schedule/generate/", {"week": str(WEEK)}, format="json")
    assert generated.status_code == 200
    listed = api_client.get("/api/v1/schedule/", {"week": str(WEEK)})
    assert listed.status_code == 200
    assert listed.data["count"] == 1
    assert (
        api_client.get(
            "/api/v1/schedule/", {"week": str(WEEK), "code": listed.data["results"][0]["code"]}
        ).data["count"]
        == 1
    )
    assert (
        api_client.post(
            "/api/v1/risk-category-imports/not-a-uuid/apply/",
            {"expected_revision": 1},
            format="json",
        ).status_code
        == 404
    )
    hidden_courier = another_courier(planner)
    hidden_courier.scope = {
        "centers": {"mode": "selected", "ids": [str(hidden_center.pk)]},
        "quadrants": {"mode": "all", "ids": []},
    }
    hidden_courier.save(update_fields=["scope"])
    assert (
        api_client.get(
            "/api/v1/schedule/", {"week": str(WEEK), "courier": str(hidden_courier.user_id)}
        ).status_code
        == 404
    )
    for quadrant in [foreign.quadrant, hidden_center_quadrant, hidden_quadrant]:
        assert (
            api_client.put(
                "/api/v1/quadrant-assignments/",
                {"quadrant_id": str(quadrant.pk), "courier_id": None, "expected_revision": 0},
                format="json",
            ).status_code
            == 404
        )
        assert (
            api_client.get(
                "/api/v1/risk-categories/", {"week": str(WEEK), "quadrant": str(quadrant.pk)}
            ).status_code
            == 404
        )
    for task in forbidden_tasks:
        response = api_client.post(
            "/api/v1/schedule/reassign-pending/",
            {
                "task_ids": [str(task.pk)],
                "courier": str(planner.member.user_id),
                "expected_revision": listed.data["revision"],
            },
            format="json",
        )
        assert response.status_code == 404
        assert "blocked_by" not in response.data
    other_upload = store_upload(foreign.member, "risk.csv", b"block_code,category\nB,high\n")
    for upload_id in [other_upload.pk, uuid4()]:
        response = api_client.post(
            "/api/v1/risk-category-imports/",
            {"upload_id": str(upload_id), "week": str(WEEK), "source": "company_rule"},
            format="json",
        )
        assert response.status_code == 404
        assert "fields" not in response.data
    with patch("scheduling.views.services.store_upload") as stored:
        from django.core.files.uploadedfile import SimpleUploadedFile

        response = api_client.post(
            "/api/v1/risk-category-import-uploads/",
            {"file": SimpleUploadedFile("risk.csv", b"x" * (MAX_UPLOAD_BYTES + 1))},
            format="multipart",
        )
    assert response.status_code == 400
    assert response.data["fields"]["file"][0]["code"] == "file_too_large"
    stored.assert_not_called()


@pytest.mark.django_db(transaction=True)
def test_database_guards_protect_import_and_ownership_history():
    planner = planner_setup()
    risk_import = preview(planner)
    with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute(
            "UPDATE scheduling_riskimport SET revision = 2 WHERE id = %s", [risk_import.pk]
        )
    with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute("DELETE FROM scheduling_riskimport WHERE id = %s", [risk_import.pk])
    assert RiskImport.objects.get(pk=risk_import.pk).revision == 1
    task = ScheduledTask.objects.create(
        organization=planner.member.organization, point=planner.point, action="place", due_date=WEEK
    )
    owner = TaskOwnership.objects.create(
        organization=planner.member.organization, task=task, courier=planner.member.user, revision=1
    )
    with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute("UPDATE scheduling_taskownership SET revision = 2 WHERE id = %s", [owner.pk])
    with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute("DELETE FROM scheduling_taskownership WHERE id = %s", [owner.pk])
    assert TaskOwnership.objects.get(pk=owner.pk).revision == 1


@pytest.mark.parametrize("field", ["week", "day"])
@pytest.mark.parametrize("extreme", ["0001-01-01", "9999-12-31"])
def test_planning_date_extremes_have_coded_validation_instead_of_overflow(field, extreme):
    from scheduling.serializers import ScheduleQuerySerializer

    query = ScheduleQuerySerializer(data={"week": str(WEEK), field: extreme})
    assert not query.is_valid()
    assert query.errors[field][0].code == "out_of_range"


def test_live_scheduling_schema_exposes_requests_paging_and_revision_contract():
    from drf_spectacular.generators import SchemaGenerator

    schema = SchemaGenerator(urlconf="config.urls").get_schema(request=None, public=True)
    paths = schema["paths"]
    assert set(paths["/api/v1/quadrant-assignments/"]) == {"get", "put"}
    assert "post" in paths["/api/v1/schedule/generate/"]
    assert "post" in paths["/api/v1/schedule/reassign-pending/"]
    components = schema["components"]["schemas"]
    assert components["SchedulePage"]["properties"]["revision"]["type"] == "integer"
    request_ref = paths["/api/v1/schedule/reassign-pending/"]["post"]["requestBody"]["content"][
        "application/json"
    ]["schema"]["$ref"]
    assert components[request_ref.rsplit("/", 1)[-1]]["properties"]["task_ids"]["maxItems"] == 200
    response_schema = paths["/api/v1/schedule/"]["get"]["responses"]["200"]["content"][
        "application/json"
    ]["schema"]
    assert response_schema == {"$ref": "#/components/schemas/SchedulePage"}
    assert components["Task"]["properties"]["source"]["nullable"] is True
    code_parameter = next(
        parameter
        for parameter in paths["/api/v1/schedule/"]["get"]["parameters"]
        if parameter["name"] == "code"
    )
    assert code_parameter["schema"]["maxLength"] >= 67


@pytest.mark.parametrize("convention", ["iso", "mmwr"])
def test_normalized_first_supported_week_can_be_used_again_internally(convention):
    organization = SimpleNamespace(epi_week=convention)
    start = week_start(organization, date(2020, 1, 1))
    assert start.year == 2019
    assert week_start(organization, start) == start


# Use the real phone/bootstrap boundary with the courier membership already under test.
def planning_phone(member):
    from tests.sync_support import make_phone

    member.profiles.add(
        ProfileFactory(
            organization=member.organization,
            scope=all_scope(),
            permission_codes=["field.bootstrap", "field_event.sync"],
        )
    )
    return make_phone(lambda *args, **kwargs: (member.user, member), member.organization)


@pytest.mark.django_db
def test_bootstrap_assignments_contains_only_own_in_scope_planning_rows(monkeypatch):
    monkeypatch.setattr(timezone, "now", lambda: NOW)
    planner = planner_setup()
    courier = another_courier(planner)
    phone = planning_phone(courier)
    other = another_courier(planner)
    hidden = Quadrant.objects.create(
        organization=planner.member.organization, center=planner.quadrant.center, code="Q-hidden"
    )
    planning_point(hidden, "P-hidden")
    other_quadrant = Quadrant.objects.create(
        organization=planner.member.organization, center=planner.quadrant.center, code="Q-other"
    )
    planning_point(other_quadrant, "P-other")
    for quadrant, owner in (
        (planner.quadrant, courier),
        (hidden, courier),
        (other_quadrant, other),
    ):
        change_assignment(planner.member, AssignmentChange(quadrant.pk, owner.user_id, 0))
    generate_schedule(planner.member, WEEK)
    other_task = ScheduledTask.objects.create(
        organization=planner.member.organization, point=planner.point, action="check", due_date=WEEK
    )
    TaskOwnership.objects.create(
        organization=planner.member.organization, task=other_task, courier=other.user, revision=1
    )
    foreign = planner_setup()
    foreign_courier = MembershipFactory(
        organization=foreign.member.organization, user=courier.user, scope=all_scope()
    )
    foreign_courier.profiles.add(foreign.profile)
    change_assignment(foreign.member, AssignmentChange(foreign.quadrant.pk, courier.user_id, 0))
    generate_schedule(foreign.member, WEEK)
    courier.scope["quadrants"] = {"mode": "selected", "ids": [str(planner.quadrant.pk)]}
    courier.save(update_fields=["scope"])
    response = phone.client.get("/api/v1/field/bootstrap/")
    assert response.status_code == 200
    rows = response.data["assignments"]
    task = ScheduledTask.objects.get(point=planner.point, action="place")
    assert {(row["kind"], row["id"]) for row in rows} == {
        ("quadrant_assignment", str(planner.quadrant.pk)),
        ("task", str(task.pk)),
    }
    assert all(row["courier"] == str(courier.user_id) for row in rows)
    assert all(row["quadrant_id"] == str(planner.quadrant.pk) for row in rows)
    task_row = next(row for row in rows if row["kind"] == "task")
    assert set(task_row) == {
        "id",
        "kind",
        "quadrant_id",
        "courier",
        "revision",
        "code",
        "point",
        "action",
        "date",
        "category",
        "source",
        "protocol",
        "target",
        "is_completed",
    }
    assert (task_row["point"], task_row["target"]) == (str(planner.point.pk), 1)


@pytest.mark.django_db
def test_reassignment_delivers_remove_and_upsert_with_contiguous_sequences(monkeypatch):
    monkeypatch.setattr(timezone, "now", lambda: NOW)
    planner = planner_setup()
    courier = another_courier(planner)
    old_phone, new_phone = planning_phone(planner.member), planning_phone(courier)
    change_assignment(
        planner.member, AssignmentChange(planner.quadrant.pk, planner.member.user_id, 0)
    )
    generate_schedule(planner.member, WEEK)
    task = ScheduledTask.objects.get()
    old_cursor = old_phone.client.get("/api/v1/field/bootstrap/").data["cursor"]
    new_cursor = new_phone.client.get("/api/v1/field/bootstrap/").data["cursor"]
    reassign_pending(
        planner.member,
        PendingReassignment(
            (task.pk,), courier.user_id, schedule_revision(planner.member.organization)
        ),
    )
    old_delta = old_phone.sync([], cursor=old_cursor).data["changes"]["assignments"]
    new_delta = new_phone.sync([], cursor=new_cursor).data["changes"]["assignments"]
    assert [(row["action"], row["resource_type"], row["resource_id"]) for row in old_delta] == [
        ("remove", "task", str(task.pk))
    ]
    assert [(row["action"], row["resource_type"], row["resource_id"]) for row in new_delta] == [
        ("upsert", "task", str(task.pk))
    ]
    assert new_delta[0]["data"]["courier"] == str(courier.user_id)
    assert new_delta[0]["data"]["revision"] == 2
    for owner in (planner.member.user, courier.user):
        sequences = list(
            CourierChange.objects.filter(courier=owner)
            .order_by("sequence")
            .values_list("sequence", flat=True)
        )
        assert sequences == list(range(1, len(sequences) + 1))


@pytest.mark.django_db
def test_failed_generation_rolls_back_domain_and_courier_changes(monkeypatch):
    monkeypatch.setattr(timezone, "now", lambda: NOW)
    planner = planner_setup()
    change_assignment(
        planner.member, AssignmentChange(planner.quadrant.pk, planner.member.user_id, 0)
    )
    before = set(CourierChange.objects.values_list("pk", flat=True))
    with (
        patch(
            "scheduling.services._append_schedule_revision",
            side_effect=SchedulingConflictError("forced_rollback"),
        ),
        pytest.raises(SchedulingConflictError),
    ):
        generate_schedule(planner.member, WEEK)
    assert not ScheduledTask.objects.exists()
    assert not TaskOwnership.objects.exists()
    assert set(CourierChange.objects.values_list("pk", flat=True)) == before


@pytest.mark.django_db
def test_generation_replay_does_not_append_duplicate_courier_changes(monkeypatch):
    monkeypatch.setattr(timezone, "now", lambda: NOW)
    planner = planner_setup()
    change_assignment(
        planner.member, AssignmentChange(planner.quadrant.pk, planner.member.user_id, 0)
    )
    generated = generate_schedule(planner.member, WEEK)
    changes = list(CourierChange.objects.filter(resource_type="task"))
    assert len(changes) == generated["created"] == 1
    assert changes[0].payload["point"] == str(planner.point.pk)
    before = set(CourierChange.objects.values_list("pk", flat=True))
    assert generate_schedule(planner.member, WEEK) == {
        "created": 0,
        "revision": generated["revision"],
    }
    assert set(CourierChange.objects.values_list("pk", flat=True)) == before


@pytest.mark.django_db
def test_assignment_change_revokes_quadrant_without_moving_existing_tasks(monkeypatch):
    monkeypatch.setattr(timezone, "now", lambda: NOW)
    planner = planner_setup()
    courier = another_courier(planner)
    change_assignment(
        planner.member, AssignmentChange(planner.quadrant.pk, planner.member.user_id, 0)
    )
    generate_schedule(planner.member, WEEK)
    before = set(CourierChange.objects.values_list("pk", flat=True))
    change_assignment(planner.member, AssignmentChange(planner.quadrant.pk, courier.user_id, 1))
    changes = CourierChange.objects.exclude(pk__in=before)
    assert set(changes.values_list("courier_id", "action", "resource_type", "resource_id")) == {
        (planner.member.user_id, "remove", "quadrant_assignment", str(planner.quadrant.pk)),
        (courier.user_id, "upsert", "quadrant_assignment", str(planner.quadrant.pk)),
    }
    assert changes.get(action="upsert").payload["revision"] == 2
    assert TaskOwnership.objects.get().courier_id == planner.member.user_id
    change_assignment(planner.member, AssignmentChange(planner.quadrant.pk, None, 2))
    removed = CourierChange.objects.filter(courier=courier.user).latest("sequence")
    assert (removed.action, removed.resource_id) == ("remove", str(planner.quadrant.pk))


@pytest.mark.django_db
def test_import_delivers_changed_risk_to_current_task_owner_once(monkeypatch):
    monkeypatch.setattr(timezone, "now", lambda: NOW)
    planner = planner_setup()
    courier = another_courier(planner)
    change_assignment(
        planner.member, AssignmentChange(planner.quadrant.pk, planner.member.user_id, 0)
    )
    generate_schedule(planner.member, WEEK)
    task = ScheduledTask.objects.get()
    reassign_pending(
        planner.member,
        PendingReassignment(
            (task.pk,), courier.user_id, schedule_revision(planner.member.organization)
        ),
    )
    risk_import = preview(planner)
    before = set(CourierChange.objects.values_list("pk", flat=True))
    apply_import(planner.member, risk_import.pk, 1)
    change = CourierChange.objects.exclude(pk__in=before).get()
    assert (change.courier_id, change.action, change.resource_id) == (
        courier.user_id,
        "upsert",
        str(task.pk),
    )
    assert (change.payload["category"], change.payload["source"], change.payload["protocol"]) == (
        "high",
        "official_import",
        "pilot",
    )
    prior = CourierChange.objects.filter(courier=courier.user, resource_id=str(task.pk)).earliest(
        "sequence"
    )
    assert change.resource_version != prior.resource_version
    after = set(CourierChange.objects.values_list("pk", flat=True))
    apply_import(planner.member, risk_import.pk, 1)
    identical = preview(planner)
    apply_import(planner.member, identical.pk, 1)
    assert set(CourierChange.objects.values_list("pk", flat=True)) == after


@pytest.mark.parametrize(
    "invalid", ["missing_task_field", "extra_field", "assignment_task_fields", "missing_completion"]
)
def test_assignment_producer_rejects_invalid_phone_payloads(invalid):
    from scheduling.courier_feed import AssignmentProducerSerializer

    payload = {
        "id": str(uuid4()),
        "kind": "task",
        "quadrant_id": str(uuid4()),
        "courier": str(uuid4()),
        "revision": 1,
        "code": "P:place:2026-02-02",
        "point": str(uuid4()),
        "action": "place",
        "date": "2026-02-02",
        "category": None,
        "source": None,
        "protocol": None,
        "target": 40,
        "is_completed": False,
    }
    assert AssignmentProducerSerializer(data=payload).is_valid()
    if invalid == "missing_task_field":
        del payload["point"]
    elif invalid == "extra_field":
        payload["unexpected"] = 1
    elif invalid == "missing_completion":
        del payload["is_completed"]
    else:
        payload["kind"] = "quadrant_assignment"
    assert not AssignmentProducerSerializer(data=payload).is_valid()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("busy_owner", ["previous", "next"])
def test_busy_affected_courier_returns_retryable_429_without_partial_writes(
    monkeypatch, api_client, busy_owner
):
    from scheduling.courier_feed import lock_couriers

    monkeypatch.setattr(timezone, "now", lambda: NOW)
    planner = planner_setup()
    courier = another_courier(planner)
    change_assignment(
        planner.member, AssignmentChange(planner.quadrant.pk, planner.member.user_id, 0)
    )
    generate_schedule(planner.member, WEEK)
    task = ScheduledTask.objects.get()
    revision = schedule_revision(planner.member.organization)
    before = set(CourierChange.objects.values_list("pk", flat=True))
    held, release = Event(), Event()
    owner = planner.member if busy_owner == "previous" else courier

    def hold_courier():
        close_old_connections()
        try:
            with transaction.atomic():
                lock_couriers(owner, (owner.user_id,))
                held.set()
                assert release.wait(30)
        finally:
            connection.close()

    api_client.force_authenticate(planner.member.user)
    with ThreadPoolExecutor(max_workers=1) as pool:
        holder = pool.submit(hold_courier)
        try:
            assert held.wait(15)
            response = api_client.post(
                "/api/v1/schedule/reassign-pending/",
                {
                    "task_ids": [str(task.pk)],
                    "courier": str(courier.user_id),
                    "expected_revision": revision,
                },
                format="json",
            )
        finally:
            release.set()
            holder.result(timeout=15)
    assert (response.status_code, response.data["code"], response["Retry-After"]) == (
        429,
        "scheduling_in_progress",
        "1",
    )
    assert TaskOwnership.objects.get().courier_id == planner.member.user_id
    assert schedule_revision(planner.member.organization) == revision
    assert set(CourierChange.objects.values_list("pk", flat=True)) == before


def test_assignment_producer_projects_only_assignment_fields_and_hides_metadata():
    from scheduling.courier_feed import AssignmentProducerSerializer

    payload = {
        "id": str(uuid4()),
        "kind": "quadrant_assignment",
        "quadrant_id": str(uuid4()),
        "courier": str(uuid4()),
        "revision": 1,
    }
    serializer = AssignmentProducerSerializer(
        data={
            **payload,
            "organization_id": str(uuid4()),
            "center_id": str(uuid4()),
        }
    )
    assert serializer.is_valid(), serializer.errors
    assert serializer.data == payload


@pytest.mark.django_db
def test_bootstrap_includes_future_tasks_before_cursor_covers_them(monkeypatch):
    from scheduling.selectors import local_midnight

    planner = planner_setup()
    next_week = week_start(planner.member.organization, WEEK) + timedelta(days=7)
    clock = [local_midnight(planner.member.organization, next_week) - timedelta(minutes=5)]
    monkeypatch.setattr(timezone, "now", lambda: clock[0])
    phone = planning_phone(planner.member)
    change_assignment(
        planner.member, AssignmentChange(planner.quadrant.pk, planner.member.user_id, 0)
    )
    generate_schedule(planner.member, next_week)
    task = ScheduledTask.objects.get()
    upload = store_upload(
        planner.member,
        "future.csv",
        (f"block_code,category,protocol\n{planner.point.block.code},high,next week\n".encode()),
    )
    risk_import = preview_import(
        planner.member, ImportPreview(upload.pk, next_week, "company_rule")
    )
    apply_import(planner.member, risk_import.pk, 1)
    bundle = phone.client.get("/api/v1/field/bootstrap/")
    assert bundle.status_code == 200
    rows = [row for row in bundle.data["assignments"] if row["kind"] == "task"]
    assert [
        (row["id"], row["date"], row["category"], row["source"], row["protocol"]) for row in rows
    ] == [(str(task.pk), next_week.isoformat(), "high", "company_rule", "next week")]
    clock[0] += timedelta(
        minutes=10
    )  # Cross the week boundary within the same access-token lifetime.
    assert week_start(planner.member.organization, clock[0].date()) == next_week
    pulled = phone.sync([], cursor=bundle.data["cursor"])
    assert pulled.status_code == 200
    assert pulled.data["changes"]["assignments"] == []


def reading_schedule_field(convention, interval):
    from dataclasses import replace

    from scheduling.selectors import local_midnight
    from tests.ovitrap_support import setup_field

    field = setup_field()
    field.batch.organization.epi_week = convention
    field.batch.organization.save(update_fields=["epi_week"])
    field.profile.permission_codes += [SCHEDULE_MANAGE, SCHEDULE_READ]
    field.profile.save(update_fields=["permission_codes"])
    parameter = RuleParameterFactory(
        organization=field.batch.organization, key="revisit_interval_days"
    )
    RuleParameterVersionFactory(
        parameter=parameter, value=interval, effective_from=NOW - timedelta(days=30)
    )
    field.week = week_start(field.batch.organization, WEEK)
    field.placed_at = local_midnight(field.batch.organization, field.week) + timedelta(hours=12)
    field.batch = replace(field.batch, sent_at=field.placed_at, received_at=field.placed_at)
    return field


@pytest.mark.django_db
@pytest.mark.parametrize("interval", [1, 3])
@pytest.mark.parametrize("convention", ["iso", "mmwr"])
def test_generation_checks_once_per_epi_week_and_stops_after_real_reading(
    monkeypatch, interval, convention
):
    from dataclasses import replace

    from tests.ovitrap_support import envelope, ingest

    field = reading_schedule_field(convention, interval)
    clock = [field.placed_at]
    monkeypatch.setattr(timezone, "now", lambda: clock[0])
    assert ingest(field, envelope(field, device_time=clock[0])).status == "accepted"
    first = generate_schedule(field.membership, field.week)
    assert first["created"] == 1
    task = ScheduledTask.objects.get()
    assert (task.action, task.due_date) == ("check", field.week + timedelta(days=interval))
    clock[0] += timedelta(days=interval)
    field.batch = replace(field.batch, sent_at=clock[0], received_at=clock[0])
    reading = envelope(field, "ovitrap.check", device_time=clock[0])
    assert ingest(field, reading).status == "accepted"
    assert generate_schedule(field.membership, field.week)["created"] == 0
    assert list(ScheduledTask.objects.values_list("due_date", flat=True)) == [task.due_date]


@pytest.mark.django_db
@pytest.mark.parametrize("is_voided", [False, True])
def test_week_reading_suppresses_generation_only_until_voided(monkeypatch, is_voided):
    from dataclasses import replace

    from tests.ovitrap_support import envelope, ingest

    field = reading_schedule_field("iso", 3)
    clock = [field.placed_at]
    monkeypatch.setattr(timezone, "now", lambda: clock[0])
    assert ingest(field, envelope(field, device_time=clock[0])).status == "accepted"
    clock[0] += timedelta(days=1)
    field.batch = replace(field.batch, sent_at=clock[0], received_at=clock[0])
    reading = envelope(field, "ovitrap.check", device_time=clock[0])
    assert ingest(field, reading).status == "accepted"
    if is_voided:
        void = envelope(
            field,
            "record.void",
            device_time=clock[0],
            voids_event_id=reading.id,
            payload={"reason_code": "other", "reason": "Corrected field observation"},
        )
        assert ingest(field, void).status == "accepted"
    assert generate_schedule(field.membership, field.week)["created"] == int(is_voided)
    assert list(ScheduledTask.objects.values_list("due_date", flat=True)) == (
        [field.week + timedelta(days=3)] if is_voided else []
    )


@pytest.mark.django_db
@pytest.mark.parametrize(("setting", "value"), [("timezone", "UTC"), ("epi_week", "mmwr")])
def test_scope_loss_hides_import_even_when_week_policy_changes(setting, value):
    from rest_framework.exceptions import NotFound

    planner = planner_setup()
    risk_import = preview(planner)
    planner.member.scope["quadrants"] = {"mode": "none", "ids": []}
    planner.member.save(update_fields=["scope"])
    setattr(planner.member.organization, setting, value)
    planner.member.organization.save(update_fields=[setting])
    with pytest.raises(NotFound):
        apply_import(planner.member, risk_import.pk, 0)  # Both policy and revision are stale.
    assert not RiskCategoryVersion.objects.exists()
    assert not RiskImportApplication.objects.exists()


def test_task_feed_preserves_completion_from_the_schedule_projection():
    from scheduling.courier_feed import AssignmentProducerSerializer, task_payload

    row = {
        "id": str(uuid4()),
        "quadrant_id": str(uuid4()),
        "courier": str(uuid4()),
        "revision": 1,
        "organization_id": str(uuid4()),
        "center_id": str(uuid4()),
        "code": "P:check:2026-02-02",
        "point": str(uuid4()),
        "action": "check",
        "date": "2026-02-02",
        "category": None,
        "source": None,
        "protocol": None,
        "is_completed": True,
        "target": 40,
    }
    produced = task_payload(row)
    assert produced["is_completed"] is True
    serializer = AssignmentProducerSerializer(data=produced)
    assert serializer.is_valid(), serializer.errors
    assert serializer.data["is_completed"] is True


@pytest.mark.django_db
def test_regeneration_keeps_one_check_when_future_revisit_rules_change(monkeypatch):
    from scheduling.selectors import local_midnight
    from tests.ovitrap_support import envelope, ingest

    field = reading_schedule_field("iso", 3)
    monkeypatch.setattr(timezone, "now", lambda: field.placed_at)
    assert ingest(field, envelope(field, device_time=field.placed_at)).status == "accepted"
    assert generate_schedule(field.membership, field.week)["created"] == 1
    from rules.models import RuleParameter

    parameter = RuleParameter.objects.get(
        organization=field.batch.organization, key="revisit_interval_days"
    )
    RuleParameterVersionFactory(
        parameter=parameter,
        value=1,
        effective_from=local_midnight(field.batch.organization, field.week + timedelta(days=1)),
    )
    assert generate_schedule(field.membership, field.week)["created"] == 0
    assert list(ScheduledTask.objects.values_list("due_date", flat=True)) == [
        field.week + timedelta(days=3)
    ]
