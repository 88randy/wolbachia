"""Real own release downloads, exact custody and recovery through the existing bootstrap."""

from dataclasses import replace
from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ImproperlyConfigured

from field_sync.producers import ProducerContext
from organizations.models import all_scope
from organizations.scope import EffectiveScope
from releases.capture_projections import prepare_release_capture
from releases.producers import build_permits
from releases.projection_serializers import PermitBundleSerializer
from releases.services import change_release_device_status
from tests.releases_support import accept_release, release_setup

pytestmark = pytest.mark.django_db(transaction=True)
BOOTSTRAP = "/api/v1/field/bootstrap/"


@pytest.fixture
def release_context(org_a, make_member, monkeypatch, settings, tmp_path):
    return release_setup(org_a, make_member, monkeypatch, settings, tmp_path)


def capture_context(context, scope=None, user=None):
    grants = scope or EffectiveScope(
        ((frozenset(("field.bootstrap", "field_event.sync")), all_scope()),)
    )
    return prepare_release_capture(
        ProducerContext(
            context.organization,
            user or context.phone.user,
            grants,
            context.clock["now"],
            "field.bootstrap",
        )
    )


def downloaded(context):
    answer = context.phone.client.get(BOOTSTRAP)
    assert answer.status_code == 200, answer.data
    permit = next(row for row in answer.data["permits"] if row["id"] == str(context.permit.pk))
    return answer, permit["capture"]


def test_capture_projection_uses_only_real_own_bindings_custody_and_transit_policy(release_context):
    context = release_context
    row = build_permits(capture_context(context))[0]
    serializer = PermitBundleSerializer(data=row)
    serializer.is_valid(raise_exception=True)
    captured = serializer.data["capture"]
    (device,) = captured["devices"]
    (task,) = captured["tasks"]
    (custody,) = device["custody"]
    assert device["id"] == str(context.device.pk)
    assert device["source_lot_version_id"] == str(context.device.source_lot_version_id)
    assert device["status"] == "active"
    assert device["revision"] == 1
    assert task["id"] == str(context.task["task_id"])
    assert task["permit_version_id"] == str(context.permit_version.pk)
    assert task["courier_id"] == str(context.phone.user.pk)
    assert not task["is_completed"]
    assert custody["receipt_line_id"] == str(context.receipt_line.pk)
    assert custody["receipt_source_event_id"] == context.receipt_capture["id"]
    assert custody["assignment_id"] == str(context.assignment.pk)
    assert custody["shift_id"] == str(context.shift_id)
    assert custody["available_quantity"] == "10.000000"
    assert custody["accounted_release_event_ids"] == []
    assert custody["unit_version_id"] == str(context.stock.supply_version.pk)
    assert custody["transit_policy_id"] == str(context.transit_policy.pk)
    assert custody["transit_mode"] == "manual_evidence_review"
    assert custody["proof_roles"] == ["photo"]
    assert custody["requires_evidence"]
    assert custody["blocked_by"] == []
    assert custody["source_expires_at"] == custody["current_expires_at"]


def test_capture_download_never_unions_scope_axes_or_exposes_another_couriers_custody(
    release_context, make_member
):
    context = release_context
    stranger, _member = make_member(context.organization)
    other = build_permits(capture_context(context, user=stranger))[0]["capture"]
    assert other["devices"] == []
    assert other["tasks"] == []
    with pytest.raises(ImproperlyConfigured, match="context changed"):
        build_permits(replace(capture_context(context), user=stranger))
    center = str(context.permit.center_id)
    quadrant = str(context.permit.quadrant_id)
    partial = EffectiveScope(
        (
            (frozenset(("field.bootstrap",)), all_scope()),
            (
                frozenset(("field_event.sync",)),
                {
                    "centers": {"mode": "selected", "ids": [center]},
                    "quadrants": {"mode": "none", "ids": []},
                },
            ),
            (
                frozenset(("field_event.sync",)),
                {
                    "centers": {"mode": "none", "ids": []},
                    "quadrants": {"mode": "selected", "ids": [quadrant]},
                },
            ),
        )
    )
    assert build_permits(capture_context(context, scope=partial))[0]["capture"] is None
    boot_only = EffectiveScope(((frozenset(("field.bootstrap",)), all_scope()),))
    assert build_permits(capture_context(context, scope=boot_only))[0]["capture"] is None


def test_observation_clock_does_not_churn_capture_scope_or_bootstrap_etag(release_context):
    context = release_context
    first, original = downloaded(context)
    context.clock["now"] += timedelta(seconds=1)
    second, later = downloaded(context)
    assert later["as_of"] != original["as_of"]
    assert later["version"] == original["version"]
    assert second.data["scope_revision"] == first.data["scope_revision"]
    assert second.data["bundle_version"] == first.data["bundle_version"]
    assert context.phone.client.get(BOOTSTRAP, HTTP_IF_NONE_MATCH=first["ETag"]).status_code == 304


def test_device_and_lot_changes_force_full_bootstrap_without_creating_an_override(release_context):
    context = release_context
    first, original = downloaded(context)
    change_release_device_status(
        context.actor,
        context.device.pk,
        {
            "status": "inactive",
            "reason": "Synthetic equipment safety suspension",
            "expected_revision": 1,
        },
    )
    invalid = context.phone.sync([], cursor=first.data["cursor"])
    assert invalid.status_code == 400
    assert invalid.data["code"] == "invalid_cursor"
    second, inactive = downloaded(context)
    assert inactive["version"] != original["version"]
    assert inactive["devices"][0]["status"] == "inactive"
    context.clock["now"] = context.stock.version.expires_at
    refreshed = context.phone.client.post(
        "/api/v1/auth/refresh/",
        {"refresh": context.phone.issued.refresh, "device_id": str(context.phone.device_id)},
        format="json",
    )
    assert refreshed.status_code == 200
    context.phone.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refreshed.data['access']}")
    expired = context.phone.sync([], cursor=second.data["cursor"])
    assert expired.status_code == 400
    assert expired.data["code"] == "invalid_cursor"
    _third, blocked = downloaded(context)
    assert "lot_expired" in blocked["devices"][0]["custody"][0]["blocked_by"]


def test_single_ledger_consumption_changes_exact_downloaded_stock_and_task_completion(
    release_context,
):
    context = release_context
    first, original = downloaded(context)
    accept_release(context)
    invalid = context.phone.sync([], cursor=first.data["cursor"])
    assert invalid.status_code == 400
    assert invalid.data["code"] == "invalid_cursor"
    _second, consumed = downloaded(context)
    assert consumed["version"] != original["version"]
    custody = consumed["devices"][0]["custody"][0]
    assert Decimal(custody["available_quantity"]) == Decimal("8")
    assert custody["available_quantity"] == "8.000000"
    assert custody["accounted_release_event_ids"] == [context.capture["id"]]
    assert consumed["tasks"][0]["is_completed"]
