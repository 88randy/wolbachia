"""B-04 private immutable evidence, actual image/filesystem and scoped consumer wiring."""

import hashlib
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import timedelta
from io import BytesIO
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from django.db import DatabaseError, OperationalError, connection, transaction
from django.http import Http404
from PIL import Image
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient

from core.exceptions import FieldValidationError
from fleet.exceptions import FleetConflictError
from fleet.models import InspectionClearance
from fleet.services import ClearanceRequest, clear_fault
from tests.factories import MotorcycleFactory
from tests.fleet_support import grant_fleet_scope
from tests.ovitrap_support import CAPTURED, envelope, ingest, setup_field
from tests.test_fleet_b_05 import make_fault
from tests.test_inventory_allocations_b_10 import allocation as allocation
from uploads.access import UploadActor
from uploads.exceptions import UploadConflictError, UploadInProgressError, UploadStorageError
from uploads.images import sanitize_image
from uploads.models import AttachmentLink, Upload, UploadLease, UploadSource, UploadVerification
from uploads.services import (
    LEASE_HEADER,
    UploadBody,
    UploadRequest,
    authorize_upload,
    download_attachment,
    finalize_upload,
    receive_upload,
    renew_upload,
)
from uploads.storage import read_object, store_source
from uploads.targets import AttachmentTarget


def image_bytes(kind="PNG", *, metadata=False):
    output = BytesIO()
    image = Image.new("RGB", (5, 3), color=(20, 40, 60))
    options = {}
    if kind == "PNG" and metadata:
        image = Image.new("P", (5, 3))
        image.putpalette([20, 40, 60, 70, 80, 90, 100, 110, 120] + [0] * 759)
        image.putdata([0, 1, 2, 1, 0, 2, 0, 1, 0, 2, 1, 2, 0, 2, 1])
        options["transparency"] = bytes([0, 128, 255])
    if metadata:
        exif = Image.Exif()
        exif[270] = "Synthetic private metadata"
        exif[274] = 6
        options["exif"] = exif
    image.save(output, format=kind, **options)
    return output.getvalue()


@pytest.mark.parametrize("kind", ["JPEG", "PNG"])
def test_actual_image_decode_strips_metadata_and_preserves_oriented_pixels(kind):
    original = image_bytes(kind, metadata=True)
    cleaned = sanitize_image(original, "image/jpeg" if kind == "JPEG" else "image/png")
    with Image.open(BytesIO(cleaned.content)) as image:
        image.load()
        assert not image.getexif()
        assert not {"exif", "xmp", "icc_profile", "comment", "text"} & image.info.keys()
        assert image.size == (3, 5)
        if kind == "PNG":
            assert image.mode == "RGBA"
            assert image.getpixel((2, 0)) == (20, 40, 60, 0)
            assert image.getpixel((2, 1)) == (70, 80, 90, 128)
            assert image.getpixel((2, 2)) == (100, 110, 120, 255)
            assert image.getpixel((0, 0)) == (70, 80, 90, 128)
        else:
            assert all(
                abs(actual - expected) <= 3
                for actual, expected in zip(image.getpixel((0, 0)), (20, 40, 60), strict=True)
            )
    assert hashlib.sha256(original).hexdigest() != cleaned.sha256


@pytest.mark.parametrize("failure", ["mismatch", "truncated", "not_image", "pixels"])
def test_invalid_or_unbounded_content_never_becomes_sanitized_evidence(failure, monkeypatch):
    original = image_bytes()
    declared = "image/jpeg" if failure == "mismatch" else "image/png"
    if failure == "truncated":
        original = original[:32]
    elif failure == "not_image":
        original = b"not an image"
    elif failure == "pixels":
        monkeypatch.setattr("uploads.images.MAX_IMAGE_PIXELS", 1)
    with pytest.raises(FieldValidationError):
        sanitize_image(original, declared)


def test_sanitized_output_is_bounded_independently_of_the_valid_original(monkeypatch):
    image = Image.new("RGB", (100, 100))
    image.putdata(
        [(column % 256, (column * 17) % 256, (column * 41) % 256) for column in range(10_000)]
    )
    original = BytesIO()
    image.save(original, format="JPEG", quality=1)
    content = original.getvalue()
    monkeypatch.setattr("uploads.images.MAX_UPLOAD_BYTES", len(content))
    with pytest.raises(FieldValidationError) as oversized:
        sanitize_image(content, "image/jpeg")
    assert oversized.value.fields["file"][0]["code"] == "upload_sanitized_too_large"


