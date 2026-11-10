# ruff: noqa: ANN401 -- seed helpers pass explicit row facts
"""PCR demo: external labs, received samples waiting for PCR and batches in every step.

Samples are inserted like `samples_history` (the event pipeline refuses past dates); labs,
batches, steps and results go through the real PCR services, so Wolbachia results are also
real result attempts and show up in prevalence (W54).
"""

from datetime import timedelta
from decimal import Decimal
from typing import Any
from uuid import uuid5

from django.db import transaction

from accounts.models import Device
from field_sync.models import FieldEvent
from lab.models import LabMethodVerification
from lab.pcr import services
from lab.pcr.models import ExternalLab, PcrBatch
from lab.pcr.selectors import eligible_samples
from lab.samples.models import SampleReceipt, WolbachiaSample
from organizations.demo_seed.field import NAMESPACE, catalog_for
from organizations.demo_seed.history import RULES_VERSION, _sha
from organizations.demo_seed.samples_history import METHOD_CODE, _command, _origin
from organizations.models import Membership, Organization
from ovitraps.models import OvitrapReading
from uploads.access import UploadActor

PREFIX = "WS-P"
PENDING_SAMPLES = 40
LABS = (
    (
        "Laboratorio Estatal de Salud Pública de Yucatán",
        "Q.F.B. Laura Canché · 999 930 3050",
        "Calle 72 No. 463, Centro, Mérida, Yuc.",
    ),
    (
        "Diagnóstico Molecular del Sureste",
        "Recepción de muestras · 999 943 1200",
        "Av. Colón 501, García Ginerés, Mérida, Yuc.",
    ),
    (
        "Laboratorio de Arbovirus UADY",
        "Dr. Pedro Ku · 999 924 5809",
        "Av. Itzáes s/n, Centro, Mérida, Yuc.",
    ),
)


def _pending_samples(
    organization: Organization, members: dict[str, Membership], device: Device
) -> None:
    if WolbachiaSample.objects.filter(organization=organization, code__startswith=PREFIX).exists():
        return
    verification = LabMethodVerification.objects.filter(
        organization=organization, method_version__method__code=METHOD_CODE
    ).latest("revision")
    method = verification.method_version
    origin = _origin(catalog_for(organization, members["demo-admin"].user))
    entomologist = members["demo-entomologist"].user
    readings = list(
        OvitrapReading.objects.filter(organization=organization, paddle_present=True)
        .select_related("event", "ovitrap__sampling_point__block__quadrant")
        .order_by("-epi_week", "pk")[:PENDING_SAMPLES]
    )
    events, samples, receipts, commands = [], [], [], []
    for index, reading in enumerate(readings, start=1):
        code = f"{PREFIX}{index:04d}"
        source = reading.event
        when = source.device_time + timedelta(hours=2)
        payload = {
            "sample_id": str(uuid5(NAMESPACE, f"sample:{code}")),
            "code": code,
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
            payload_sha256=_sha(payload),
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
    with transaction.atomic():
        FieldEvent.objects.bulk_create(events)
        WolbachiaSample.objects.bulk_create(samples)
        SampleReceipt.objects.bulk_create(receipts)
        from lab.samples.models import SampleCommandReceipt

        SampleCommandReceipt.objects.bulk_create(commands)


def _outcome(code: str, target: str) -> tuple[str, str, Decimal | None]:
    digit = int(uuid5(NAMESPACE, f"pcr:{code}:{target}").hex[:4], 16)
    if target == "wolbachia":
        if digit % 11 == 0:
            return "invalid", "", None
        positive = digit % 10 < 6
        return (
            ("positive" if positive else "negative"),
            "",
            Decimal(18 + digit % 14) if positive else None,
        )
    if digit % 7 == 0:
        return "positive", f"DENV-{1 + digit % 4}", Decimal(22 + digit % 10)
    return "negative", "", None


def _apply(actor: UploadActor, batch: PcrBatch) -> None:
    rows = [
        services.ResultRow(entry.sample_id, target, *_outcome(entry.sample.code, target))
        for entry in batch.samples.select_related("sample").order_by("sample__code")
        for target in batch.targets
    ]
    services.apply_results(actor, batch.pk, rows)


def ensure_pcr_history(
    organization: Organization, members: dict[str, Membership], device: Device
) -> int:
    """Create the demo PCR batches once; returns how many batches were written."""
    from organizations.defaults import seed_default_permission_codes

    seed_default_permission_codes(organization)  # grants pcr.* to an already seeded demo
    if PcrBatch.objects.filter(organization=organization).exists():
        return 0
    _pending_samples(organization, members, device)
    actor = UploadActor(members["demo-entomologist"].user, organization)
    labs = [
        ExternalLab.objects.filter(organization=organization, name=name).first()
        or services.create_external_lab(
            actor, {"name": name, "contact": contact, "address": address}
        )
        for name, contact, address in LABS
    ]
    pool = list(
        eligible_samples(actor)
        .filter(code__startswith=PREFIX)
        .order_by("code")
        .values_list("pk", flat=True)
    )
    # Each plan: lab index, targets, sample count and the steps already done.
    plans: list[tuple[int, list[str], int, list[str]]] = [
        (0, ["wolbachia", "dengue"], 6, ["ready", "ship", "receive", "results", "close"]),
        (1, ["wolbachia"], 6, ["ready", "ship", "receive", "results"]),
        (0, ["dengue"], 5, ["ready", "ship", "receive"]),
        (2, ["wolbachia", "dengue"], 6, ["ready", "ship"]),
        (1, ["wolbachia"], 4, ["ready"]),
        (0, ["wolbachia", "dengue"], 4, []),
    ]
    created = 0
    for lab_index, targets, size, steps in plans:
        chosen, pool = pool[:size], pool[size:]
        if len(chosen) < size:
            break
        values: dict[str, Any] = {
            "external_lab_id": labs[lab_index].pk,
            "targets": targets,
            "sample_ids": chosen,
        }
        batch = services.create_batch(actor, values)
        created += 1
        for step in steps:
            if step == "results":
                _apply(actor, batch)
            elif step == "ship":
                services.transition_batch(
                    actor,
                    batch.pk,
                    "ship",
                    {"carrier": "Estafeta", "tracking_number": f"EST-{batch.code[-4:]}-7781"},
                )
            else:
                services.transition_batch(actor, batch.pk, step, {})
    return created
