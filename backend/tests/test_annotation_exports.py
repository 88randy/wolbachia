"""Dataset requests retain filters, current authority and private download receipts."""

import csv
import hashlib
import json
from datetime import date, timedelta
from io import BytesIO, StringIO
from types import SimpleNamespace
from uuid import uuid4
from zipfile import ZipFile

import pytest
from django.db import DatabaseError, connection, transaction
from PIL import Image

from lab.access import LabTarget
from lab.commands import execute_lab_command
from lab.models import EggAnnotation
from tests.lab_support import (
    AT,
    actor_with_codes,
    capture_bag,
    command,
    count_input,
    lab_context,
    receive,
)
from tests.uploads_support import verified_upload

EXPORTS = "/api/v1/lab/egg-annotation-exports/"
EXPORT_CODE = "egg_annotation.export"
FILTERS = {"date_from": "2026-02-04", "date_to": "2026-02-04", "format": "coco"}
POINT = {"kind": "point", "x": 0, "y": 0}


@pytest.fixture
def export_requester(org_a, make_member, monkeypatch):
    from organizations.models import all_scope
    from uploads.access import UploadActor

    monkeypatch.setattr("django.utils.timezone.now", lambda: AT)
    monkeypatch.setattr("lab.tasks.build_egg_annotation_export.delay", lambda *_: None)
    user, member = make_member(org_a, [EXPORT_CODE])
    member.scope = all_scope()
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    profile.scope = all_scope()
    profile.save(update_fields=["scope"])
    return SimpleNamespace(actor=UploadActor(user, org_a), member=member)


def export_context(monkeypatch):
    context = lab_context(monkeypatch)
    profile = context.member.profiles.get()
    if EXPORT_CODE not in profile.permission_codes:
        profile.permission_codes = [*profile.permission_codes, EXPORT_CODE]
        profile.save(update_fields=["permission_codes"])
    return context


def annotate(context, code, *, upload=None):
    bag = capture_bag(context, code, new_source=True)
    assert receive(context, bag).status == 200
    image = upload or verified_upload(
        context.actor.organization, context.actor.user, purpose="egg_annotation"
    )
    result = execute_lab_command(
        context.actor,
        count_input(
            context,
            bag,
            1,
            annotation={
                "upload_id": str(image.public_id),
                "marks": [POINT],
                "tool_version": "aedesvision-synthetic-test",
            },
        ),
    )
    assert result.status == 201, result.body
    return EggAnnotation.objects.get(count_id=result.body["count"]["id"])


def request_export(api_client, context, **filters):
    api_client.force_authenticate(context.actor.user)
    response = api_client.post(EXPORTS, {**FILTERS, **filters}, format="json")
    assert response.status_code == 201, response.data
    return response.data


@pytest.mark.django_db
@pytest.mark.parametrize(
    "filters",
    [
        {"date_from": "2026-02-05", "date_to": "2026-02-04"},
        {"date_from": "2025-02-03", "date_to": "2026-02-04"},
        {"date_from": "9999-12-31", "date_to": "9999-12-31"},
    ],
)
def test_export_rejects_unusable_date_ranges(export_requester, api_client, filters):
    api_client.force_authenticate(export_requester.actor.user)
    response = api_client.post(EXPORTS, {**FILTERS, **filters}, format="json")
    assert response.status_code == 400
    assert response.data["code"] == "validation_error"
    assert response.data["fields"]["date_to"][0]["code"] == "annotation_export_date_range"


@pytest.mark.django_db
def test_queued_export_preserves_filters_and_refuses_download(export_requester, api_client):
    exported = request_export(
        api_client,
        export_requester,
        date_from="2025-02-04",
        format="yolo",
        include_voided=True,
    )
    assert exported["status"] == "queued"
    assert exported["date_from"] == "2025-02-04"  # Exactly 366 inclusive calendar days.
    assert exported["format"] == "yolo"
    assert exported["include_voided"] is True
    detail = api_client.get(f"{EXPORTS}{exported['id']}/")
    assert detail.status_code == 200
    assert detail.data["id"] == exported["id"]
    download = api_client.get(f"{EXPORTS}{exported['id']}/download/")
    assert (download.status_code, download.data["code"]) == (
        409,
        "annotation_export_not_ready",
    )


@pytest.mark.django_db
def test_export_history_is_server_paged_newest_first(export_requester, monkeypatch, api_client):
    from lab.annotation_exports import record_export_failure

    earlier = request_export(api_client, export_requester)
    record_export_failure(earlier["id"])
    monkeypatch.setattr("django.utils.timezone.now", lambda: AT + timedelta(seconds=1))
    later = request_export(api_client, export_requester, format="yolo")
    page = api_client.get(EXPORTS, {"page_size": 1})
    assert page.status_code == 200
    assert page.data["count"] == 2
    assert [row["id"] for row in page.data["results"]] == [later["id"]]
    assert earlier["id"] not in str(page.data["results"])
    assert page.data["next"]


