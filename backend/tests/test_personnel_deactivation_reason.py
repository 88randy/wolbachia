"""Deactivating a person requires a void-rule reason, kept on the receipt and shown on the record."""

import pytest
from rest_framework.test import APIClient

from accounts.models import AccessLog
from tests.test_accounts_b_02 import make_person
from tests.test_accounts_b_02 import setup as setup  # noqa: PLC0414 -- re-exported fixture

pytestmark = pytest.mark.django_db


def _client(setup):
    client = APIClient()
    client.force_authenticate(setup.actor.user)
    return client


@pytest.mark.parametrize("body", [{}, {"reason": ""}, {"reason": "  short  "}])
def test_deactivation_without_a_long_enough_reason_is_refused(setup, body):
    person, member = make_person(setup.actor, setup.center)

    response = _client(setup).post(
        f"/api/v1/users/{member.user_id}/deactivate/",
        {"expected_revision": person.revision, **body},
        format="json",
    )

    assert response.status_code == 400
    member.refresh_from_db()
    assert member.is_active
    assert not AccessLog.objects.filter(action=AccessLog.Action.DEACTIVATE).exists()


def test_the_reason_is_stored_on_the_receipt_and_shown_while_inactive(setup):
    person, member = make_person(setup.actor, setup.center)
    client = _client(setup)

    response = client.post(
        f"/api/v1/users/{member.user_id}/deactivate/",
        {"expected_revision": person.revision, "reason": "  Left the organization  "},
        format="json",
    )

    assert response.status_code == 200, response.data
    assert response.data["deactivation_reason"] == "Left the organization"
    receipt = AccessLog.objects.get(action=AccessLog.Action.DEACTIVATE, target=person)
    assert receipt.reason == "Left the organization"
    detail = client.get(f"/api/v1/users/{member.user_id}/")
    assert detail.data["deactivation_reason"] == "Left the organization"
    listed = client.get("/api/v1/users/", {"is_active": "false"})
    assert [row["deactivation_reason"] for row in listed.data["results"]] == [
        "Left the organization"
    ]
    log = client.get("/api/v1/access-log/", {"action": "user.deactivate"})
    assert [row["reason"] for row in log.data["results"]] == ["Left the organization"]


def test_an_active_person_has_no_deactivation_reason(setup):
    _person, member = make_person(setup.actor, setup.center)

    response = _client(setup).get(f"/api/v1/users/{member.user_id}/")

    assert response.data["deactivation_reason"] is None
