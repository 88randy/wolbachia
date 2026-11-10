import json
import uuid
from copy import deepcopy
from dataclasses import dataclass, field, replace
from datetime import datetime
from typing import Any, Literal, TypedDict

from django.conf import settings
from django.contrib.postgres.expressions import ArraySubquery
from django.db.models import Max, OuterRef, Q, QuerySet
from django.db.models.functions import JSONObject
from rest_framework.exceptions import PermissionDenied

from catalogs.selectors import build_catalog_snapshot
from core.snapshots import snapshot_hash
from field_sync.cursor import ChangesCursor, encode_cursor
from field_sync.envelope import BatchContext, CourierContext
from field_sync.models import CourierChange, FieldEvent
from field_sync.permissions import FIELD_BOOTSTRAP, FIELD_EVENT_SYNC
from field_sync.producers import (
    ProducerContext,
    build_sections,
    bundle_schema_version,
    map_manifests_ready,
)
from organizations.models import Membership, Organization, Profile
from organizations.scope import Dimension, EffectiveScope, WorkScope
from organizations.services import effective_scope
from reviews.models import ReviewItem
from reviews.selectors import list_courier_reviews
from rules.selectors import build_rules_snapshot


@dataclass(frozen=True)
class StoredEvent:
    """The columns of an already stored event that idempotency needs. Nothing else is read."""

    organization_id: uuid.UUID
    device_id: uuid.UUID
    created_by_id: uuid.UUID | None
    payload_sha256: str
    status: str
    status_code: str
    status_params: dict[str, Any]
    type: str = ""


def find_stored_event(event_id: uuid.UUID) -> StoredEvent | None:
    """The stored event with this id in ANY organization, or None.

    Deliberately not scoped: an id is globally unique (it is the primary key), so a reused id of
    another organization or device must be detected to answer `event_id_conflict`. The caller
    compares the owner and returns a result; the row itself never leaves the service.
    """
    row = (
        FieldEvent.objects.filter(pk=event_id)
        .values(
            "organization_id",
            "device_id",
            "created_by_id",
            "payload_sha256",
            "status",
            "status_code",
            "status_params",
            "type",
        )
        .first()
    )
    return None if row is None else StoredEvent(**row)


class CaptureContext(TypedDict):
    schema_version: Literal[1]
    permission: str
    user_id: str
    organization_id: str
    scope_revision: str
    grants: list[WorkScope]


@dataclass(frozen=True)
class Changes:
    """The downstream answer; explicit no-pull (including final upload) has no context/cursor."""

    cursor: str | None = None
    reviews: list[ReviewItem] = field(default_factory=list)
    catalog_version: str | None = None
    rules_version: str | None = None
    has_more: bool = False
    next_change_at: str | None = None
    capture_context: CaptureContext | None = None
    assignments: list[dict[str, Any]] = field(default_factory=list)
    supplies: list[dict[str, Any]] = field(default_factory=list)
    permits: list[dict[str, Any]] = field(default_factory=list)
    eligibility: list[dict[str, Any]] = field(default_factory=list)
    history: list[dict[str, Any]] = field(default_factory=list)
    map_manifests: list[dict[str, Any]] = field(default_factory=list)
    quadrants: list[dict[str, Any]] = field(default_factory=list)
    sampling_points: list[dict[str, Any]] = field(default_factory=list)
    ovitraps: list[dict[str, Any]] = field(default_factory=list)


def membership_snapshots(organization: Organization) -> QuerySet[Membership]:
    """One SQL snapshot for membership, user/org activity and active assigned profiles.

    READ COMMITTED gives each statement its own snapshot. A separate profile query
    could combine an old membership with new profile grants. No row lock is taken:
    organization configuration must never be locked below the courier lock.
    """
    profiles = (
        Profile.objects.filter(
            memberships__pk=OuterRef("pk"),
            organization_id=OuterRef("organization_id"),
            is_active=True,
        )
        .order_by("slug")
        .values(
            snapshot=JSONObject(
                slug="slug",
                scope="scope",
                permission_codes="permission_codes",
                is_active="is_active",
                revision="revision",
            )
        )
    )
    return (
        Membership.objects.select_related("user", "organization")
        .filter(
            organization=organization,
            is_active=True,
            user__is_active=True,
            organization__is_active=True,
        )
        .annotate(scope_profiles=ArraySubquery(profiles))
    )