def test_real_storage_retries_use_distinct_immutable_objects(tmp_path, settings):
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "private"
    content = image_bytes()
    expected = (len(content), hashlib.sha256(content).hexdigest())
    first = store_source(BytesIO(content), expected)
    second = store_source(BytesIO(content), expected)
    assert first.key != second.key
    assert read_object(first.key) == read_object(second.key) == content
    assert len(list(settings.UPLOADS_PRIVATE_ROOT.rglob("*.bin"))) == 2


@pytest.mark.parametrize("failure", ["incomplete", "hash", "oversize", "disk"])
def test_coded_storage_failures_leave_no_receipt_candidate(failure, tmp_path, settings):
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "private"
    original = image_bytes()
    expected = (len(original), hashlib.sha256(original).hexdigest())
    content = original
    if failure == "incomplete":
        content = original[:-1]
    elif failure == "hash":
        content = b"x" * len(original)
    elif failure == "oversize":
        content += b"x"
    else:
        settings.UPLOADS_PRIVATE_ROOT.write_bytes(b"Synthetic unavailable storage directory")
    with pytest.raises((FieldValidationError, UploadStorageError)) as invalid:
        store_source(BytesIO(content), expected)
    if failure == "disk":
        assert invalid.value.code == "upload_storage_unavailable"
    else:
        assert (
            invalid.value.fields["file"][0]["code"]
            == {
                "incomplete": "upload_incomplete",
                "hash": "upload_hash_mismatch",
                "oversize": "upload_too_large",
            }[failure]
        )
        assert not list(settings.UPLOADS_PRIVATE_ROOT.rglob("*.bin"))


@pytest.fixture
def private(org_a, make_member, tmp_path, settings):
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "private"
    user, member = grant_fleet_scope(
        make_member(org_a, ["field.upload", "motorcycle.service_clear", "motorcycle.read"])
    )
    return SimpleNamespace(
        actor=UploadActor(user, org_a), member=member, content=image_bytes(metadata=True)
    )


def authorize(private, *, identifier=None, context=None, content_type="image/png"):
    request = UploadRequest(
        content_type,
        len(private.content),
        hashlib.sha256(private.content).hexdigest(),
        identifier or uuid4(),
        context,
    )
    answer = authorize_upload(private.actor, request)
    return UUID(answer["upload_id"]), answer


def put(private, identifier, authorization):
    receive_upload(
        private.actor,
        UploadBody(identifier, authorization["headers"][LEASE_HEADER], BytesIO(private.content)),
    )


@pytest.mark.django_db(transaction=True)
def test_expired_authorization_renews_same_identity_and_lost_responses_do_not_replace_bytes(
    private, monkeypatch
):
    monkeypatch.setattr("uploads.services.server_now", lambda: CAPTURED)
    identifier, lease = authorize(private)
    assert authorize(private, identifier=identifier)[1] == lease
    monkeypatch.setattr("uploads.services.server_now", lambda: CAPTURED + timedelta(minutes=15))
    with pytest.raises(UploadConflictError) as expired:
        put(private, identifier, lease)
    assert expired.value.code == "upload_lease_expired"
    renewed = renew_upload(private.actor, identifier)
    assert renewed["upload_id"] == str(identifier)
    assert renewed["headers"] != lease["headers"]
    put(private, identifier, renewed)
    # A lost PUT response is retried against the original receipt, never overwrites it.
    receive_upload(
        private.actor,
        UploadBody(identifier, renewed["headers"][LEASE_HEADER], BytesIO(b"different bytes")),
    )
    first = finalize_upload(private.actor, identifier)
    assert finalize_upload(private.actor, identifier) == first
    assert first["state"] == "verified"
    source = UploadSource.objects.get(upload__public_id=identifier)
    verification = UploadVerification.objects.get(upload=source.upload)
    assert read_object(source.object_key) == private.content
    assert source.sha256 != verification.sha256
    assert UploadSource.objects.count() == UploadVerification.objects.count() == 1
    with pytest.raises(Http404):
        download_attachment(private.actor, identifier)


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("phase", ["put", "finalize"])
def test_lost_ack_after_real_commit_preserves_referenced_bytes_and_same_id_replay(
    private, monkeypatch, phase
):
    import uploads.services as services

    fault = make_fault(
        MotorcycleFactory(organization=private.actor.organization), private.actor.user
    )
    identifier, lease = authorize(private, context=AttachmentTarget("motorcycle_fault", fault.pk))
    if phase == "finalize":
        put(private, identifier, lease)
    commit = connection.commit
    storage_name = "store_source" if phase == "put" else "store_verified"
    store = getattr(services, storage_name)
    is_armed = False

    def arm_after_real_storage(*args):
        nonlocal is_armed
        candidate = store(*args)
        is_armed = True
        return candidate

    def commit_then_lose_ack():
        nonlocal is_armed
        commit()  # Real PostgreSQL commit, not a fact store or a replaced transaction boundary.
        if is_armed:
            is_armed = False
            raise OperationalError("Synthetic acknowledgement lost after successful commit")

    with monkeypatch.context() as committed_ack:
        committed_ack.setattr(services, storage_name, arm_after_real_storage)
        committed_ack.setattr(connection, "commit", commit_then_lose_ack)
        if phase == "put":
            with pytest.raises(OperationalError, match="Synthetic acknowledgement lost"):
                put(private, identifier, lease)
        else:
            with pytest.raises(OperationalError, match="Synthetic acknowledgement lost"):
                finalize_upload(private.actor, identifier)
    source = UploadSource.objects.get(upload__public_id=identifier)
    assert read_object(source.object_key) == private.content
    assert source.sha256 == hashlib.sha256(private.content).hexdigest()
    if phase == "finalize":
        committed = UploadVerification.objects.get(upload=source.upload)
        assert hashlib.sha256(read_object(committed.object_key)).hexdigest() == committed.sha256
    put(private, identifier, lease)
    verified = finalize_upload(private.actor, identifier)
    assert finalize_upload(private.actor, identifier) == verified
    verification = UploadVerification.objects.get(upload=source.upload)
    content, content_type = download_attachment(private.actor, identifier)
    assert hashlib.sha256(content).hexdigest() == verification.sha256
    assert content_type == "image/png"
    assert UploadSource.objects.count() == UploadVerification.objects.count() == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("failure", ["type", "disk"])
