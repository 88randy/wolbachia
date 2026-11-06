"""Public review-parent evidence lifecycle with real subject-vector authorization."""

import hashlib
from types import SimpleNamespace
from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from organizations.models import Membership
from organizations.scope import deny_scope
from tests.review_support import reviewed_open, reviewer
from tests.test_uploads_b_04 import image_bytes
from uploads.models import AttachmentLink, Upload, UploadSource, UploadVerification
from uploads.services import LEASE_HEADER

pytestmark = pytest.mark.django_db(transaction=True)

UPLOADS = "/api/v1/field/uploads/"


@pytest.fixture
def review_upload(org_a, make_member, tmp_path, settings, monkeypatch):
    # Keep durable review causes; only unrelated asynchronous notice delivery is isolated.
    monkeypatch.setattr("incidents.tasks.publish_incident_notices.delay", lambda *_args: None)
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "private"
    _phone, _motorcycle, item, _capture = reviewed_open(org_a, make_member, code="B281-UPLOAD-A")
    actor = reviewer(org_a, make_member)
    client = APIClient()
    client.force_authenticate(actor.user)
    content = image_bytes(metadata=True)
    context = {"kind": "review_item", "id": str(item.pk)}
    metadata = {
        "client_id": str(uuid4()),
        "content_type": "image/png",
        "size_bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
        "context": context,
    }
    authorization = client.post(UPLOADS, metadata, format="json")
    assert authorization.status_code == 201, authorization.data
    identifier = authorization.data["upload_id"]
    base = f"{UPLOADS}{identifier}/"
    renewal = client.post(f"{base}renew/")
    assert renewal.status_code == 200, renewal.data
    assert renewal.data["upload_id"] == identifier
    assert (
        client.generic(
            "PUT",
            authorization.data["url"],
            content,
            content_type="image/png",
            HTTP_UPLOAD_LEASE=renewal.data["headers"][LEASE_HEADER],
        ).status_code
        == 204
    )
    finalized = client.post(f"{base}finalize/", {"context": context}, format="json")
    assert (finalized.status_code, finalized.data["state"]) == (200, "verified")
    download = f"/api/v1/attachments/{identifier}/download/"
    assert client.get(download).status_code == 200
    return SimpleNamespace(
        actor=actor,
        client=client,
        item=item,
        metadata=metadata,
        identifier=identifier,
        base=base,
        download=download,
        finalized=finalized.data,
    )


def test_review_parent_public_lifecycle_and_same_target_replay_keep_one_immutable_binding(
    review_upload,
):
    case = review_upload
    link = AttachmentLink.objects.get(upload__public_id=case.identifier)
    assert (link.review_item_id, link.field_event_id, link.fault_id, link.incident_id) == (
        case.item.pk,
        None,
        None,
        None,
    )
    repeated = case.client.post(UPLOADS, case.metadata, format="json")
    assert (repeated.status_code, repeated.data["upload_id"]) == (201, case.identifier)
    finalized = case.client.post(f"{case.base}finalize/", {}, format="json")
    assert finalized.status_code == 200
    assert finalized.data == case.finalized
    link.refresh_from_db()
    assert link.created_by_id == case.actor.user.pk
    assert AttachmentLink.objects.get(upload__public_id=case.identifier).pk == link.pk
    assert UploadSource.objects.filter(upload=link.upload).count() == 1
    assert UploadVerification.objects.filter(upload=link.upload).count() == 1


@pytest.mark.parametrize(
    "revoked", ["field.upload", "review_item.decide", "review_item.read", "scope"]
)
def test_bound_review_upload_rechecks_current_attach_and_read_authority(review_upload, revoked):
    case = review_upload
    member = Membership.objects.get(user=case.actor.user, organization=case.actor.organization)
    if revoked == "scope":
        member.scope = deny_scope()
        member.save(update_fields=["scope"])
    else:
        profile = member.profiles.get()
        profile.permission_codes.remove(revoked)
        profile.save(update_fields=["permission_codes"])

    renewal = case.client.post(f"{case.base}renew/")
    expected_renewal = (
        403 if revoked == "field.upload" else 200 if revoked == "review_item.read" else 404
    )
    assert renewal.status_code == expected_renewal
    expected_download = 404 if revoked in {"review_item.read", "scope"} else 200
    assert case.client.get(case.download).status_code == expected_download
    assert (
        AttachmentLink.objects.get(upload__public_id=case.identifier).review_item_id == case.item.pk
    )


def test_review_upload_rejects_foreign_parent_metadata_and_foreign_byte_reader(
    review_upload, org_b, make_member
):
    case = review_upload
    _phone, _motorcycle, foreign_item, _capture = reviewed_open(
        org_b, make_member, code="B281-FOREIGN"
    )
    identifier = str(uuid4())
    metadata = {
        **case.metadata,
        "client_id": identifier,
        "context": {"kind": "review_item", "id": str(foreign_item.pk)},
    }
    denied = case.client.post(UPLOADS, metadata, format="json")
    assert (denied.status_code, denied.data["code"]) == (404, "not_found")
    assert not Upload.objects.filter(public_id=identifier).exists()
    foreign = APIClient()
    foreign.force_authenticate(reviewer(org_b, make_member).user)
    assert foreign.post(f"{case.base}renew/").status_code == 404
    assert foreign.get(case.download).status_code == 404


def test_review_upload_cannot_be_reparented_to_another_authorized_review(
    review_upload, make_member
):
    case = review_upload
    _phone, _motorcycle, another, _capture = reviewed_open(
        case.actor.organization, make_member, code="B281-UPLOAD-B"
    )
    link = AttachmentLink.objects.get(upload__public_id=case.identifier)
    response = case.client.post(
        f"{case.base}finalize/",
        {"context": {"kind": "review_item", "id": str(another.pk)}},
        format="json",
    )
    assert (response.status_code, response.data["code"]) == (409, "upload_already_bound")
    link.refresh_from_db()
    assert link.review_item_id == case.item.pk
    assert AttachmentLink.objects.get(upload__public_id=case.identifier).pk == link.pk
