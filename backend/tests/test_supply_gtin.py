"""Optional supply GTIN: stored as one canonical GTIN-14 and searchable for scanned supplier codes."""

import pytest

from tests.inventory_support import allow_all

pytestmark = pytest.mark.django_db

URL = "/api/v1/supply-types/"
BASE = {
    "code": "GTIN-A",
    "label": "Synthetic gtin supply",
    "unit": "box",
    "identity_kind": "lot",
    "is_biological": False,
}


@pytest.fixture
def writer(org_a, make_member, api_client):
    _, member = make_member(org_a, ["supply_type.create", "supply_type.update", "supply_type.read"])
    allow_all(member)
    api_client.force_authenticate(member.user)
    return api_client


def test_gtin_defaults_to_empty(writer):
    response = writer.post(URL, BASE, format="json")
    assert response.status_code == 201
    assert response.json()["gtin"] == ""


@pytest.mark.parametrize(
    ("typed", "stored"),
    [
        ("7501055300013", "07501055300013"),
        ("07501055300013", "07501055300013"),
        (" 12345670 ", "00000012345670"),
        ("", ""),
    ],
)
def test_gtin_is_normalized_to_fourteen_digits(writer, typed, stored):
    response = writer.post(URL, {**BASE, "gtin": typed}, format="json")
    assert response.status_code == 201
    assert response.json()["gtin"] == stored


@pytest.mark.parametrize("bad", ["12345", "75010553000A3", "123456789012345", "١٢٣٤٥٦٧٨"])
def test_gtin_with_wrong_length_or_characters_is_refused(writer, bad):
    assert writer.post(URL, {**BASE, "gtin": bad}, format="json").status_code == 400


def test_search_finds_a_supply_by_its_gtin_and_update_changes_it(writer):
    created = writer.post(URL, {**BASE, "gtin": "7501055300013"}, format="json").json()
    writer.post(URL, {**BASE, "code": "GTIN-B", "gtin": "7501055300020"}, format="json")
    found = writer.get(URL, {"search": "07501055300013"}).json()
    assert [row["code"] for row in found["results"]] == ["GTIN-A"]
    changed = writer.patch(
        f"{URL}{created['id']}/",
        {"expected_revision": created["revision"], "gtin": "7501055300037"},
        format="json",
    )
    assert changed.status_code == 200
    assert changed.json()["gtin"] == "07501055300037"
