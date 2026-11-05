"""`POST /field/sync/`: authentication, permissions, limits, throttle and the final upload."""

import uuid
from datetime import timedelta

import pytest
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import RevokeReason
from accounts.revocation import Revocation, revoke_device, revoke_session
from field_sync.models import FieldEvent
from field_sync.permissions import FIELD_EVENT_SYNC
from field_sync.throttling import FieldSyncDeviceThrottle
from organizations.models import Organization
from reviews.models import ReviewItem
from reviews.permissions import REVIEW_ITEM_READ
from tests.conftest import MemberFactory
from tests.factories import UserFactory
from tests.sync_support import (
    SYNC,
    Phone,
    batch,
    configure_clock_skew,
    event,
    make_phone,
    second_device_of,
)
from tests.testapp.models import Widget

pytestmark = pytest.mark.django_db


@pytest.fixture
def phone(org_a: Organization, make_member: MemberFactory) -> Phone:
    return make_phone(make_member, org_a)


# --- authentication and permission ---------------------------------------------------------


def test_the_answer_has_results_and_changes(phone: Phone) -> None:
    sent = event()

    response = phone.sync([sent])

    assert response.status_code == 200
    assert set(response.data) == {"server_time", "results", "changes"}
    assert set(response.data["changes"]) == {
        "cursor",
        "reviews",
        "catalog_version",
        "rules_version",
        "has_more",
        "next_change_at",
        "assignments",
        "supplies",
        "permits",
        "eligibility",
        "history",
        "map_manifests",
        "quadrants",
        "sampling_points",
        "ovitraps",
    }
    assert response.data["results"][0]["id"] == sent["id"]


def test_a_request_without_a_token_is_a_401_with_a_bearer_challenge() -> None:
    response = APIClient().post(SYNC, {"events": []}, format="json")

    assert (response.status_code, response.data["code"]) == (401, "not_authenticated")
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_an_unknown_token_is_an_invalid_token() -> None:
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")

    response = client.post(SYNC, {"events": []}, format="json")

    assert (response.status_code, response.data["code"]) == (401, "invalid_token")


def test_a_web_session_cookie_is_not_accepted(phone: Phone) -> None:
    web = APIClient()
    web.force_login(phone.user)

    response = web.post(SYNC, batch(phone, [event()]), format="json")

    assert (response.status_code, response.data["code"]) == (401, "not_authenticated")
    assert not FieldEvent.objects.exists()


def test_a_user_without_the_sync_permission_is_denied(
    org_a: Organization, make_member: MemberFactory
) -> None:
    supervisor = make_phone(make_member, org_a, codes=(REVIEW_ITEM_READ,))

    response = supervisor.sync([event()])

    assert (response.status_code, response.data["code"]) == (403, "permission_denied")
    assert not FieldEvent.objects.exists()


def test_the_token_pins_the_organization_another_header_is_refused(
    phone: Phone, org_b: Organization
) -> None:
    response = phone.client.post(
        SYNC, batch(phone, [event()]), format="json", HTTP_X_ORGANIZATION=org_b.slug
    )

    assert (response.status_code, response.data["code"]) == (403, "no_active_membership")
    assert not FieldEvent.objects.exists()


def test_the_phone_must_say_which_device_it_is(phone: Phone) -> None:
    response = phone.client.post(
        SYNC, batch(phone, [event()], device_id=str(uuid.uuid4())), format="json"
    )

    assert (response.status_code, response.data["code"]) == (403, "device_mismatch")
    assert not FieldEvent.objects.exists()


def test_other_methods_are_not_allowed(phone: Phone) -> None:
    assert phone.client.get(SYNC).status_code == 405
    assert phone.client.put(SYNC, {}, format="json").status_code == 405
    assert phone.client.delete(SYNC).status_code == 405


# --- limits and throttle -------------------------------------------------------------------


def test_a_body_over_the_byte_limit_is_a_413_before_anything_is_read(phone: Phone) -> None:
    body = batch(phone, [event(payload={"text": "x" * 50, "padding": "y" * 400})])

    with override_settings(SYNC_MAX_BODY_BYTES=300):
        response = phone.client.post(SYNC, body, format="json")

    assert (response.status_code, response.data["code"]) == (413, "payload_too_large")
    assert not FieldEvent.objects.exists()


def test_more_events_than_the_limit_is_a_413_and_stores_nothing(phone: Phone) -> None:
    with override_settings(SYNC_MAX_EVENTS=3):
        refused = phone.sync([event() for _ in range(4)])
        allowed = phone.sync([event() for _ in range(3)])

    assert (refused.status_code, refused.data["code"]) == (413, "payload_too_large")
    assert allowed.status_code == 200
    assert FieldEvent.objects.count() == 3


def test_the_limit_applies_to_a_batch_that_would_also_fail_validation(phone: Phone) -> None:
    with override_settings(SYNC_MAX_EVENTS=1):
        response = phone.client.post(SYNC, {"events": [{"junk": 1}, {"junk": 2}]}, format="json")

    assert response.status_code == 413


