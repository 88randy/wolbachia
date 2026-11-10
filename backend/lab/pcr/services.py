# ruff: noqa: PLR0913 -- commands take actor, batch, action and its values explicitly
"""PCR batch writes. Every step appends an immutable fact inside one explicit transaction.

Lock order: Organization (no key) -> PcrBatch -> Upload. Wolbachia results are also written as
real result attempts through the existing sample command, so prevalence (W54) keeps one source.
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any, cast
from uuid import UUID, uuid4

from django.db import transaction
from django.http import Http404

from core.exceptions import FieldValidationError
from core.time import server_now
from core.void_reason import validate_void_reason
from lab.exceptions import LabConflictError
from lab.pcr.models import (
    TARGETS,
    TRANSITIONS,
    ExternalLab,
    PcrBatch,
    PcrBatchEvent,
    PcrBatchSample,
    PcrReport,
    PcrResult,
    PcrResultVoid,
)
from lab.pcr.selectors import (
    batch_status,
    current_results,
    eligible_samples,
    latest_live_transition,
)
from lab.samples.models import SampleReceipt, WolbachiaResultAttempt, WolbachiaSample
from lab.samples.services import SampleCommand, execute_sample_command
from organizations.models import Organization
from releases.models import PermitVersion
from uploads.access import UploadActor, current_scope
from uploads.models import AttachmentLink, Upload, UploadVerification

MAX_BATCH_SAMPLES = 500
EVIDENCE_TYPES = frozenset({"application/pdf", "image/jpeg", "image/png"})
REPORT_TYPES = frozenset({"application/pdf"})


@dataclass(frozen=True)
class ResultRow:
    sample_id: UUID
    target: str
    outcome: str
    serotype: str = ""
    ct_value: Decimal | None = None


def _lock_organization(actor: UploadActor) -> None:
    Organization.objects.select_for_update(no_key=True).get(pk=actor.organization.pk)


def _locked_batch(actor: UploadActor, batch_id: UUID) -> PcrBatch:
    _lock_organization(actor)
    batch = (
        PcrBatch.objects.select_for_update(no_key=True)
        .filter(organization=actor.organization, pk=batch_id)
        .first()
    )
    if batch is None:
        raise Http404
    return cast(PcrBatch, batch)


# External labs -------------------------------------------------------------------------------


def create_external_lab(actor: UploadActor, values: dict[str, Any]) -> ExternalLab:
    with transaction.atomic():
        _lock_organization(actor)
        if ExternalLab.objects.filter(
            organization=actor.organization, name__iexact=values["name"]
        ).exists():
            raise FieldValidationError("name", "pcr_lab_name_taken")
        return cast(
            ExternalLab,
            ExternalLab.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                name=values["name"],
                contact=values.get("contact", ""),
                address=values.get("address", ""),
                is_active=values.get("is_active", True),
            ),
        )


def update_external_lab(actor: UploadActor, lab_id: UUID, values: dict[str, Any]) -> ExternalLab:
    with transaction.atomic():
        _lock_organization(actor)
        lab = (
            ExternalLab.objects.select_for_update()
            .filter(organization=actor.organization, pk=lab_id)
            .first()
        )
        if lab is None:
            raise Http404
        name = values.get("name", lab.name)
        if (
            ExternalLab.objects.filter(organization=actor.organization, name__iexact=name)
            .exclude(pk=lab.pk)
            .exists()
        ):
            raise FieldValidationError("name", "pcr_lab_name_taken")
        for field in ("name", "contact", "address", "is_active"):
            if field in values:
                setattr(lab, field, values[field])
        lab.save(update_fields=["name", "contact", "address", "is_active"])
        return cast(ExternalLab, lab)


# Batches -------------------------------------------------------------------------------------


def _next_code(organization: Organization, year: int) -> str:
    prefix = f"PCR-{year}-"
    count = PcrBatch.objects.filter(organization=organization, code__startswith=prefix).count()
    return f"{prefix}{count + 1:04d}"


def create_batch(actor: UploadActor, values: dict[str, Any]) -> PcrBatch:
    targets = sorted(set(values["targets"]), key=TARGETS.index)
    sample_ids = list(dict.fromkeys(values["sample_ids"]))
    if not targets:
        raise FieldValidationError("targets", "required")
    if not sample_ids:
        raise FieldValidationError("sample_ids", "pcr_samples_required")
    if len(sample_ids) > MAX_BATCH_SAMPLES:
        raise FieldValidationError("sample_ids", "max_length", {"max_length": MAX_BATCH_SAMPLES})
    with transaction.atomic():
        _lock_organization(actor)
        lab = ExternalLab.objects.filter(
            organization=actor.organization, pk=values["external_lab_id"]
        ).first()
        if lab is None or not lab.is_active:
            raise FieldValidationError("external_lab_id", "pcr_lab_unavailable")
        found = set(eligible_samples(actor).filter(pk__in=sample_ids).values_list("pk", flat=True))
        if found != set(sample_ids):
            raise LabConflictError("pcr_sample_unavailable")
        now = server_now()
        batch = PcrBatch.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            code=_next_code(actor.organization, now.year),
            external_lab=lab,
            targets=targets,
            notes=values.get("notes", ""),
        )
        PcrBatchSample.objects.bulk_create(
            [
                PcrBatchSample(
                    organization=actor.organization,
                    created_by=actor.user,
                    batch=batch,
                    sample_id=identifier,
                )
                for identifier in sample_ids
            ]
        )
        return cast(PcrBatch, batch)


def _verified_upload(
    actor: UploadActor, upload_id: UUID, field: str, allowed: frozenset[str]
) -> UploadVerification:
    """An actor-owned, verified upload not yet bound to any record (permit document pattern)."""
    uploads = Upload.objects.filter(
        organization=actor.organization, public_id=upload_id, uploader=actor.user
    )
    uploads = (
        uploads.filter(device__isnull=True)
        if actor.device_id is None
        else uploads.filter(device_id=actor.device_id)
    )
    upload = uploads.select_for_update(no_key=True).first()
    if upload is None:
        raise FieldValidationError(field, "pcr_file_not_ready")
    verification = UploadVerification.objects.filter(
        organization=actor.organization, upload=upload
    ).first()
    if verification is None:
        raise FieldValidationError(field, "pcr_file_not_ready")
    if verification.content_type not in allowed:
        raise FieldValidationError(field, "pcr_file_type_invalid")
    if (
        AttachmentLink.objects.filter(upload=upload).exists()
        or PermitVersion.objects.filter(official_document=verification).exists()
        or PcrBatchEvent.objects.filter(evidence=verification).exists()
        or PcrReport.objects.filter(document=verification).exists()
    ):
        raise FieldValidationError(field, "pcr_file_already_used")
    return cast(UploadVerification, verification)


def _append_event(actor: UploadActor, batch: PcrBatch, kind: str, **fields: Any) -> PcrBatchEvent:  # noqa: ANN401
    return cast(
        PcrBatchEvent,
        PcrBatchEvent.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            batch=batch,
            kind=kind,
            occurred_at=fields.pop("occurred_at", None) or server_now(),
            **fields,
        ),
    )


def transition_batch(
    actor: UploadActor, batch_id: UUID, kind: str, values: dict[str, Any]
) -> PcrBatch:
    """`ready`, `ship`, `receive` or `close`; `results` is appended by `apply_results`."""
    if kind not in TRANSITIONS or kind == "results":
        raise LabConflictError("pcr_transition_invalid")
    with transaction.atomic():
        batch = _locked_batch(actor, batch_id)
        expected, _next = TRANSITIONS[kind]
        if batch_status(batch) != expected:
            raise LabConflictError("pcr_transition_invalid")
        occurred_at: datetime | None = values.get("occurred_at")
        if occurred_at is not None and occurred_at > server_now():
            raise FieldValidationError("occurred_at", "pcr_date_in_future")
        fields: dict[str, Any] = {"occurred_at": occurred_at}
        if kind == "ship":
            if not values.get("tracking_number", "").strip():
                raise FieldValidationError("tracking_number", "required")
            fields["carrier"] = values.get("carrier", "").strip()
            fields["tracking_number"] = values["tracking_number"].strip()
            if values.get("evidence_id"):
                fields["evidence"] = _verified_upload(
                    actor, values["evidence_id"], "evidence_id", EVIDENCE_TYPES
                )
        if kind == "close" and _missing_results(batch):
            raise LabConflictError("pcr_results_incomplete")
        _append_event(actor, batch, kind, **fields)
        return batch


def _missing_results(batch: PcrBatch) -> int:
    expected = batch.samples.count() * len(batch.targets)
    return expected - len(current_results(batch))


def undo_last_step(actor: UploadActor, batch_id: UUID, reason: str) -> PcrBatch:
    text = validate_void_reason(reason, "reason")
    with transaction.atomic():
        batch = _locked_batch(actor, batch_id)
        if batch_status(batch) == "voided":
            raise LabConflictError("pcr_batch_voided")
        latest = latest_live_transition(batch)
        if latest is None:
            raise LabConflictError("pcr_nothing_to_undo")
        if latest.kind == "results" and current_results(batch):
            raise LabConflictError("pcr_undo_blocked")
        _append_event(actor, batch, "undo", undoes=latest, reason=text)
        return batch


def void_batch(actor: UploadActor, batch_id: UUID, reason: str) -> PcrBatch:
    text = validate_void_reason(reason, "reason")
    with transaction.atomic():
        batch = _locked_batch(actor, batch_id)
        if batch_status(batch) == "voided":
            raise LabConflictError("pcr_batch_voided")
        if current_results(batch):
            raise LabConflictError("pcr_batch_void_blocked")
        _append_event(actor, batch, "void", reason=text)
        return batch


# Results -------------------------------------------------------------------------------------


def validate_result_rows(
    actor: UploadActor, batch: PcrBatch, rows: list[ResultRow]
) -> list[list[dict[str, Any]]]:
    """Per-row errors (`[{field, code, params}]`), empty when the row can be applied."""
    members = {
        entry.sample_id: entry.sample
        for entry in batch.samples.select_related("sample").prefetch_related("sample__attempts")
    }
    existing = {(result.sample_id, result.target): result for result in current_results(batch)}
    scope = current_scope(actor)
    seen: set[tuple[UUID, str]] = set()
    errors: list[list[dict[str, Any]]] = []
    for row in rows:
        problems: list[dict[str, Any]] = []
        sample = members.get(row.sample_id)
        key = (row.sample_id, row.target)
        if sample is None:
            problems.append({"field": "sample", "code": "pcr_sample_not_in_batch", "params": {}})
        if row.target not in batch.targets:
            problems.append({"field": "target", "code": "pcr_target_not_in_batch", "params": {}})
        if row.serotype and not (row.target == "dengue" and row.outcome == "positive"):
            problems.append({"field": "serotype", "code": "pcr_serotype_not_allowed", "params": {}})
        if key in seen:
            problems.append({"field": "sample", "code": "pcr_result_duplicated", "params": {}})
        seen.add(key)
        previous = existing.get(key)
        if previous is not None and previous.outcome != "invalid":
            problems.append({"field": "outcome", "code": "pcr_result_exists", "params": {}})
        if sample is not None and row.target == "wolbachia" and not problems:
            problems.extend(_wolbachia_problems(scope, sample))
        errors.append(problems)
    return errors


def _wolbachia_problems(scope: Any, sample: WolbachiaSample) -> list[dict[str, Any]]:  # noqa: ANN401
    center = str(sample.center_id)
    quadrant = str(sample.quadrant_id) if sample.quadrant_id else None
    needed = ["sample.result_create"]
    if not SampleReceipt.objects.filter(sample=sample).exists():
        needed.append("sample.receive")
    if not all(scope.allows(code, center, quadrant) for code in needed):
        return [{"field": "target", "code": "pcr_wolbachia_not_allowed", "params": {}}]
    latest = sample.attempts.order_by("-revision").first()
    if latest is not None and latest.status == "valid":
        return [{"field": "outcome", "code": "pcr_wolbachia_result_exists", "params": {}}]
    return []


def _record_wolbachia(
    actor: UploadActor, sample: WolbachiaSample, outcome: str
) -> WolbachiaResultAttempt:
    if not SampleReceipt.objects.filter(sample=sample).exists():
        execute_sample_command(actor, sample.pk, SampleCommand("receive", uuid4(), {}))
    latest = WolbachiaResultAttempt.objects.filter(sample=sample).order_by("-revision").first()
    values = {
        "status": "invalid" if outcome == "invalid" else "valid",
        "result": None if outcome == "invalid" else outcome,
        "method_version": str(sample.method_version_id),
        "repeat_of": None if latest is None else str(latest.pk),
    }
    response = execute_sample_command(actor, sample.pk, SampleCommand("results", uuid4(), values))
    return cast(
        WolbachiaResultAttempt,
        WolbachiaResultAttempt.objects.get(pk=response["attempt"]["id"]),
    )


def apply_results(actor: UploadActor, batch_id: UUID, rows: list[ResultRow]) -> PcrBatch:
    """All rows or none. The first application moves the batch to `results_received`."""
    if not rows:
        raise FieldValidationError("rows", "required")
    with transaction.atomic():
        batch = _locked_batch(actor, batch_id)
        status = batch_status(batch)
        if status not in {"received_by_lab", "results_received"}:
            raise LabConflictError("pcr_results_not_expected")
        if any(validate_result_rows(actor, batch, rows)):
            raise LabConflictError("pcr_results_invalid")
        existing = {(result.sample_id, result.target): result for result in current_results(batch)}
        samples = {
            entry.sample_id: entry.sample for entry in batch.samples.select_related("sample")
        }
        for row in rows:
            attempt = None
            if row.target == "wolbachia":
                attempt = _record_wolbachia(actor, samples[row.sample_id], row.outcome)
            PcrResult.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                batch=batch,
                sample_id=row.sample_id,
                target=row.target,
                outcome=row.outcome,
                serotype=row.serotype,
                ct_value=row.ct_value,
                supersedes=existing.get((row.sample_id, row.target)),
                wolbachia_attempt=attempt,
            )
        if status == "received_by_lab":
            _append_event(actor, batch, "results")
        return batch


def void_result(actor: UploadActor, batch_id: UUID, result_id: UUID, reason: str) -> PcrBatch:
    text = validate_void_reason(reason, "reason")
    with transaction.atomic():
        batch = _locked_batch(actor, batch_id)
        if batch_status(batch) in {"closed", "voided"}:
            raise LabConflictError("pcr_batch_closed")
        result = next((row for row in current_results(batch) if row.pk == result_id), None)
        if result is None:
            raise Http404
        if result.target == "wolbachia" and result.outcome != "invalid":
            # The valid Wolbachia attempt is permanent analytical history (prevalence).
            raise LabConflictError("pcr_result_locked")
        PcrResultVoid.objects.create(
            organization=actor.organization, created_by=actor.user, result=result, reason=text
        )
        return batch


def attach_report(actor: UploadActor, batch_id: UUID, upload_id: UUID) -> PcrBatch:
    with transaction.atomic():
        batch = _locked_batch(actor, batch_id)
        if batch_status(batch) not in {"received_by_lab", "results_received", "closed"}:
            raise LabConflictError("pcr_report_not_expected")
        document = _verified_upload(actor, upload_id, "upload_id", REPORT_TYPES)
        PcrReport.objects.create(
            organization=actor.organization, created_by=actor.user, batch=batch, document=document
        )
        return batch
