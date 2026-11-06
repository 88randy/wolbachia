"""Public authority/cache wiring and one real Organization arbitration journey (CI SQL)."""

from dataclasses import replace
from datetime import timedelta
from uuid import uuid4

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import RevokeReason
from accounts.revocation import Revocation, revoke_session
from accounts.services import DeviceInfo, start_device_session
from organizations.defaults import COURIER_CODES
from organizations.models import all_scope
from ovitraps.lifecycle.advisory import read_scoped_advisory
from rules.seeds import seed_default_rule_parameters
from tests.ovitrap_support import CAPTURED, envelope, ingest, setup_field
from uploads.access import UploadActor

pytestmark = pytest.mark.django_db


@pytest.fixture
def advisory_case(monkeypatch):
    monkeypatch.setattr(timezone, "now", lambda: CAPTURED)
    case = setup_field()
    case.organization = case.batch.organization
    case.profile.permission_codes = list(COURIER_CODES)
    case.profile.save(update_fields=["permission_codes"])
    seed_default_rule_parameters(case.organization)
    case.placement = envelope(case)
    assert ingest(case, case.placement).status == "accepted"
    case.issued = start_device_session(
        case.batch.user, case.organization, DeviceInfo(case.batch.device.pk)
    )
    case.client = APIClient()
    case.client.credentials(HTTP_AUTHORIZATION=f"Bearer {case.issued.access}")
    case.actor = UploadActor(
        case.batch.user,
        case.organization,
        case.batch.device.pk,
        case.issued.session.pk,
        case.issued.pair.pk,
    )
    case.url = f"/api/v1/field/ovitrap-advisories/{case.identity}/"
    return case


def get_advisory(case, at=CAPTURED, **headers):
    return case.client.get(case.url, {"at": at.isoformat()}, **headers)


def test_clock_transition_recomputes_state_before_etag_without_business_writes(
    advisory_case, monkeypatch
):
    from field_sync.models import CourierChange, FieldEvent
    from geography.models import PointVersion
    from rules.models import RuleParameterVersion
    from scheduling.models import ScheduledTask

    case = advisory_case
    cutoff = CAPTURED + timedelta(seconds=1)
    unchanged = (
        list(FieldEvent.objects.values()),
        list(PointVersion.objects.values()),
        list(RuleParameterVersion.objects.values()),
        CourierChange.objects.count(),
        ScheduledTask.objects.count(),
    )
    future = get_advisory(case, cutoff)
    assert future.status_code == 200
    assert future.data["state"] == "unavailable"
    assert future.data["unavailable_reason"] == "future_cutoff"
    assert future.data["incident_count"] is None
    monkeypatch.setattr(timezone, "now", lambda: cutoff)
    current = get_advisory(case, cutoff, HTTP_IF_NONE_MATCH=future.headers["ETag"])
    assert current.status_code == 200
    assert current.data["state"] == "available"
    assert current.headers["ETag"] != future.headers["ETag"]
    assert current.data["incident_count"] == 0
    assert current.data["suggested"] is False
    assert current.data["observed_closed_house_weeks"] == []
    parameters = current.data["rule_context"]["parameters"]
    for key, value in (("closed_house_weeks_to_relocate", 2), ("incidents_to_relocate", 3)):
        version = RuleParameterVersion.objects.get(parameter__key=key)
        assert parameters[key] == {
            "version_id": str(version.pk),
            "value": value,
            "effective_from": version.effective_from.isoformat().replace("+00:00", "Z"),
        }
    same = get_advisory(case, cutoff, HTTP_IF_NONE_MATCH=current.headers["ETag"])
    assert same.status_code == 304
    assert same.headers["Cache-Control"] == "private, no-cache"
    assert same.headers["Vary"].find("X-Organization") >= 0
    assert unchanged == (
        list(FieldEvent.objects.values()),
        list(PointVersion.objects.values()),
        list(RuleParameterVersion.objects.values()),
        CourierChange.objects.count(),
        ScheduledTask.objects.count(),
    )
    missing = get_advisory(case, CAPTURED - timedelta(days=31))
    assert missing.data["state"] == "unavailable"
    assert missing.data["unavailable_reason"] == "rule_context_unavailable"
    assert missing.data["rule_context"] is None
    assert missing.data["suggested"] is None


