"""B-13 acceptance: replay-safe bundles, recovery, due refresh and scope wiring."""

import threading
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from django.core import signing
from django.core.exceptions import ImproperlyConfigured
from django.db import DatabaseError, connection, transaction
from django.test import override_settings
from django.utils import timezone
from drf_spectacular.generators import SchemaGenerator
from drf_spectacular.validation import validate_schema
from rest_framework import serializers

from accounts.models import RevokeReason, User
from accounts.revocation import Revocation, revoke_session
from core.exceptions import ImmutableRecordError, PhysicalDeleteForbiddenError
from field_sync import producers, selectors, services
from field_sync.cursor import decode_cursor
from field_sync.envelope import BatchContext
from field_sync.models import CourierChange, FieldEvent
from field_sync.permissions import FIELD_BOOTSTRAP, FIELD_EVENT_SYNC
from field_sync.producers import (
    BundleProducer,
    bundle_schema_version,
    map_manifests_ready,
    register,
)
from field_sync.selectors import producer_context
from field_sync.services import ChangeInput, append_courier_change, lock_courier_batches
from organizations.defaults import seed_default_permission_codes
from organizations.models import Membership, Organization
from organizations.scope import EffectiveScope
from rules.selectors import get_values_in_force
from tests.factories import ProfileFactory, RuleParameterFactory, RuleParameterVersionFactory
from tests.sync_support import event, make_phone, second_device_of

BOOTSTRAP = "/api/v1/field/bootstrap/"
NOW = datetime(2026, 11, 5, 12, tzinfo=UTC)
ALL = {"centers": {"mode": "all", "ids": []}, "quadrants": {"mode": "all", "ids": []}}


class RowSerializer(serializers.Serializer):
    id = serializers.CharField()
    value = serializers.CharField()


@pytest.fixture(autouse=True)
def clean_producers(monkeypatch):
    monkeypatch.setattr(producers, "PRODUCERS", {})


@pytest.fixture
def phone(org_a, make_member):
    return make_phone(make_member, org_a, (FIELD_BOOTSTRAP, FIELD_EVENT_SYNC))


def batch_context(phone):
    from accounts.models import Device

    return BatchContext(
        organization=phone.organization,
        user=phone.user,
        device=Device.objects.get(pk=phone.device_id),
        sent_at=timezone.now(),
        received_at=timezone.now(),
    )


def change_input(**overrides):
    return ChangeInput(
        **{
            "kind": "assignments",
            "resource_type": "test.point",
            "resource_id": "point-1",
            "resource_version": "v1",
            "scope": None,
            "action": "upsert",
            "payload": {"id": "point-1", "value": "assigned"},
            **overrides,
        }
    )


def register_rows(rows=()):
    register(BundleProducer("assignments", 1, lambda ctx: list(rows), RowSerializer))


def test_producer_contract_rejects_duplicate_and_unregistered_sections():
    register_rows()
    with pytest.raises(ImproperlyConfigured, match="already registered"):
        register_rows()
    with pytest.raises(ImproperlyConfigured):
        register(BundleProducer("unknown", 1, lambda ctx: [], RowSerializer))


def test_capture_context_keeps_complete_sync_grants():
    center_a, center_b, quadrant_a, quadrant_b = [str(uuid.UUID(int=n)) for n in range(1, 5)]
    pair_ab = {
        "centers": {"mode": "selected", "ids": [center_a]},
        "quadrants": {"mode": "selected", "ids": [quadrant_b]},
    }
    pair_ba = {
        "centers": {"mode": "selected", "ids": [center_b]},
        "quadrants": {"mode": "selected", "ids": [quadrant_a]},
    }
    denied = {
        "centers": {"mode": "none", "ids": []},
        "quadrants": {"mode": "selected", "ids": []},
    }
    ctx = producers.ProducerContext(
        Organization(id=uuid.UUID(int=100)),
        User(id=uuid.UUID(int=200)),
        EffectiveScope(
            (
                (frozenset({FIELD_EVENT_SYNC}), pair_ba),
                (frozenset({FIELD_BOOTSTRAP}), ALL),
                (frozenset({FIELD_EVENT_SYNC}), denied),
                (frozenset({FIELD_BOOTSTRAP, FIELD_EVENT_SYNC}), pair_ab),
            )
        ),
        NOW,
        FIELD_BOOTSTRAP,
    )

    capture = selectors.capture_context(ctx, revision="a" * 64)

    assert capture == {
        "schema_version": 1,
        "permission": FIELD_EVENT_SYNC,
        "user_id": str(uuid.UUID(int=200)),
        "organization_id": str(uuid.UUID(int=100)),
        "scope_revision": "a" * 64,
        "grants": [pair_ab, pair_ba, denied],
    }


