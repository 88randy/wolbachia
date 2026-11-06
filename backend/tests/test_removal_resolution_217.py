"""Append-only recovery decisions, scoped API and source-lock serialization (#217)."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from threading import Event
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.db import DatabaseError, close_old_connections, connection, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from field_sync.models import FieldEvent
from ovitraps.lifecycle import services
from ovitraps.lifecycle.exceptions import RemovalConflictError, RemovalInProgressError
from ovitraps.lifecycle.models import RemovalAttempt, RemovalResolution
from ovitraps.lifecycle.selectors import has_unresolved_removal, ovitrap_history
from ovitraps.lifecycle.services import RemovalResolutionRequest, resolve_removal
from tests.ovitrap_support import CAPTURED, envelope, ingest, setup_field
from tests.test_ovitraps_lifecycle_b_15 import lifecycle, void_event


@pytest.fixture
def field(monkeypatch):
    from catalogs.history import remember_catalog_snapshot
    from catalogs.models import Catalog
    from catalogs.selectors import build_catalog_snapshot
    from tests.factories import CatalogItemFactory

    monkeypatch.setattr(timezone, "now", lambda: CAPTURED)
    configured = setup_field()
    configured.profile.permission_codes.append("removal.resolve")
    configured.profile.save(update_fields=["permission_codes"])
    reason = CatalogItemFactory(
        organization=configured.batch.organization,
        catalog=Catalog.objects.get(
            organization=configured.batch.organization, slug="removal-reason"
        ),
        code="damaged",
        is_other=False,
    )
    snapshot = remember_catalog_snapshot(
        configured.batch.organization,
        configured.batch.user,
        build_catalog_snapshot(configured.batch.organization),
    )
    configured.catalog_version = snapshot.version
    assert ingest(configured, envelope(configured)).status == "accepted"
    source = lifecycle(configured, "remove", payload={"reason_code": reason.code, "other_text": ""})
    assert ingest(configured, source).status == "accepted"
    configured.removal = RemovalAttempt.objects.get(event_id=source.id)
    configured.source = source
    return configured


def decision(**changes):
    return replace(
        RemovalResolutionRequest(
            "unrecovered", "recovered_later", "Recovered after the original visit"
        ),
        **changes,
    )


def test_resolution_requires_an_auditable_visible_normalized_reason():
    from ovitraps.lifecycle.serializers import RemovalResolutionRequestSerializer

    serializer = RemovalResolutionRequestSerializer(
        data={
            "expected_state": "unrecovered",
            "outcome": "written_off",
            "reason": "short",
        }
    )
    assert not serializer.is_valid()
    assert "reason" in serializer.errors


def test_resolution_openapi_exposes_expected_state_and_immutable_audit():
    from drf_spectacular.generators import SchemaGenerator

    schema = SchemaGenerator(urlconf="config.urls").get_schema(public=True)
    operation = schema["paths"]["/api/v1/ovitrap-removals/{id}/resolve/"]["post"]
    request_ref = operation["requestBody"]["content"]["application/json"]["schema"]["$ref"].split(
        "/"
    )[-1]
    components = schema["components"]["schemas"]
    assert set(components[request_ref]["required"]) == {"expected_state", "outcome", "reason"}
    response_ref = operation["responses"]["201"]["content"]["application/json"]["schema"][
        "$ref"
    ].split("/")[-1]
    assert set(components[response_ref]["properties"]) == {
        "id",
        "removal",
        "outcome",
        "reason",
        "created_by",
        "created_at",
    }


@pytest.mark.django_db
@pytest.mark.parametrize("outcome", ["recovered_later", "written_off"])
def test_resolve_clears_only_the_removal_blocker_and_preserves_audited_source(field, outcome):
    client = APIClient()
    client.force_authenticate(field.batch.user)
    original = field.removal.evidence_ids[:]
    response = client.post(
        f"/api/v1/ovitrap-removals/{field.removal.pk}/resolve/",
        {
            "expected_state": "unrecovered",
            "outcome": outcome,
            "reason": "  Supervisor verified recovery disposition  ",
        },
        format="json",
    )
    assert response.status_code == 201
    resolution = RemovalResolution.objects.get(pk=response.data["id"])
    assert resolution.removal_id == field.removal.pk
    assert resolution.created_by_id == field.batch.user.pk
    assert resolution.reason == "Supervisor verified recovery disposition"
    assert resolution.outcome == outcome
    assert not has_unresolved_removal(field.batch.organization, point=field.point.pk)
    assert not has_unresolved_removal(field.batch.organization, field.point.quadrant_id)
    field.removal.refresh_from_db()
    assert field.removal.recovery_state == "unrecovered"
    assert field.removal.evidence_ids == original
    assert field.removal.incident_link_id is not None
    assert FieldEvent.objects.get(pk=field.source.id).payload == field.source.payload
    history = ovitrap_history(field.removal.ovitrap)
    effect = next(
        row["effects"] for row in history["entries"] if row["event_id"] == field.source.id
    )
    assert effect["recovery_state"] == "unrecovered"
    assert effect["resolution"]["id"] == str(resolution.pk)
    assert effect["resolution"]["created_by"] == str(field.batch.user.pk)


@pytest.mark.django_db
def test_another_physical_removal_at_same_point_remains_a_blocker(field):
    resolve_removal(field.membership, field.removal.pk, decision())
    next_field = SimpleNamespace(**{**vars(field), "identity": uuid4()})
    assert ingest(next_field, envelope(next_field)).status == "accepted"
    assert ingest(next_field, lifecycle(next_field, "remove")).status == "accepted"
    assert has_unresolved_removal(field.batch.organization, point=field.point.pk)
    assert has_unresolved_removal(field.batch.organization, field.point.quadrant_id)
    assert RemovalResolution.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize("state", ["stale", "resolved", "voided", "recovered"])
def test_stale_or_ineligible_removal_returns_409_without_another_resolution(field, state):
    from tests.factories import FieldEventFactory

    request = decision(expected_state="recovered") if state == "stale" else decision()
    removal = field.removal
    if state == "resolved":
        resolve_removal(field.membership, removal.pk, decision())
    elif state == "voided":
        assert ingest(field, void_event(field, field.source)).status == "accepted"
    elif state == "recovered":
        # A separate authored historical recovered removal is never eligible for resolution.
        source = FieldEventFactory(organization=field.batch.organization, type="ovitrap.remove")
        removal = RemovalAttempt.objects.create(
            organization=field.batch.organization,
            event=source,
            ovitrap=field.removal.ovitrap,
            point_version=field.removal.point_version,
            reason=field.removal.reason,
            reason_code=field.removal.reason_code,
            reason_label=field.removal.reason_label,
            other_text="",
            evidence_ids=[],
            evaluated_rules={},
            rule_version_ids={},
            is_recovered=True,
            recovery_state="recovered",
        )
    before = set(RemovalResolution.objects.values_list("pk", flat=True))
    with pytest.raises(RemovalConflictError) as conflict:
        resolve_removal(field.membership, removal.pk, request)
    assert conflict.value.status_code == 409
    assert conflict.value.code == "removal_state_conflict"
    assert set(RemovalResolution.objects.values_list("pk", flat=True)) == before


@pytest.mark.django_db
@pytest.mark.parametrize(
    "restriction", ["foreign_org", "center", "quadrant", "unpaired", "no_permission"]
)
def test_resolution_endpoint_default_denies_and_hides_foreign_scope(field, restriction):
    from organizations.models import all_scope
    from tests.factories import MembershipFactory, ProfileFactory

    member = MembershipFactory(organization=field.batch.organization, scope=all_scope())
    scopes = [all_scope()]
    if restriction == "foreign_org":
        member = MembershipFactory(scope=all_scope())
    elif restriction in {"center", "quadrant"}:
        dimension = "centers" if restriction == "center" else "quadrants"
        member.scope[dimension] = {"mode": "selected", "ids": [str(uuid4())]}
        member.save(update_fields=["scope"])
    elif restriction == "unpaired":
        scopes = [
            {"centers": {"mode": "all", "ids": []}, "quadrants": {"mode": "none", "ids": []}},
            {"centers": {"mode": "none", "ids": []}, "quadrants": {"mode": "all", "ids": []}},
        ]
    for scope in scopes:
        member.profiles.add(
            ProfileFactory(
                organization=member.organization,
                scope=scope,
                permission_codes=[] if restriction == "no_permission" else ["removal.resolve"],
            )
        )
    client = APIClient()
    client.force_authenticate(member.user)
    response = client.post(
        f"/api/v1/ovitrap-removals/{field.removal.pk}/resolve/", {}, format="json"
    )
    assert response.status_code == (403 if restriction == "no_permission" else 404)
    assert not RemovalResolution.objects.exists()


@pytest.mark.django_db
def test_resolution_retains_archived_reason_and_blocks_void_as_a_dependent(field):
    from catalogs.models import CatalogItem

    CatalogItem.objects.filter(pk=field.removal.reason_id).update(is_active=False)
    resolution = resolve_removal(field.membership, field.removal.pk, decision())
    result = ingest(field, void_event(field, field.source))
    assert result.code == "ovitrap_void_blocked"
    assert result.params["blocked_by"] == [
        {"resource": "removal_resolution", "id": str(resolution.pk)}
    ]
    assert FieldEvent.objects.get(pk=field.source.id).voided_at is None
    assert not has_unresolved_removal(field.batch.organization)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "statement",
    [
        "UPDATE ovitraps_removalresolution SET reason = 'changed' WHERE id = %s",
        "DELETE FROM ovitraps_removalresolution WHERE id = %s",
    ],
)
def test_database_guard_preserves_resolution_audit(field, statement):
    resolution = resolve_removal(field.membership, field.removal.pk, decision())
    with pytest.raises(DatabaseError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute(statement, [resolution.pk])
    assert RemovalResolution.objects.get(pk=resolution.pk).reason == resolution.reason


@pytest.mark.django_db
def test_deferred_constraint_contention_rolls_back_resolution_and_maps_retry(field, monkeypatch):
    from django.db import OperationalError

    class LockUnavailableError(Exception):
        sqlstate = "55P03"

    def fail_constraint_check():
        raise OperationalError("Test-only deferred FK lock contention") from LockUnavailableError()

    monkeypatch.setattr(services, "check_deferred_constraints_now", fail_constraint_check)
    with pytest.raises(RemovalInProgressError) as busy:
        resolve_removal(field.membership, field.removal.pk, decision())
    assert busy.value.response_headers() == {"Retry-After": "1"}
    assert not RemovalResolution.objects.exists()
    assert has_unresolved_removal(field.batch.organization)


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("contender", ["resolve", "void", "new_removal"])
def test_resolution_serializes_with_double_resolution_void_and_new_removal(
    field, settings, contender
):
    settings.SYNC_LOCK_TIMEOUT_MS = 50
    entered, release = Event(), Event()
    real_append = services._append_resolution
    next_field = SimpleNamespace(**{**vars(field), "identity": uuid4()})
    if contender == "new_removal":
        assert ingest(next_field, envelope(next_field)).status == "accepted"

    def pause_append(*args):
        result = real_append(*args)
        entered.set()
        assert release.wait(10)
        return result

    def resolve_first():
        close_old_connections()
        try:
            return resolve_removal(field.membership, field.removal.pk, decision())
        finally:
            close_old_connections()

    with (
        patch.object(services, "_append_resolution", pause_append),
        ThreadPoolExecutor(max_workers=1) as pool,
    ):
        writer = pool.submit(resolve_first)
        try:
            assert entered.wait(10)
            if contender == "resolve":
                with pytest.raises(RemovalInProgressError):
                    resolve_removal(field.membership, field.removal.pk, decision())
            else:
                from field_sync.exceptions import SyncInProgressError

                pending = (
                    void_event(field, field.source)
                    if contender == "void"
                    else lifecycle(next_field, "remove")
                )
                with pytest.raises(SyncInProgressError):
                    ingest(field if contender == "void" else next_field, pending)
            assert not RemovalResolution.objects.exists()
        finally:
            release.set()
            writer.result(timeout=10)
    assert RemovalResolution.objects.count() == 1
    if contender == "resolve":
        with pytest.raises(RemovalConflictError):
            resolve_removal(field.membership, field.removal.pk, decision())
    else:
        result = ingest(field if contender == "void" else next_field, pending)
        assert (
            result.code == "ovitrap_void_blocked"
            if contender == "void"
            else result.status == "accepted"
        )
        assert has_unresolved_removal(field.batch.organization) is (contender == "new_removal")