def test_failed_storage_or_verification_cannot_certify_and_capture_file_remains_retryable(
    private, failure, settings
):
    identifier, lease = authorize(
        private, content_type="image/jpeg" if failure == "type" else "image/png"
    )
    content = private.content
    if failure == "disk":
        settings.UPLOADS_PRIVATE_ROOT.write_bytes(b"Synthetic unavailable storage directory")
    if failure == "type":
        put(private, identifier, lease)
        with pytest.raises(FieldValidationError) as invalid:
            finalize_upload(private.actor, identifier)
        assert invalid.value.fields["file"][0]["code"] == "upload_type_mismatch"
    else:
        with pytest.raises((FieldValidationError, UploadStorageError)):
            receive_upload(
                private.actor,
                UploadBody(identifier, lease["headers"][LEASE_HEADER], BytesIO(content)),
            )
    assert not UploadVerification.objects.exists()
    assert (
        private.content == read_object(UploadSource.objects.get().object_key)
        if failure == "type"
        else not UploadSource.objects.exists()
    )


@pytest.mark.django_db(transaction=True)
def test_clear_fault_consumes_only_its_bound_verified_evidence_and_private_download_rechecks_read_authority(
    private,
):
    motorcycle = MotorcycleFactory(organization=private.actor.organization)
    fault = make_fault(motorcycle, private.actor.user)
    target = AttachmentTarget("motorcycle_fault", fault.pk)
    identifier, lease = authorize(private, context=target)
    request = ClearanceRequest(fault.pk, [identifier], "Inspected repaired equipment", 0)
    with pytest.raises(FleetConflictError) as blocked:
        clear_fault(motorcycle, private.actor.user, request)
    assert blocked.value.code == "motorcycle_evidence_not_ready"
    assert not InspectionClearance.objects.exists()
    put(private, identifier, lease)
    finalize_upload(private.actor, identifier)
    other = MotorcycleFactory(organization=private.actor.organization)
    other_fault = make_fault(other, private.actor.user)
    with pytest.raises(FleetConflictError):
        clear_fault(other, private.actor.user, replace(request, fault_id=other_fault.pk))
    clear_fault(motorcycle, private.actor.user, request)
    assert InspectionClearance.objects.get().fault_id == fault.pk
    sanitized, mime = download_attachment(private.actor, identifier)
    assert mime == "image/png"
    assert not Image.open(BytesIO(sanitized)).getexif()
    with pytest.raises(UploadConflictError) as bound:
        finalize_upload(
            private.actor, identifier, AttachmentTarget("motorcycle_fault", other_fault.pk)
        )
    assert bound.value.code == "upload_already_bound"
    profile = private.member.profiles.get()
    profile.permission_codes.remove("motorcycle.read")
    profile.save(update_fields=["permission_codes"])
    with pytest.raises(Http404):
        download_attachment(private.actor, identifier)


