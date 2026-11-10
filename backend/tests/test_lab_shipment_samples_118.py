"""Shipments consume real B21 collection rather than a second sample writer."""

from copy import deepcopy
from dataclasses import replace
from datetime import timedelta
from uuid import UUID

import pytest
from django.http import Http404

from accounts.models import Device
from core.services import void_record
from field_sync.envelope import describe_payload
from inventory.services import LotChange, revise_lot
from lab.exceptions import LabConflictError
from lab.samples.models import WolbachiaSample
from lab.shipments.selectors import shipment_projection
from lab.shipments.services import create_shipment
from tests.inventory_support import inventory_context
from tests.ovitrap_support import ingest
from tests.review_support import audit_current_membership
from tests.test_lab_samples_b_21 import collect, sample_capture
from tests.test_lab_samples_b_21 import samples_context as samples_context
from uploads.access import UploadActor


@pytest.fixture
def retained_sample(samples_context):  # noqa: F811 -- pytest injects the imported B21 fixture.
    context = samples_context
    profile = context.field.profile
    profile.permission_codes = [*profile.permission_codes, "shipment.create", "shipment.read"]
    profile.revision += 1
    profile.save(update_fields=["permission_codes", "revision"])
    audit_current_membership(context.field.membership)
    return context


def shipment_values(sample):
    return {
        "source_ids": [sample.pk],
        "cutoff": sample.created_at,
        "recipient_institution": "Synthetic sample recipient",
    }


@pytest.mark.django_db
def test_retained_sample_lineage_replays_once_and_freezes_actual_source_provenance(retained_sample):
    context = retained_sample
    sample, capture = collect(context)
    assert ingest(context.field, capture).status == "accepted"
    shipment = create_shipment(context.actor, shipment_values(sample))
    snapshot = shipment.source_snapshot[0]

    assert WolbachiaSample.objects.count() == 1
    assert (sample.event_id, sample.created_by_id, sample.reading_id) == (
        capture.id,
        context.actor.user.pk,
        context.reading.pk,
    )
    assert snapshot["kind"] == "sample"
    assert snapshot["method_version_id"] == str(context.method.pk)
    assert snapshot["source_event_id"] == str(capture.id)
    assert snapshot["payload_sha256"] == capture.payload_info.sha256
    assert snapshot["device_time"] == sample.device_time.isoformat()
    assert snapshot["server_received_at"] == sample.server_received_at.isoformat()
    assert snapshot["rules_version"] == capture.rules_version
    assert snapshot["catalog_version"] == capture.catalog_version
    assert snapshot["origin_snapshot"] == sample.origin_snapshot
    assert snapshot["location"] == sample.location
    assert snapshot["source_provenance"] == sample.source_provenance


@pytest.mark.django_db
@pytest.mark.parametrize("invalid_kind", ["body", "foreign_source", "unapplied_source"])
def test_sample_consumer_rejects_unproven_body_and_foreign_or_unapplied_sources(
    retained_sample, invalid_kind, org_b, make_member
):
    context = retained_sample
    capture = sample_capture(context)
    actor = context.actor
    if invalid_kind == "unapplied_source":
        context.field.batch = replace(context.field.batch, is_final_upload=True)
        assert ingest(context.field, capture).status == "in_review"
    else:
        sample, capture = collect(context)
        if invalid_kind == "body":
            payload = {**capture.payload, "code": "DIFFERENT-CAPTURE"}
            changed = replace(capture, payload=payload, payload_info=describe_payload(payload))
            assert ingest(context.field, changed).code == "event_id_conflict"
            sample.refresh_from_db()
            assert sample.code == capture.payload["code"]
            return
        user, _membership = make_member(org_b, ("shipment.create",))
        actor = UploadActor(user, org_b)
    with pytest.raises(Http404):
        create_shipment(
            actor,
            {"source_ids": [UUID(capture.payload["sample_id"])], "cutoff": context.clock["now"]},
        )


