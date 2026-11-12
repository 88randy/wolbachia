"""W56 comparison and W61 retention: shape, permission per indicator, scope and validation."""

from uuid import uuid4

import pytest

from tests.test_analytics_dashboards import member_with
from tests.test_core_b_27 import make_center, make_point

COMPARISON = "/api/v1/analytics/comparison/"
RETENTION = "/api/v1/retention/"


@pytest.mark.django_db
@pytest.mark.parametrize("indicator", ["positive_index", "coverage", "eggs_per_ovitrap"])
@pytest.mark.parametrize("group_by", ["quadrant", "center"])
def test_comparison_answers_rows_with_previous_period(
    api_client, org_a, make_member, indicator, group_by
):
    api_client.force_authenticate(
        member_with(make_member, org_a, ("analytics.entomology.read", "analytics.operations.read"))
    )
    make_point(org_a, make_center(org_a, "C-CMP"), "CMP-P")

    response = api_client.get(
        COMPARISON,
        {
            "indicator": indicator,
            "group_by": group_by,
            "date_from": "2026-02-01",
            "date_to": "2026-02-28",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["indicator"] == indicator
    assert (body["previous_from"], body["previous_to"]) == ("2026-01-04", "2026-01-31")
    assert body["rows"] == []
    assert response["Cache-Control"] == "private, no-store"


@pytest.mark.django_db
def test_comparison_permission_follows_the_indicator(api_client, org_a, make_member):
    api_client.force_authenticate(member_with(make_member, org_a, ("analytics.entomology.read",)))
    assert api_client.get(COMPARISON, {"indicator": "positive_index"}).status_code == 200
    assert api_client.get(COMPARISON, {"indicator": "coverage"}).status_code == 403

    api_client.force_authenticate(member_with(make_member, org_a, ("analytics.operations.read",)))
    assert api_client.get(COMPARISON, {"indicator": "coverage"}).status_code == 200
    assert api_client.get(COMPARISON, {"indicator": "eggs_per_ovitrap"}).status_code == 403

    api_client.force_authenticate(member_with(make_member, org_a, ("home.read",)))
    assert api_client.get(COMPARISON).status_code == 403


@pytest.mark.django_db
def test_comparison_rejects_foreign_center_unknown_indicator_and_bad_range(
    api_client, org_a, org_b, make_member
):
    api_client.force_authenticate(
        member_with(make_member, org_a, ("analytics.entomology.read", "analytics.operations.read"))
    )
    foreign = make_center(org_b, "C-FOREIGN-CMP")

    assert api_client.get(COMPARISON, {"center": str(foreign.pk)}).status_code == 404
    assert api_client.get(COMPARISON, {"center": str(uuid4())}).status_code == 404
    assert api_client.get(COMPARISON, {"indicator": "nope"}).status_code == 400
    bad = {"date_from": "2026-02-01", "date_to": "2026-01-01"}
    assert api_client.get(COMPARISON, bad).status_code == 400


@pytest.mark.django_db
def test_retention_lists_the_real_jobs_and_needs_access_log_read(api_client, org_a, make_member):
    api_client.force_authenticate(member_with(make_member, org_a, ("access_log.read",)))

    response = api_client.get(RETENTION)

    assert response.status_code == 200
    body = response.json()
    assert body["nightly_at"] == "03:30"
    assert [row["code"] for row in body["rows"]] == ["auth_token_pairs", "session_audit"]
    assert [row["action"] for row in body["rows"]] == ["delete", "unlink"]
    # No run receipt exists yet: the API says so with nulls instead of inventing a time.
    assert all(row["last_run_at"] is None for row in body["rows"])

    api_client.force_authenticate(member_with(make_member, org_a, ("home.read",)))
    assert api_client.get(RETENTION).status_code == 403