@pytest.mark.django_db(transaction=True)
def test_lab_rejection_consumes_real_verified_bytes_and_exact_void_only_parent_access(
    monkeypatch, make_member, tmp_path, settings
):
    from lab.access import LabTarget
    from organizations.models import all_scope
    from tests.lab_support import capture_bag, command, lab_context, receive, synthetic_method

    context = lab_context(monkeypatch)
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "lab-private"
    private = SimpleNamespace(actor=context.actor, member=context.member, content=image_bytes())
    method = synthetic_method(context)
    bag = capture_bag(context)
    receive(context, bag)
    identifier, lease = authorize(private)
    put(private, identifier, lease)
    finalize_upload(private.actor, identifier)
    result = command(
        context,
        "reject",
        LabTarget("bag", bag.pk),
        {
            "expected_revision": 0,
            "method_version": method.pk,
            "reason": "Synthetic physical sample integrity rejection",
            "evidence_ids": [identifier],
        },
    )
    rejection_id = UUID(result.body["rejection"]["id"])
    assert AttachmentLink.objects.get(upload__public_id=identifier).lab_rejection_id == rejection_id
    assert (
        finalize_upload(private.actor, identifier, AttachmentTarget("lab_rejection", rejection_id))[
            "state"
        ]
        == "verified"
    )
    user, member = make_member(context.actor.organization, ["egg_count.void"])
    member.scope = all_scope()
    member.save(update_fields=["scope"])
    profile = member.profiles.get()
    profile.scope = all_scope()
    profile.save(update_fields=["scope"])
    reader = UploadActor(user, context.actor.organization)
    content, mime = download_attachment(reader, identifier)
    assert mime == "image/png"
    assert Image.open(BytesIO(content)).size == (5, 3)
    profile.permission_codes = []
    profile.save(update_fields=["permission_codes"])
    with pytest.raises(Http404):
        download_attachment(reader, identifier)


@pytest.mark.django_db
def test_inventory_intent_binds_real_signature_once_and_download_uses_current_action(
    allocation, tmp_path, settings
):
    from inventory.allocations.commands import IntentExecution
    from inventory.allocations.intents import execute_inventory_intent, prepare_inventory_intent
    from inventory.allocations.models import ReturnDeclaration
    from tests.sync_support import event
    from tests.test_inventory_allocations_b_10 import receive_capture

    context = allocation.context
    source, line_id = receive_capture(allocation)
    assert allocation.phone.sync([source]).data["results"][0]["status"] == "accepted"
    returned = event(
        type="supplies.reconcile",
        shift_id=str(allocation.shift_id),
        payload={
            "command_id": str(uuid4()),
            "assignment_id": str(allocation.assignment_id),
            "expected_revision": 1,
            "used": [],
            "shrinkage": [],
            "returned": [
                {
                    "receipt_line_id": str(line_id),
                    "receipt_source_event_id": source["id"],
                    "destination_id": str(context.location.pk),
                    "quantity": "2",
                }
            ],
        },
    )
    assert allocation.phone.sync([returned]).data["results"][0]["status"] == "accepted"
    declaration = ReturnDeclaration.objects.get()
    identifier = uuid4()
    prepared = prepare_inventory_intent(
        context.actor,
        {
            "command_id": uuid4(),
            "kind": "return_accept",
            "declaration_id": declaration.pk,
            "expected_revision": 2,
            "quantity": "2",
            "evidence": [{"upload_id": identifier, "role": "signature"}],
        },
    )
    intent_id = UUID(prepared.body["intent"]["id"])
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "inventory-private"
    private = SimpleNamespace(actor=context.actor, member=context.member, content=image_bytes())
    identifier, lease = authorize(private, identifier=identifier)
    put(private, identifier, lease)
    target = AttachmentTarget("inventory_intent", intent_id)
    assert finalize_upload(private.actor, identifier, target)["state"] == "verified"
    assert finalize_upload(private.actor, identifier, target)["state"] == "verified"
    link = AttachmentLink.objects.get(upload__public_id=identifier)
    assert link.inventory_intent_id == intent_id
    assert AttachmentLink.objects.filter(upload=link.upload).count() == 1
    command = IntentExecution(
        intent_id, "return_accept", declaration.event.assignment.reconciliation.pk
    )
    accepted = execute_inventory_intent(private.actor, command)
    assert execute_inventory_intent(private.actor, command).body == accepted.body
    content, mime = download_attachment(private.actor, identifier)
    assert mime == "image/png"
    assert Image.open(BytesIO(content)).size == (5, 3)
    context.profile.permission_codes.remove("field.upload")
    context.profile.save(update_fields=["permission_codes"])
    assert download_attachment(private.actor, identifier) == (content, mime)
    context.profile.permission_codes = [
        code
        for code in context.profile.permission_codes
        if code not in ("inventory.reconcile", "supply_assignment.reconcile")
    ]
    context.profile.save(update_fields=["permission_codes"])
    with pytest.raises(Http404):
        download_attachment(private.actor, identifier)