@pytest.mark.django_db
def test_polling_does_not_spend_the_export_write_rate_limit(
    export_requester, api_client, monkeypatch
):
    from rest_framework.throttling import ScopedRateThrottle

    monkeypatch.setattr(
        ScopedRateThrottle,
        "THROTTLE_RATES",
        {**ScopedRateThrottle.THROTTLE_RATES, "export": "1/hour"},
    )
    exported = request_export(api_client, export_requester)
    assert api_client.get(EXPORTS).status_code == 200
    assert api_client.get(f"{EXPORTS}{exported['id']}/").status_code == 200
    repeated = api_client.post(EXPORTS, FILTERS, format="json")
    assert repeated.status_code == 429


@pytest.mark.django_db
def test_foreign_organization_cannot_list_read_or_download_export(
    export_requester, api_client, make_member, org_b
):
    exported = request_export(api_client, export_requester)
    foreign, _member = make_member(org_b, [EXPORT_CODE])
    api_client.force_authenticate(foreign)
    assert api_client.get(EXPORTS).data["count"] == 0
    assert api_client.get(f"{EXPORTS}{exported['id']}/").status_code == 404
    assert api_client.get(f"{EXPORTS}{exported['id']}/download/").status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize("operation", ["create", "list", "retrieve", "download"])
def test_every_export_endpoint_requires_its_permission(api_client, make_member, org_a, operation):
    denied, _member = make_member(org_a, ["egg_count.read"])
    api_client.force_authenticate(denied)
    identifier = uuid4()
    if operation == "create":
        response = api_client.post(EXPORTS, FILTERS, format="json")
    elif operation == "list":
        response = api_client.get(EXPORTS)
    else:
        suffix = "download/" if operation == "download" else ""
        response = api_client.get(f"{EXPORTS}{identifier}/{suffix}")
    assert response.status_code == 403


@pytest.mark.django_db
def test_export_is_hidden_when_a_selected_subject_leaves_current_scope(monkeypatch, api_client):
    from organizations.models import default_scope

    context = export_context(monkeypatch)
    annotate(context, "EXPORT-SCOPE-RECHECK")
    exported = request_export(api_client, context)
    profile = context.member.profiles.get()
    profile.scope = default_scope()
    profile.save(update_fields=["scope"])
    assert api_client.get(EXPORTS).data["count"] == 0
    assert api_client.get(f"{EXPORTS}{exported['id']}/").status_code == 404
    assert api_client.get(f"{EXPORTS}{exported['id']}/download/").status_code == 404


def test_dataset_export_is_seeded_for_admin_only():
    from organizations.defaults import DEFAULT_PROFILE_PERMISSIONS

    assert EXPORT_CODE in DEFAULT_PROFILE_PERMISSIONS["admin"]
    assert EXPORT_CODE not in DEFAULT_PROFILE_PERMISSIONS["entomologist"]


@pytest.mark.django_db
@pytest.mark.parametrize("fact", ["request", "status"])
def test_export_sql_rejects_rewriting_retained_request_or_status(
    export_requester, api_client, fact
):
    exported = request_export(api_client, export_requester)
    statements = {
        "request": "UPDATE lab_eggannotationexport SET format='yolo' WHERE id=%s",
        "status": "UPDATE lab_eggannotationexportstatus SET image_count=1 WHERE export_id=%s",
    }
    with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute(statements[fact], [exported["id"]])


@pytest.mark.django_db
def test_export_sql_refuses_terminal_state_before_running(export_requester, api_client):
    from lab.models import EggAnnotationExportStatus

    exported = request_export(api_client, export_requester)
    with pytest.raises(DatabaseError), transaction.atomic():
        EggAnnotationExportStatus.objects.create(
            organization=export_requester.actor.organization,
            export_id=exported["id"],
            actor_kind="system",
            policy_version="egg-annotation-export-v1",
            status="failed",
            revision=2,
            error_code="synthetic_failure",
        )


@pytest.mark.django_db
def test_export_selection_cannot_be_extended_after_queued(monkeypatch, api_client):
    from lab.models import EggAnnotationExportItem

    context = export_context(monkeypatch)
    exported = request_export(api_client, context)
    annotation = annotate(context, "EXPORT-LATE-ANNOTATION")
    with pytest.raises(DatabaseError), transaction.atomic():
        EggAnnotationExportItem.objects.create(
            organization=context.actor.organization,
            created_by=context.actor.user,
            export_id=exported["id"],
            annotation=annotation,
            voided=False,
        )


@pytest.mark.django_db
def test_export_download_fact_requires_same_organization(export_requester, api_client, org_b):
    from lab.models import EggAnnotationExportDownload

    exported = request_export(api_client, export_requester)
    with pytest.raises(DatabaseError), transaction.atomic():  # noqa: PT012 -- deferred FK must be flushed before the test transaction ends.
        EggAnnotationExportDownload.objects.create(
            organization=org_b,
            created_by=export_requester.actor.user,
            export_id=exported["id"],
        )
        with connection.cursor() as cursor:
            cursor.execute("SET CONSTRAINTS annotation_export_download_org_fk IMMEDIATE")