@pytest.mark.django_db(transaction=True)
def test_producer_commit_cannot_fall_behind_a_pull_cursor(phone):
    register_rows()
    reconnect = second_device_of(phone)
    before = phone.sync([]).data["changes"]["cursor"]
    inserted, release = threading.Event(), threading.Event()
    errors = []

    def writer():
        try:
            with transaction.atomic():
                ctx = batch_context(phone)
                lock_courier_batches(ctx)
                append_courier_change(ctx, change_input())
                inserted.set()
                assert release.wait(30)
        except Exception as error:  # noqa: BLE001 -- propagated to the test thread
            errors.append(error)
        finally:
            connection.close()

    thread = threading.Thread(target=writer)
    thread.start()
    try:
        assert inserted.wait(30), errors
        during = reconnect.sync([], cursor=before)
        bootstrap_during = reconnect.client.get(BOOTSTRAP)
        assert (during.status_code, bootstrap_during.status_code) == (429, 429)
    finally:
        release.set()
        thread.join(40)
    assert not thread.is_alive()
    assert not errors
    after = reconnect.sync([], cursor=before).data["changes"]
    assert [row["resource_id"] for row in after["assignments"]] == ["point-1"]
    assert reconnect.sync([], cursor=after["cursor"]).data["changes"]["assignments"] == []
    assert reconnect.sync([], cursor=before).data["changes"]["assignments"] == after["assignments"]


@pytest.mark.django_db
@pytest.mark.parametrize("reason", ["expired", "scope", "v1", "root_schema"])
def test_bootstrap_recovers_cursor_without_consuming_pending_evidence(phone, monkeypatch, reason):
    if reason == "root_schema":
        with monkeypatch.context() as previous_schema:
            previous_schema.setattr(producers, "BOOTSTRAP_SCHEMA_VERSION", 1)
            issued = phone.sync([]).data["changes"]["cursor"]
    else:
        issued = phone.sync([]).data["changes"]["cursor"]
    if reason == "expired":
        payload = signing.loads(issued, salt="field_sync.changes")
        with monkeypatch.context() as clock:
            clock.setattr(signing.time, "time", lambda: NOW.timestamp() - 31 * 86400)
            issued = signing.dumps(payload, salt="field_sync.changes", compress=True)
    elif reason == "scope":
        membership = Membership.objects.get(user=phone.user, organization=phone.organization)
        membership.scope = ALL
        membership.save(update_fields=["scope"])
        profile = membership.profiles.get()
        profile.scope = ALL
        profile.save(update_fields=["scope"])
    elif reason == "v1":
        issued = signing.dumps(
            {"o": str(phone.organization.pk), "u": str(phone.user.pk), "s": 0},
            salt="field_sync.changes",
        )
    outbox = [event()]
    rejected = phone.sync(outbox, cursor=issued)
    assert (rejected.status_code, rejected.data["code"]) == (400, "invalid_cursor")
    assert not FieldEvent.objects.filter(pk=outbox[0]["id"]).exists()
    bundle = phone.client.get(BOOTSTRAP)
    assert bundle.status_code == 200
    assert all(bundle.data[key] == [] for key in producers.SECTION_KEYS)
    capture = bundle.data["capture_context"]
    assert capture["scope_revision"] == bundle.data["scope_revision"]
    assert (
        capture["scope_revision"]
        == decode_cursor(bundle.data["cursor"], phone.organization.pk, phone.user.pk).scope_revision
    )
    recovered = phone.sync(outbox, cursor=bundle.data["cursor"])
    repeated = phone.sync(outbox, cursor=recovered.data["changes"]["cursor"])
    assert recovered.data["results"] == repeated.data["results"]
    assert FieldEvent.objects.filter(pk=outbox[0]["id"]).count() == 1
    assert outbox[0]["id"] == recovered.data["results"][0]["id"]
    assert recovered.data["changes"]["capture_context"] == capture


