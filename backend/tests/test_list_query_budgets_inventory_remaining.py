"""Movement paging must not load transfer facts that its response always redacts."""

from decimal import Decimal

import pytest

from inventory.transfers.services import dispatch_transfer
from tests.query_budget import count_queries
from tests.test_inventory_transfers_106 import (
    custody,  # noqa: F401 -- fixture reused as is
    dispatch_request,
    prepared,
)

pytestmark = pytest.mark.django_db


def test_signed_movement_queries_are_constant_for_two_and_ten_rows(api_client, custody):  # noqa: F811
    context, _destination = custody
    api_client.force_authenticate(context.actor.user)
    for _ in range(10):
        dispatch_transfer(dispatch_request(context.actor, prepared(custody, quantity="0.2")))
    url = f"/api/v1/locations/{context.location.pk}/movements/"
    count_queries(api_client, f"{url}?page_size=2")

    small, small_rows = count_queries(api_client, f"{url}?page_size=2")
    large, large_rows = count_queries(api_client, f"{url}?page_size=10")

    assert (small_rows, large_rows) == (2, 10)
    assert len(small) == len(large) <= 25
    rows = api_client.get(url, {"page_size": 10}).json()["results"]
    assert all(row["source_transfer"] is None for row in rows)
    assert all(row["source_kind"] == "transfer_dispatch" for row in rows)
    assert all(Decimal(row["quantity"]) == Decimal("-0.2") for row in rows)
