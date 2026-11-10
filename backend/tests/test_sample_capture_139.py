"""P20 consumes real self sources and verified methods through existing sync recovery."""

from copy import deepcopy
from dataclasses import replace
from datetime import timedelta
from uuid import uuid4

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.utils.dateparse import parse_datetime

from field_sync.cursor import decode_cursor
from field_sync.exceptions import InvalidCursorError
from field_sync.producers import ProducerContext
from field_sync.selectors import build_bootstrap, producer_context
from field_sync.services import bootstrap_bundle, sync_batch
from lab.methods import write_method
from lab.samples.capture import (
    bound_sample_capture,
    prepare_sample_capture,
    sample_capture_snapshot,
)
from lab.samples.capture_serializers import SampleCaptureSnapshotSerializer
from lab.samples.models import SampleReceipt, WolbachiaSample
from organizations.models import all_scope
from organizations.scope import EffectiveScope
from tests.factories import UserFactory
from tests.ovitrap_support import ingest
from tests.releases_support import accept_release, release_setup
from tests.review_support import audit_current_membership
from tests.test_lab_samples_b_21 import collect, sample_capture, sample_command
from tests.test_lab_samples_b_21 import samples_context as sample_context_fixture

samples_context = sample_context_fixture
pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def sample_context(samples_context):
    context = samples_context
    context.field.profile.permission_codes = [
        code
        for code in [*context.field.profile.permission_codes, "field.bootstrap"]
        if code not in {"lab_method.read", "sample.read"}
    ]
    context.field.profile.revision += 1
    context.field.profile.save(update_fields=["permission_codes", "revision"])
    audit_current_membership(context.field.membership)
    return context


def context_for(context):
    batch = replace(
        context.field.batch, sent_at=context.clock["now"], received_at=context.clock["now"]
    )
    return producer_context(batch, "field.bootstrap")


def position(context, bundle):
    batch = context.field.batch
    return decode_cursor(bundle["cursor"], batch.organization.pk, batch.user.pk)


def test_real_scoped_method_and_reading_are_collectable_without_broad_lab_reads(sample_context):
    context = sample_context
    ctx = context_for(context)
    assert not ctx.scope.allows("lab_method.read")
    assert not ctx.scope.allows("sample.read")
    payload = sample_capture_snapshot(ctx)
    serializer = SampleCaptureSnapshotSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    (method,) = payload["methods"]
    (reading,) = payload["sources"]
    verification = context.method.verifications.get()
    assert method["id"] == str(context.method.pk)
    assert method["verification"]["id"] == str(verification.pk)
    assert method["verification"]["content_hash"] == context.method.content_hash
    assert method["supports_wolbachia"]
    assert "procedure" not in method
    assert reading["id"] == str(context.reading.pk)
    assert reading["event_id"] == str(context.reading.event_id)
    assert reading["author_id"] == str(context.field.batch.user.pk)
    sent = sample_capture(
        context,
        method_version=method["id"],
        source_ref={"kind": reading["kind"], "id": reading["id"]},
    )
    assert ingest(context.field, sent).status == "accepted"
    assert WolbachiaSample.objects.get(event_id=sent.id).reading_id == context.reading.pk


def test_release_and_lot_use_canonical_ids_and_no_invented_custody(
    org_a, make_member, monkeypatch, settings, tmp_path
):
    context = release_setup(org_a, make_member, monkeypatch, settings, tmp_path)
    release = accept_release(context)
    ctx = prepare_sample_capture(
        ProducerContext(
            context.organization,
            context.phone.user,
            EffectiveScope(
                (
                    (
                        frozenset({"field.bootstrap", "field_event.sync", "sample.collect"}),
                        all_scope(),
                    ),
                )
            ),
            context.clock["now"],
            "field.bootstrap",
        )
    )
    sources = sample_capture_snapshot(ctx)["sources"]
    released = next(row for row in sources if row["kind"] == "release")
    lot = next(row for row in sources if row["kind"] == "lot" and row["id"] == str(context.lot.pk))
    assert released["id"] == str(release.pk)
    assert released["event_id"] == str(release.declared_event_id)
    assert released["author_id"] == str(context.phone.user.pk)
    assert lot["lot_version_id"] == str(context.lot.versions.order_by("-revision").first().pk)
    assert lot["author_id"] is lot["event_id"] is lot["device_time"] is None
    assert "quantity" not in lot