@pytest.mark.django_db
def test_due_rule_refresh_changes_bundle_etag_and_sync_but_keeps_capture_values(phone, monkeypatch):
    monkeypatch.setattr(timezone, "now", lambda: NOW)
    parameter = RuleParameterFactory(organization=phone.organization)
    RuleParameterVersionFactory(
        parameter=parameter, value=50, effective_from=NOW - timedelta(days=1)
    )
    due = NOW + timedelta(minutes=1)
    RuleParameterVersionFactory(parameter=parameter, value=75, effective_from=due)
    before = phone.client.get(BOOTSTRAP)
    assert before.data["next_change_at"] is not None
    cached = phone.client.get(BOOTSTRAP, HTTP_IF_NONE_MATCH=before["ETag"])
    assert cached.status_code == 304
    assert cached["Cache-Control"] == "private, no-cache"
    monkeypatch.setattr(timezone, "now", lambda: due)
    after = phone.client.get(BOOTSTRAP, HTTP_IF_NONE_MATCH=before["ETag"])
    downstream = phone.sync([]).data["changes"]
    assert after.status_code == 200
    assert after["ETag"] != before["ETag"]
    assert after.data["rules_version"] == downstream["rules_version"]
    assert after.data["rules_version"] != before.data["rules_version"]
    assert downstream["next_change_at"] is None
    assert get_values_in_force(phone.organization, NOW)[parameter.key] == 50
    assert get_values_in_force(phone.organization, due)[parameter.key] == 75


@pytest.mark.django_db
def test_bootstrap_permission_and_scope_isolation_are_wired_through_sync(phone, org_b):
    center, quadrant, foreign_center, foreign_quadrant = [str(uuid.uuid4()) for _ in range(4)]
    membership = Membership.objects.get(user=phone.user, organization=phone.organization)
    profile = membership.profiles.get()
    profile.permission_codes = [FIELD_EVENT_SYNC]
    profile.save(update_fields=["permission_codes"])
    denied = phone.client.get(BOOTSTRAP, HTTP_IF_NONE_MATCH="*")
    assert denied.status_code == 403
    profile.permission_codes = [FIELD_EVENT_SYNC, FIELD_BOOTSTRAP]
    profile.scope = ALL
    profile.save(update_fields=["permission_codes", "scope"])
    membership.scope = {
        "centers": {"mode": "selected", "ids": [center]},
        "quadrants": {"mode": "selected", "ids": [quadrant]},
    }
    membership.save(update_fields=["scope"])
    rows = [
        {
            "id": "local",
            "value": "yes",
            "organization_id": str(phone.organization.pk),
            "center_id": center,
            "quadrant_id": quadrant,
        },
        {
            "id": "org",
            "value": "hidden",
            "organization_id": str(org_b.pk),
            "center_id": center,
            "quadrant_id": quadrant,
        },
        {
            "id": "center",
            "value": "hidden",
            "organization_id": str(phone.organization.pk),
            "center_id": foreign_center,
            "quadrant_id": quadrant,
        },
        {
            "id": "quadrant",
            "value": "hidden",
            "organization_id": str(phone.organization.pk),
            "center_id": center,
            "quadrant_id": foreign_quadrant,
        },
    ]
    register_rows(rows)
    before = phone.sync([]).data["changes"]["cursor"]
    for row in rows:
        ctx = batch_context(phone)
        if row["organization_id"] == str(org_b.pk):
            ctx = BatchContext(
                organization=org_b, user=phone.user, device=ctx.device, sent_at=NOW, received_at=NOW
            )
        with transaction.atomic():
            lock_courier_batches(ctx)
            append_courier_change(
                ctx,
                change_input(
                    resource_id=row["id"],
                    scope={"center_id": row["center_id"], "quadrant_id": row["quadrant_id"]},
                ),
            )
    # Foreign organization/courier rows are also excluded by the feed query.
    with transaction.atomic():
        ctx = batch_context(phone)
        ctx = BatchContext(
            organization=org_b, user=phone.user, device=ctx.device, sent_at=NOW, received_at=NOW
        )
        lock_courier_batches(ctx)
        append_courier_change(ctx, change_input(resource_id="foreign-org"))
    bundle = phone.client.get(BOOTSTRAP)
    assert bundle.status_code == 200
    assert bundle.data["assignments"] == [{"id": "local", "value": "yes"}]
    assert bundle.data["map_manifest_ready"] is False
    changes = phone.sync([], cursor=before).data["changes"]
    assert {row["resource_id"] for row in changes["assignments"]} == {"local"}
    assert bundle.data["capture_context"]["user_id"] == str(phone.user.pk)
    assert bundle.data["capture_context"]["organization_id"] == str(phone.organization.pk)
    # Even a legacy government profile containing field codes remains clamped.
    government = ProfileFactory(
        organization=phone.organization,
        slug="government",
        permission_codes=["portal.read", FIELD_BOOTSTRAP, FIELD_EVENT_SYNC],
        scope=ALL,
    )
    membership.profiles.add(government)
    assert phone.client.get(BOOTSTRAP, HTTP_IF_NONE_MATCH=bundle["ETag"]).status_code == 403


