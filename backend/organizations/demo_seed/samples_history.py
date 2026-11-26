# ruff: noqa: PLR0913, ANN401 -- seed helpers pass explicit row facts
"""Wolbachia lab samples of the history readings with result attempts (insert-only ORM).

The method is written and verified through the lab services. Samples, receipts and attempts are
inserted directly because the sample event pipeline refuses past dates. The positive share rises
week after week (about 20 % to 70 %) with a small offset per quadrant, so the W54 prevalence
chart shows a curve; a few samples only have an invalid attempt (not counted) and two of them
were repeated with a valid result.
"""

import random
from datetime import datetime, timedelta
from typing import Any
from unittest.mock import patch
from uuid import uuid5

from django.db import transaction
from django.utils import timezone

from accounts.models import Device
from catalogs.models import Catalog, CatalogItem
from catalogs.services import CatalogItemSpec, create_catalog_item
from field_sync.models import FieldEvent
from lab.methods import decide_method, write_method
from lab.models import LabMethod, LabMethodVerification
from lab.samples.models import (
    SampleCommandReceipt,
    SampleReceipt,
    WolbachiaResultAttempt,
    WolbachiaSample,
)
from organizations.demo_seed.field import NAMESPACE, catalog_for
from organizations.demo_seed.history import RULES_VERSION, SEED, _sha, event_sha
from organizations.models import Membership, Organization
from ovitraps.models import OvitrapReading
from uploads.access import UploadActor

METHOD_CODE = "WOLB-QPCR-01"
PER_QUADRANT_WEEK = 8
QUADRANTS = range(1, 7)
START_SHARE, END_SHARE = 0.20, 0.70
QUADRANT_OFFSET = {1: -0.06, 2: -0.03, 3: 0.08, 4: 0.05, 5: 0.0, 6: 0.03}
INVALID_SAMPLES = 4
REPEATED = 2


def _write_method(admin: UploadActor, at: datetime) -> None:
    version = write_method(
        admin,
        {
            "code": METHOD_CODE,
            "expected_revision": 0,
            "name": "PCR en tiempo real para detección de Wolbachia",
            "procedure": "Extracción de ADN y amplificación en tiempo real (procedimiento sintético).",
            "reference": "Protocolo interno de demostración, sin validez biológica",
            "effective_from": at,
            "supports_viability": False,
            "supports_rejection": False,
            "supports_wolbachia": True,
        },
    )
    decision = {
        "expected_revision": 0,
        "decision": "verify",
        "reference": "Verificación sintética de demostración",
    }
    decide_method(admin, version.pk, decision)


def _ensure_method(admin: UploadActor) -> LabMethodVerification:
    """Write and verify the method as of 120 days ago (the services run with a frozen clock), so
    the database guards accept samples collected in the past weeks."""
    existing = LabMethod.objects.filter(organization=admin.organization, code=METHOD_CODE).first()
    if existing is None:
        past = timezone.now() - timedelta(days=120)
        with patch("django.utils.timezone.now", lambda: past):
            _write_method(admin, past)
    return LabMethodVerification.objects.filter(
        organization=admin.organization, method_version__method__code=METHOD_CODE
    ).latest("revision")


def _command(
    organization: Organization, author: Any, sample: WolbachiaSample, command_id: Any, action: str
) -> SampleCommandReceipt:
    return SampleCommandReceipt(
        organization=organization,
        created_by=author,
        sample=sample,
        command_id=command_id,
        action=action,
        body_hash=_sha({"sample": str(sample.pk), "command": str(command_id), "action": action}),
        response={"sample_id": str(sample.pk)},
    )


def _ensure_origin_item(organization: Organization, admin: UploadActor) -> None:
    """The seeded sample-origin catalog only has "Other"; add the regular origin once."""
    catalog = Catalog.objects.get(organization=organization, slug="sample-origin")
    if CatalogItem.objects.filter(catalog=catalog, is_other=False).exists():
        return
    spec = CatalogItemSpec("ovitrap-paddle", "Paleta de ovitrampa", "Ovitrap paddle")
    create_catalog_item(catalog, spec, admin.user)


def _origin(catalog: dict[str, Any]) -> dict[str, Any]:
    for entry in catalog["catalogs"]:
        if entry["slug"] == "sample-origin":
            for item in entry["items"]:
                if not item.get("is_other"):
                    return dict(item)
    raise RuntimeError("The sample-origin catalog has no regular item.")


