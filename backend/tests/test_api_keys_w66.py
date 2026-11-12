"""W66 API keys: the secret exists once, only its digest is stored, revocation needs a reason."""

import hashlib
from datetime import UTC, datetime, timedelta

import pytest
from django.core.cache import cache
from django.db import DatabaseError, connection, transaction

from core.exceptions import ImmutableRecordError
from organizations.models import all_scope
from privacy.api_keys import ApiKeyRefused, authenticate_api_key
from privacy.models import ApiKey, ApiKeyEvent
from tests.test_core_b_27 import make_center, make_point

URL = "/api/v1/api-keys/"
NOW = datetime.now(UTC)


def admin(make_member, organization, codes=("api_key.read", "api_key.manage")):
    user, membership = make_member(organization, codes)
    membership.scope = all_scope()
    membership.save(update_fields=["scope"])
    for profile in membership.profiles.all():
        profile.scope = all_scope()
        profile.save(update_fields=["scope"])
    return user


def payload(center, **changes):
    body = {
        "institution": "State health secretariat",
        "center_id": str(center.pk),
        "endpoints": ["coverage", "releases_total"],
        "rate_limit_per_day": 3,
        "valid_from": (NOW - timedelta(days=1)).isoformat(),
        "valid_until": (NOW + timedelta(days=30)).isoformat(),
    }
    return {**body, **changes}


@pytest.fixture
def issued(api_client, org_a, make_member):
    api_client.force_authenticate(admin(make_member, org_a))
    center = make_center(org_a, "C-KEY")
    response = api_client.post(URL, payload(center), format="json")
    assert response.status_code == 201, response.content
    return api_client, center, response


@pytest.mark.django_db
def test_secret_is_in_the_creation_answer_only_and_never_stored(issued):
    client, _center, response = issued
    body = response.json()
    secret = body["secret"]
    assert secret.startswith("cq_live_")
    assert response["Cache-Control"] == "no-store"

    row = ApiKey.objects.get()
    token_secret = secret.split(".", 1)[1]
    assert row.secret_digest == hashlib.sha256(token_secret.encode()).hexdigest()
    assert token_secret not in row.secret_digest
    # No column of the table holds the secret or the full token.
    with connection.cursor() as cursor:
        cursor.execute("SELECT row_to_json(k)::text FROM privacy_apikey k")
        stored = cursor.fetchone()[0]
    assert token_secret not in stored
    assert secret not in stored

    for read in (client.get(URL), client.get(f"{URL}{body['id']}/")):
        text = read.content.decode()
        assert token_secret not in text
        assert "secret" not in read.json().get("results", [read.json()])[0]
        assert "digest" not in text


@pytest.mark.django_db
def test_creation_requires_manage_and_read_requires_read(api_client, org_a, make_member):
    center = make_center(org_a, "C-PERM")
    api_client.force_authenticate(admin(make_member, org_a, ("api_key.read",)))
    assert api_client.get(URL).status_code == 200
    assert api_client.post(URL, payload(center), format="json").status_code == 403
    api_client.force_authenticate(admin(make_member, org_a, ("home.read",)))
    assert api_client.get(URL).status_code == 403


@pytest.mark.django_db
def test_validation_scope_and_one_live_key_per_institution(issued, org_a, org_b):
    client, center, _response = issued
    foreign = make_center(org_b, "C-FOREIGN")
    assert client.post(URL, payload(foreign), format="json").status_code == 404
    assert client.post(URL, payload(center, endpoints=["nope"]), format="json").status_code == 400
    assert client.post(URL, payload(center, endpoints=[]), format="json").status_code == 400
    assert client.post(URL, payload(center, rate_limit_per_day=0), format="json").status_code == 400
    bad_dates = payload(center, valid_until=(NOW - timedelta(days=5)).isoformat())
    assert client.post(URL, bad_dates, format="json").status_code == 400
    other_center_quadrant, _point = make_point(org_a, make_center(org_a, "C-OTHER"), "OTHER")
    wrong = payload(center, institution="Another", quadrant_id=str(other_center_quadrant.pk))
    assert client.post(URL, wrong, format="json").status_code == 404

    duplicate = client.post(
        URL, payload(center, institution="  STATE health SECRETARIAT "), format="json"
    )
    assert duplicate.status_code == 400
    assert ApiKey.objects.count() == 1