@pytest.mark.django_db
def test_ready_export_totals_disclose_original_count_before_archive_download(
    monkeypatch, api_client, make_member
):
    from lab.annotation_exports import append_export_status
    from lab.independent_qa.models import LabNumericDisclosure
    from lab.models import EggAnnotationExport

    context = export_context(monkeypatch)
    annotation = annotate(context, "EXPORT-TOTAL-DISCLOSURE")
    exported = request_export(api_client, context)
    export = EggAnnotationExport.objects.get(pk=exported["id"])
    append_export_status(export, "running")
    append_export_status(
        export,
        "ready",
        image_count=1,
        box_count=0,
        point_count=1,
        object_key=f"dataset/{uuid4().hex}.zip",
        size_bytes=1,
        sha256="0" * 64,
    )
    viewer = actor_with_codes(context, make_member, (EXPORT_CODE,))
    disclosures = LabNumericDisclosure.objects.filter(
        count=annotation.count, created_by=viewer.user
    )
    assert not disclosures.exists()
    api_client.force_authenticate(viewer.user)
    response = api_client.get(f"{EXPORTS}{exported['id']}/")
    assert response.status_code == 200
    assert (response.data["image_count"], response.data["point_count"]) == (1, 1)
    assert disclosures.exists()


def stored_annotation_upload(context):
    """Persist genuine sanitized bytes outside domain transactions for the eager wiring test."""
    from uploads.images import sanitize_image
    from uploads.models import Upload, UploadLease, UploadSource, UploadVerification
    from uploads.storage import store_source, store_verified

    original = BytesIO()
    image = Image.new("RGB", (2, 3), color="white")
    image.save(original, "PNG")
    source_bytes = original.getvalue()
    cleaned = sanitize_image(source_bytes, "image/png")
    source_object = store_source(
        BytesIO(source_bytes), (len(source_bytes), hashlib.sha256(source_bytes).hexdigest())
    )
    verified_object = store_verified(cleaned.content)
    owner = {"organization": context.actor.organization, "created_by": context.actor.user}
    upload = Upload.objects.create(
        **owner,
        uploader=context.actor.user,
        purpose="egg_annotation",
        content_type="image/png",
        size_bytes=source_object.size_bytes,
        sha256=source_object.sha256,
    )
    lease = UploadLease.objects.create(
        **owner, upload=upload, revision=1, expires_at=AT + timedelta(minutes=15)
    )
    source = UploadSource.objects.create(
        **owner,
        upload=upload,
        lease=lease,
        object_key=source_object.key,
        size_bytes=source_object.size_bytes,
        sha256=source_object.sha256,
    )
    UploadVerification.objects.create(
        **owner,
        upload=upload,
        source=source,
        object_key=verified_object.key,
        size_bytes=verified_object.size_bytes,
        sha256=verified_object.sha256,
        content_type="image/png",
        width=cleaned.width,
        height=cleaned.height,
    )
    return upload


@pytest.mark.django_db
def test_export_filters_author_local_dates_and_void_policy(monkeypatch, make_member):
    from lab.annotation_exports import export_annotation_rows

    context = export_context(monkeypatch)
    kept = annotate(context, "EXPORT-KEPT")
    voided = annotate(context, "EXPORT-VOIDED")
    assert (
        command(
            context,
            "void_count",
            LabTarget("count", voided.count_id),
            {
                "expected_revision": 1,
                "reason_code": "data-entry-error",
                "reason": "Synthetic export policy correction",
            },
        ).status
        == 200
    )
    monkeypatch.setattr("django.utils.timezone.now", lambda: AT - timedelta(days=1))
    annotate(context, "EXPORT-OUTSIDE-DATE")
    monkeypatch.setattr("django.utils.timezone.now", lambda: AT)
    other = actor_with_codes(
        context, make_member, ("bag.receive", "egg_count.create", "field.upload")
    )
    context.actor, previous = other, context.actor
    annotate(context, "EXPORT-OTHER-AUTHOR")
    context.actor = previous
    filters = {
        "date_from": date(2026, 2, 4),
        "date_to": date(2026, 2, 4),
        "author": context.actor.user.pk,
        "include_voided": False,
    }
    assert set(export_annotation_rows(context.actor, filters).values_list("pk", flat=True)) == {
        kept.pk
    }
    included = export_annotation_rows(context.actor, {**filters, "include_voided": True})
    assert set(included.values_list("pk", flat=True)) == {kept.pk, voided.pk}


@pytest.mark.django_db
def test_export_returns_coded_limit_and_creates_no_partial_request(monkeypatch, api_client):
    from lab.models import EggAnnotationExport

    context = export_context(monkeypatch)
    annotate(context, "EXPORT-LIMIT-ONE")
    annotate(context, "EXPORT-LIMIT-TWO")
    monkeypatch.setattr("lab.annotation_exports.MAX_EXPORT_IMAGES", 1)
    api_client.force_authenticate(context.actor.user)
    response = api_client.post(EXPORTS, FILTERS, format="json")
    assert response.status_code == 400
    assert response.data["fields"]["date_to"][0] == {
        "code": "annotation_export_too_many_images",
        "params": {"max_images": 1},
    }
    assert not EggAnnotationExport.objects.exists()


@pytest.mark.django_db
def test_export_snapshot_never_selects_another_organizations_annotations(monkeypatch, api_client):
    from lab.models import EggAnnotationExportItem

    context = export_context(monkeypatch)
    own = annotate(context, "EXPORT-OWN")
    foreign = export_context(monkeypatch)
    annotate(foreign, "EXPORT-FOREIGN")
    exported = request_export(api_client, context)
    assert list(
        EggAnnotationExportItem.objects.filter(export_id=exported["id"]).values_list(
            "annotation_id", flat=True
        )
    ) == [own.pk]