def captured_scope(membership: Membership) -> EffectiveScope:
    snapshots: list[dict[str, Any]] = membership.scope_profiles  # type: ignore[attr-defined]
    profiles = [Profile(organization_id=membership.organization_id, **row) for row in snapshots]
    return effective_scope(membership, profiles=profiles)


def captured_generation(membership: Membership) -> dict[str, Any]:
    """Monotonic revisions of the membership and its active profiles, from the same snapshot."""
    snapshots: list[dict[str, Any]] = membership.scope_profiles  # type: ignore[attr-defined]
    return {
        "membership": membership.revision,
        "profiles": {row["slug"]: row["revision"] for row in snapshots},
    }


def producer_context(batch: BatchContext, permission: str) -> ProducerContext:
    """Compute paired grants exclusively from one captured configuration snapshot."""
    membership = membership_snapshots(batch.organization).filter(user=batch.user).first()
    if membership is None:
        raise PermissionDenied
    scope = captured_scope(membership)
    if not scope.allows(permission):
        raise PermissionDenied
    from lab.independent_qa.selectors import visibility_revision
    from uploads.access import UploadActor

    return ProducerContext(
        batch.organization,
        batch.user,
        scope,
        batch.received_at,
        permission,
        configuration_generation=captured_generation(membership),
        lab_visibility_revision=visibility_revision(UploadActor(batch.user, batch.organization)),
    )


def scope_revision(ctx: ProducerContext) -> str:
    """Canonical effective grants (SA02) bound to the configuration generation and producers.

    Restoring identical grants must not revalidate a cursor: rows published while the courier was
    outside the scope have no CourierChange for it. Any membership/profile revision bump, and any
    producer schema change (rows that were never delivered by changes), forces a re-bootstrap.
    """
    relevant = {
        FIELD_BOOTSTRAP,
        FIELD_EVENT_SYNC,
        "supply_assignment.receive",
        "supply_assignment.reconcile",
        "egg_count.read",
        "egg_count.void",
        "recount.create",
        "recount.adjudicate",
    }
    grants = [
        {"permissions": sorted(codes & relevant), "scope": scope}
        for codes, scope in ctx.scope.grants
        if codes & relevant
    ]
    unique = {json.dumps(grant, sort_keys=True, separators=(",", ":")) for grant in grants}
    return snapshot_hash(
        {
            "grants": [json.loads(grant) for grant in sorted(unique)],
            "generation": ctx.configuration_generation,
            "schema": bundle_schema_version(),
            "lab_visibility": ctx.lab_visibility_revision,
        }
    )


def capture_context(ctx: ProducerContext, *, revision: str) -> CaptureContext:
    """Project only captured self SYNC pairs, never a new read or original capture authority."""
    grants = [deepcopy(scope) for codes, scope in ctx.scope.grants if FIELD_EVENT_SYNC in codes]
    grants.sort(key=lambda scope: json.dumps(scope, sort_keys=True, separators=(",", ":")))
    return {
        "schema_version": 1,
        "permission": FIELD_EVENT_SYNC,
        "user_id": str(ctx.user.pk),
        "organization_id": str(ctx.organization.pk),
        "scope_revision": revision,
        "grants": grants,
    }


def latest_change_sequence(batch: BatchContext | CourierContext) -> int:
    value = (
        CourierChange.objects.for_org(batch.organization)
        .filter(courier=batch.user)
        .aggregate(last=Max("sequence"))["last"]
    )
    return int(value or 0)


def _change_scope_filter(ctx: ProducerContext) -> Q:
    allowed = Q(pk__in=[])
    for codes, scope in ctx.scope.grants:
        if ctx.permission not in codes:
            continue
        grant = Q(pk__isnull=False)
        bounds: tuple[tuple[Dimension, str], ...] = (
            (scope["centers"], "center_id"),
            (scope["quadrants"], "quadrant_id"),
        )
        for bound, key in bounds:
            if bound["mode"] != "all":
                ids = bound["ids"] if bound["mode"] == "selected" else []
                grant &= Q(**{f"scope__{key}": None}) | Q(**{f"scope__{key}__in": ids})
        allowed |= Q(scope__isnull=True) | grant
    return allowed


