"""Retained synthetic collection facts test the minimal consumer, not sync acceptance."""

from copy import deepcopy
from dataclasses import replace
from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.http import Http404

from catalogs.models import Catalog
from catalogs.seeds import seed_default_catalogs
from core.services import void_record
from field_sync.envelope import describe_payload
from inventory.models import Location
from inventory.services import LotChange, revise_lot
from lab.exceptions import LabConflictError
from lab.samples.models import WolbachiaSample
from lab.samples.services import SampleIdentityInput, register_sample_identity
from lab.shipments.selectors import shipment_projection
from lab.shipments.services import create_shipment
from tests.factories import CatalogItemFactory, FieldEventFactory
from tests.inventory_support import inventory_context
from tests.lab_support import AT, capture_bag, lab_context, synthetic_method


@pytest.fixture
def retained_sample(monkeypatch):
    context = lab_context(monkeypatch)
    profile = context.field.profile
    profile.permission_codes = [
        *profile.permission_codes,
        "sample.receive",
        "shipment.create",
        "shipment.read",
    ]
    profile.save(update_fields=["permission_codes"])
    bag = capture_bag(context, "SAMPLE-SOURCE-118")
    quadrant = bag.reading.ovitrap.sampling_point.block.quadrant
    location = Location.objects.create(
        organization=context.actor.organization,
        created_by=context.actor.user,
        center=quadrant.center,
        quadrant=quadrant,
        code="SAMPLE-STORE-118",
    )
    catalog, _created = Catalog.objects.get_or_create(
        organization=context.actor.organization,
        slug="sample-origin",
        defaults={"label_es": "Synthetic origin", "label_en": "Synthetic origin"},
    )
    origin = CatalogItemFactory(
        organization=context.actor.organization, catalog=catalog, code="synthetic-origin-118"
    )
    method = synthetic_method(context)
    identifier = uuid4()
    payload = {
        "sample_id": str(identifier),
        "code": "SAMPLE-118",
        "origin_code": origin.code,
        "method_version": str(method.pk),
        "source_ref": {"kind": "reading", "id": str(bag.reading_id)},
    }
    # The registry intentionally has no sample.collect handler yet (#117).
    source = FieldEventFactory(
        organization=context.actor.organization,
        created_by=context.actor.user,
        device=context.field.batch.device,
        type="sample.collect",
        payload=payload,
        payload_sha256=describe_payload(payload).sha256,
        device_time=AT,
        server_received_at=AT,
        rules_version="synthetic-sample-rules",
        catalog_version="synthetic-sample-catalog",
    )
    request = SampleIdentityInput(
        identifier=identifier,
        event_id=source.pk,
        code=payload["code"],
        origin_id=origin.pk,
        method_version_id=method.pk,
        location_id=location.pk,
        reading_id=bag.reading_id,
    )
    return SimpleNamespace(context=context, source=source, request=request, method=method)


def shipment_values(sample):
    return {
        "source_ids": [sample.pk],
        "cutoff": AT,
        "recipient_institution": "Synthetic sample recipient",
    }


@pytest.mark.django_db
def test_retained_sample_lineage_replays_once_and_freezes_actual_source_provenance(retained_sample):
    retained = retained_sample
    actor = retained.context.actor
    sample = register_sample_identity(actor, retained.request)
    replay = register_sample_identity(actor, retained.request)
    shipment = create_shipment(actor, shipment_values(sample))
    snapshot = shipment.source_snapshot[0]

    assert replay.pk == sample.pk
    assert WolbachiaSample.objects.count() == 1
    assert (sample.event_id, sample.collector_id, sample.reading_id) == (
        retained.source.pk,
        retained.source.created_by_id,
        retained.request.reading_id,
    )
    assert snapshot["kind"] == "sample"
    assert snapshot["method_version_id"] == str(retained.method.pk)
    assert snapshot["source_event_id"] == str(retained.source.pk)
    assert snapshot["payload_sha256"] == retained.source.payload_sha256
    assert snapshot["device_time"] == retained.source.device_time.isoformat()
    assert snapshot["server_received_at"] == retained.source.server_received_at.isoformat()
    assert snapshot["rules_version"] == retained.source.rules_version
    assert snapshot["catalog_version"] == retained.source.catalog_version


