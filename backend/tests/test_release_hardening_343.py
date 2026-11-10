"""Hardening follow-up of #116: document binding, provenance exposure and review locks."""

from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack, contextmanager
from datetime import timedelta
from threading import Event
from types import SimpleNamespace

import pytest
from django.db import close_old_connections, transaction

from core.exceptions import FieldValidationError
from field_sync.exceptions import SyncInProgressError
from organizations.models import Organization
from releases.exceptions import ReleaseConflictError
from releases.services import append_permit_version, create_permit
from reviews.actions import ReviewDecisionRequest, _prepare_accept, decide_review
from reviews.exceptions import ReviewBlockedError
from reviews.models import ReviewItem
from reviews.scope import SubjectFacts
from tests.inventory_support import AT
from tests.releases_support import GEOMETRY, accept_release, release_setup
from tests.test_inventory_transfers_106 import verified_upload

pytestmark = pytest.mark.django_db(transaction=True)

FORBIDDEN_PROVENANCE = {
    "training",
    "requirements",
    "transit_reviewer_id",
    "source_payload_hash",
}
FORBIDDEN_NESTED = {
    "subject_id",
    "certification_id",
    "revocation_id",
    "assignment_id",
    "receipt_line_id",
    "receipt_source_event_id",
    "plan_id",
    "capture_owner_id",
}
DECISION = "Reviewed exact original transit photos"


@pytest.fixture
def release_context(org_a, make_member, monkeypatch, settings, tmp_path):
    return release_setup(org_a, make_member, monkeypatch, settings, tmp_path)


def _version_values(context, document_id, **extra):
    return {
        "number": "R343-OFFICIAL",
        "authority": "Synthetic authority",
        "type_id": context.permit_version.type_id,
        "official_document_id": document_id,
        "document_attestation": "Reviewed synthetic official document and geometry",
        "geometry": GEOMETRY,
        "valid_from": AT - timedelta(days=1),
        "valid_to": AT + timedelta(days=2),
        **extra,
    }


def test_disallowed_content_type_is_rejected_as_official_document(release_context):
    context = release_context
    photo = verified_upload(context.actor, "text/html")
    values = _version_values(
        context, photo, code="R343-PHOTO", quadrant_id=context.point.quadrant_id
    )
    with pytest.raises(FieldValidationError) as caught:
        create_permit(context.actor, values)
    assert caught.value.fields == {
        "official_document_id": [{"code": "permit.document_type_invalid", "params": {}}]
    }


def test_document_bound_to_a_version_cannot_back_another_permit_or_version(release_context):
    context = release_context
    bound = context.permit_version.official_document.upload.public_id
    values = _version_values(
        context, bound, code="R343-SECOND", quadrant_id=context.point.quadrant_id
    )
    with pytest.raises(ReleaseConflictError) as second_permit:
        create_permit(context.actor, values)
    assert second_permit.value.blocked_by[0]["reason"] == "permit_document_already_bound"
    with pytest.raises(ReleaseConflictError) as next_version:
        append_permit_version(
            context.actor,
            context.permit.pk,
            _version_values(context, bound, expected_revision=1),
        )
    assert next_version.value.blocked_by[0]["reason"] == "permit_document_already_bound"
    fresh = verified_upload(context.actor, "application/pdf")
    version = append_permit_version(
        context.actor, context.permit.pk, _version_values(context, fresh, expected_revision=1)
    )
    assert version.revision == 2


def test_release_provenance_exposes_regulatory_ids_only(release_context):
    context = release_context
    released = accept_release(context)
    detail = context.phone.client.get(f"/api/v1/releases/{released.pk}/")
    assert detail.status_code == 200, detail.data
    provenance = detail.data["provenance"]
    assert provenance["permit_version"] == str(context.permit_version.pk)
    assert provenance["stock"]["transit_policy_id"] == str(context.transit_policy.pk)
    assert FORBIDDEN_PROVENANCE.isdisjoint(provenance)
    assert FORBIDDEN_NESTED.isdisjoint(provenance["stock"])
    assert FORBIDDEN_NESTED.isdisjoint(provenance["schedule"])


