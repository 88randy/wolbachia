from datetime import UTC, date, datetime, timedelta

import pytest
from django.utils import timezone

from catalogs import permissions as catalog_codes
from catalogs.services import deactivate_catalog_item, update_catalog_item
from rules import permissions as rule_codes
from tests.factories import (
    CatalogFactory,
    CatalogItemFactory,
    RuleParameterFactory,
    RuleParameterVersionFactory,
)

pytestmark = pytest.mark.django_db

CATALOG_URL = "/api/v1/field/catalog/"
RULES_URL = "/api/v1/field/rules/"
FIELD_CODES = (catalog_codes.CATALOG_READ, rule_codes.RULE_PARAMETER_READ)


@pytest.fixture
def phone(api_client, org_a, make_member):
    """A courier-like user: it can read both snapshots and nothing else."""
    user, _ = make_member(org_a, FIELD_CODES)
    api_client.force_authenticate(user)
    return api_client


@pytest.fixture
def catalog(org_a):
    catalog = CatalogFactory(organization=org_a, slug="removal-reason")
    CatalogItemFactory(catalog=catalog, code="other", is_other=True, sort=0)
    CatalogItemFactory(catalog=catalog, code="blocked", sort=1, label_en="")
    return catalog


@pytest.fixture
def speed(org_a):
    parameter = RuleParameterFactory(organization=org_a, key="speed_lock_kmh")
    RuleParameterVersionFactory(parameter=parameter, value=10)
    return parameter


def revalidate(client, url, etag, **extra):
    return client.get(url, headers={"If-None-Match": etag, **extra})


def test_catalog_snapshot_has_version_etag_and_compact_items(phone, catalog) -> None:
    response = phone.get(CATALOG_URL)

    [only] = response.data["catalogs"]
    assert response.status_code == 200
    assert response["ETag"] == f'"{response.data["version"]}"'
    assert response["Cache-Control"] == "private, no-cache"
    assert [item["code"] for item in only["items"]] == ["blocked", "other"]
    assert set(only["items"][0]) == {
        "id",
        "code",
        "label_es",
        "label_en",
        "icon",
        "sort",
        "is_other",
        "requires_photo",
    }
    assert set(only) == {"slug", "label_es", "label_en", "is_open", "items"}


def test_catalog_snapshot_304_on_matching_if_none_match(phone, catalog) -> None:
    etag = phone.get(CATALOG_URL)["ETag"]

    response = revalidate(phone, CATALOG_URL, etag)

    assert response.status_code == 304
    assert response.content == b""
    assert response["ETag"] == etag


def test_catalog_snapshot_accepts_a_weak_etag(phone, catalog) -> None:
    etag = phone.get(CATALOG_URL)["ETag"]

    assert revalidate(phone, CATALOG_URL, f"W/{etag}").status_code == 304


def test_snapshot_version_changes_after_item_edit(phone, catalog) -> None:
    etag = phone.get(CATALOG_URL)["ETag"]
    item = catalog.items.get(code="blocked")

    update_catalog_item(item, {"label_es": "Cambió el texto"})
    response = revalidate(phone, CATALOG_URL, etag)

    assert response.status_code == 200
    assert response["ETag"] != etag


def test_deactivated_items_leave_the_snapshot_and_change_its_version(phone, catalog) -> None:
    etag = phone.get(CATALOG_URL)["ETag"]

    deactivate_catalog_item(catalog.items.get(code="blocked"))
    response = revalidate(phone, CATALOG_URL, etag)

    assert response.status_code == 200
    assert [item["code"] for item in response.data["catalogs"][0]["items"]] == ["other"]


def test_catalog_snapshot_never_includes_other_organizations(phone, catalog, org_b) -> None:
    CatalogFactory(organization=org_b, slug="foreign")

    slugs = [row["slug"] for row in phone.get(CATALOG_URL).data["catalogs"]]

    assert slugs == ["removal-reason"]


def test_rules_snapshot_has_numbers_version_and_etag(phone, speed) -> None:
    response = phone.get(RULES_URL)

    [parameter] = response.data["parameters"]
    assert response.status_code == 200
    assert response["ETag"] == f'"{response.data["version"]}"'
    assert (parameter["key"], parameter["value"], parameter["unit"]) == ("speed_lock_kmh", 10, "m")
    assert response.data["next_change_at"] is None