@pytest.mark.django_db
def test_feed_pages_advance_only_to_delivered_changes_and_support_remove(phone):
    register_rows()
    ctx = batch_context(phone)
    before = phone.sync([]).data["changes"]["cursor"]
    with transaction.atomic():
        lock_courier_batches(ctx)
        for number in range(3):
            append_courier_change(ctx, change_input(resource_id=str(number)))
        append_courier_change(ctx, change_input(action="remove", payload={}))
    with override_settings(API_CURSOR_PAGE_SIZE=2):
        first = phone.sync([], cursor=before).data["changes"]
        second = phone.sync([], cursor=first["cursor"]).data["changes"]
    assert [row["sequence"] for row in first["assignments"]] == [1, 2]
    assert first["has_more"] is True
    assert [row["sequence"] for row in second["assignments"]] == [3, 4]
    assert second["has_more"] is False
    assert second["assignments"][-1]["action"] == "remove"
    assert second["assignments"][-1]["data"] == {}
    bundle = phone.client.get(BOOTSTRAP).data
    position = decode_cursor(bundle["cursor"], phone.organization.pk, phone.user.pk)
    assert (position.sequence, position.change_sequence) == (0, 4)


@pytest.mark.django_db(transaction=True)
def test_append_guard_does_not_survive_transaction_or_savepoint_rollback(phone):
    register_rows()
    ctx = batch_context(phone)
    with transaction.atomic():
        with pytest.raises(RuntimeError):
            append_courier_change(ctx, change_input())

        def rolled_back_lock():
            with transaction.atomic():
                lock_courier_batches(ctx)
                raise ValueError("rollback")

        with pytest.raises(ValueError, match="rollback"):
            rolled_back_lock()
        with pytest.raises(RuntimeError):
            append_courier_change(ctx, change_input())
        lock_courier_batches(ctx)
        with pytest.raises(ImproperlyConfigured):
            append_courier_change(ctx, change_input(kind="supplies"))
        append_courier_change(ctx, change_input())
    with transaction.atomic(), pytest.raises(RuntimeError):
        append_courier_change(ctx, change_input())
    assert CourierChange.objects.count() == 1


@pytest.mark.django_db
def test_bootstrap_seed_adds_permission_once_without_restoring_revocations(phone):
    profile = ProfileFactory(
        organization=phone.organization,
        slug="courier",
        created_by_seed=True,
        seeded_permission_codes=[FIELD_EVENT_SYNC],
        permission_codes=[FIELD_EVENT_SYNC],
    )
    seed_default_permission_codes(phone.organization)
    profile.refresh_from_db()
    assert FIELD_BOOTSTRAP in profile.permission_codes
    profile.permission_codes.remove(FIELD_BOOTSTRAP)
    profile.save(update_fields=["permission_codes"])
    seed_default_permission_codes(phone.organization)
    profile.refresh_from_db()
    assert FIELD_BOOTSTRAP not in profile.permission_codes