def test_accept_of_release_source_with_unresolved_subjects_is_a_coded_blocker(
    release_context, monkeypatch
):
    context = release_context
    response = context.phone.sync([context.capture])
    assert response.data["results"][0]["code"] == "release_transit_review_required"
    item = ReviewItem.objects.get(field_event_id=context.capture["id"])
    monkeypatch.setattr("reviews.scope.release_subjects", lambda *_args: SubjectFacts())
    with pytest.raises(ReviewBlockedError) as caught:
        decide_review(context.reviewer, item.pk, ReviewDecisionRequest("accept", 0, DECISION))
    assert "source_scope_unavailable" in [row["reason"] for row in caught.value.blocked_by]


def test_review_accept_takes_inventory_lock_for_release_record_source(monkeypatch):
    entered = []

    class Probe:
        def __enter__(self):
            entered.append(True)
            return self

        def __exit__(self, *_args):
            return False

    stop = RuntimeError("stop after the lock decision")

    def halt(*_args):
        raise stop

    monkeypatch.setattr("inventory.transactions.inventory_transaction", lambda **_kw: Probe())
    monkeypatch.setattr("reviews.boundaries.retain_domain_boundary", halt)
    monkeypatch.setattr(
        "reviews.actions.get_handler", lambda *_a: SimpleNamespace(review_adapter=object())
    )
    source = SimpleNamespace(type="release.record", schema_version=1, organization=object())
    evaluation = SimpleNamespace(blockers=(), context=object(), subjects=SubjectFacts())
    with ExitStack() as stack, pytest.raises(RuntimeError) as caught:
        _prepare_accept(stack, source, evaluation)
    assert caught.value is stop
    assert entered == [True]


@contextmanager
def _held_organization_lock(organization):
    locked, finish = Event(), Event()

    def hold():
        close_old_connections()
        try:
            with transaction.atomic():
                Organization.objects.select_for_update().get(pk=organization.pk)
                locked.set()
                assert finish.wait(15), "lock holder was never released"
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(hold)
        try:
            assert locked.wait(15), "lock holder never acquired the organization row"
            yield
        finally:
            finish.set()
        future.result(timeout=15)


def test_lock_not_available_maps_to_429_in_release_handler(release_context):
    context = release_context
    with _held_organization_lock(context.organization):
        response = context.phone.sync([context.capture])
    assert response.status_code == 429, response.data


def test_lock_not_available_maps_to_429_in_review_accept(release_context):
    context = release_context
    response = context.phone.sync([context.capture])
    assert response.data["results"][0]["code"] == "release_transit_review_required"
    item = ReviewItem.objects.get(field_event_id=context.capture["id"])
    with _held_organization_lock(context.organization), pytest.raises(SyncInProgressError):
        decide_review(context.reviewer, item.pk, ReviewDecisionRequest("accept", 0, DECISION))


def test_real_pdf_upload_binds_as_permit_official_document(release_context, tmp_path, settings):
    import hashlib
    from io import BytesIO

    from tests.test_uploads_b_04 import pdf_bytes
    from uploads.services import (
        LEASE_HEADER,
        UploadBody,
        UploadRequest,
        authorize_upload,
        finalize_upload,
        receive_upload,
    )

    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "private"
    context = release_context
    content = pdf_bytes()
    answer = authorize_upload(
        context.actor,
        UploadRequest(
            "application/pdf", len(content), hashlib.sha256(content).hexdigest(), None, None
        ),
    )
    receive_upload(
        context.actor,
        UploadBody(answer["upload_id"], answer["headers"][LEASE_HEADER], BytesIO(content)),
    )
    finalize_upload(context.actor, answer["upload_id"])
    version = append_permit_version(
        context.actor,
        context.permit.pk,
        _version_values(context, answer["upload_id"], expected_revision=1),
    )
    assert version.official_document.content_type == "application/pdf"