def _background(job):
    try:
        return job()
    finally:
        connection.close()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(
    "race", ["renew_put", "revoke_finalize", "session_revoke_finalize", "duplicate_finalize"]
)
def test_unlocked_io_rechecks_lease_permissions_and_unique_verification_before_commit(
    private, monkeypatch, race, settings
):
    import uploads.services as services

    if race == "session_revoke_finalize":
        from accounts.services import DeviceInfo, start_device_session

        issued = start_device_session(
            private.actor.user, private.actor.organization, DeviceInfo(uuid4())
        )
        private.actor = UploadActor(
            private.actor.user,
            private.actor.organization,
            issued.session.device_id,
            issued.session.pk,
            issued.pair.pk,
        )
    identifier, lease = authorize(private)
    if race != "renew_put":
        put(private, identifier, lease)
    reached, released = threading.Event(), threading.Event()
    storage_name = "store_source" if race == "renew_put" else "store_verified"
    original = getattr(services, storage_name)

    def parked(*args):
        assert not connection.in_atomic_block
        candidate = original(*args)
        if threading.current_thread().name.startswith("evidence-race"):
            reached.set()
            assert released.wait(timeout=10)
        return candidate

    monkeypatch.setattr(services, storage_name, parked)
    with ThreadPoolExecutor(max_workers=1, thread_name_prefix="evidence-race") as pool:

        def job():
            return (
                put(private, identifier, lease)
                if race == "renew_put"
                else finalize_upload(private.actor, identifier)
            )

        pending = pool.submit(_background, job)
        try:
            assert reached.wait(timeout=10)
            if race == "renew_put":
                renew_upload(private.actor, identifier)
            elif race == "revoke_finalize":
                profile = private.member.profiles.get()
                profile.is_active = False
                profile.save(update_fields=["is_active"])
            elif race == "session_revoke_finalize":
                from accounts.models import RevokeReason
                from accounts.revocation import Revocation, revoke_user_sessions

                revoke_user_sessions(
                    private.actor.user,
                    Revocation(RevokeReason.ADMIN_REVOKE),
                    private.actor.organization,
                )
            else:
                winner = finalize_upload(private.actor, identifier)
        finally:
            released.set()
        if race == "duplicate_finalize":
            assert pending.result(timeout=10) == winner
            assert UploadVerification.objects.count() == 1
            assert len(list(settings.UPLOADS_PRIVATE_ROOT.rglob("verified/*.bin"))) == 1
        else:
            from accounts.exceptions import SessionRevokedError

            expected = (
                UploadConflictError
                if race == "renew_put"
                else (
                    SessionRevokedError if race == "session_revoke_finalize" else PermissionDenied
                )
            )
            with pytest.raises(expected):
                pending.result(timeout=10)
            assert not UploadVerification.objects.exists()
            assert UploadSource.objects.count() == (0 if race == "renew_put" else 1)
            assert not list(settings.UPLOADS_PRIVATE_ROOT.rglob("verified/*.bin"))


@pytest.fixture
def field(monkeypatch, tmp_path, settings):
    monkeypatch.setattr("django.utils.timezone.now", lambda: CAPTURED)
    settings.UPLOADS_PRIVATE_ROOT = tmp_path / "private"
    return setup_field()


def pending_lifecycle(field, identifier, kind="remove"):
    from field_sync.envelope import describe_payload

    payload = {
        "ovitrap_id": str(field.identity),
        "reason_code": "other",
        "other_text": "Synthetic field observation",
        "evidence_ids": [str(identifier)],
    }
    payload.update(
        {"proposed_location": [-99.9901, 20.0051]}
        if kind == "relocate"
        else {"is_recovered": False}
    )
    return replace(
        envelope(field, f"ovitrap.{kind}"), payload=payload, payload_info=describe_payload(payload)
    )


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("metadata_first", [False, True])
def test_pending_event_reference_survives_review_and_later_finalization_without_acceptance(
    field, metadata_first, settings
):
    from field_sync.models import FieldEvent
    from ovitraps.lifecycle.models import RemovalAttempt

    assert ingest(field, envelope(field)).status == "accepted"
    private = SimpleNamespace(
        actor=UploadActor(field.batch.user, field.batch.organization, field.batch.device.pk),
        content=image_bytes(),
    )
    identifier = uuid4()
    if metadata_first:
        _, lease = authorize(private, identifier=identifier)
    sent = pending_lifecycle(field, identifier)
    verdict = ingest(field, sent)
    assert (verdict.status, verdict.code) == ("in_review", "ovitrap_evidence_required")
    if not metadata_first:
        _, lease = authorize(
            private, identifier=identifier, context=AttachmentTarget("field_event", sent.id)
        )
    assert AttachmentLink.objects.get(upload__public_id=identifier).field_event_id == sent.id
    if metadata_first:
        settings.UPLOADS_PRIVATE_ROOT.write_bytes(b"Synthetic unavailable storage directory")
        with pytest.raises(UploadStorageError):
            put(private, identifier, lease)
        assert FieldEvent.objects.get(pk=sent.id).payload["evidence_ids"] == [str(identifier)]
        settings.UPLOADS_PRIVATE_ROOT.unlink()
    put(private, identifier, lease)
    finalize_upload(private.actor, identifier)
    assert ingest(field, sent) == verdict
    assert FieldEvent.objects.get(pk=sent.id).status == "in_review"
    assert not RemovalAttempt.objects.exists()


