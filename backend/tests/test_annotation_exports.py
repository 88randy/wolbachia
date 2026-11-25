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
    earlier = request_export(api_client, export_requester)
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