def ensure_samples(
    organization: Organization,
    members: dict[str, Membership],
    device: Device,
    catalog: dict[str, Any],
) -> int:
    """Create the samples once (the method is found by code); returns how many were written."""
    if WolbachiaSample.objects.filter(organization=organization, code__startswith="WS-").exists():
        return 0
    admin = UploadActor(members["demo-admin"].user, organization)
    verification = _ensure_method(admin)
    method = verification.method_version
    _ensure_origin_item(organization, admin)
    origin = _origin(catalog_for(organization, admin.user))
    entomologist = members["demo-entomologist"].user
    readings = list(
        OvitrapReading.objects.filter(
            organization=organization,
            paddle_present=True,
            ovitrap__sampling_point__block__quadrant__code__in=[
                f"Q-MER-{number:02d}" for number in QUADRANTS
            ],
        )
        .select_related("event", "ovitrap__sampling_point__block__quadrant")
        .order_by("epi_week", "pk")
    )
    weeks = sorted({reading.epi_week for reading in readings})
    groups: dict[tuple[int, str], list[OvitrapReading]] = {}
    for reading in readings:
        number = int(reading.ovitrap.sampling_point.block.quadrant.code[-2:])
        groups.setdefault((number, reading.epi_week), []).append(reading)
    rng = random.Random(f"{SEED}:samples")  # noqa: S311 -- deterministic synthetic data
    events, samples, receipts, attempts, commands = [], [], [], [], []
    counter = 0
    for (number, week), group in sorted(groups.items()):
        progress = weeks.index(week) / max(1, len(weeks) - 1)
        share = START_SHARE + (END_SHARE - START_SHARE) * progress + QUADRANT_OFFSET[number]
        rng.shuffle(group)
        for reading in group[:PER_QUADRANT_WEEK]:
            counter += 1
            code = f"WS-{counter:05d}"
            source = reading.event
            when = source.device_time + timedelta(hours=1)
            payload = {
                "sample_id": str(uuid5(NAMESPACE, f"sample:{code}")),
                "code": code,
                "origin_code": origin["code"],
                "method_version": str(method.pk),
                "source_ref": {"kind": "reading", "id": str(reading.pk)},
            }
            event = FieldEvent(
                id=uuid5(NAMESPACE, f"hist:sample-event:{code}"),
                organization=organization,
                created_by=source.created_by,
                type="sample.collect",
                schema_version=1,
                payload=payload,
                payload_sha256=event_sha(payload),
                device=device,
                shift_id=source.shift_id,
                device_time=when,
                server_received_at=source.server_received_at,
                clock_skew_seconds=0,
                gps_lng=source.gps_lng,
                gps_lat=source.gps_lat,
                gps_accuracy_m=6.0,
                rules_version=RULES_VERSION,
                catalog_version=source.catalog_version,
                status="accepted",
                status_code="accepted",
                status_params={},
                is_final_upload=True,
            )
            events.append(event)
            quadrant = reading.ovitrap.sampling_point.block.quadrant
            sample = WolbachiaSample(
                id=uuid5(NAMESPACE, f"sample:{code}"),
                organization=organization,
                created_by=source.created_by,
                code=code,
                event=event,
                center_id=quadrant.center_id,
                quadrant=quadrant,
                reading=reading,
                method_version=method,
                origin_snapshot=origin,
                source_provenance={"version": 1, "origin": origin, "source": {}},
                location=[source.gps_lng, source.gps_lat],
                device_time=when,
                server_received_at=source.server_received_at,
            )
            samples.append(sample)
            receive_id = uuid5(NAMESPACE, f"sample-receive:{code}")
            receipts.append(
                SampleReceipt(
                    organization=organization,
                    created_by=entomologist,
                    sample=sample,
                    command_id=receive_id,
                )
            )
            commands.append(_command(organization, entomologist, sample, receive_id, "receive"))
            invalid = counter <= INVALID_SAMPLES
            first = WolbachiaResultAttempt(
                organization=organization,
                created_by=entomologist,
                sample=sample,
                command_id=uuid5(NAMESPACE, f"sample-result:{code}:1"),
                revision=1,
                status="invalid" if invalid else "valid",
                result=None if invalid else ("positive" if rng.random() < share else "negative"),
                method_version=method,
                method_verification=verification,
            )
            attempts.append(first)
            commands.append(
                _command(organization, entomologist, sample, first.command_id, "results")
            )
            if invalid and counter <= REPEATED:
                attempts.append(
                    WolbachiaResultAttempt(
                        organization=organization,
                        created_by=entomologist,
                        sample=sample,
                        command_id=uuid5(NAMESPACE, f"sample-result:{code}:2"),
                        revision=2,
                        status="valid",
                        result="positive" if rng.random() < share else "negative",
                        method_version=method,
                        method_verification=verification,
                        repeat_of=first,
                    )
                )
                commands.append(
                    _command(
                        organization,
                        entomologist,
                        sample,
                        attempts[-1].command_id,
                        "results",
                    )
                )
    with transaction.atomic():
        FieldEvent.objects.bulk_create(events)
        WolbachiaSample.objects.bulk_create(samples)
        SampleReceipt.objects.bulk_create(receipts)
        WolbachiaResultAttempt.objects.bulk_create(attempts)
        SampleCommandReceipt.objects.bulk_create(commands)
    return len(samples)
