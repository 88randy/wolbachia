"""Bundle producer contracts. Register once from the owning AppConfig.ready()."""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from django.core.exceptions import ImproperlyConfigured
from django.db.models import Q, QuerySet
from rest_framework import serializers

from accounts.models import User
from core.snapshots import snapshot_hash
from organizations.models import Organization
from organizations.scope import EffectiveScope

SECTION_KEYS = (
    "assignments",
    "supplies",
    "permits",
    "eligibility",
    "history",
    "map_manifests",
    "quadrants",
    "sampling_points",
    "ovitraps",
)
BOOTSTRAP_SCHEMA_VERSION = 2


@dataclass(frozen=True)
class ProducerContext:
    organization: Organization
    user: User
    scope: EffectiveScope
    now: datetime
    permission: str
    configuration_generation: dict[str, Any] = field(default_factory=dict)
    eligibility_payloads: tuple[dict[str, Any], ...] | None = None
    eligibility_frame: tuple[str, str, str, str] | None = None
    lab_visibility_revision: str = ""
    release_visibility_revision: str = ""
    release_capture_payloads: dict[str, dict[str, Any]] | None = None
    release_capture_frame: tuple[str, str, str, str, str] | None = None
    sample_visibility_revision: str = ""
    sample_capture_payload: dict[str, Any] | None = None
    sample_capture_frame: tuple[str, ...] | None = None

    def includes(self, row: dict[str, Any]) -> bool:
        """Defense in depth before serialization: require ownership metadata on every row.

        Producers must already filter their queries. Metadata is not client payload;
        center_id/quadrant_id may be null only for a genuinely inapplicable dimension.
        """
        if not {"organization_id", "center_id", "quadrant_id"} <= row.keys():
            return False
        center = row["center_id"]
        quadrant = row["quadrant_id"]
        return str(row["organization_id"]) == str(self.organization.pk) and self.scope.allows(
            self.permission,
            None if center is None else str(center),
            None if quadrant is None else str(quadrant),
        )


@dataclass(frozen=True)
class BundleProducer:
    key: str
    schema_version: int
    build: Callable[[ProducerContext], list[dict[str, Any]]]
    serializer: type[serializers.Serializer[Any]]


PRODUCERS: dict[str, BundleProducer] = {}


def register(producer: BundleProducer) -> None:
    """Write the process-wide registry; duplicate keys are a configuration error."""
    if producer.key not in SECTION_KEYS or producer.schema_version < 1:
        raise ImproperlyConfigured("Unknown bundle section or invalid producer schema version.")
    if producer.key in PRODUCERS:
        raise ImproperlyConfigured(f"Bundle producer {producer.key!r} is already registered.")
    if producer.key == "map_manifests" and not issubclass(
        producer.serializer, MapManifestSerializer
    ):
        raise ImproperlyConfigured("Map producers require the licensed PMTiles manifest schema.")
    PRODUCERS[producer.key] = producer


def get_producer(key: str) -> BundleProducer:
    producer = PRODUCERS.get(key)
    if producer is None:
        raise ImproperlyConfigured(f"No bundle producer registered for {key!r}.")
    return producer


def serialize_payload(producer: BundleProducer, payload: dict[str, Any]) -> dict[str, Any]:
    """Validate producer output before it enters either delivery contract."""
    serializer = producer.serializer(data=payload)
    if not serializer.is_valid():
        raise ImproperlyConfigured(
            f"Invalid {producer.key!r} producer payload: {serializer.errors}"
        )
    return dict(serializer.data)


def build_sections(ctx: ProducerContext) -> dict[str, list[dict[str, Any]]]:
    sections: dict[str, list[dict[str, Any]]] = {key: [] for key in SECTION_KEYS}
    for key in SECTION_KEYS:
        if key not in PRODUCERS:
            continue
        producer = PRODUCERS[key]
        sections[key] = [
            serialize_payload(producer, row) for row in producer.build(ctx) if ctx.includes(row)
        ]
        if key == "history":
            from lab.independent_qa.services import publish_history_batch
            from uploads.access import UploadActor

            publish_history_batch(UploadActor(ctx.user, ctx.organization), sections[key])
    return sections


class MapManifestSerializer(serializers.Serializer[Any]):
    """Metadata only; a producer must report missing/failed assets as unlicensed or incomplete."""

    asset_id = serializers.CharField()
    version = serializers.CharField(allow_blank=True)
    sha256 = serializers.CharField(allow_blank=True)
    size_bytes = serializers.IntegerField(min_value=0)
    quadrant_id = serializers.UUIDField()
    licensed = serializers.BooleanField()


def map_manifests_ready(manifests: list[dict[str, Any]]) -> bool:
    """No assets, incomplete metadata or an unavailable license must never imply readiness.

    Actual download/hash verification belongs to the native map store (M-01).
    """
    return bool(manifests) and all(
        row.get("licensed") is True
        and bool(row.get("asset_id"))
        and bool(row.get("version"))
        and isinstance(row.get("size_bytes"), int)
        and row["size_bytes"] > 0
        and len(str(row.get("sha256", ""))) == 64
        and all(character in "0123456789abcdef" for character in str(row["sha256"]))
        for row in manifests
    )


def bundle_schema_version() -> str:
    """Opaque schema boundary includes every registered producer version, even for empty rows."""
    return snapshot_hash(
        {
            "bundle": BOOTSTRAP_SCHEMA_VERSION,
            "producers": {key: producer.schema_version for key, producer in PRODUCERS.items()},
        }
    )


def filter_producer_rows(
    queryset: QuerySet[Any], ctx: ProducerContext, lookups: tuple[str, str]
) -> QuerySet[Any]:
    """Apply the captured paired grants in SQL, without a second membership read."""
    allowed = Q(pk__in=[])
    for codes, scope in ctx.scope.grants:
        if ctx.permission not in codes:
            continue
        grant = Q(pk__isnull=False)
        dimensions: tuple[Literal["centers", "quadrants"], ...] = ("centers", "quadrants")
        for dimension, lookup in zip(dimensions, lookups, strict=True):
            bound = scope[dimension]
            if bound["mode"] != "all":
                grant &= Q(**{f"{lookup}__in": bound["ids"] if bound["mode"] == "selected" else []})
        allowed |= grant
    return queryset.filter(allowed, organization=ctx.organization)
