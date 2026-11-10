"""Protected RFC requests have per-user limits below the global API budget."""

import pytest
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from accounts.models import AccessLog, Personnel
from tests import test_accounts_b_02
from tests.test_accounts_b_02 import make_actor, make_person
from tests.test_rfc_crypto import SYNTHETIC_RFC

pytestmark = pytest.mark.django_db
setup = test_accounts_b_02.setup


@pytest.fixture
def rfc_budgets(monkeypatch):
    monkeypatch.setitem(SimpleRateThrottle.THROTTLE_RATES, "rfc_reveal", "2/hour")
    monkeypatch.setitem(SimpleRateThrottle.THROTTLE_RATES, "rfc_write", "2/hour")
    monkeypatch.setattr(SimpleRateThrottle, "timer", lambda _: 1000.0)


@pytest.mark.django_db(transaction=True)
def test_reveal_budget_is_per_user_across_clients_and_targets(setup, rfc_budgets):
    person, member = make_person(setup.actor, setup.center, rfc=SYNTHETIC_RFC)
    other_person, other_member = make_person(setup.actor, setup.center, rfc="TEST000102AA0")
    client = APIClient()
    client.force_authenticate(setup.actor.user)
    url = f"/api/v1/users/{member.user_id}/reveal-rfc/"

    assert client.post(url).status_code == 200
    second_client = APIClient()
    second_client.force_authenticate(setup.actor.user)
    second_url = f"/api/v1/users/{other_member.user_id}/reveal-rfc/"
    assert second_client.post(second_url, REMOTE_ADDR="192.0.2.2").status_code == 200

    rejected = client.post(url)

    assert (rejected.status_code, rejected.data["code"]) == (429, "throttled")
    assert rejected["Retry-After"] == "3600"
    assert (
        AccessLog.objects.filter(
            target__in=[person, other_person], action=AccessLog.Action.REVEAL_RFC
        ).count()
        == 2
    )
    other_actor, _, _ = make_actor(setup.actor.organization, ["user.reveal_rfc"])
    second_client.force_authenticate(other_actor.user)
    assert second_client.post(url).status_code == 200


@pytest.mark.django_db(transaction=True)
def test_rfc_write_budget_counts_failed_guesses_across_create_and_patch_without_blocking_work_edits(
    setup, rfc_budgets
):
    person, member = make_person(setup.actor, setup.center)
    make_person(setup.actor, setup.center, rfc=SYNTHETIC_RFC)
    client = APIClient()
    client.force_authenticate(setup.actor.user)
    url = f"/api/v1/users/{member.user_id}/"
    first = client.patch(
        url, {"expected_revision": person.revision, "rfc": SYNTHETIC_RFC}, format="json"
    )
    assert first.status_code == 400
    create_fields = {
        "username": "synthetic-throttled-rfc",
        "display_name": "Synthetic RFC employee",
        "center_id": str(setup.center.pk),
        "rfc": "TEST000102AA0",
    }
    created = client.post("/api/v1/users/", create_fields, format="json")
    assert created.status_code == 201

    rejected_patch = client.patch(
        url,
        {"expected_revision": person.revision, "rfc": "TEST000103AA0"},
        format="json",
        REMOTE_ADDR="192.0.2.3",
    )
    rejected_create = client.post(
        "/api/v1/users/",
        {**create_fields, "username": "synthetic-denied-rfc", "rfc": "TEST000104AA0"},
        format="json",
    )

    for rejected in (rejected_patch, rejected_create):
        assert (rejected.status_code, rejected.data["code"]) == (429, "throttled")
        assert rejected["Retry-After"] == "3600"
    assert Personnel.objects.count() == 3
    person.refresh_from_db()
    assert person.revision == 1
    assert not person.rfc_ciphertext
    work_edit = client.patch(
        url,
        {"expected_revision": person.revision, "display_name": "Synthetic work edit"},
        format="json",
    )
    assert work_edit.status_code == 200