def test_bundle_schema_wires_bootstrap_and_typed_sync_sections():
    schema = SchemaGenerator(urlconf="config.urls").get_schema(public=True)
    validate_schema(schema)
    operation = schema["paths"][BOOTSTRAP]["get"]
    assert "304" in operation["responses"]
    properties = schema["components"]["schemas"]["Changes"]["properties"]
    assert set(producers.SECTION_KEYS) <= properties.keys()
    assert "next_change_at" in properties
    bootstrap = schema["components"]["schemas"]["Bootstrap"]["properties"]
    assert {
        *producers.SECTION_KEYS,
        "bundle_version",
        "scope_revision",
        "map_manifest_ready",
        "capture_context",
    } <= bootstrap.keys()
    components = schema["components"]["schemas"]
    for name in ("Bootstrap", "Changes"):
        assert components[name]["properties"]["capture_context"]["nullable"] is True
        assert "capture_context" not in components[name]["required"]
    capture = components["CaptureContext"]
    assert (
        set(capture["properties"])
        == set(capture["required"])
        == {
            "schema_version",
            "permission",
            "user_id",
            "organization_id",
            "scope_revision",
            "grants",
        }
    )
    assert capture["properties"]["schema_version"]["minimum"] == 1
    assert capture["properties"]["schema_version"]["maximum"] == 1
    assert capture["properties"]["grants"]["items"]["$ref"].endswith("/MeScope")
    # Exact generated-client currency is enforced by api-contract.yml:
    # npm run api:generate followed by git diff --exit-code on both artifacts.


@pytest.mark.parametrize("fault", ["missing", "unlicensed", "failed", "complete"])
def test_map_readiness_requires_complete_licensed_asset_metadata(fault):
    manifest = {
        "asset_id": "map",
        "version": "1",
        "sha256": "a" * 64,
        "size_bytes": 100,
        "quadrant_id": str(uuid.uuid4()),
        "licensed": True,
    }
    if fault == "unlicensed":
        manifest["licensed"] = False
    if fault == "failed":
        manifest["sha256"] = ""
    assert map_manifests_ready([] if fault == "missing" else [manifest]) is (fault == "complete")


def test_empty_bundle_schema_boundary_changes_when_a_producer_version_changes(monkeypatch):
    register_rows()
    before = bundle_schema_version()
    monkeypatch.setattr(producers, "PRODUCERS", {})
    register(BundleProducer("assignments", 2, lambda ctx: [], RowSerializer))
    assert bundle_schema_version() != before


@pytest.mark.django_db(transaction=True)
def test_scope_change_during_ingest_is_not_silently_acknowledged_by_the_response(
    phone, monkeypatch
):
    initial = phone.sync([]).data["changes"]
    old = initial["cursor"]
    started, release = threading.Event(), threading.Event()
    real_ingest = services.ingest_batch
    answers = []

    def gated_ingest(batch, envelopes):
        results = real_ingest(batch, envelopes)
        started.set()
        assert release.wait(30)
        return results

    def pull():
        try:
            answers.append(phone.sync([], cursor=old))
        finally:
            connection.close()

    monkeypatch.setattr(services, "ingest_batch", gated_ingest)
    thread = threading.Thread(target=pull)
    thread.start()
    try:
        assert started.wait(30)
        membership = Membership.objects.get(user=phone.user, organization=phone.organization)
        membership.scope = ALL
        membership.save(update_fields=["scope"])
        profile = membership.profiles.get()
        profile.scope = ALL
        profile.save(update_fields=["scope"])
    finally:
        release.set()
        thread.join(40)
    assert not thread.is_alive()
    assert len(answers) == 1
    assert answers[0].status_code == 200
    next_cursor = answers[0].data["changes"]["cursor"]
    assert (
        decode_cursor(next_cursor, phone.organization.pk, phone.user.pk).scope_revision
        == decode_cursor(old, phone.organization.pk, phone.user.pk).scope_revision
    )
    assert answers[0].data["changes"]["capture_context"] == initial["capture_context"]
    assert (
        initial["capture_context"]["scope_revision"]
        == decode_cursor(next_cursor, phone.organization.pk, phone.user.pk).scope_revision
    )
    refused = phone.sync([], cursor=next_cursor)
    assert (refused.status_code, refused.data["code"]) == (400, "invalid_cursor")


