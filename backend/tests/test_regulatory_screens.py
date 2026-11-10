"""Smoke tests of the regulatory endpoints (W57-W60) and the public portal (W69-W71)."""

import csv
import io
import zipfile
from datetime import timedelta

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from core.time import server_now
from organizations.models import Center, Organization, all_scope
from privacy.models import ExportLog, PortalSettings
from privacy.permissions import ADMIN_CODES, REGULATORY_CODES
from tests.conftest import MemberFactory

pytestmark = pytest.mark.django_db

CODES = (*ADMIN_CODES, *REGULATORY_CODES)


@pytest.fixture
def center(org_a: Organization) -> Center:
    return Center.objects.create(organization=org_a, code="C1", name="Center 1")


@pytest.fixture
def regulator(org_a: Organization, make_member: MemberFactory, center: Center) -> APIClient:
    user, membership = make_member(org_a, CODES)
    membership.scope = all_scope()
    membership.save()
    for profile in membership.profiles.all():
        profile.scope = all_scope()
        profile.save()
    client = APIClient()
    client.force_authenticate(user)
    return client


def test_data_transfer_create_list_revoke(regulator: APIClient, center: Center) -> None:
    now = server_now()
    body = {
        "recipient_institution": "UIEB",
        "center_id": str(center.pk),
        "valid_from": (now - timedelta(days=1)).isoformat(),
        "valid_until": (now + timedelta(days=30)).isoformat(),
        "reference": "Oficio 123",
    }
    created = regulator.post("/api/v1/data-transfers/", body, format="json")
    assert created.status_code == 201, created.content
    assert created.json()["status"] == "active"
    assert regulator.get("/api/v1/data-transfers/").json()["results"][0]["id"]
    revoked = regulator.post(
        f"/api/v1/data-transfers/{created.json()['id']}/revoke/",
        {"reason": "Convenio terminado"},
        format="json",
    )
    assert revoked.status_code == 200, revoked.content
    assert revoked.json()["status"] == "revoked"


@pytest.mark.parametrize("dataset", ["releases", "readings", "lab_results"])
@pytest.mark.parametrize("fmt", ["csv", "xlsx"])
def test_export_logs_access_and_blanks_rfc(
    regulator: APIClient, org_a: Organization, dataset: str, fmt: str
) -> None:
    response = regulator.get(
        "/api/v1/export/",
        {
            "dataset": dataset,
            "file_format": fmt,
            "date_from": "2026-01-01",
            "date_to": "2026-12-31",
        },
    )
    assert response.status_code == 200, response.content
    if fmt == "csv":
        header = next(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))
        assert header[-2:] == ["operator_rfc", "note"]
    else:
        names = zipfile.ZipFile(io.BytesIO(response.content)).namelist()
        assert "xl/worksheets/sheet1.xml" in names
    assert ExportLog.objects.filter(organization=org_a).count() == 1


def test_arco_register_track_resolve(regulator: APIClient) -> None:
    created = regulator.post(
        "/api/v1/arco-requests/",
        {"request_type": "access", "requester_reference": "REQ-001", "received_on": "2026-11-01"},
        format="json",
    )
    assert created.status_code == 201, created.content
    assert created.json()["due_on"] == "2026-11-21"
    item = created.json()["id"]
    started = regulator.patch(
        f"/api/v1/arco-requests/{item}/", {"status": "in_progress"}, format="json"
    )
    assert started.json()["status"] == "in_progress"
    resolved = regulator.post(
        f"/api/v1/arco-requests/{item}/resolve/",
        {"outcome": "resolved", "resolution_note": "Entregado"},
        format="json",
    )
    assert resolved.json()["status"] == "resolved"
    assert regulator.get("/api/v1/arco-requests/?status=resolved").json()["results"]


def test_portal_is_public_aggregate_and_configurable(
    regulator: APIClient, org_a: Organization
) -> None:
    public = APIClient()
    assert public.get(f"/api/v1/portal/{org_a.slug}/").status_code == 404
    saved = regulator.put(
        "/api/v1/portal-settings/update/",
        {"enabled": True, "indicators": ["releases_total", "releases_by_week", "coverage"]},
        format="json",
    )
    assert saved.status_code == 200, saved.content
    home = public.get(f"/api/v1/portal/{org_a.slug}/")
    assert home.status_code == 200
    assert home.json()["indicators"]["values"] == {"releases_total": 0}
    assert public.get(f"/api/v1/portal/{org_a.slug}/releases-by-week/").json()["rows"] == []
    assert public.get(f"/api/v1/portal/{org_a.slug}/coverage/").json()["areas"] == []
    PortalSettings.objects.filter(organization=org_a).update(indicators=["releases_total"])
    assert public.get(f"/api/v1/portal/{org_a.slug}/coverage/").status_code == 404


def test_other_organization_is_isolated(
    regulator: APIClient, org_b: Organization, make_member: MemberFactory
) -> None:
    user: User = make_member(org_b, CODES)[0]
    other = APIClient()
    other.force_authenticate(user)
    assert other.get("/api/v1/data-transfers/").json()["results"] == []
