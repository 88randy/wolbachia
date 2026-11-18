"""Release review visibility stays constant while retaining actual subject ownership."""

from dataclasses import dataclass
from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from field_sync.envelope import describe_payload
from geography.models import Block, Quadrant, SamplingPoint
from inventory.models import Lot
from organizations.models import Center
from releases.models import Permit, ReleaseDevice
from scheduling.models import ScheduledTask
from tests.factories import ReviewItemFactory
from tests.inventory_support import AT, inventory_context
from tests.query_budget import assert_constant_queries

pytestmark = pytest.mark.django_db
URL = "/api/v1/review-items/"


@dataclass(frozen=True)
class ReleaseReviews:
    organization: object
    stock: object
    permit: Permit
    device: ReleaseDevice
    task: ScheduledTask
    payload: dict

    def add(self, **changes):
        payload = {**self.payload, **changes}
        return ReviewItemFactory(
            field_event__organization=self.organization,
            field_event__created_by=self.stock.actor.user,
            field_event__type="release.record",
            field_event__payload=payload,
            field_event__payload_sha256=describe_payload(payload).sha256,
        )


@pytest.fixture
def release_reviews(org_a, make_member):
    center = Center.objects.create(organization=org_a, code="REV-C", name="Review center")
    quadrant = Quadrant.objects.create(organization=org_a, center=center, code="REV-Q")
    stock = inventory_context(org_a, make_member, biological=True, quadrant=quadrant)
    block = Block.objects.create(organization=org_a, quadrant=quadrant, code="REV-B")
    point = SamplingPoint.objects.create(organization=org_a, block=block, code="REV-P")
    permit = Permit.objects.create(
        organization=org_a,
        created_by=stock.actor.user,
        center=stock.center,
        quadrant=quadrant,
        code="REV-PERMIT",
    )
    device = ReleaseDevice.objects.create(
        organization=org_a,
        created_by=stock.actor.user,
        center=stock.center,
        quadrant=quadrant,
        code="REV-DEVICE",
        source_lot=stock.lot,
        source_lot_version=stock.version,
    )
    task = ScheduledTask.objects.create(
        organization=org_a,
        created_by=stock.actor.user,
        point=point,
        action="release",
        due_date=AT.date(),
    )
    payload = {
        "permit_id": str(permit.pk),
        "release_device_id": str(device.pk),
        "lot_id": str(stock.lot.pk),
        "quantity": "1",
        "schedule_task_id": str(task.pk),
        "training_version": str(uuid4()),
        "evidence_ids": [],
    }
    profile = stock.member.profiles.get()
    profile.permission_codes = ["review_item.read"]
    profile.scope = {
        "centers": {"mode": "selected", "ids": [str(stock.center.pk)]},
        "quadrants": {"mode": "selected", "ids": [str(quadrant.pk)]},
    }
    profile.save(update_fields=["permission_codes", "scope"])
    return ReleaseReviews(org_a, stock, permit, device, task, payload)


def test_release_review_list_does_not_grow_with_rows(api_client: APIClient, release_reviews):
    api_client.force_authenticate(release_reviews.stock.actor.user)

    def add_rows(count):
        for _ in range(count):
            release_reviews.add()

    assert_constant_queries(api_client, URL, add_rows)


def test_release_review_batch_keeps_unknown_foreign_and_mismatched_references_hidden(
    api_client: APIClient, release_reviews, org_b
):
    context = release_reviews
    api_client.force_authenticate(context.stock.actor.user)
    visible = context.add()
    foreign_center = Center.objects.create(organization=org_b, code="REV-FC", name="Foreign")
    foreign_quadrant = Quadrant.objects.create(
        organization=org_b, center=foreign_center, code="REV-FQ"
    )
    foreign = Permit.objects.create(
        organization=org_b,
        created_by=context.stock.actor.user,
        center=foreign_center,
        quadrant=foreign_quadrant,
        code="REV-FOREIGN",
    )
    other_lot = Lot.objects.create(
        organization=context.organization,
        created_by=context.stock.actor.user,
        supply=context.stock.supply,
        center=context.stock.center,
        code="REV-OTHER-LOT",
    )
    context.add(permit_id=str(uuid4()))
    context.add(permit_id=str(foreign.pk))
    context.add(lot_id=str(other_lot.pk))
    context.add(schedule_task_id=str(uuid4()))
    response = api_client.get(URL)
    assert response.status_code == 200
    assert [row["id"] for row in response.json()["results"]] == [str(visible.pk)]


def test_batch_point_subjects_preserve_real_identity_and_pending_parent_resolution():
    from reviews.scope import subject_facts, subject_facts_many
    from tests.ovitrap_support import envelope, ingest, make_point, setup_field

    field = setup_field()
    placed = envelope(field)
    assert ingest(field, placed).status == "accepted"
    pending_identity = uuid4()
    pending_point = make_point(field.point.block.quadrant, "REV-PENDING")
    pending = envelope(
        field,
        gps=None,
        payload={"ovitrap_id": str(pending_identity), "sampling_point_id": str(pending_point.pk)},
    )
    assert ingest(field, pending).status == "in_review"
    envelopes = [
        placed,
        envelope(field, "ovitrap.check"),
        envelope(field, "ovitrap.check", payload={"ovitrap_id": str(pending_identity)}),
        envelope(field, "ovitrap.check", payload={"ovitrap_id": str(uuid4())}),
        envelope(field, payload={"sampling_point_id": str(uuid4())}),
    ]
    organization = field.batch.organization
    expected = {row.id: subject_facts(organization, row) for row in envelopes}
    assert [facts.resolved for facts in expected.values()] == [True, True, True, False, False]
    assert subject_facts_many(organization, envelopes) == expected