def test_actual_bearer_both_paired_actions_and_current_denial_before_304(
    advisory_case, monkeypatch
):
    from tests.factories import ProfileFactory

    case = advisory_case
    assert "ovitrap.read" not in case.profile.permission_codes
    current = get_advisory(case)
    assert current.status_code == 200
    assert case.client.get(f"/api/v1/ovitraps/{case.identity}/history/").status_code == 403
    for codes in (["field.bootstrap"], ["field_event.sync"], []):
        case.profile.permission_codes = codes
        case.profile.save(update_fields=["permission_codes"])
        assert get_advisory(case, HTTP_IF_NONE_MATCH=current.headers["ETag"]).status_code == 403
    case.profile.permission_codes = ["field.bootstrap", "field_event.sync"]
    center, quadrant = str(case.point.center_id), str(case.point.quadrant_id)
    case.profile.scope = {
        "centers": {"mode": "selected", "ids": [center]},
        "quadrants": {"mode": "none", "ids": []},
    }
    case.profile.save(update_fields=["permission_codes", "scope"])
    other = ProfileFactory(
        organization=case.organization,
        permission_codes=case.profile.permission_codes,
        scope={
            "centers": {"mode": "none", "ids": []},
            "quadrants": {"mode": "selected", "ids": [quadrant]},
        },
    )
    case.membership.profiles.add(other)
    assert get_advisory(case, HTTP_IF_NONE_MATCH=current.headers["ETag"]).status_code == 404
    case.profile.scope = all_scope()
    case.profile.save(update_fields=["scope"])
    government = ProfileFactory(
        organization=case.organization,
        slug="government",
        scope=all_scope(),
        permission_codes=["portal.read", "field.bootstrap", "field_event.sync"],
    )
    case.membership.profiles.add(government)
    assert get_advisory(case).status_code == 403
    case.membership.profiles.remove(government)
    assert get_advisory(case).status_code == 200
    assert get_advisory(case, HTTP_X_ORGANIZATION="another-organization").status_code == 403
    original_url = case.url
    case.url = f"/api/v1/field/ovitrap-advisories/{uuid4()}/"
    assert get_advisory(case).status_code == 404
    foreign = setup_field()
    assert ingest(foreign, envelope(foreign)).status == "accepted"
    case.url = f"/api/v1/field/ovitrap-advisories/{foreign.identity}/"
    assert get_advisory(case).status_code == 404
    case.url = original_url
    anonymous = APIClient()
    assert anonymous.get(case.url, {"at": CAPTURED.isoformat()}).status_code == 401
    anonymous.force_login(case.batch.user)
    assert anonymous.get(case.url, {"at": CAPTURED.isoformat()}).status_code == 401
    monkeypatch.setattr(timezone, "now", lambda: case.issued.pair.access_expires_at)
    assert get_advisory(case).data["code"] == "token_expired"
    monkeypatch.setattr(timezone, "now", lambda: CAPTURED)
    revoke_session(
        case.issued.session, Revocation(RevokeReason.ADMIN_REVOKE, allow_final_upload=True)
    )
    final_only = get_advisory(case, HTTP_IF_NONE_MATCH=current.headers["ETag"])
    assert (final_only.status_code, final_only.data["code"]) == (401, "session_revoked")
    case.issued.session.refresh_from_db()
    assert case.issued.session.final_upload_deadline is not None
    assert case.issued.session.final_upload_used_at is None


