import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from catalogs import permissions as catalog_codes
from catalogs import services
from catalogs.models import CatalogItem
from organizations.models import Organization
from tests.conftest import MemberFactory
from tests.factories import CatalogFactory, CatalogItemFactory

pytestmark = pytest.mark.django_db

ADMIN_CODES = (
    catalog_codes.CATALOG_READ,
    catalog_codes.CATALOG_ITEM_CREATE,
    catalog_codes.CATALOG_ITEM_UPDATE,
    catalog_codes.CATALOG_ITEM_DEACTIVATE,
    catalog_codes.CATALOG_ITEM_ACTIVATE,
)


@pytest.fixture
def catalog(org_a: Organization):
    return CatalogFactory(organization=org_a, slug="removal-reason")


@pytest.fixture
def admin(api_client: APIClient, org_a: Organization, make_member: MemberFactory) -> APIClient:
    user, _ = make_member(org_a, ADMIN_CODES)
    api_client.force_authenticate(user)
    return api_client


def as_member(
    client: APIClient, organization: Organization, make_member: MemberFactory, *permissions: str
) -> APIClient:
    user, _ = make_member(organization, permissions)
    client.force_authenticate(user)
    return client


def items_url(slug: str, suffix: str = "") -> str:
    return f"/api/v1/catalogs/{slug}/items/{suffix}"


def test_list_catalogs_returns_the_organization_catalogs_only(admin, catalog, org_b) -> None:
    CatalogFactory(organization=org_b, slug="foreign")

    response = admin.get("/api/v1/catalogs/")

    assert response.status_code == 200
    assert [row["slug"] for row in response.data["results"]] == ["removal-reason"]
    assert set(response.data["results"][0]) == {
        "slug",
        "label_es",
        "label_en",
        "is_open",
        "version",
    }


def test_there_is_no_post_on_catalogs(admin) -> None:
    assert admin.post("/api/v1/catalogs/", {"slug": "x"}, format="json").status_code == 405


def test_list_items_in_display_order_with_other_last(admin, catalog) -> None:
    CatalogItemFactory(catalog=catalog, code="other", is_other=True, sort=0)
    CatalogItemFactory(catalog=catalog, code="b", sort=2)
    CatalogItemFactory(catalog=catalog, code="a", sort=1)
    CatalogItemFactory(catalog=catalog, code="off", sort=3, is_active=False)

    response = admin.get(items_url("removal-reason"))

    assert [row["code"] for row in response.data["results"]] == ["a", "b", "off", "other"]


def test_retrieve_returns_the_item_by_id(admin, catalog) -> None:
    item = CatalogItemFactory(catalog=catalog, code="a")

    response = admin.get(items_url("removal-reason", f"{item.id}/"))

    assert response.status_code == 200
    assert response.data["code"] == "a"


def test_create_item_appends_it_and_returns_201(admin, catalog) -> None:
    payload = {"code": "blocked", "label_es": "Bloqueado", "label_en": "Blocked"}

    response = admin.post(items_url("removal-reason"), payload, format="json")

    assert response.status_code == 201
    assert (response.data["code"], response.data["sort"], response.data["is_other"]) == (
        "blocked",
        1,
        False,
    )
    assert CatalogItem.objects.get(code="blocked").created_by is not None


def test_create_item_ignores_is_other_and_organization_in_the_payload(
    admin, catalog, org_b
) -> None:
    payload = {
        "code": "x",
        "label_es": "X",
        "is_other": True,
        "is_active": False,
        "organization": str(org_b.id),
    }

    response = admin.post(items_url("removal-reason"), payload, format="json")

    item = CatalogItem.objects.get(code="x")
    assert response.status_code == 201
    assert (item.is_other, item.is_active, item.organization_id) == (
        False,
        True,
        catalog.organization_id,
    )