@pytest.mark.django_db(transaction=True)
def test_eager_task_records_failed_code_without_exposing_storage_details(
    monkeypatch, api_client, settings, tmp_path
):
    from lab.tasks import build_egg_annotation_export

    settings.UPLOADS_PRIVATE_ROOT = tmp_path
    monkeypatch.setattr("lab.tasks.build_egg_annotation_export.delay", lambda *_: None)
    context = export_context(monkeypatch)
    annotate(context, "EXPORT-MISSING-BYTES")
    exported = request_export(api_client, context)
    build_egg_annotation_export.apply(args=[exported["id"]]).get(propagate=True)
    detail = api_client.get(f"{EXPORTS}{exported['id']}/")
    assert detail.status_code == 200
    assert detail.data["status"] == "failed"
    assert detail.data["error_code"] == "annotation_export_failed"
    assert detail.data["size_bytes"] is None
    assert str(tmp_path) not in str(detail.data)


@pytest.mark.django_db(transaction=True)
def test_eager_export_downloads_verified_dataset_and_logs_each_download(
    monkeypatch, api_client, settings, tmp_path
):
    from config.celery import app
    from lab.models import EggAnnotationExportDownload, EggAnnotationExportStatus
    from lab.tasks import build_egg_annotation_export

    settings.UPLOADS_PRIVATE_ROOT = tmp_path
    settings.CELERY_TASK_ALWAYS_EAGER = True
    monkeypatch.setitem(app.conf, "task_always_eager", True)
    context = export_context(monkeypatch)
    upload = stored_annotation_upload(context)
    annotation = annotate(context, "PRIVATE-BAG-NEVER-EXPORTED", upload=upload)
    exported = request_export(api_client, context)
    detail = api_client.get(f"{EXPORTS}{exported['id']}/")
    assert detail.data["status"] == "ready", detail.data
    assert (
        detail.data["image_count"],
        detail.data["box_count"],
        detail.data["point_count"],
    ) == (1, 0, 1)
    archive_bytes = download_bytes(api_client, exported["id"])
    assert len(archive_bytes) == detail.data["size_bytes"]
    assert hashlib.sha256(archive_bytes).hexdigest() == detail.data["sha256"]
    with ZipFile(BytesIO(archive_bytes)) as archive:
        manifest = list(csv.DictReader(StringIO(archive.read("manifest.csv").decode())))
        assert len(manifest) == 1
        assert str(annotation.public_id) in str(manifest)
        assert "PRIVATE-BAG" not in str(manifest)
        assert context.actor.user.username not in str(manifest)
        assert json.loads(archive.read("points.json"))["images"][0]["points"] == [[0, 0]]
    download_bytes(api_client, exported["id"])
    receipts = EggAnnotationExportDownload.objects.filter(export_id=exported["id"])
    assert receipts.count() == 2
    assert set(receipts.values_list("created_by_id", flat=True)) == {context.actor.user.pk}
    for statement in (
        "UPDATE lab_eggannotationexportitem SET voided=true WHERE export_id=%s",
        "DELETE FROM lab_eggannotationexportdownload WHERE export_id=%s",
    ):
        with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(statement, [exported["id"]])
    build_egg_annotation_export.apply(args=[exported["id"]]).get(propagate=True)
    assert list(
        EggAnnotationExportStatus.objects.filter(export_id=exported["id"])
        .order_by("status")
        .values_list("status", flat=True)
    ) == ["queued", "ready", "running"]


def download_bytes(api_client, identifier):
    response = api_client.get(f"{EXPORTS}{identifier}/download/")
    assert response.status_code == 200
    assert response["Content-Type"] == "application/zip"
    assert response["Content-Disposition"].startswith("attachment;")
    assert response["Cache-Control"] == "private, no-store"
    assert response["X-Content-Type-Options"] == "nosniff"
    return b"".join(response.streaming_content)


def mark_export_ready(identifier, *, receipt=None):
    from lab.annotation_exports import append_export_status
    from lab.models import EggAnnotationExport
    from uploads.storage import StoredObject

    export = EggAnnotationExport.objects.get(pk=identifier)
    stored = receipt or StoredObject(f"dataset/{uuid4().hex}.zip", 1, "0" * 64)
    append_export_status(export, "running")
    append_export_status(
        export, "ready", object_key=stored.key, size_bytes=stored.size_bytes, sha256=stored.sha256
    )
    return export


@pytest.mark.django_db
@pytest.mark.parametrize("state", ["queued", "running"])
def test_recovery_times_out_only_stale_active_exports(
    export_requester, api_client, monkeypatch, state
):
    from lab.annotation_exports import append_export_status
    from lab.models import EggAnnotationExport
    from lab.tasks import recover_annotation_exports

    exported = request_export(api_client, export_requester)
    export = EggAnnotationExport.objects.get(pk=exported["id"])
    if state == "running":
        append_export_status(export, "running")
    monkeypatch.setattr("django.utils.timezone.now", lambda: AT + timedelta(hours=1))
    assert recover_annotation_exports() == 1
    assert recover_annotation_exports() == 0
    detail = api_client.get(f"{EXPORTS}{export.pk}/")
    assert (detail.data["status"], detail.data["error_code"]) == (
        "failed",
        "annotation_export_timed_out",
    )
    fresh = request_export(api_client, export_requester)
    assert recover_annotation_exports() == 0
    assert api_client.get(f"{EXPORTS}{fresh['id']}/").data["status"] == "queued"


