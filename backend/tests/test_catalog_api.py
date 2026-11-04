import pytest
from rest_framework.test import APIClient

from catalogs.models import CatalogItem
from core import permission_codes as codes
from organizations.models import Organization
from tests.conftest import MemberFactory
from tests.factories import CatalogFactory, CatalogItemFactory

pytestmark = pytest.mark.django_db

ADMIN_CODES = (
    codes.CATALOG_READ,
    codes.CATALOG_ITEM_CREATE,
    codes.CATALOG_ITEM_UPDATE,
    codes.CATALOG_ITEM_DEACTIVATE,
    codes.CATALOG_ITEM_ACTIVATE,
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
    assert set(response.data["results"][0]) == {"slug", "label_es", "label_en", "is_open"}


def test_there_is_no_post_on_catalogs(admin) -> None:
    assert admin.post("/api/v1/catalogs/", {"slug": "x"}, format="json").status_code == 405


def test_list_items_in_display_order_with_other_last(admin, catalog) -> None:
    CatalogItemFactory(catalog=catalog, code="other", is_other=True, sort=0)
    CatalogItemFactory(catalog=catalog, code="b", sort=2)
    CatalogItemFactory(catalog=catalog, code="a", sort=1)
    CatalogItemFactory(catalog=catalog, code="off", sort=3, is_active=False)

    response = admin.get(items_url("removal-reason"))

    assert [row["code"] for row in response.data["results"]] == ["a", "b", "off", "other"]


def test_retrieve_item(admin, catalog) -> None:
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


def test_deactivate_and_activate_an_item(admin, catalog) -> None:
    item = CatalogItemFactory(catalog=catalog)

    off = admin.post(items_url("removal-reason", f"{item.id}/deactivate/"))
    on = admin.post(items_url("removal-reason", f"{item.id}/activate/"))

    assert (off.status_code, off.data["is_active"]) == (200, False)
    assert (on.status_code, on.data["is_active"]) == (200, True)


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
        ("get", "", codes.CATALOG_READ),
        ("post", "", codes.CATALOG_ITEM_CREATE),
        ("patch", "ITEM/", codes.CATALOG_ITEM_UPDATE),
        ("post", "ITEM/deactivate/", codes.CATALOG_ITEM_DEACTIVATE),
        ("post", "ITEM/activate/", codes.CATALOG_ITEM_ACTIVATE),
    ],
)
def test_each_action_needs_its_own_permission_code(
    api_client, org_a, make_member, catalog, method, suffix, missing_code
) -> None:
    item = CatalogItemFactory(catalog=catalog)
    granted = [code for code in ADMIN_CODES if code != missing_code]
    client = as_member(api_client, org_a, make_member, *granted)

    response = getattr(client, method)(
        items_url("removal-reason", suffix.replace("ITEM", str(item.id))), {}, format="json"
    )

    assert response.status_code == 403
    assert response.data["code"] == "permission_denied"


def test_catalog_list_needs_catalog_read(api_client, org_a, make_member) -> None:
    client = as_member(api_client, org_a, make_member, codes.CATALOG_ITEM_CREATE)

    assert client.get("/api/v1/catalogs/").status_code == 403


def test_anonymous_requests_are_401(api_client, catalog) -> None:
    assert api_client.get("/api/v1/catalogs/").status_code == 401
    assert api_client.get(items_url("removal-reason")).status_code == 401