@pytest.mark.django_db
def test_voided_sample_source_preserves_issued_snapshot_and_blocks_new_selection(retained_sample):
    context = retained_sample
    actor = context.actor
    sample, _capture = collect(context)
    shipment = create_shipment(actor, shipment_values(sample))
    original_snapshot = deepcopy(shipment.source_snapshot)
    void_record(
        sample.event,
        actor.user,
        reason="Synthetic collection source correction",
        reason_code="other",
    )

    with pytest.raises(LabConflictError) as blocked:
        create_shipment(actor, shipment_values(sample))

    shipment.refresh_from_db()
    sample.event.refresh_from_db()
    assert blocked.value.code == "shipment_source_unavailable"
    assert shipment.source_snapshot == original_snapshot
    assert shipment_projection(actor, shipment)["is_superseded"]
    assert sample.event.status == "accepted"


@pytest.mark.django_db
def test_lot_backed_sample_pins_source_edition_and_flags_later_correction(
    retained_sample, make_member
):
    context = retained_sample
    stock = inventory_context(context.actor.organization, make_member)
    sample, _capture = collect(
        context,
        code="LOT-SAMPLE-118",
        source_ref={"kind": "lot", "id": str(stock.lot.pk)},
    )
    shipment = create_shipment(context.actor, shipment_values(sample))
    frozen = deepcopy(shipment.source_snapshot)
    assert frozen[0]["lot_version_id"] == str(stock.version.pk)
    assert not shipment_projection(context.actor, shipment)["is_superseded"]

    corrected = revise_lot(
        LotChange(
            stock.actor,
            {"observations": "A later genuine source edition"},
            stock.lot.pk,
            stock.version.revision,
        )
    )

    shipment.refresh_from_db()
    assert shipment.source_snapshot == frozen
    assert shipment_projection(context.actor, shipment)["is_superseded"]
    replacement = create_shipment(
        context.actor,
        {
            **shipment_values(sample),
            "supersedes_id": shipment.pk,
            "reason": "Keep the corrected source edition in a linked shipment",
        },
    )
    assert replacement.source_snapshot[0]["lot_version_id"] == str(corrected.pk)


@pytest.mark.django_db(transaction=True)
def test_release_backed_sample_freezes_canonical_release_and_blocks_voided_source(
    retained_sample, make_member, monkeypatch, settings, tmp_path
):
    from tests.releases_support import accept_release, grant_release_codes, release_setup

    context = retained_sample
    release_context = release_setup(
        context.actor.organization, make_member, monkeypatch, settings, tmp_path
    )
    released = accept_release(release_context)
    grant_release_codes(
        release_context.people.subject,
        ("sample.collect", "sample.void", "shipment.create", "shipment.read"),
    )
    context.clock["now"] = release_context.clock["now"] + timedelta(minutes=1)
    monkeypatch.setattr("django.utils.timezone.now", lambda: context.clock["now"])
    context.field.batch = replace(
        context.field.batch,
        user=release_context.phone.user,
        device=Device.objects.get(pk=release_context.phone.device_id),
        sent_at=context.clock["now"],
        received_at=context.clock["now"],
    )
    context.actor = UploadActor(release_context.phone.user, context.actor.organization)
    sample, _capture = collect(
        context,
        code="RELEASE-SAMPLE-118",
        source_ref={"kind": "release", "id": str(released.pk)},
    )
    shipment = create_shipment(context.actor, shipment_values(sample))
    frozen = deepcopy(shipment.source_snapshot)
    assert frozen[0]["release_id"] == str(released.pk)
    assert frozen[0]["source_provenance"]["source"]["event_id"] == str(released.declared_event_id)
    assert frozen[0]["collector_id"] == str(release_context.phone.user.pk)
    assert not shipment_projection(context.actor, shipment)["is_superseded"]

    void_record(
        sample.event,
        context.actor.user,
        reason="Correct synthetic release sample before its source",
        reason_code="other",
    )
    assert shipment_projection(context.actor, shipment)["is_superseded"]
    assert shipment.source_snapshot == frozen
    with pytest.raises(LabConflictError):
        create_shipment(context.actor, shipment_values(sample))