@pytest.mark.django_db
@pytest.mark.parametrize("limit", ["requester", "organization"])
def test_active_export_capacity_is_enforced(export_requester, api_client, make_member, limit):
    first = request_export(api_client, export_requester)
    if limit == "organization":
        second_user, _ = make_member(export_requester.actor.organization, [EXPORT_CODE])
        api_client.force_authenticate(second_user)
        assert api_client.post(EXPORTS, FILTERS, format="json").status_code == 201
        third_user, _ = make_member(export_requester.actor.organization, [EXPORT_CODE])
        api_client.force_authenticate(third_user)
    response = api_client.post(EXPORTS, FILTERS, format="json")
    assert (response.status_code, response.data["code"]) == (409, "annotation_export_in_progress")
    if limit == "requester":
        mark_export_ready(first["id"])
        assert api_client.post(EXPORTS, FILTERS, format="json").status_code == 201


@pytest.mark.django_db
def test_export_verified_byte_limit_reports_cap_and_selected_total(monkeypatch, api_client):
    from lab.models import EggAnnotationExport

    context = export_context(monkeypatch)
    annotation = annotate(context, "EXPORT-BYTE-LIMIT")
    size = annotation.image_upload.verification.size_bytes
    monkeypatch.setattr("lab.annotation_exports.MAX_EXPORT_BYTES", size - 1)
    api_client.force_authenticate(context.actor.user)
    response = api_client.post(EXPORTS, FILTERS, format="json")
    assert response.status_code == 400
    assert response.data["fields"]["date_to"][0] == {
        "code": "annotation_export_too_many_bytes",
        "params": {"max_bytes": size - 1, "total_bytes": size},
    }
    assert not EggAnnotationExport.objects.exists()


@pytest.mark.django_db(transaction=True)
def test_expiry_removes_only_archive_and_retains_status_history(
    export_requester, api_client, settings, tmp_path, monkeypatch
):
    from lab.models import EggAnnotationExport, EggAnnotationExportStatus
    from lab.tasks import expire_annotation_exports
    from uploads.storage import store_dataset_export

    settings.UPLOADS_PRIVATE_ROOT = tmp_path
    settings.ANNOTATION_EXPORT_RETENTION_DAYS = 2
    exported = request_export(api_client, export_requester)
    stored = store_dataset_export(BytesIO(b"synthetic archive"))
    mark_export_ready(exported["id"], receipt=stored)
    assert expire_annotation_exports() == 0
    monkeypatch.setattr("django.utils.timezone.now", lambda: AT + timedelta(days=2))
    response = api_client.get(f"{EXPORTS}{exported['id']}/download/")
    assert (response.status_code, response.data["code"]) == (409, "annotation_export_expired")
    assert expire_annotation_exports() == 1
    assert expire_annotation_exports() == 0
    assert not (tmp_path / stored.key).exists()
    assert EggAnnotationExport.objects.filter(pk=exported["id"]).exists()
    assert list(
        EggAnnotationExportStatus.objects.filter(export_id=exported["id"]).values_list(
            "status", flat=True
        )
    ) == ["expired", "ready", "running", "queued"]
    assert api_client.get(f"{EXPORTS}{exported['id']}/").data["status"] == "expired"
    assert request_export(api_client, export_requester)["status"] == "queued"


@pytest.mark.django_db
def test_repeated_polling_performs_no_numeric_disclosure_inserts(
    monkeypatch, api_client, make_member
):
    from django.test.utils import CaptureQueriesContext

    from lab.annotation_exports import append_export_status
    from lab.models import EggAnnotationExport, LabNumericDisclosure

    context = export_context(monkeypatch)
    annotation = annotate(context, "EXPORT-NO-POLL-WRITE")
    exported = request_export(api_client, context)
    export = EggAnnotationExport.objects.get(pk=exported["id"])
    append_export_status(export, "running")
    append_export_status(
        export,
        "ready",
        image_count=1,
        point_count=1,
        object_key=f"dataset/{uuid4().hex}.zip",
        size_bytes=1,
        sha256="0" * 64,
    )
    viewer = actor_with_codes(context, make_member, (EXPORT_CODE,))
    api_client.force_authenticate(viewer.user)
    assert api_client.get(EXPORTS).status_code == 200
    assert LabNumericDisclosure.objects.filter(
        count=annotation.count, created_by=viewer.user
    ).exists()
    with CaptureQueriesContext(connection) as queries:
        assert api_client.get(EXPORTS).status_code == 200
        assert api_client.get(EXPORTS).status_code == 200
    assert not [
        query for query in queries if 'INSERT INTO "lab_labnumericdisclosure"' in query["sql"]
    ]


