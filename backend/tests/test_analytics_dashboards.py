"""Smoke tests of the read-only dashboards: shape, permission and scope filters."""

from uuid import uuid4

import pytest

from organizations.models import all_scope
from tests.test_core_b_27 import make_center, make_point

OPERATIONS = "/api/v1/analytics/operations/"
ENTOMOLOGY = "/api/v1/analytics/entomology/"
WOLBACHIA = "/api/v1/analytics/wolbachia-prevalence/"
ENDPOINTS = (
    (OPERATIONS, "analytics.operations.read"),
    (ENTOMOLOGY, "analytics.entomology.read"),
    (WOLBACHIA, "analytics.wolbachia.read"),
)


def member_with(make_member, organization, codes):
    user, membership = make_member(organization, codes)
    membership.scope = all_scope()
    membership.save(update_fields=["scope"])
    for profile in membership.profiles.all():
        profile.scope = all_scope()
        profile.save(update_fields=["scope"])
    return user


@pytest.mark.django_db
@pytest.mark.parametrize(("url", "code"), ENDPOINTS)
def test_dashboard_answers_charts_with_series_table_and_codes(
    api_client, org_a, make_member, url, code
):
    api_client.force_authenticate(member_with(make_member, org_a, (code, "incident.read")))

    response = api_client.get(url, {"granularity": "week"})

    assert response.status_code == 200
    body = response.json()
    assert body["charts"]
    for chart in body["charts"]:
        assert chart["label"]["code"].startswith("analytics.")
        assert {"series", "table"} <= set(chart)
        assert [c["key"] for c in chart["table"]["columns"]]
    assert {"cutoff", "filters", "indicators", "notes"} <= set(body)


@pytest.mark.django_db
@pytest.mark.parametrize(("url", "code"), ENDPOINTS)
def test_dashboard_requires_its_permission(api_client, org_a, make_member, url, code):
    api_client.force_authenticate(member_with(make_member, org_a, ("home.read",)))

    assert api_client.get(url).status_code == 403


@pytest.mark.django_db
def test_foreign_quadrant_or_center_is_404_and_bad_range_is_400(
    api_client, org_a, org_b, make_member
):
    api_client.force_authenticate(
        member_with(make_member, org_a, ("analytics.entomology.read", "analytics.operations.read"))
    )
    quadrant, _point = make_point(org_b, make_center(org_b, "C-OTHER"), "OTHER-P")

    assert api_client.get(ENTOMOLOGY, {"quadrant": str(quadrant.pk)}).status_code == 404
    assert api_client.get(OPERATIONS, {"center": str(uuid4())}).status_code == 404
    assert (
        api_client.get(OPERATIONS, {"date_from": "2026-02-01", "date_to": "2026-01-01"}).status_code
        == 400
    )
