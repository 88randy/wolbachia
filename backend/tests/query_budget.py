"""Shared helper: a list endpoint must not issue more queries when it returns more rows."""

import re
from collections import Counter
from collections.abc import Callable

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

_LITERAL = re.compile(r"'(?:[^']|'')*'|\b\d+\b")


def _shapes(captured: list[dict[str, str]]) -> Counter[str]:
    return Counter(_LITERAL.sub("?", query["sql"])[:160] for query in captured)


def count_queries(client: APIClient, url: str) -> tuple[list[dict[str, str]], int]:
    """(captured queries, rows) of one GET; rows is the length of `results` (or of the list)."""
    with CaptureQueriesContext(connection) as context:
        response = client.get(url)
    assert response.status_code == 200, response.content
    data = response.json()
    rows = data["results"] if isinstance(data, dict) and "results" in data else data
    return list(context.captured_queries), len(rows)


def assert_constant_queries(
    client: APIClient, url: str, add_rows: Callable[[int], None], few: int = 2, many: int = 10
) -> None:
    """Seed `few` rows, measure; add rows up to `many`, measure; the counts must be equal."""
    add_rows(few)
    count_queries(client, url)  # warm caches (content types, permissions)
    small, small_rows = count_queries(client, url)
    add_rows(many - few)
    large, large_rows = count_queries(client, url)
    assert small_rows >= few
    assert large_rows >= many
    growth = _shapes(large) - _shapes(small)
    assert len(large) == len(small), (
        f"{url}: {len(small)} queries for {small_rows} rows, {len(large)} for {large_rows}; "
        f"growing statements: {dict(growth)}"
    )