@pytest.mark.django_db
def test_snapshot_and_feed_share_projection_scope_with_disjoint_action_grants(phone):
    center_a, center_b = str(uuid.uuid4()), str(uuid.uuid4())
    scope_a = {
        "centers": {"mode": "selected", "ids": [center_a]},
        "quadrants": {"mode": "all", "ids": []},
    }
    scope_b = {
        "centers": {"mode": "selected", "ids": [center_b]},
        "quadrants": {"mode": "all", "ids": []},
    }
    membership = Membership.objects.get(user=phone.user, organization=phone.organization)
    membership.scope = ALL
    membership.save(update_fields=["scope"])
    bootstrap = membership.profiles.get()
    bootstrap.permission_codes = [FIELD_BOOTSTRAP]
    bootstrap.scope = scope_a
    bootstrap.save(update_fields=["permission_codes", "scope"])
    sync = ProfileFactory(
        organization=phone.organization, permission_codes=[FIELD_EVENT_SYNC], scope=scope_b
    )
    membership.profiles.add(sync)
    rows = [
        {
            "id": center,
            "value": "assigned",
            "organization_id": str(phone.organization.pk),
            "center_id": center,
            "quadrant_id": None,
        }
        for center in (center_a, center_b)
    ]
    register_rows(rows)
    initial = phone.sync([]).data["changes"]
    before = initial["cursor"]
    explicit_null = phone.sync([], cursor=None).data["changes"]
    assert explicit_null["capture_context"] == initial["capture_context"]
    ctx = batch_context(phone)
    with transaction.atomic():
        lock_courier_batches(ctx)
        for row in rows:
            append_courier_change(
                ctx,
                change_input(
                    resource_id=row["id"],
                    scope={"center_id": row["center_id"], "quadrant_id": None},
                ),
            )
    bundle = phone.client.get(BOOTSTRAP).data
    changes = phone.sync([], cursor=before).data["changes"]
    assert [row["id"] for row in bundle["assignments"]] == [center_a]
    assert [row["resource_id"] for row in changes["assignments"]] == [center_a]
    capture = bundle["capture_context"]
    assert capture == {
        "schema_version": 1,
        "permission": FIELD_EVENT_SYNC,
        "user_id": str(phone.user.pk),
        "organization_id": str(phone.organization.pk),
        "scope_revision": bundle["scope_revision"],
        "grants": [scope_b],
    }
    empty = phone.sync([], cursor=bundle["cursor"]).data["changes"]
    assert empty["assignments"] == []
    assert (
        initial["capture_context"]
        == changes["capture_context"]
        == empty["capture_context"]
        == capture
    )
    assert (
        capture["scope_revision"]
        == decode_cursor(changes["cursor"], phone.organization.pk, phone.user.pk).scope_revision
    )

    membership.profiles.remove(bootstrap)
    assert phone.sync([]).data["changes"]["assignments"] == []
    membership.profiles.set([bootstrap])
    read_only = phone.client.get(BOOTSTRAP)
    assert read_only.status_code == 200
    assert read_only.data["capture_context"]["grants"] == []
    assert read_only.data["assignments"] == bundle["assignments"]
    assert phone.sync([]).status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("credential", ["session_cookie", "revoked_bearer"])
def test_bootstrap_requires_live_bearer_and_never_spends_final_upload(phone, credential):
    if credential == "session_cookie":
        phone.client.credentials()
        phone.client.force_login(phone.user)
    else:
        revoke_session(
            phone.issued.session, Revocation(RevokeReason.ADMIN_REVOKE, allow_final_upload=True)
        )
    refused = phone.client.get(BOOTSTRAP)
    assert refused.status_code == 401
    if credential == "revoked_bearer":
        final = phone.sync([event()])
        assert final.status_code == 200
        assert final.data["results"][0]["code"] == "final_upload_after_revoke"
        assert all(final.data["changes"][key] == [] for key in producers.SECTION_KEYS)