def test_create_item_with_a_taken_code_is_400_with_a_field_code(admin, catalog) -> None:
    CatalogItemFactory(catalog=catalog, code="blocked")

    response = admin.post(
        items_url("removal-reason"), {"code": "blocked", "label_es": "B"}, format="json"
    )

    assert response.status_code == 400
    assert response.data["code"] == "validation_error"
    assert response.data["fields"] == {"code": [{"code": "duplicate_code", "params": {}}]}


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"label_es": "X"}, "code"),
        ({"code": "x"}, "label_es"),
        ({"code": "no spaces", "label_es": "X"}, "code"),
    ],
)
def test_create_item_validates_required_fields(admin, catalog, payload, field) -> None:
    response = admin.post(items_url("removal-reason"), payload, format="json")

    assert response.status_code == 400
    assert field in response.data["fields"]


def test_patch_changes_labels_order_and_photo_flag(admin, catalog) -> None:
    item = CatalogItemFactory(catalog=catalog)

    response = admin.patch(
        items_url("removal-reason", f"{item.id}/"),
        {"label_es": "Nuevo", "sort": 5, "requires_photo": True},
        format="json",
    )

    item.refresh_from_db()
    assert response.status_code == 200
    assert (item.label_es, item.sort, item.requires_photo) == ("Nuevo", 5, True)


def test_patch_ignores_code_is_other_and_is_active(admin, catalog) -> None:
    item = CatalogItemFactory(catalog=catalog, code="a")

    response = admin.patch(
        items_url("removal-reason", f"{item.id}/"),
        {"code": "z", "is_other": True, "is_active": False},
        format="json",
    )

    item.refresh_from_db()
    assert response.status_code == 200
    assert (item.code, item.is_other, item.is_active) == ("a", False, True)


def test_put_on_an_item_is_405(admin, catalog) -> None:
    item = CatalogItemFactory(catalog=catalog)

    response = admin.put(
        items_url("removal-reason", f"{item.id}/"), {"label_es": "X"}, format="json"
    )

    assert response.status_code == 405


def test_delete_on_an_item_is_405(admin, catalog) -> None:
    item = CatalogItemFactory(catalog=catalog)

    assert admin.delete(items_url("removal-reason", f"{item.id}/")).status_code == 405
    assert CatalogItem.objects.filter(pk=item.pk).exists()


@pytest.mark.parametrize("is_conditional", [False, True])
def test_deactivate_an_item(admin, catalog, is_conditional) -> None:
    item = CatalogItemFactory(catalog=catalog)

    url = items_url("removal-reason", f"{item.id}/deactivate/")
    response = admin.post(url, {"version": 0}, format="json") if is_conditional else admin.post(url)

    assert (response.status_code, response.data["is_active"]) == (200, False)
    assert response.data["catalog_version"] == 1


@pytest.mark.parametrize("is_conditional", [False, True])
def test_activate_an_item(admin, catalog, is_conditional) -> None:
    item = CatalogItemFactory(catalog=catalog, is_active=False)

    url = items_url("removal-reason", f"{item.id}/activate/")
    response = admin.post(url, {"version": 0}, format="json") if is_conditional else admin.post(url)

    assert (response.status_code, response.data["is_active"]) == (200, True)
    assert response.data["catalog_version"] == 1


@pytest.mark.parametrize("action", ["activate", "deactivate"])
def test_availability_action_wires_the_stale_version_conflict(admin, catalog, action):
    item = CatalogItemFactory(catalog=catalog, is_active=action == "deactivate")

    response = admin.post(
        items_url(catalog.slug, f"{item.pk}/{action}/"), {"version": 1}, format="json"
    )

    assert (response.status_code, response.data["code"]) == (409, "catalog_version_conflict")


@pytest.mark.parametrize("action", ["activate", "deactivate"])
@pytest.mark.parametrize(("version", "code"), [(-1, "min_value"), ("later", "invalid")])
def test_availability_action_returns_coded_version_field_errors(
    admin, catalog, action, version, code
):
    item = CatalogItemFactory(catalog=catalog)

    response = admin.post(
        items_url(catalog.slug, f"{item.pk}/{action}/"), {"version": version}, format="json"
    )

    assert (response.status_code, response.data["code"]) == (400, "validation_error")
    assert response.data["fields"]["version"] == [{"code": code, "params": {}}]