def test_new_known_review_effect_and_void_change_same_cutoff_not_geometry(
    advisory_case, make_member, monkeypatch
):
    from field_sync.models import FieldEvent
    from field_sync.services import sync_batch
    from geography.models import PointVersion
    from incidents.services import report
    from reviews.actions import ReviewDecisionRequest, decide_review
    from reviews.models import ReviewEffectReceipt, ReviewItem, ReviewSourceSnapshot
    from tests.review_support import audit_current_membership, reviewer
    from tests.test_incidents_b_06 import configured
    from tests.test_ovitraps_lifecycle_b_15 import void_event

    case = advisory_case
    monkeypatch.setattr("incidents.tasks.publish_incident_notices.delay", lambda *_args: None)
    incident_context = configured(case)
    baseline = get_advisory(case)
    geometry = list(PointVersion.objects.values())
    report(incident_context.actor, incident_context.data)  # Real ordinary #104 Incident, no marker.
    assert get_advisory(case).headers["ETag"] == baseline.headers["ETag"]
    audit_current_membership(case.membership)  # Actual observation BEFORE the reviewed source.
    capture = envelope(
        case,
        "ovitrap.check",
        payload={
            "finding": "abandoned",
            "paddle_present": False,
            "has_eggs": None,
            "paddle_type": None,
            "bag_code": None,
        },
    )
    late = replace(case.batch, sent_at=CAPTURED - timedelta(hours=1))
    assert sync_batch(late, [capture], None).results[0].code == "clock_skew"
    item = ReviewItem.objects.get(field_event_id=capture.id)
    original = ReviewSourceSnapshot.objects.get(source_event_id=capture.id).original_envelope
    assert get_advisory(case).headers["ETag"] == baseline.headers["ETag"]
    decision = decide_review(
        reviewer(case.organization, make_member),
        item.pk,
        ReviewDecisionRequest("accept", 0, "Verified original clock, point and capture authority"),
    )
    assert ReviewEffectReceipt.objects.get(decision=decision).mode == "applied_review"
    changed = get_advisory(case, HTTP_IF_NONE_MATCH=baseline.headers["ETag"])
    assert changed.status_code == 200
    assert changed.data["incident_count"] == 1
    assert changed.headers["ETag"] != baseline.headers["ETag"]
    assert sync_batch(late, [capture], None).results[0].code == "clock_skew"
    assert get_advisory(case).data == changed.data  # Replay cannot duplicate the marker.
    assert ingest(case, void_event(case, capture)).status == "accepted"
    cleared = get_advisory(case)
    assert cleared.data["incident_count"] == 0
    assert cleared.headers["ETag"] == baseline.headers["ETag"]
    source = FieldEvent.objects.get(pk=capture.id)
    assert (source.status, source.payload, source.rules_version) == (
        "in_review",
        capture.payload,
        capture.rules_version,
    )
    assert (
        ReviewSourceSnapshot.objects.get(source_event_id=capture.id).original_envelope == original
    )
    assert list(PointVersion.objects.values()) == geometry


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("first", ["read", "write"])
def test_reader_and_real_rule_writer_share_organization_boundary(advisory_case, monkeypatch, first):
    from concurrent.futures import ThreadPoolExecutor
    from decimal import Decimal
    from threading import Event

    from django.db import connection

    from field_sync.exceptions import SyncInProgressError
    from organizations.exceptions import AdministrationBusyError
    from rules.models import RuleParameter
    from rules.services import RuleVersionSpec, create_rule_version
    from tests.factories import UserFactory

    case = advisory_case
    instant = CAPTURED + timedelta(seconds=1)
    monkeypatch.setattr(timezone, "now", lambda: instant)
    parameter = RuleParameter.objects.get(
        organization=case.organization, key="incidents_to_relocate"
    )
    writer = UserFactory()
    spec = RuleVersionSpec(Decimal(4), instant.date(), "Adjust observed OP03 threshold")
    held, release = Event(), Event()

    def read():
        return read_scoped_advisory(case.actor, case.identity, instant)

    def write():
        return create_rule_version(parameter, spec, writer)

    def hold_organization(execute, sql, params, many, context):
        result = execute(sql, params, many, context)
        if (
            'FROM "organizations_organization"' in sql
            and "FOR NO KEY UPDATE NOWAIT" in sql
            and not held.is_set()
        ):
            held.set()
            assert release.wait(timeout=10), "Organization arbiter was not released"
        return result

    def winner():
        try:
            with connection.execute_wrapper(hold_organization):
                return read() if first == "read" else write()
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=1) as pool:
        job = pool.submit(winner)
        try:
            assert held.wait(timeout=10), "Real Organization lock was not reached"
            with pytest.raises(AdministrationBusyError if first == "read" else SyncInProgressError):
                write() if first == "read" else read()
        finally:
            release.set()
        result = job.result(timeout=10)
    if first == "read":
        assert result["rule_context"]["parameters"]["incidents_to_relocate"]["value"] == 3
        write()
    refreshed = read()
    assert refreshed["rule_context"]["parameters"]["incidents_to_relocate"]["value"] == 4