def test_rules_snapshot_304_on_matching_if_none_match(phone, speed) -> None:
    etag = phone.get(RULES_URL)["ETag"]

    response = revalidate(phone, RULES_URL, etag)

    assert (response.status_code, response.content) == (304, b"")


def test_future_version_excluded_and_next_change_at_exposed(phone, speed) -> None:
    tomorrow = timezone.now() + timedelta(days=1)
    RuleParameterVersionFactory(
        parameter=speed, value=12, effective_from=tomorrow, effective_date=tomorrow.date()
    )

    response = phone.get(RULES_URL)

    assert response.data["parameters"][0]["value"] == 10
    assert response.data["next_change_at"] == tomorrow.astimezone(UTC).isoformat().replace(
        "+00:00", "Z"
    )


def test_scheduling_a_future_version_changes_the_rules_version(phone, speed) -> None:
    etag = phone.get(RULES_URL)["ETag"]
    tomorrow = timezone.now() + timedelta(days=1)

    RuleParameterVersionFactory(
        parameter=speed, value=12, effective_from=tomorrow, effective_date=tomorrow.date()
    )

    assert revalidate(phone, RULES_URL, etag).status_code == 200


def test_rules_version_changes_when_scheduled_version_becomes_effective(
    phone, org_a, monkeypatch
) -> None:
    start = datetime(2026, 11, 3, 12, 0, tzinfo=UTC)
    parameter = RuleParameterFactory(organization=org_a, key="speed_lock_kmh")
    RuleParameterVersionFactory(
        parameter=parameter,
        value=10,
        effective_from=start - timedelta(days=30),
        effective_date=date(2026, 10, 4),
    )
    RuleParameterVersionFactory(
        parameter=parameter,
        value=12,
        effective_from=start + timedelta(days=1),
        effective_date=date(2026, 11, 4),
    )
    monkeypatch.setattr(timezone, "now", lambda: start)
    before = phone.get(RULES_URL)

    monkeypatch.setattr(timezone, "now", lambda: start + timedelta(days=1, minutes=1))
    after = revalidate(phone, RULES_URL, before["ETag"])

    assert after.status_code == 200
    assert after.data["parameters"][0]["value"] == 12
    assert after.data["version"] != before.data["version"]


def test_rules_snapshot_never_includes_other_organizations(phone, speed, org_b) -> None:
    RuleParameterVersionFactory(parameter=RuleParameterFactory(organization=org_b, key="foreign"))

    keys = [row["key"] for row in phone.get(RULES_URL).data["parameters"]]

    assert keys == ["speed_lock_kmh"]


@pytest.mark.parametrize("url", [CATALOG_URL, RULES_URL])
def test_304_requires_auth(api_client, url) -> None:
    response = api_client.get(url, headers={"If-None-Match": "*"})

    assert response.status_code == 401


@pytest.mark.parametrize(
    ("url", "granted"),
    [(CATALOG_URL, rule_codes.RULE_PARAMETER_READ), (RULES_URL, catalog_codes.CATALOG_READ)],
)
def test_304_requires_permission(api_client, org_a, make_member, url, granted) -> None:
    user, _ = make_member(org_a, [granted])
    api_client.force_authenticate(user)

    response = api_client.get(url, headers={"If-None-Match": "*"})

    assert response.status_code == 403


@pytest.mark.parametrize("url", [CATALOG_URL, RULES_URL])
def test_snapshots_are_read_only(phone, url) -> None:
    for method in (phone.post, phone.put, phone.patch):
        assert method(url, {}, format="json").status_code == 405
    assert phone.delete(url).status_code == 405


@pytest.mark.parametrize("url", [CATALOG_URL, RULES_URL])
def test_snapshots_vary_by_organization_header_also_on_304(phone, catalog, speed, url) -> None:
    ok = phone.get(url)
    not_modified = revalidate(phone, url, ok["ETag"])

    assert ok["Vary"] == not_modified["Vary"] == "X-Organization"