@pytest.mark.django_db
def test_revoke_needs_a_reason_keeps_the_row_and_logs_an_event(issued):
    client, center, response = issued
    key_id = response.json()["id"]

    assert (
        client.post(f"{URL}{key_id}/revoke/", {"reason": "short"}, format="json").status_code == 400
    )
    revoked = client.post(
        f"{URL}{key_id}/revoke/", {"reason": "Contract ended in November"}, format="json"
    )
    assert revoked.status_code == 200
    assert revoked.json()["status"] == "revoked"
    assert revoked.json()["revoke_reason"] == "Contract ended in November"
    assert "secret" not in revoked.json()
    assert ApiKey.objects.count() == 1
    assert list(ApiKeyEvent.objects.order_by("created_at").values_list("kind", flat=True)) == [
        "created",
        "revoked",
    ]
    again = client.post(f"{URL}{key_id}/revoke/", {"reason": "Another long reason"}, format="json")
    assert again.status_code == 400

    # The institution may get a new key once the old one is revoked.
    assert client.post(URL, payload(center), format="json").status_code == 201


@pytest.mark.django_db
def test_other_organization_cannot_see_or_revoke(issued, org_b, make_member, api_client):
    _client, _center, response = issued
    api_client.force_authenticate(admin(make_member, org_b))
    assert api_client.get(URL).json()["results"] == []
    gone = api_client.post(
        f"{URL}{response.json()['id']}/revoke/", {"reason": "Not my organization"}, format="json"
    )
    assert gone.status_code == 404


@pytest.mark.django_db
def test_authentication_checks_in_order_and_never_logs_the_secret(issued, caplog):
    _client, _center, response = issued
    token = response.json()["secret"]
    cache.clear()

    key = authenticate_api_key(token, "coverage")
    assert key.institution == "State health secretariat"
    for refused, expected in (
        (token[:-1] + ("a" if token[-1] != "a" else "b"), "invalid_key"),
        ("garbage", "invalid_key"),
        ("cq_live_000000000000.whatever", "invalid_key"),
    ):
        with pytest.raises(ApiKeyRefused) as error:
            authenticate_api_key(refused, "coverage")
        assert error.value.code == expected
    with pytest.raises(ApiKeyRefused) as error:
        authenticate_api_key(token, "readings_total")
    assert error.value.code == "endpoint_not_allowed"
    with pytest.raises(ApiKeyRefused) as error:
        authenticate_api_key(token, "coverage", NOW + timedelta(days=60))
    assert error.value.code == "key_not_valid_now"
    assert token.split(".", 1)[1] not in caplog.text


@pytest.mark.django_db
def test_rate_limit_counts_only_accepted_requests_and_revocation_blocks(issued):
    client, _center, response = issued
    token = response.json()["secret"]
    cache.clear()

    for _ in range(3):
        authenticate_api_key(token, "coverage")
    with pytest.raises(ApiKeyRefused) as error:
        authenticate_api_key(token, "coverage")
    assert error.value.code == "rate_limited"

    cache.clear()
    client.post(
        f"{URL}{response.json()['id']}/revoke/", {"reason": "Compromised key"}, format="json"
    )
    with pytest.raises(ApiKeyRefused) as error:
        authenticate_api_key(token, "coverage")
    assert error.value.code == "revoked_key"


def run_sql(statement):
    with transaction.atomic(), connection.cursor() as cursor:
        cursor.execute(statement)


@pytest.mark.django_db
def test_database_refuses_to_rewrite_or_delete_keys_and_events(issued):
    key = ApiKey.objects.get()
    with pytest.raises(DatabaseError, match="only change by one revocation"):
        run_sql("UPDATE privacy_apikey SET rate_limit_per_day = 99999")
    with pytest.raises(DatabaseError, match="never deleted"):
        run_sql("DELETE FROM privacy_apikey")
    with pytest.raises(DatabaseError, match="insert-only"):
        run_sql("UPDATE privacy_apikeyevent SET detail = 'x'")
    event = ApiKeyEvent.objects.get(key=key)
    event.detail = "changed"
    with pytest.raises(ImmutableRecordError):
        event.save()
