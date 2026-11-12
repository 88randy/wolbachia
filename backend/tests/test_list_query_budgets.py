"""List endpoints keep a constant query count whatever the number of rows (no N+1).

Each test seeds 2 rows, measures the endpoint, grows to 10 rows and measures again: the counts
must be equal (`tests/query_budget.py`). The review-items list has its own test next to the rest of
its API tests.
"""

from datetime import UTC, datetime, timedelta
from itertools import count

import pytest
from rest_framework.test import APIClient

from tests.query_budget import assert_constant_queries

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 2, 2, 12, tzinfo=UTC)
POLYGON = {
    "type": "Polygon",
    "coordinates": [[[-100.0, 20], [-99.99, 20], [-99.99, 20.01], [-100.0, 20.01], [-100.0, 20]]],
}
SERIAL = count(1)


def test_quadrant_assignments_list_does_not_grow_with_rows(api_client: APIClient) -> None:
    from geography.models import Quadrant
    from scheduling.models import AssignmentVersion
    from tests.test_scheduling_b_12 import planner_setup

    planner = planner_setup()
    organization = planner.member.organization
    api_client.force_authenticate(planner.member.user)

    def add_rows(rows: int) -> None:
        for _ in range(rows):
            quadrant = Quadrant.objects.create(
                organization=organization,
                center=planner.quadrant.center,
                code=f"QB-{next(SERIAL)}",
            )
            AssignmentVersion.objects.create(
                organization=organization,
                quadrant=quadrant,
                courier=planner.member.user,
                valid_from=NOW - timedelta(days=1),
                version=1,
            )

    assert_constant_queries(api_client, "/api/v1/quadrant-assignments/", add_rows)


@pytest.mark.parametrize("resource", ["quadrants", "blocks", "sampling-points"])
def test_geography_lists_do_not_grow_with_rows(api_client: APIClient, resource: str) -> None:
    from geography.models import (
        Block,
        BlockVersion,
        PointVersion,
        Quadrant,
        QuadrantVersion,
        SamplingPoint,
    )
    from tests.test_geography_b_11 import geography_setup

    membership, root = geography_setup()
    organization = membership.organization
    api_client.force_authenticate(membership.user)

    def add_quadrant() -> Quadrant:
        quadrant = Quadrant.objects.create(
            organization=organization,
            center=root.center,
            code=f"QG-{next(SERIAL)}",
            created_by=membership.user,
        )
        for revision in (1, 2):  # the list must show the latest one
            QuadrantVersion.objects.create(
                organization=organization,
                quadrant=quadrant,
                geometry=POLYGON,
                revision=revision,
                effective_from=NOW + timedelta(minutes=revision),
                created_by=membership.user,
            )
        return quadrant

    def add_block() -> Block:
        block = Block.objects.create(
            organization=organization,
            quadrant=root,
            code=f"BG-{next(SERIAL)}",
            created_by=membership.user,
        )
        for revision in (1, 2):
            BlockVersion.objects.create(
                organization=organization,
                block=block,
                geometry=POLYGON,
                revision=revision,
                effective_from=NOW + timedelta(minutes=revision),
                created_by=membership.user,
            )
        return block

    def add_point() -> SamplingPoint:
        block = add_block()
        point = SamplingPoint.objects.create(
            organization=organization,
            block=block,
            code=f"PG-{next(SERIAL)}",
            created_by=membership.user,
        )
        for version in (1, 2):
            PointVersion.objects.create(
                organization=organization,
                point=point,
                location=[-99.995, 20.005],
                version=version,
                effective_from=NOW + timedelta(minutes=version),
                created_by=membership.user,
            )
        return point

    adders = {"quadrants": add_quadrant, "blocks": add_block, "sampling-points": add_point}

    def add_rows(rows: int) -> None:
        for _ in range(rows):
            adders[resource]()

    assert_constant_queries(api_client, f"/api/v1/{resource}/", add_rows)

    body = api_client.get(f"/api/v1/{resource}/").json()["results"]
    versions = [
        row["current_version"] for row in body if row["code"].startswith(("QG", "BG", "PG"))
    ]
    assert versions
    assert {version.get("revision", version.get("version")) for version in versions} == {
        2
    }, "the list shows the latest version of every row"