@pytest.mark.django_db(transaction=True)
def test_finalized_before_event_binds_once_before_required_operational_effects_and_cannot_be_reused(
    field,
):
    from ovitraps.lifecycle.models import RelocationProposal

    assert ingest(field, envelope(field)).status == "accepted"
    private = SimpleNamespace(
        actor=UploadActor(field.batch.user, field.batch.organization, field.batch.device.pk),
        content=image_bytes(),
    )
    identifier, lease = authorize(private)
    put(private, identifier, lease)
    finalize_upload(private.actor, identifier)
    sent = pending_lifecycle(field, identifier, "relocate")
    assert ingest(field, sent).status == "accepted"
    assert AttachmentLink.objects.get(upload__public_id=identifier).field_event_id == sent.id
    assert RelocationProposal.objects.get().event_id == sent.id
    # An attachment never supplies authority for a second, unrelated source event.
    other = replace(sent, id=uuid4())
    assert ingest(field, other).code == "ovitrap_evidence_required"
    assert AttachmentLink.objects.count() == RelocationProposal.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_archived_photo_requirement_gates_check_even_when_live_catalog_flag_was_removed(field):
    from catalogs.history import remember_catalog_snapshot
    from catalogs.models import CatalogItem
    from catalogs.selectors import build_catalog_snapshot
    from ovitraps.models import OvitrapReading

    assert ingest(field, envelope(field)).status == "accepted"
    finding = CatalogItem.objects.get(
        organization=field.batch.organization, catalog__slug="ovitrap-finding", code="intact"
    )
    finding.requires_photo = True
    finding.save(update_fields=["requires_photo"])
    snapshot = remember_catalog_snapshot(
        field.batch.organization, field.batch.user, build_catalog_snapshot(field.batch.organization)
    )
    finding.requires_photo = False
    finding.save(update_fields=["requires_photo"])
    field.catalog_version = snapshot.version
    missing = envelope(field, "ovitrap.check")
    assert ingest(field, missing).code == "ovitrap_evidence_required"
    assert not OvitrapReading.objects.exists()
    from tests.uploads_support import verified_upload

    upload = verified_upload(field.batch.organization, field.batch.user, device=field.batch.device)
    ready = envelope(field, "ovitrap.check", payload={"evidence_ids": [str(upload.public_id)]})
    assert ingest(field, ready).status == "accepted"
    assert OvitrapReading.objects.get().event_id == ready.id