@pytest.mark.django_db
@pytest.mark.parametrize("invalid_kind", ["body", "foreign_source", "unapplied_source"])
def test_sample_consumer_rejects_unproven_body_and_foreign_or_unapplied_sources(
    retained_sample, invalid_kind, org_b
):
    retained = retained_sample
    request = retained.request
    expected_error = LabConflictError
    if invalid_kind == "body":
        request = replace(request, code="DIFFERENT-CAPTURE")
    elif invalid_kind == "foreign_source":
        foreign = FieldEventFactory(organization=org_b, type="sample.collect")
        request = replace(request, event_id=foreign.pk)
        expected_error = Http404
    else:
        pending = FieldEventFactory(
            organization=retained.context.actor.organization,
            created_by=retained.context.actor.user,
            device=retained.context.field.batch.device,
            type="sample.collect",
            payload=retained.source.payload,
            status="in_review",
            status_code="clock_skew",
        )
        request = replace(request, event_id=pending.pk)
        expected_error = Http404

    with pytest.raises(expected_error):
        register_sample_identity(retained.context.actor, request)

    assert not WolbachiaSample.objects.exists()


@pytest.mark.django_db
def test_voided_sample_source_preserves_issued_snapshot_and_blocks_new_selection(retained_sample):
    retained = retained_sample
    actor = retained.context.actor
    sample = register_sample_identity(actor, retained.request)
    shipment = create_shipment(actor, shipment_values(sample))
    original_snapshot = deepcopy(shipment.source_snapshot)
    seed_default_catalogs(actor.organization)
    void_record(
        retained.source,
        actor.user,
        reason="Synthetic collection source correction",
        reason_code="other",
    )

    with pytest.raises(LabConflictError) as blocked:
        create_shipment(actor, shipment_values(sample))

    shipment.refresh_from_db()
    retained.source.refresh_from_db()
    assert blocked.value.code == "shipment_source_unavailable"
    assert shipment.source_snapshot == original_snapshot
    assert shipment_projection(actor, shipment)["is_superseded"]
    assert retained.source.status == "accepted"


@pytest.mark.django_db
def test_lot_backed_sample_pins_source_edition_and_flags_later_correction(
    retained_sample, make_member
):
    retained = retained_sample
    actor = retained.context.actor
    stock = inventory_context(actor.organization, make_member)
    identifier = uuid4()
    payload = {
        **retained.source.payload,
        "sample_id": str(identifier),
        "code": "LOT-SAMPLE-118",
        "source_ref": {"kind": "lot", "id": str(stock.lot.pk)},
    }
    source = FieldEventFactory(
        organization=actor.organization,
        created_by=actor.user,
        device=retained.context.field.batch.device,
        type="sample.collect",
        payload=payload,
        payload_sha256=describe_payload(payload).sha256,
        device_time=AT,
        server_received_at=AT,
    )
    sample = register_sample_identity(
        actor,
        replace(
            retained.request,
            identifier=identifier,
            event_id=source.pk,
            code=payload["code"],
            reading_id=None,
            lot_id=stock.lot.pk,
        ),
    )
    shipment = create_shipment(actor, shipment_values(sample))
    frozen = deepcopy(shipment.source_snapshot)
    assert frozen[0]["lot_version_id"] == str(stock.version.pk)
    assert not shipment_projection(actor, shipment)["is_superseded"]

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
    assert shipment_projection(actor, shipment)["is_superseded"]
    replacement = create_shipment(
        actor,
        {
            **shipment_values(sample),
            "supersedes_id": shipment.pk,
            "reason": "Keep the corrected source edition in a linked shipment",
        },
    )
    assert replacement.source_snapshot[0]["lot_version_id"] == str(corrected.pk)