def test_the_throttle_is_per_device_and_answers_429_with_retry_after(
    phone: Phone, make_member: MemberFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(FieldSyncDeviceThrottle.THROTTLE_RATES, "field_sync", "2/min")
    same_user_other_device = second_device_of(phone)
    other_user = make_phone(make_member, phone.organization)

    assert [phone.sync([]).status_code for _ in range(2)] == [200, 200]
    limited = phone.sync([event()])

    assert (limited.status_code, limited.data["code"]) == (429, "throttled")
    assert int(limited.headers["Retry-After"]) > 0
    assert not FieldEvent.objects.exists()  # a throttled request is never processed
    assert same_user_other_device.sync([]).status_code == 200
    assert other_user.sync([]).status_code == 200


# --- final upload of a revoked phone -------------------------------------------------------


def revoke(
    phone: Phone, reason: RevokeReason = RevokeReason.ADMIN_REVOKE, allow: bool = True
) -> None:
    revoke_session(phone.issued.session, Revocation(reason, allow_final_upload=allow))


def test_a_revoked_phones_final_upload_lands_in_review_and_works_only_once(phone: Phone) -> None:
    sent = event()
    revoke(phone)

    first = phone.sync([sent])
    second = phone.sync([event()])

    assert first.status_code == 200
    assert first.headers["X-Session-Revoked"] == "true"
    assert first.data["results"] == [
        {"id": sent["id"], "status": "in_review", "code": "final_upload_after_revoke", "params": {}}
    ]
    stored = FieldEvent.objects.get(pk=sent["id"])
    assert (stored.status, stored.is_final_upload) == ("in_review", True)
    item = ReviewItem.objects.get(field_event=stored)
    assert (item.kind, item.code) == ("in_review", "final_upload_after_revoke")
    assert (second.status_code, second.data["code"]) == (401, "session_revoked")
    assert FieldEvent.objects.count() == 1


def test_the_final_upload_pulls_nothing(phone: Phone) -> None:
    revoke(phone)

    response = phone.sync([event()])

    assert response.data["changes"] == {
        "cursor": None,
        "reviews": [],
        "catalog_version": None,
        "rules_version": None,
        "has_more": False,
        "next_change_at": None,
        "assignments": [],
        "supplies": [],
        "permits": [],
        "eligibility": [],
        "history": [],
        "map_manifests": [],
        "quadrants": [],
        "sampling_points": [],
        "ovitraps": [],
    }


def test_a_device_revoke_that_allows_it_also_leaves_a_final_upload(
    phone: Phone, org_a: Organization
) -> None:
    revoke_device(phone.issued.session.device, UserFactory(), allow_final_upload=True)

    response = phone.sync([event()])

    assert response.status_code == 200
    assert response.data["results"][0]["code"] == "final_upload_after_revoke"


def test_without_the_admins_explicit_allowance_a_revoked_phone_gets_nothing(phone: Phone) -> None:
    revoke(phone, allow=False)

    response = phone.sync([event()])

    assert (response.status_code, response.data["code"]) == (401, "session_revoked")
    assert not FieldEvent.objects.exists()


def test_a_refresh_reuse_revocation_never_allows_a_final_upload(phone: Phone) -> None:
    revoke(phone, RevokeReason.REFRESH_REUSE, allow=True)

    response = phone.sync([event()])

    assert (response.status_code, response.data["code"]) == (401, "session_revoked")


def test_a_final_upload_is_only_for_posts(phone: Phone) -> None:
    revoke(phone)

    assert phone.client.get(SYNC).status_code == 405  # no such route: nothing is spent
    assert phone.client.options(SYNC).status_code == 401
    assert phone.sync([event()]).status_code == 200  # still unspent


def test_a_failed_final_upload_gives_the_upload_back(phone: Phone) -> None:
    revoke(phone)
    invalid_envelope = event(payload="not an object")

    refused = phone.sync([invalid_envelope])
    retried = phone.sync([event()])

    assert refused.status_code == 400
    assert retried.status_code == 200
    assert FieldEvent.objects.count() == 1


def test_an_oversize_final_upload_does_not_spend_it(phone: Phone) -> None:
    revoke(phone)

    with override_settings(SYNC_MAX_EVENTS=1):
        refused = phone.sync([event(), event()])
    retried = phone.sync([event()])

    assert refused.status_code == 413
    assert retried.status_code == 200


def test_a_device_mismatch_on_a_final_upload_does_not_spend_it(phone: Phone) -> None:
    revoke(phone)

    refused = phone.client.post(
        SYNC, batch(phone, [event()], device_id=str(uuid.uuid4())), format="json"
    )
    retried = phone.sync([event()])

    assert refused.status_code == 403
    assert retried.status_code == 200


def test_in_a_final_upload_the_final_upload_status_beats_clock_skew_and_rejection_beats_both(
    phone: Phone,
) -> None:
    configure_clock_skew(phone.organization, 300)
    revoke(phone)
    skewed_sent_at = (timezone.now() + timedelta(hours=2)).isoformat()

    response = phone.sync([event(), event(payload={})], sent_at=skewed_sent_at)

    assert [(r["status"], r["code"]) for r in response.data["results"]] == [
        ("in_review", "final_upload_after_revoke"),
        ("rejected", "invalid_payload"),
    ]


def test_a_final_upload_handler_sees_why_the_event_will_be_reviewed(phone: Phone) -> None:
    revoke(phone)

    phone.sync([event(type="test.context_probe")])

    assert Widget.objects.filter(name="review:final_upload_after_revoke").count() == 1


def test_a_normal_request_leaves_the_review_code_empty_for_handlers(phone: Phone) -> None:
    phone.sync([event(type="test.context_probe")])

    assert Widget.objects.filter(name="review:None").count() == 1


def test_the_sync_view_is_the_only_opt_in_besides_the_test_view() -> None:
    from field_sync.views import FieldSyncViewSet

    assert FieldSyncViewSet.allows_revoked_final_upload is True
    assert FieldSyncViewSet.final_upload_methods == ("POST",)


def test_the_codes_the_phone_needs_exist_in_the_default_profiles() -> None:
    from organizations.defaults import DEFAULT_PROFILE_PERMISSIONS

    assert FIELD_EVENT_SYNC in DEFAULT_PROFILE_PERMISSIONS["courier"]
    assert FIELD_EVENT_SYNC not in DEFAULT_PROFILE_PERMISSIONS["supervisor"]