@pytest.mark.django_db(transaction=True)
def test_upload_endpoint_contract_is_private_and_enforces_current_org_center_quadrant_grants(
    field, org_b, make_member
):
    from accounts.services import DeviceInfo, start_device_session
    from organizations.models import all_scope
    from tests.factories import ProfileFactory
    from tests.test_ovitraps_lifecycle_b_15 import void_event

    issued = start_device_session(
        field.batch.user, field.batch.organization, DeviceInfo(field.batch.device.pk)
    )
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issued.access}")
    content = image_bytes()
    metadata = {
        "content_type": "image/png",
        "size_bytes": len(content),
        "sha256": hashlib.sha256(content).hexdigest(),
    }
    field.profile.permission_codes.remove("field.upload")
    field.profile.save(update_fields=["permission_codes"])
    assert client.post("/api/v1/field/uploads/", metadata, format="json").status_code == 403
    field.profile.permission_codes.append("field.upload")
    field.profile.save(update_fields=["permission_codes"])
    authorized = client.post("/api/v1/field/uploads/", metadata, format="json")
    assert authorized.status_code == 201
    assert set(authorized.data) == {"upload_id", "url", "method", "headers", "expires_at"}
    identifier = authorized.data["upload_id"]
    assert (
        client.generic(
            "PUT",
            authorized.data["url"],
            content,
            content_type="image/png",
            HTTP_UPLOAD_LEASE=authorized.data["headers"][LEASE_HEADER],
        ).status_code
        == 204
    )
    assert (
        client.post(f"/api/v1/field/uploads/{identifier}/finalize/", {}, format="json").data[
            "state"
        ]
        == "verified"
    )
    download = f"/api/v1/attachments/{identifier}/download/"
    assert client.get(download).status_code == 404
    source = envelope(field, payload={"evidence_ids": [identifier]})
    assert ingest(field, source).status == "accepted"
    response = client.get(download)
    assert response.status_code == 200
    assert response["Cache-Control"] == "private, no-store"
    assert response["X-Content-Type-Options"] == "nosniff"
    # Voiding the source preserves evidence for a currently authorized history reader.
    assert ingest(field, void_event(field, source)).status == "accepted"
    assert client.get(download).status_code == 200
    field.profile.permission_codes.remove("ovitrap.read")
    field.profile.save(update_fields=["permission_codes"])
    assert client.get(download).status_code == 404
    assert client.options(download).status_code == 403
    field.profile.permission_codes.append("ovitrap.read")
    field.profile.save(update_fields=["permission_codes"])
    foreign = APIClient()
    foreign.force_authenticate(make_member(org_b, ["ovitrap.read", "field_event.sync"])[0])
    assert foreign.get(download).status_code == 404
    assert foreign.options(download).status_code == 403
    for dimension in ("centers", "quadrants"):
        field.membership.scope = {
            **all_scope(),
            dimension: {"mode": "selected", "ids": [str(uuid4())]},
        }
        field.membership.save(update_fields=["scope"])
        assert client.get(download).status_code == 404
    field.membership.scope = all_scope()
    field.membership.save(update_fields=["scope"])
    center, quadrant = str(field.point.center_id), str(field.point.quadrant_id)
    field.profile.scope = {
        "centers": {"mode": "selected", "ids": [center]},
        "quadrants": {"mode": "selected", "ids": [str(uuid4())]},
    }
    field.profile.save(update_fields=["scope"])
    field.membership.profiles.add(
        ProfileFactory(
            organization=field.batch.organization,
            permission_codes=["ovitrap.read", "field_event.sync"],
            scope={
                "centers": {"mode": "selected", "ids": [str(uuid4())]},
                "quadrants": {"mode": "selected", "ids": [quadrant]},
            },
        )
    )
    assert client.get(download).status_code == 404


@pytest.mark.django_db(transaction=True)
def test_download_discards_read_bytes_after_current_parent_permission_was_revoked(
    private, monkeypatch
):
    import uploads.services as services

    motorcycle = MotorcycleFactory(organization=private.actor.organization)
    fault = make_fault(motorcycle, private.actor.user)
    identifier, lease = authorize(private, context=AttachmentTarget("motorcycle_fault", fault.pk))
    put(private, identifier, lease)
    finalize_upload(private.actor, identifier)
    read = services.read_object

    def revoke_after_read(key):
        content = read(key)
        profile = private.member.profiles.get()
        profile.permission_codes.remove("motorcycle.read")
        profile.save(update_fields=["permission_codes"])
        return content

    monkeypatch.setattr(services, "read_object", revoke_after_read)
    with pytest.raises(Http404):
        download_attachment(private.actor, identifier)


@pytest.mark.django_db(transaction=True)
def test_revoked_final_sync_capability_does_not_authorize_private_byte_transport(field):
    from accounts.models import RevokeReason
    from accounts.revocation import Revocation, revoke_user_sessions
    from accounts.services import DeviceInfo, start_device_session

    issued = start_device_session(
        field.batch.user, field.batch.organization, DeviceInfo(field.batch.device.pk)
    )
    revoke_user_sessions(
        field.batch.user,
        Revocation(RevokeReason.ADMIN_REVOKE, allow_final_upload=True),
        field.batch.organization,
    )
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {issued.access}")
    response = client.post(
        "/api/v1/field/uploads/",
        {"content_type": "image/png", "size_bytes": 1, "sha256": "0" * 64},
        format="json",
    )
    assert (response.status_code, response.data["code"]) == (401, "session_revoked")
    from accounts.models import DeviceSession

    assert DeviceSession.objects.get(pk=issued.pair.session_id).final_upload_used_at is None


@pytest.mark.django_db
def test_each_evidence_fact_is_insert_only_even_through_raw_sql(private):
    from tests.uploads_support import verified_upload

    fault = make_fault(
        MotorcycleFactory(organization=private.actor.organization), private.actor.user
    )
    upload = verified_upload(private.actor.organization, private.actor.user, fault=fault)
    statements = [
        (
            upload.pk,
            "UPDATE uploads_upload SET sha256=sha256 WHERE id=%s",
            "DELETE FROM uploads_upload WHERE id=%s",
        ),
        (
            upload.leases.get().pk,
            "UPDATE uploads_uploadlease SET revision=revision WHERE id=%s",
            "DELETE FROM uploads_uploadlease WHERE id=%s",
        ),
        (
            upload.source.pk,
            "UPDATE uploads_uploadsource SET sha256=sha256 WHERE id=%s",
            "DELETE FROM uploads_uploadsource WHERE id=%s",
        ),
        (
            upload.verification.pk,
            "UPDATE uploads_uploadverification SET sha256=sha256 WHERE id=%s",
            "DELETE FROM uploads_uploadverification WHERE id=%s",
        ),
        (
            upload.attachment.pk,
            "UPDATE uploads_attachmentlink SET upload_id=upload_id WHERE id=%s",
            "DELETE FROM uploads_attachmentlink WHERE id=%s",
        ),
    ]
    for identifier, update, delete in statements:
        for statement in (update, delete):
            with (
                pytest.raises(DatabaseError, match="insert-only"),
                transaction.atomic(),
                connection.cursor() as cursor,
            ):
                cursor.execute(statement, [identifier])


