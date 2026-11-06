"""Small authored historical setup for B-14; no production data or wall-clock fixtures."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import uuid4

from field_sync.envelope import BatchContext, EventEnvelope, GpsFix, describe_payload
from field_sync.services import sync_batch
from geography.models import Block, PointVersion, Quadrant, SamplingPoint
from organizations.models import Center, all_scope
from tests.factories import (
    DeviceFactory,
    MembershipFactory,
    ProfileFactory,
    RuleParameterFactory,
    RuleParameterVersionFactory,
)

CAPTURED = datetime(2026, 2, 4, 18, tzinfo=UTC)


def setup_field():
    membership = MembershipFactory(scope=all_scope())
    organization = membership.organization
    profile = ProfileFactory(
        organization=organization,
        scope=all_scope(),
        permission_codes=[
            "field_event.sync",
            "field.upload",
            "ovitrap.read",
            "reading.read",
            "catalog.read",
        ],
    )
    membership.profiles.add(profile)
    center = Center.objects.create(organization=organization, code="C-111", name="Test center")
    quadrant = Quadrant.objects.create(organization=organization, center=center, code="Q-111")
    point = make_point(quadrant, "P-111")
    device = DeviceFactory(organization=organization)
    batch = BatchContext(organization, membership.user, device, CAPTURED, CAPTURED)
    for key, value in {
        "max_distance_to_point_m": 50,
        "max_gps_accuracy_m": 50,
        "speed_lock_kmh": 10,
    }.items():
        parameter = RuleParameterFactory(organization=organization, key=key)
        RuleParameterVersionFactory(
            parameter=parameter, value=value, effective_from=CAPTURED - timedelta(days=30)
        )
    from catalogs.seeds import seed_default_catalogs

    seed_default_catalogs(organization)
    from catalogs.history import remember_catalog_snapshot
    from catalogs.selectors import build_catalog_snapshot

    snapshot = remember_catalog_snapshot(
        organization, membership.user, build_catalog_snapshot(organization)
    )
    return SimpleNamespace(
        catalog_version=snapshot.version,
        membership=membership,
        profile=profile,
        point=point,
        batch=batch,
        identity=uuid4(),
    )


def make_point(quadrant, code):
    block = Block.objects.create(organization=quadrant.organization, quadrant=quadrant, code=code)
    point = SamplingPoint.objects.create(organization=quadrant.organization, block=block, code=code)
    PointVersion.objects.create(
        organization=quadrant.organization,
        point=point,
        version=1,
        location=[-99.99, 20.005],
        effective_from=CAPTURED - timedelta(days=30),
    )
    return point


def envelope(field, event_type="ovitrap.place", **overrides):
    payload = {
        "sampling_point_id": str(field.point.pk),
        "ovitrap_id": str(field.identity),
        "supply_refs": [],
        "evidence_ids": [],
    }
    if event_type == "ovitrap.check":
        payload = {
            "ovitrap_id": str(field.identity),
            "finding": "intact",
            "paddle_present": True,
            "has_eggs": True,
            "temperature_c": 24,
            "humidity_pct": 70,
            "paddle_type": "standard",
            "is_lagged": False,
            "bag_code": "B-111",
        }
    payload = {**payload, **overrides.pop("payload", {})}
    fields = dict(
        index=0,
        id=uuid4(),
        type=event_type,
        schema_version=1,
        device_time=CAPTURED,
        payload=payload,
        payload_info=describe_payload(payload),
        rules_version="phone-rules-historical",
        catalog_version=field.catalog_version,
        manual_capture=False,
        gps=GpsFix(20.005, -99.99, 5),
    )
    return EventEnvelope(**{**fields, **overrides})


def ingest(field, sent):
    return sync_batch(field.batch, [sent], None).results[0]


def second_courier(field):
    membership = MembershipFactory(organization=field.batch.organization, scope=all_scope())
    membership.profiles.add(field.profile)
    device = DeviceFactory(organization=field.batch.organization)
    return replace(field.batch, user=membership.user, device=device)