def test_deactivate_other_returns_409_other_item_cannot_be_deactivated(admin, catalog) -> None:
    other = CatalogItemFactory(catalog=catalog, code="other", is_other=True)

    response = admin.post(items_url("removal-reason", f"{other.id}/deactivate/"))

    other.refresh_from_db()
    assert response.status_code == 409
    assert response.data["code"] == "other_item_cannot_be_deactivated"
    assert other.is_active is True


def test_patch_never_deactivates_other_even_when_asked(admin, catalog) -> None:
    other = CatalogItemFactory(catalog=catalog, code="other", is_other=True)

    admin.patch(items_url("removal-reason", f"{other.id}/"), {"is_active": False}, format="json")

    other.refresh_from_db()
    assert other.is_active is True


def test_another_organizations_catalog_is_404(admin, org_b) -> None:
    CatalogFactory(organization=org_b, slug="foreign")

    assert admin.get(items_url("foreign")).status_code == 404
    response = admin.post(items_url("foreign"), {"code": "x", "label_es": "X"}, format="json")
    assert response.status_code == 404


def test_another_organizations_item_is_404(admin, catalog, org_b) -> None:
    foreign = CatalogItemFactory(catalog=CatalogFactory(organization=org_b, slug="foreign"))

    assert admin.get(items_url("removal-reason", f"{foreign.id}/")).status_code == 404
    assert admin.post(items_url("removal-reason", f"{foreign.id}/deactivate/")).status_code == 404
    assert admin.get(items_url("foreign", f"{foreign.id}/")).status_code == 404


def test_an_item_under_the_wrong_catalog_slug_is_404(admin, catalog, org_a) -> None:
    CatalogFactory(organization=org_a, slug="other-catalog")
    item = CatalogItemFactory(catalog=catalog)

    assert admin.get(items_url("other-catalog", f"{item.id}/")).status_code == 404


@pytest.mark.parametrize(
    ("method", "suffix", "missing_code"),
    [
        ("get", "", catalog_codes.CATALOG_READ),
        ("post", "", catalog_codes.CATALOG_ITEM_CREATE),
        ("patch", "ITEM/", catalog_codes.CATALOG_ITEM_UPDATE),
        ("post", "ITEM/deactivate/", catalog_codes.CATALOG_ITEM_DEACTIVATE),
        ("post", "ITEM/activate/", catalog_codes.CATALOG_ITEM_ACTIVATE),
        ("post", "reorder/", catalog_codes.CATALOG_ITEM_UPDATE),
    ],
)
def test_each_action_needs_its_own_permission_code(
    api_client, org_a, make_member, catalog, method, suffix, missing_code
) -> None:
    item = CatalogItemFactory(catalog=catalog)
    granted = [code for code in ADMIN_CODES if code != missing_code]
    client = as_member(api_client, org_a, make_member, *granted)

    payload = {"version": -1} if suffix in {"ITEM/activate/", "ITEM/deactivate/"} else {}
    response = getattr(client, method)(
        items_url("removal-reason", suffix.replace("ITEM", str(item.id))), payload, format="json"
    )

    assert response.status_code == 403
    assert response.data["code"] == "permission_denied"


def test_catalog_list_needs_catalog_read(api_client, org_a, make_member) -> None:
    client = as_member(api_client, org_a, make_member, catalog_codes.CATALOG_ITEM_CREATE)

    assert client.get("/api/v1/catalogs/").status_code == 403


def test_anonymous_requests_are_401(api_client, catalog) -> None:
    assert api_client.get("/api/v1/catalogs/").status_code == 401
    assert api_client.get(items_url("removal-reason")).status_code == 401


@pytest.mark.parametrize(
    ("payload", "field", "code"),
    [
        ({"code": "other", "label_es": "X"}, "code", "reserved_code"),
        ({"code": "Upper", "label_es": "X"}, "code", "invalid"),
        ({"code": "-lead", "label_es": "X"}, "code", "invalid"),
        ({"code": "x", "label_es": "X", "icon": "Bad Icon"}, "icon", "invalid"),
        ({"code": "x", "label_es": "X", "icon": "a" * 65}, "icon", "max_length"),
        ({"code": "x", "label_es": "X", "sort": 10_001}, "sort", "max_value"),
        ({"code": "x", "label_es": "X", "sort": -1}, "sort", "min_value"),
    ],
)
def test_create_item_input_is_validated(admin, catalog, payload, field, code) -> None:
    response = admin.post(items_url("removal-reason"), payload, format="json")

    assert response.status_code == 400
    assert response.data["fields"][field][0]["code"] == code


