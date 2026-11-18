"""Nested shift sources and quadrant blockers have a bounded read cost."""

from collections import Counter
from dataclasses import replace
from uuid import uuid4

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from field_sync.envelope import describe_payload
from tests.factories import FieldEventFactory, ShiftFactory
from tests.ovitrap_support import envelope, ingest, make_point
from tests.test_geography_decisions_b_33 import field as field
from tests.test_geography_decisions_b_33 import lifecycle
from tests.test_shift_api import supervisor_client

pytestmark = pytest.mark.django_db


def measured_get(client, url):
    with CaptureQueriesContext(connection) as queries:
        response = client.get(url)
    assert response.status_code == 200, response.content
    return response.json(), len(queries)


def test_shift_detail_queries_do_not_grow_with_source_events(org_a, make_member):
    shift = ShiftFactory(organization=org_a, is_closed=True)
    client = supervisor_client(org_a, make_member)
    payload = {
        "motorcycle_id": shift.motorcycle.code,
        "litres": "2.000",
        "amount": "20.00",
        "currency": "MXN",
        "odometer_km": 12020,
        "receipt_upload_id": None,
        "is_full_refill": False,
    }

    def add_sources(number):
        for _ in range(number):
            FieldEventFactory(
                organization=org_a,
                created_by=shift.courier,
                device=shift.device,
                shift_id=shift.pk,
                type="fuel.load",
                payload=payload,
                payload_sha256=describe_payload(payload).sha256,
            )

    url = f"/api/v1/shifts/{shift.pk}/"
    add_sources(2)
    measured_get(client, url)
    small, small_count = measured_get(client, url)
    add_sources(8)
    large, large_count = measured_get(client, url)

    assert small_count == large_count
    assert large_count <= 25
    assert small == large


def test_quadrant_closure_queries_do_not_grow_with_pending_sources(api_client, field):  # noqa: F811
    api_client.force_authenticate(field.actor.user)

    def add_sources(number):
        for _ in range(number):
            field.identity = uuid4()
            field.point = make_point(field.quadrant, f"QB-{field.identity.hex[:12]}")
            assert ingest(field, envelope(field)).status == "accepted"
            original_batch = field.batch
            field.batch = replace(original_batch, is_final_upload=True)
            assert ingest(field, lifecycle(field, "remove")).status == "in_review"
            field.batch = original_batch

    url = f"/api/v1/quadrants/{field.quadrant.pk}/closure/"
    add_sources(2)
    measured_get(api_client, url)
    small, small_count = measured_get(api_client, url)
    add_sources(8)
    large, large_count = measured_get(api_client, url)

    assert small_count == large_count
    assert large_count <= 25
    assert small["can_close"] is large["can_close"] is False
    assert Counter(row["reason"] for row in large["blockers"]) == {
        "removal_unconfirmed": 10,
        "removal_review_pending": 10,
    }