def list_courier_changes(ctx: ProducerContext, after: int) -> tuple[list[CourierChange], bool]:
    from django.db.models import CharField
    from django.db.models.functions import Cast

    from inventory.allocations.producers import current_supply_assignments
    from people.projections import eligibility_change_filter
    from reviews.history_scope import visible_history_contexts

    history_ids = visible_history_contexts(ctx)
    supply_ids = (
        current_supply_assignments(ctx)
        .annotate(_resource_id=Cast("pk", CharField()))
        .values("_resource_id")
    )

    rows = list(
        CourierChange.objects.for_org(ctx.organization)
        .filter(
            Q(kind="history", pk__in=history_ids)
            | (
                Q(kind="eligibility", resource_type="training_eligibility")
                & eligibility_change_filter(ctx)
            )
            | (
                Q(kind="supplies", resource_type="supply_assignment", resource_id__in=supply_ids)
                & _change_scope_filter(ctx)
            )
            | (~Q(kind__in=("history", "supplies", "eligibility")) & _change_scope_filter(ctx))
        )
        .filter(courier=ctx.user, sequence__gt=after)
        .order_by("sequence")[: settings.API_CURSOR_PAGE_SIZE + 1]
    )
    return rows[: settings.API_CURSOR_PAGE_SIZE], len(rows) > settings.API_CURSOR_PAGE_SIZE


def _typed_changes(
    rows: list[CourierChange], ctx: ProducerContext
) -> dict[str, list[dict[str, Any]]]:
    from field_sync.producers import SECTION_KEYS

    sections: dict[str, list[dict[str, Any]]] = {key: [] for key in SECTION_KEYS}
    from lab.independent_qa.services import publish_history_batch
    from uploads.access import UploadActor

    publish_history_batch(
        UploadActor(ctx.user, ctx.organization),
        [row.payload for row in rows if row.kind == "history"],
    )
    for row in rows:
        sections[row.kind].append(
            {
                "sequence": row.sequence,
                "action": row.action,
                "resource_type": row.resource_type,
                "resource_id": row.resource_id,
                "resource_version": row.resource_version,
                "data": row.payload,
            }
        )
    return sections


def build_changes(batch: BatchContext, cursor: ChangesCursor, ctx: ProducerContext) -> Changes:
    """Read both streams under the courier lock; advance each only to its last delivered row."""
    page = list_courier_reviews(batch.organization, batch.user, cursor.sequence)
    rows, has_more = list_courier_changes(
        replace(ctx, permission=FIELD_BOOTSTRAP), cursor.change_sequence
    )
    revision = scope_revision(ctx)
    position = replace(
        cursor,
        sequence=page.items[-1].courier_sequence if page.items else cursor.sequence,
        change_sequence=rows[-1].sequence if rows else cursor.change_sequence,
        scope_revision=revision,
    )
    rules = build_rules_snapshot(batch.organization, batch.received_at)
    return Changes(
        cursor=encode_cursor(batch.organization.pk, batch.user.pk, position),
        reviews=page.items,
        catalog_version=str(build_catalog_snapshot(batch.organization)["version"]),
        rules_version=str(rules["version"]),
        next_change_at=_next_change_at(rules["next_change_at"], ctx),
        capture_context=capture_context(ctx, revision=revision),
        has_more=page.has_more or has_more,
        **_typed_changes(rows, ctx),
    )


def build_bootstrap(batch: BatchContext, ctx: ProducerContext | None = None) -> dict[str, Any]:
    """Materialize the entire bundle and cursor while holding the courier transaction lock."""
    ctx = producer_context(batch, FIELD_BOOTSTRAP) if ctx is None else ctx
    position = latest_change_sequence(batch)
    sections = build_sections(ctx)
    rules = build_rules_snapshot(batch.organization, batch.received_at)
    revision = scope_revision(ctx)
    payload = {
        "schema_version": bundle_schema_version(),
        "scope_revision": revision,
        "capture_context": capture_context(ctx, revision=revision),
        "catalog_version": build_catalog_snapshot(batch.organization)["version"],
        "rules_version": rules["version"],
        "next_change_at": _next_change_at(rules["next_change_at"], ctx),
        "map_manifest_ready": map_manifests_ready(sections["map_manifests"]),
        **sections,
    }
    return {
        "bundle_version": snapshot_hash(payload),
        **payload,
        "generated_at": batch.received_at,
        "cursor": encode_cursor(
            batch.organization.pk, batch.user.pk, ChangesCursor(0, position, revision)
        ),
    }


def _next_change_at(rule_boundary: str | None, ctx: ProducerContext) -> str | None:
    from people.projections import earliest_eligibility_change

    values = [
        datetime.fromisoformat(value)
        for value in (rule_boundary, earliest_eligibility_change(ctx))
        if value is not None
    ]
    return None if not values else min(values).isoformat()