def test_create_item_accepts_a_valid_icon_and_the_maximum_sort(admin, catalog) -> None:
    payload = {"code": "ok", "label_es": "Ok", "icon": "alert-circle", "sort": 10_000}

    assert admin.post(items_url("removal-reason"), payload, format="json").status_code == 201


def test_patch_validates_icon_and_sort(admin, catalog) -> None:
    item = CatalogItemFactory(catalog=catalog)
    url = items_url("removal-reason", f"{item.id}/")

    assert admin.patch(url, {"sort": 10_001}, format="json").status_code == 400
    assert admin.patch(url, {"icon": "No Good"}, format="json").status_code == 400


def test_create_item_when_the_order_is_exhausted_is_400_sort_exhausted(admin, catalog) -> None:
    CatalogItemFactory(catalog=catalog, code="last", sort=10_000)

    response = admin.post(
        items_url("removal-reason"), {"code": "x", "label_es": "X"}, format="json"
    )

    assert response.status_code == 400
    assert response.data["fields"]["sort"] == [{"code": "sort_exhausted", "params": {}}]


def test_create_item_beyond_the_active_limit_is_409(admin, catalog, monkeypatch) -> None:
    monkeypatch.setattr(services, "MAX_ACTIVE_ITEMS_PER_CATALOG", 1)
    CatalogItemFactory(catalog=catalog)

    response = admin.post(
        items_url("removal-reason"), {"code": "x", "label_es": "X"}, format="json"
    )

    assert (response.status_code, response.data["code"]) == (409, "catalog_item_limit_reached")


def test_activate_beyond_the_active_limit_is_409(admin, catalog, monkeypatch) -> None:
    monkeypatch.setattr(services, "MAX_ACTIVE_ITEMS_PER_CATALOG", 1)
    CatalogItemFactory(catalog=catalog)
    off = CatalogItemFactory(catalog=catalog, is_active=False)

    response = admin.post(items_url("removal-reason", f"{off.id}/activate/"))

    assert (response.status_code, response.data["code"]) == (409, "catalog_item_limit_reached")


def test_patch_activate_and_deactivate_of_another_organizations_item_are_404(
    admin, catalog, org_b
) -> None:
    foreign = CatalogItemFactory(catalog=CatalogFactory(organization=org_b, slug="foreign"))
    base = items_url("removal-reason", f"{foreign.id}/")

    assert admin.patch(base, {"label_es": "Hacked"}, format="json").status_code == 404
    assert admin.post(f"{base}activate/", {"version": -1}, format="json").status_code == 404
    assert admin.post(f"{base}deactivate/", {"version": -1}, format="json").status_code == 404
    foreign.refresh_from_db()
    assert foreign.label_es != "Hacked"
    assert foreign.is_active is True


def test_inactive_maximum_does_not_block_automatic_sort(admin, catalog):
    CatalogItemFactory(catalog=catalog, sort=10_000, is_active=False)
    response = admin.post(
        items_url(catalog.slug), {"code": "new", "label_es": "New"}, format="json"
    )
    assert (response.status_code, response.data["sort"]) == (201, 1)