@pytest.mark.django_db
def test_change_log_blocks_rewrite_and_delete_in_orm_and_raw_sql(phone):
    register_rows()
    ctx = batch_context(phone)
    with transaction.atomic():
        lock_courier_batches(ctx)
        stored = append_courier_change(ctx, change_input())
    stored.payload = {}
    with pytest.raises(ImmutableRecordError):
        stored.save()
    with pytest.raises(ImmutableRecordError):
        CourierChange.objects.filter(pk=stored.pk).update(payload={})
    with pytest.raises(PhysicalDeleteForbiddenError):
        CourierChange.objects.filter(pk=stored.pk).delete()
    for statement in (
        "UPDATE field_sync_courierchange SET payload = '{}' WHERE id = %s",
        "DELETE FROM field_sync_courierchange WHERE id = %s",
    ):
        with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
            cursor.execute(statement, [stored.pk])
    stored.refresh_from_db()
    assert stored.payload == {"id": "point-1", "value": "assigned"}


@pytest.mark.django_db(transaction=True)
def test_producer_scope_capture_never_mixes_membership_and_profile_revisions(phone):
    """Neither committed configuration grants A; the old two-query read could invent that grant."""
    center_a, center_b = str(uuid.uuid4()), str(uuid.uuid4())
    scope_a = {
        "centers": {"mode": "selected", "ids": [center_a]},
        "quadrants": {"mode": "all", "ids": []},
    }
    scope_b = {
        "centers": {"mode": "selected", "ids": [center_b]},
        "quadrants": {"mode": "all", "ids": []},
    }
    membership = Membership.objects.get(user=phone.user, organization=phone.organization)
    profile = membership.profiles.get()
    membership.scope = scope_a
    membership.save(update_fields=["scope"])
    profile.scope = scope_b
    profile.save(update_fields=["scope"])
    register_rows(
        [
            {
                "id": "never-authorized",
                "value": "private",
                "organization_id": str(phone.organization.pk),
                "center_id": center_a,
                "quadrant_id": None,
            }
        ]
    )
    before = phone.client.get(BOOTSTRAP).data
    batch = batch_context(phone)
    read_finished, update_committed = threading.Event(), threading.Event()
    captured, captured_contexts, errors = [], [], []

    def pause_after_membership_read(execute, sql, params, many, context):
        result = execute(sql, params, many, context)
        if '"organizations_membership"' in sql and not read_finished.is_set():
            # Freeze after the membership statement, before a possible second
            # profile SELECT. The single-statement fix already captured both.
            read_finished.set()
            assert update_committed.wait(10)
        return result

    def reader():
        try:
            with transaction.atomic():
                lock_courier_batches(batch)
                with connection.execute_wrapper(pause_after_membership_read):
                    ctx = producer_context(batch, FIELD_BOOTSTRAP)
                captured.append(producers.build_sections(ctx)["assignments"])
                captured_contexts.append(
                    selectors.capture_context(ctx, revision=selectors.scope_revision(ctx))
                )
        except Exception as error:  # noqa: BLE001 -- propagate worker failures to the test
            errors.append(error)
        finally:
            connection.close()

    thread = threading.Thread(target=reader)
    thread.start()
    try:
        assert read_finished.wait(10)
        # Same organization-first serialization as administration. The writer
        # commits both changes together while the reader holds the courier lock.
        with transaction.atomic():
            Organization.objects.select_for_update(no_key=True).get(pk=phone.organization.pk)
            membership.scope = scope_b
            membership.revision += 1
            membership.save(update_fields=["scope", "revision"])
            profile.scope = scope_a
            profile.revision += 1
            profile.save(update_fields=["scope", "revision"])
    finally:
        update_committed.set()
        thread.join(15)
    assert not thread.is_alive()
    assert not errors
    assert captured == [[]]
    assert captured_contexts == [before["capture_context"]]
    # Both bootstrap and initial sync use this same capture; the new committed
    # configuration must still deny A on the next request.
    with transaction.atomic():
        lock_courier_batches(batch)
        current = producer_context(batch, FIELD_EVENT_SYNC)
    assert producers.build_sections(current)["assignments"] == []
    assert selectors.scope_revision(current) != before["scope_revision"]