@pytest.mark.django_db
@pytest.mark.parametrize("revoked", ["active", "permission"])
def test_worker_refuses_requester_after_authorization_loss(export_requester, api_client, revoked):
    from lab.annotation_exports import run_annotation_export

    exported = request_export(api_client, export_requester)
    if revoked == "active":
        export_requester.actor.user.is_active = False
        export_requester.actor.user.save(update_fields=["is_active"])
    else:
        profile = export_requester.member.profiles.get()
        profile.permission_codes = []
        profile.save(update_fields=["permission_codes"])
    run_annotation_export(exported["id"])
    from lab.models import EggAnnotationExportStatus

    state = EggAnnotationExportStatus.objects.filter(export_id=exported["id"]).first()
    assert (state.status, state.error_code) == (
        "failed",
        "annotation_export_requester_unauthorized",
    )


@pytest.mark.django_db
def test_same_annotation_keeps_each_exports_voided_snapshot(monkeypatch, api_client):
    from lab.annotation_exports import selected_export_annotations
    from lab.models import EggAnnotationExport

    context = export_context(monkeypatch)
    annotation = annotate(context, "EXPORT-TWO-SNAPSHOTS")
    first = request_export(api_client, context, include_voided=True)
    from lab.annotation_exports import record_export_failure

    record_export_failure(first["id"])
    assert (
        command(
            context,
            "void_count",
            LabTarget("count", annotation.count_id),
            {
                "expected_revision": 1,
                "reason_code": "data-entry-error",
                "reason": "Synthetic snapshot correction",
            },
        ).status
        == 200
    )
    second = request_export(api_client, context, include_voided=True)
    for exported, expected in ((first, False), (second, True)):
        rows = list(selected_export_annotations(EggAnnotationExport.objects.get(pk=exported["id"])))
        assert [(row.pk, row.export_voided) for row in rows] == [(annotation.pk, expected)]


@pytest.mark.django_db
def test_head_does_not_create_download_receipts(export_requester, api_client):
    from lab.models import EggAnnotationExportDownload

    exported = request_export(api_client, export_requester)
    assert api_client.head(f"{EXPORTS}{exported['id']}/download/").status_code == 405
    assert not EggAnnotationExportDownload.objects.exists()


@pytest.mark.django_db
def test_download_has_its_own_hourly_throttle(export_requester, api_client, monkeypatch):
    from rest_framework.throttling import ScopedRateThrottle

    monkeypatch.setattr(
        ScopedRateThrottle,
        "THROTTLE_RATES",
        {**ScopedRateThrottle.THROTTLE_RATES, "export_download": "1/hour"},
    )
    exported = request_export(api_client, export_requester)
    url = f"{EXPORTS}{exported['id']}/download/"
    assert api_client.get(url).status_code == 409
    assert api_client.get(url).status_code == 429
    assert api_client.get(EXPORTS).status_code == 200


@pytest.mark.django_db(transaction=True)
def test_cookie_download_resolves_export_membership_without_organization_header(
    export_requester, api_client, make_member, org_b, settings, tmp_path
):
    from uploads.storage import store_dataset_export

    settings.UPLOADS_PRIVATE_ROOT = tmp_path
    exported = request_export(api_client, export_requester)
    stored = store_dataset_export(BytesIO(b"synthetic archive"))
    mark_export_ready(exported["id"], receipt=stored)
    make_member(org_b, [EXPORT_CODE], user=export_requester.actor.user)
    assert api_client.get(EXPORTS).status_code == 400
    assert download_bytes(api_client, exported["id"]) == b"synthetic archive"


@pytest.mark.django_db(transaction=True)
def test_download_reads_no_archive_bytes_until_stream_is_consumed(
    export_requester, api_client, settings, tmp_path, monkeypatch
):
    from uploads.storage import open_dataset_export, store_dataset_export

    settings.UPLOADS_PRIVATE_ROOT = tmp_path
    exported = request_export(api_client, export_requester)
    stored = store_dataset_export(BytesIO(b"synthetic archive"))
    mark_export_ready(exported["id"], receipt=stored)
    opened = []

    def track_open(key):
        archive = open_dataset_export(key)
        opened.append(archive)
        return archive

    monkeypatch.setattr("uploads.storage.open_dataset_export", track_open)
    response = api_client.get(f"{EXPORTS}{exported['id']}/download/")
    assert response.status_code == 200
    assert opened[0].tell() == 0
    assert b"".join(response.streaming_content) == b"synthetic archive"


@pytest.mark.django_db(transaction=True)
def test_stream_aborts_on_archive_hash_mismatch(export_requester, api_client, settings, tmp_path):
    from uploads.exceptions import UploadStorageError
    from uploads.storage import store_dataset_export

    settings.UPLOADS_PRIVATE_ROOT = tmp_path
    exported = request_export(api_client, export_requester)
    stored = store_dataset_export(BytesIO(b"synthetic archive"))
    mark_export_ready(exported["id"], receipt=stored)
    (tmp_path / stored.key).write_bytes(b"corrupted archive")
    response = api_client.get(f"{EXPORTS}{exported['id']}/download/")
    assert response.status_code == 200
    with pytest.raises(UploadStorageError):
        b"".join(response.streaming_content)