@pytest.mark.django_db(transaction=True)
def test_deferred_foreign_key_wait_is_bounded_and_rolls_back_authorization(private, settings):
    from organizations.models import Organization

    settings.SYNC_LOCK_TIMEOUT_MS = 50
    locked, released = threading.Event(), threading.Event()

    def hold_reference():
        with transaction.atomic():
            Organization.objects.select_for_update().get(pk=private.actor.organization.pk)
            locked.set()
            assert released.wait(timeout=10)

    with ThreadPoolExecutor(max_workers=1) as pool:
        pending = pool.submit(_background, hold_reference)
        try:
            assert locked.wait(timeout=10)
            with pytest.raises(UploadInProgressError):
                authorize(private)
            assert not Upload.objects.exists()
            assert not UploadLease.objects.exists()
        finally:
            released.set()
        pending.result(timeout=10)


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("arbitration", ["compatible_fk", "unique_wait"])
def test_late_link_unique_wait_rolls_back_whole_pipeline_and_retry_keeps_exact_binding(
    field, settings, arbitration
):
    from field_sync.exceptions import SyncInProgressError
    from field_sync.models import CourierChange, FieldEvent
    from field_sync.services import sync_batch
    from ovitraps.lifecycle.models import RelocationProposal
    from ovitraps.models import Ovitrap, OvitrapReading
    from tests.uploads_support import verified_upload

    settings.SYNC_LOCK_TIMEOUT_MS = 50
    field.profile.permission_codes.append("field.bootstrap")
    field.profile.save(update_fields=["permission_codes"])
    upload = verified_upload(field.batch.organization, field.batch.user, device=field.batch.device)
    fault = make_fault(MotorcycleFactory(organization=field.batch.organization), field.batch.user)
    first = envelope(field)
    second = envelope(
        field,
        "ovitrap.check",
        index=1,
        device_time=CAPTURED + timedelta(seconds=1),
        payload={"evidence_ids": [str(upload.public_id)]},
    )
    batch = replace(field.batch, sent_at=second.device_time, received_at=second.device_time)
    locked, released = threading.Event(), threading.Event()

    def hold_arbiter():
        with transaction.atomic():
            if arbitration == "compatible_fk":
                Upload.objects.select_for_update(no_key=True).get(pk=upload.pk)
            else:
                AttachmentLink.objects.create(
                    organization=field.batch.organization,
                    created_by=field.batch.user,
                    upload=upload,
                    fault=fault,
                )
            locked.set()
            assert released.wait(timeout=10)

    with ThreadPoolExecutor(max_workers=1) as pool:
        pending = pool.submit(_background, hold_arbiter)
        try:
            assert locked.wait(timeout=10)
            if arbitration == "unique_wait":
                with pytest.raises(SyncInProgressError):
                    sync_batch(batch, [first, second], None)
                assert not FieldEvent.objects.exists()
                assert not Ovitrap.objects.exists()
                assert not OvitrapReading.objects.exists()
                assert not CourierChange.objects.exists()
            else:
                assert [
                    result.status for result in sync_batch(batch, [first, second], None).results
                ] == ["accepted", "accepted"]
        finally:
            released.set()
        pending.result(timeout=10)
    outcome = sync_batch(batch, [first, second], None)
    changes = CourierChange.objects.count()
    assert sync_batch(batch, [first, second], None).results == outcome.results
    assert FieldEvent.objects.count() == 2
    assert OvitrapReading.objects.count() == 1
    assert CourierChange.objects.count() == changes
    link = AttachmentLink.objects.get(upload=upload)
    if arbitration == "compatible_fk":
        assert link.field_event_id == second.id
    else:
        assert link.fault_id == fault.pk
        assert link.field_event_id is None
        # An optional declaration did not rebind or certify this upload for a required gate.
        assert (
            ingest(field, pending_lifecycle(field, upload.public_id, "relocate")).code
            == "ovitrap_evidence_required"
        )
        assert not RelocationProposal.objects.exists()