def test_capture_authority_never_unions_pairs_or_launders_prepared_frames(sample_context):
    context = sample_context
    original = context_for(context)
    center = str(context.field.point.block.quadrant.center_id)
    quadrant = str(context.field.point.block.quadrant_id)
    codes = frozenset({"field.bootstrap", "field_event.sync", "sample.collect"})
    crossed = EffectiveScope(
        (
            (
                codes,
                {
                    "centers": {"mode": "selected", "ids": [center]},
                    "quadrants": {"mode": "selected", "ids": [str(uuid4())]},
                },
            ),
            (
                codes,
                {
                    "centers": {"mode": "selected", "ids": [str(uuid4())]},
                    "quadrants": {"mode": "selected", "ids": [quadrant]},
                },
            ),
        )
    )
    blank = ProducerContext(
        original.organization, original.user, crossed, original.now, original.permission
    )
    assert sample_capture_snapshot(blank)["sources"] == []
    assert sample_capture_snapshot(blank)["methods"] == []
    stranger = UserFactory()
    ownless = prepare_sample_capture(
        ProducerContext(
            original.organization, stranger, original.scope, original.now, original.permission
        )
    )
    assert sample_capture_snapshot(ownless)["sources"] == []
    assert sample_capture_snapshot(ownless)["receipts"] == []
    denied = ProducerContext(
        original.organization, original.user, EffectiveScope(()), original.now, original.permission
    )
    assert sample_capture_snapshot(denied) is None
    modified = deepcopy(original.sample_capture_payload)
    modified["sources"][0]["id"] = str(uuid4())
    for changed in (
        replace(original, user=stranger),
        replace(original, scope=crossed),
        replace(original, now=original.now + timedelta(seconds=1)),
        replace(original, sample_capture_payload=modified),
        replace(original, configuration_generation={"membership": "changed"}),
    ):
        with pytest.raises(ImproperlyConfigured, match="context changed"):
            bound_sample_capture(changed)


def test_observation_clock_keeps_semantic_etag_and_sync_delivers_full_snapshot(sample_context):
    context = sample_context
    first = bootstrap_bundle(context.field.batch)
    later = replace(
        context.field.batch,
        sent_at=context.clock["now"] + timedelta(seconds=1),
        received_at=context.clock["now"] + timedelta(seconds=1),
    )
    second = build_bootstrap(later)
    assert first["sample_capture"]["as_of"] != second["sample_capture"]["as_of"]
    assert first["sample_capture"]["version"] == second["sample_capture"]["version"]
    assert first["bundle_version"] == second["bundle_version"]
    pulled = sync_batch(context.field.batch, [], position(context, first)).changes
    assert pulled.sample_capture == first["sample_capture"]


def test_future_method_boundary_expires_original_capture_and_invalidates_cursor(sample_context):
    context = sample_context
    effective = context.clock["now"] + timedelta(minutes=2)
    write_method(
        context.actor,
        {
            "expected_revision": context.method.revision,
            "name": "Synthetic future method without original verification",
            "procedure": "Synthetic technical fixture only",
            "reference": "Synthetic immutable method fixture",
            "effective_from": effective,
            "supports_viability": False,
            "supports_rejection": False,
            "supports_wolbachia": True,
        },
        context.method.method_id,
    )
    first = bootstrap_bundle(context.field.batch)
    assert parse_datetime(first["sample_capture"]["valid_until"]) == effective
    assert first["sample_capture"]["methods"][0]["id"] == str(context.method.pk)
    context.clock["now"] = effective
    context.field.batch = replace(context.field.batch, sent_at=effective, received_at=effective)
    with pytest.raises(InvalidCursorError):
        sync_batch(context.field.batch, [], position(context, first))
    fresh = bootstrap_bundle(context.field.batch)
    assert fresh["sample_capture"]["methods"] == []
    assert fresh["sample_capture"]["version"] != first["sample_capture"]["version"]


def test_only_real_own_lab_receipt_changes_download_and_requires_rebootstrap(sample_context):
    context = sample_context
    sample, source = collect(context)
    first = bootstrap_bundle(context.field.batch)
    assert first["sample_capture"]["receipts"] == []
    sample_command(context, sample, "receive")
    receipt = SampleReceipt.objects.get(sample=sample)
    with pytest.raises(InvalidCursorError):
        sync_batch(context.field.batch, [], position(context, first))
    fresh = bootstrap_bundle(context.field.batch)
    (own,) = fresh["sample_capture"]["receipts"]
    assert own["sample_id"] == str(sample.pk)
    assert own["event_id"] == str(source.id)
    assert parse_datetime(own["received_at"]) == receipt.created_at
    assert set(own) == {"sample_id", "event_id", "received_at"}