@pytest.mark.django_db(transaction=True)
def test_concurrent_requesters_compete_for_one_remaining_organization_slot(
    export_requester, api_client, make_member, monkeypatch
):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from django.db import close_old_connections
    from rest_framework.test import APIClient

    monkeypatch.setattr("lab.tasks.build_egg_annotation_export.delay", lambda *_: None)
    request_export(api_client, export_requester)
    users = [make_member(export_requester.actor.organization, [EXPORT_CODE])[0] for _ in range(2)]
    start = Barrier(2)

    def create(user):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(user)
            start.wait(timeout=10)
            response = client.post(EXPORTS, FILTERS, format="json")
            return response.status_code, response.data.get("code")
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(create, users))
    assert sorted(results, key=lambda result: result[0]) == [
        (201, None),
        (409, "annotation_export_in_progress"),
    ]


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("failure", ["authorization", "ready_insert", "recovery"])
def test_failure_after_storage_discards_unreferenced_archive(
    export_requester, api_client, settings, tmp_path, monkeypatch, failure
):
    from lab.annotation_exports import (
        append_export_status,
        record_export_failure,
        run_annotation_export,
    )
    from lab.models import EggAnnotationExportStatus
    from uploads.storage import store_dataset_export

    settings.UPLOADS_PRIVATE_ROOT = tmp_path
    monkeypatch.setattr("lab.tasks.build_egg_annotation_export.delay", lambda *_: None)
    exported = request_export(api_client, export_requester)

    def store_then_fail(archive):
        receipt = store_dataset_export(archive)
        if failure == "authorization":
            profile = export_requester.member.profiles.get()
            profile.permission_codes = []
            profile.save(update_fields=["permission_codes"])
        elif failure == "recovery":
            record_export_failure(exported["id"], "annotation_export_timed_out")
        return receipt

    def append_or_fail(export, status, **facts):
        if status == "ready" and failure == "ready_insert":
            raise DatabaseError("Synthetic ready insert failure")
        return append_export_status(export, status, **facts)

    monkeypatch.setattr("uploads.storage.store_dataset_export", store_then_fail)
    monkeypatch.setattr("lab.annotation_exports.append_export_status", append_or_fail)
    run_annotation_export(exported["id"])
    assert not list(tmp_path.rglob("*.zip"))
    assert (
        EggAnnotationExportStatus.objects.filter(export_id=exported["id"]).first().status
        == "failed"
    )


@pytest.mark.django_db
def test_expired_transition_refuses_a_failed_predecessor(export_requester, api_client):
    from lab.annotation_exports import append_export_status, record_export_failure
    from lab.models import EggAnnotationExport

    exported = request_export(api_client, export_requester)
    record_export_failure(exported["id"])
    with pytest.raises(DatabaseError), transaction.atomic():
        append_export_status(EggAnnotationExport.objects.get(pk=exported["id"]), "expired")


@pytest.mark.django_db
def test_requester_capacity_spans_active_memberships(
    export_requester, api_client, make_member, org_b
):
    request_export(api_client, export_requester)
    make_member(org_b, [EXPORT_CODE], user=export_requester.actor.user)
    response = api_client.post(
        EXPORTS, FILTERS, format="json", headers={"X-Organization": org_b.slug}
    )
    assert (response.status_code, response.data["code"]) == (409, "annotation_export_in_progress")


def test_annotation_export_maintenance_is_registered_in_beat(settings):
    tasks = {entry["task"]: entry["schedule"] for entry in settings.CELERY_BEAT_SCHEDULE.values()}
    assert tasks["lab.tasks.recover_annotation_exports"] > 0
    assert tasks["lab.tasks.expire_annotation_exports"] > 0


@pytest.mark.django_db(transaction=True)
def test_lost_ready_commit_acknowledgment_preserves_referenced_archive(
    export_requester, api_client, settings, tmp_path, monkeypatch
):
    from lab.annotation_exports import complete_annotation_export, run_annotation_export
    from lab.models import EggAnnotationExportStatus

    settings.UPLOADS_PRIVATE_ROOT = tmp_path
    monkeypatch.setattr("lab.tasks.build_egg_annotation_export.delay", lambda *_: None)
    exported = request_export(api_client, export_requester)

    def complete_then_lose_ack(actor, export, result):
        complete_annotation_export(actor, export, result)
        raise DatabaseError("Synthetic lost commit acknowledgment")

    monkeypatch.setattr("lab.annotation_exports.complete_annotation_export", complete_then_lose_ack)
    run_annotation_export(exported["id"])
    assert (
        EggAnnotationExportStatus.objects.filter(export_id=exported["id"]).first().status == "ready"
    )
    assert len(list(tmp_path.rglob("*.zip"))) == 1
    assert download_bytes(api_client, exported["id"])


@pytest.mark.django_db(transaction=True)
def test_unconsumed_download_response_closes_private_file(
    export_requester, api_client, settings, tmp_path, monkeypatch
):
    from uploads.storage import open_dataset_export, store_dataset_export

    settings.UPLOADS_PRIVATE_ROOT = tmp_path
    monkeypatch.setattr("lab.tasks.build_egg_annotation_export.delay", lambda *_: None)
    exported = request_export(api_client, export_requester)
    mark_export_ready(exported["id"], receipt=store_dataset_export(BytesIO(b"synthetic archive")))
    opened = []

    def track_open(key):
        archive = open_dataset_export(key)
        opened.append(archive)
        return archive

    monkeypatch.setattr("uploads.storage.open_dataset_export", track_open)
    response = api_client.get(f"{EXPORTS}{exported['id']}/download/")
    response.close()
    assert opened[0].closed


