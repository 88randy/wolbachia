"""Catalog choice policy: tested once here, without a database."""

import uuid
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from rest_framework.exceptions import ValidationError

from core.validation import flatten_error_details
from core.void_reason import resolve_void_reason


@pytest.fixture
def catalog_query(monkeypatch):
    # Policy tests replace the database; concurrency tests exercise real transactions.
    monkeypatch.setattr("core.void_reason.connection", SimpleNamespace(in_atomic_block=True))
    query = Mock()
    monkeypatch.setattr("core.void_reason.CatalogItem.objects.filter", query)
    query.return_value.select_for_update.return_value = query.return_value
    query.return_value.first.return_value = SimpleNamespace(is_active=True)
    return query


def test_resolver_refuses_to_run_outside_a_transaction():
    with pytest.raises(RuntimeError, match="requires an active transaction"):
        resolve_void_reason(uuid.uuid4(), "", "duplicate-record")


@pytest.mark.parametrize(
    ("code", "note", "stored"),
    [
        ("other", "  a clear mistake  ", "a clear mistake"),
        ("duplicate-record", "", ""),
        ("duplicate-record", " e\u0301\r\nx ", "\u00e9\nx"),
    ],
)
def test_choice_resolves_in_one_org_scoped_query(catalog_query, code, note, stored):
    organization_id = uuid.uuid4()

    choice = resolve_void_reason(organization_id, note, code)

    assert (choice.code, choice.reason, choice.is_active) == (code, stored, True)
    catalog_query.assert_called_once_with(
        organization_id=organization_id,
        catalog__organization_id=organization_id,
        catalog__slug="void-reason",
        code=code,
    )


@pytest.mark.parametrize(
    ("code", "note", "item", "field", "error"),
    [
        ("", "", None, "reason_code", "required"),
        ("  ", "", None, "reason_code", "required"),
        ("unknown", "", None, "reason_code", "void_reason_code_unknown"),
        (
            "inactive",
            "",
            SimpleNamespace(is_active=False),
            "reason_code",
            "void_reason_code_unknown",
        ),
        (
            "other",
            "  ",
            SimpleNamespace(is_active=True),
            "reason",
            "void_reason_required_for_other",
        ),
        ("other", "short", SimpleNamespace(is_active=True), "reason", "void_reason_too_short"),
        (
            "regular",
            "a\u202eb",
            SimpleNamespace(is_active=True),
            "reason",
            "void_reason_invalid_characters",
        ),
        ("regular", "a" * 1001, SimpleNamespace(is_active=True), "reason", "max_length"),
    ],
)
def test_invalid_choice_carries_only_codes_and_params(
    catalog_query, code, note, item, field, error
):
    catalog_query.return_value.first.return_value = item

    with pytest.raises(ValidationError) as raised:
        resolve_void_reason(uuid.uuid4(), note, code)

    details = flatten_error_details(raised.value.get_full_details())
    assert details[field][0]["code"] == error
    assert set(details[field][0]) == {"code", "params"}


def test_sync_can_resolve_inactive_choice_but_still_validates_text(catalog_query):
    catalog_query.return_value.first.return_value = SimpleNamespace(is_active=False)
    organization_id = uuid.uuid4()

    choice = resolve_void_reason(organization_id, "", "regular", allow_inactive=True)

    assert choice.is_active is False
    with pytest.raises(ValidationError):
        resolve_void_reason(organization_id, "a\u202eb", "regular", allow_inactive=True)