def test_list_returns_usage_counts_and_authorship_without_per_item_queries(admin, catalog):
    from catalogs.selectors import with_item_usage
    from catalogs.serializers import CatalogItemSerializer
    from shifts.models import MotorcycleCheck
    from tests.factories import ShiftFactory, UserFactory

    author = UserFactory()
    used = CatalogItemFactory(catalog=catalog, created_by=author)
    seed = CatalogItemFactory(catalog=catalog)
    for _ in range(2):
        MotorcycleCheck.objects.create(
            organization=catalog.organization,
            shift=ShiftFactory(organization=catalog.organization),
            item=used,
            result="ok",
        )

    # Usage and authors are batched: the number of queries does not grow with the list.
    def serialize_queries() -> int:
        with CaptureQueriesContext(connection) as queries:
            list(
                CatalogItemSerializer(with_item_usage(catalog.items.all(), catalog), many=True).data
            )
        return len(queries)

    baseline = serialize_queries()
    for _ in range(3):
        CatalogItemFactory(catalog=catalog, created_by=UserFactory())
    assert serialize_queries() == baseline

    response = admin.get(items_url(catalog.slug))
    rows = {row["id"]: row for row in response.data["results"]}
    assert (rows[str(used.pk)]["usage_count"], rows[str(used.pk)]["in_use"]) == (2, True)
    assert (rows[str(used.pk)]["created_by"], rows[str(used.pk)]["created_by_username"]) == (
        author.pk,
        author.username,
    )
    assert (rows[str(seed.pk)]["usage_count"], rows[str(seed.pk)]["in_use"]) == (0, False)
    assert rows[str(seed.pk)]["created_by"] is None
    assert rows[str(seed.pk)]["created_by_username"] is None


def test_deactivation_records_actor_and_time_and_activation_clears_them(
    admin, catalog, monkeypatch
):
    from datetime import UTC, datetime

    item = CatalogItemFactory(catalog=catalog)
    base = items_url(catalog.slug, f"{item.pk}/")
    instant = datetime(2026, 1, 15, 12, tzinfo=UTC)
    monkeypatch.setattr("catalogs.services.timezone.now", lambda: instant)
    deactivated = admin.post(f"{base}deactivate/")
    row = admin.get(items_url(catalog.slug)).data["results"][0]
    actor = deactivated.wsgi_request.user
    assert deactivated.status_code == 200
    assert row["deactivated_by"] == actor.pk
    assert row["deactivated_by_username"] == actor.username
    assert datetime.fromisoformat(row["deactivated_at"].replace("Z", "+00:00")) == instant
    activated = admin.post(f"{base}activate/")
    assert activated.status_code == 200
    assert all(
        activated.data[field] is None
        for field in ["deactivated_at", "deactivated_by", "deactivated_by_username"]
    )


def test_void_usage_sums_historical_sources_and_isolates_organization(admin, catalog, org_b):
    from django.utils import timezone

    from tests.factories import MotorcycleFactory, UserFactory
    from tests.testapp.models import Widget

    catalog.slug = "void-reason"
    catalog.save(update_fields=["slug"])
    item = CatalogItemFactory(catalog=catalog, code="duplicate-record")
    CatalogItemFactory(
        catalog=CatalogFactory(organization=org_b, slug="void-reason"), code=item.code
    )
    actor = UserFactory()
    for organization in [catalog.organization, org_b]:
        audit = dict(
            organization=organization,
            voided_at=timezone.now(),
            voided_by=actor,
            void_reason_code=item.code,
        )
        Widget.objects.create(name="Historical", **audit)
        MotorcycleFactory(**audit)
    response = admin.get(items_url(catalog.slug))
    assert response.data["results"][0]["usage_count"] == 2
    assert response.data["results"][0]["in_use"] is True


def test_item_reads_carry_the_catalog_revision_and_follow_item_writes(admin, catalog):
    catalog.revision = 7
    catalog.save(update_fields=["revision"])
    first = CatalogItemFactory(catalog=catalog)
    CatalogItemFactory(catalog=catalog, is_active=False)
    CatalogItemFactory(catalog=catalog, code="other", is_other=True)
    url = items_url(catalog.slug)

    before = admin.get(url)
    assert before.status_code == 200
    assert {row["catalog_version"] for row in before.data["results"]} == {7}
    detail = admin.get(f"{url}{first.pk}/")
    assert detail.data["catalog_version"] == 7

    changed = admin.patch(f"{url}{first.pk}/", {"label_es": "Changed"}, format="json")
    assert changed.status_code == 200
    catalog.refresh_from_db()
    after = admin.get(url)
    assert catalog.revision == 8
    assert {row["catalog_version"] for row in after.data["results"]} == {catalog.revision}