@pytest.mark.django_db(transaction=True)
def test_expiry_storage_failure_keeps_ready_fact_retryable(
    export_requester, api_client, settings, tmp_path, monkeypatch
):
    from lab.models import EggAnnotationExportStatus
    from lab.tasks import expire_annotation_exports
    from uploads.exceptions import UploadStorageError
    from uploads.storage import store_dataset_export

    settings.UPLOADS_PRIVATE_ROOT = tmp_path
    monkeypatch.setattr("lab.tasks.build_egg_annotation_export.delay", lambda *_: None)
    exported = request_export(api_client, export_requester)
    mark_export_ready(exported["id"], receipt=store_dataset_export(BytesIO(b"synthetic archive")))
    monkeypatch.setattr("django.utils.timezone.now", lambda: AT + timedelta(days=8))

    def cannot_delete(_key):
        raise UploadStorageError

    with monkeypatch.context() as fault:
        fault.setattr("uploads.storage.discard_dataset_export", cannot_delete)
        assert expire_annotation_exports() == 0
    assert (
        EggAnnotationExportStatus.objects.filter(export_id=exported["id"]).first().status == "ready"
    )
    assert expire_annotation_exports() == 1


@pytest.mark.django_db
@pytest.mark.parametrize("multiple_memberships", [False, True])
def test_malformed_download_identifier_is_concealed_as_missing(
    export_requester, api_client, make_member, org_b, multiple_memberships
):
    api_client.force_authenticate(export_requester.actor.user)
    if multiple_memberships:
        make_member(org_b, [EXPORT_CODE], user=export_requester.actor.user)
    assert api_client.get(f"{EXPORTS}not-a-uuid/download/").status_code == 404


@pytest.mark.django_db(transaction=True)
def test_archive_close_failure_after_storage_discards_unreferenced_zip(
    export_requester, api_client, settings, tmp_path, monkeypatch
):
    import tempfile

    from lab.annotation_exports import run_annotation_export
    from lab.models import EggAnnotationExportStatus

    settings.UPLOADS_PRIVATE_ROOT = tmp_path
    monkeypatch.setattr("lab.tasks.build_egg_annotation_export.delay", lambda *_: None)
    exported = request_export(api_client, export_requester)
    real_temporary_file = tempfile.TemporaryFile
    stored_before_close = []

    class FailingClose:
        def __init__(self, **kwargs):
            self.stream = real_temporary_file(**kwargs)

        def __enter__(self):
            return self.stream

        def __exit__(self, *_args):
            self.stream.close()
            stored_before_close.append(bool(list(tmp_path.rglob("*.zip"))))
            raise OSError("Synthetic archive close failure")

    monkeypatch.setattr(
        "lab.annotation_exports.tempfile", SimpleNamespace(TemporaryFile=FailingClose)
    )
    run_annotation_export(exported["id"])
    assert stored_before_close == [True]
    assert (
        EggAnnotationExportStatus.objects.filter(export_id=exported["id"]).first().status
        == "failed"
    )
    assert not list(tmp_path.rglob("*.zip"))


@pytest.mark.django_db(transaction=True)
def test_expired_totals_publish_once_for_a_new_viewer(
    monkeypatch, api_client, make_member, settings, tmp_path
):
    from django.test.utils import CaptureQueriesContext

    from lab.annotation_exports import append_export_status
    from lab.models import EggAnnotationExport, LabNumericDisclosure
    from lab.tasks import expire_annotation_exports

    settings.UPLOADS_PRIVATE_ROOT = tmp_path
    monkeypatch.setattr("lab.tasks.build_egg_annotation_export.delay", lambda *_: None)
    context = export_context(monkeypatch)
    annotation = annotate(context, "EXPORT-EXPIRED-DISCLOSURE")
    exported = request_export(api_client, context)
    export = EggAnnotationExport.objects.get(pk=exported["id"])
    append_export_status(export, "running")
    append_export_status(
        export,
        "ready",
        image_count=1,
        point_count=1,
        object_key=f"dataset/{uuid4().hex}.zip",
        size_bytes=1,
        sha256="0" * 64,
    )
    monkeypatch.setattr("django.utils.timezone.now", lambda: AT + timedelta(days=8))
    assert expire_annotation_exports() == 1
    viewer = actor_with_codes(context, make_member, (EXPORT_CODE,))
    api_client.force_authenticate(viewer.user)
    response = api_client.get(EXPORTS)
    assert response.data["results"][0]["status"] == "expired"
    assert LabNumericDisclosure.objects.filter(
        count=annotation.count, created_by=viewer.user
    ).exists()
    with CaptureQueriesContext(connection) as queries:
        assert api_client.get(EXPORTS).status_code == 200
    assert not [
        query for query in queries if 'INSERT INTO "lab_labnumericdisclosure"' in query["sql"]
    ]
