"""First-pass observations append one current revision, real QA causes and exact source pins."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, cast

from django.db.models import Max, QuerySet
from django.shortcuts import get_object_or_404

from core.time import server_now
from lab.access import reading_source_proof, scoped_bags
from lab.commands import LabCommandInput, LabOutcome
from lab.exceptions import LabConflictError
from lab.methods import configured_method, method_pin
from lab.models import BagReceipt, EggCountAttempt, LabCommand, LabResultRevision
from lab.permissions import COUNT_CREATE
from lab.policies import CountFacts, ExaminedFacts, LabPolicyError, evaluate_count, viability
from lab.queue import next_queue_snapshot
from organizations.models import Organization
from ovitraps.models import Bag
from reviews.effect_receipts import is_effective
from rules.selectors import list_parameters_with_current
from uploads.access import UploadActor

COUNT_LIMIT_KEY = "lab_count_plausibility_limit"
SAMPLE_RATE_KEY = "lab_recount_sample_per_100"


@dataclass(frozen=True)
class CountCreation:
    actor: UploadActor
    command: LabCommand
    bag: Bag
    receipt: BagReceipt
    values: dict[str, Any]
    replacement_of: EggCountAttempt | None = None


def capture_lab_rules(organization: Organization, at: datetime | None = None) -> dict[str, Any]:
    instant = at or server_now()
    parameters = cast(QuerySet[Any], list_parameters_with_current(organization, instant))
    rows = parameters.filter(key__in=(COUNT_LIMIT_KEY, SAMPLE_RATE_KEY)).values(
        "key", "value_type", "unit", "current_value", "current_version_id", "current_effective_from"
    )
    result: dict[str, Any] = {}
    for row in rows:
        if (
            row["current_value"] is None
            or row["current_version_id"] is None
            or row["value_type"] != "integer"
            or row["unit"] != "count"
        ):
            raise LabConflictError("lab_configuration_unavailable")
        minimum, maximum = (100, 10000) if row["key"] == COUNT_LIMIT_KEY else (1, 20)
        if (
            row["current_value"] != int(row["current_value"])
            or not minimum <= row["current_value"] <= maximum
        ):
            raise LabConflictError("lab_configuration_unavailable")
        result[row["key"]] = {
            "value": int(row["current_value"]),
            "version_id": str(row["current_version_id"]),
            "effective_from": row["current_effective_from"].isoformat(),
        }
    if set(result) != {COUNT_LIMIT_KEY, SAMPLE_RATE_KEY}:
        raise LabConflictError("lab_configuration_unavailable")
    result["_captured_at"] = instant.isoformat()
    return result


def disposition_context(
    actor: UploadActor, request: LabCommandInput, permission: str = COUNT_CREATE
) -> tuple[Bag, BagReceipt, LabResultRevision | None]:
    bag = get_object_or_404(
        scoped_bags(actor, permission).select_for_update(nowait=True, no_key=True),
        pk=request.target.identifier,
    )
    if not is_effective(bag.reading.event):
        raise LabConflictError("no_reading")
    if not bag.reading.paddle_present or type(bag.reading.has_eggs) is not bool:
        raise LabConflictError("lab_source_incoherent")
    receipt = BagReceipt.objects.filter(bag=bag, kind="bag").first()
    if receipt is None:
        raise LabConflictError("lab_receipt_required")
    previous = LabResultRevision.objects.filter(bag=bag).first()
    revision = 0 if previous is None else previous.revision
    if request.values["expected_revision"] != revision or (
        previous is not None
        and (previous.count_id is not None or previous.rejection_id is not None)
    ):
        raise LabConflictError("lab_state_conflict", revision)
    return bag, receipt, previous


def record_count(actor: UploadActor, command: LabCommand, request: LabCommandInput) -> LabOutcome:
    bag, receipt, previous = disposition_context(actor, request)
    from lab.dependencies import require_physical_material

    require_physical_material(bag)
    previous_void = None if previous is None else previous.void
    predecessor = None if previous_void is None else previous_void.count
    count, causes = create_count(
        CountCreation(actor, command, bag, receipt, request.values, predecessor)
    )
    LabResultRevision.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        bag=bag,
        revision=1 if previous is None else previous.revision + 1,
        previous=previous,
        command=command,
        count=count,
    )
    complete_count(count, causes)
    return LabOutcome(
        201, {"count": count_projection(count), **next_queue_snapshot(actor, bag, request.values)}
    )


def create_count(creation: CountCreation) -> tuple[EggCountAttempt, tuple[str, ...]]:
    actor, bag, values = creation.actor, creation.bag, creation.values
    from lab.dependencies import require_historical_correction

    measurement_proof = require_historical_correction(bag, creation.replacement_of, values)
    rules = capture_lab_rules(actor.organization)
    try:
        evaluation = evaluate_count(
            CountFacts(
                values["value"],
                values["confirmed_implausible"],
                rules[COUNT_LIMIT_KEY]["value"],
                bool(bag.reading.has_eggs),
            )
        )
    except LabPolicyError as error:
        raise LabConflictError(str(error)) from error
    method_values = count_method_values(actor, values)
    ordinal = (
        EggCountAttempt.objects.filter(bag=bag).aggregate(last=Max("ordinal"))["last"] or 0
    ) + 1
    count = EggCountAttempt.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        command=creation.command,
        receipt=creation.receipt,
        bag=bag,
        ordinal=ordinal,
        value=values["value"],
        rules=rules,
        source_proof={**reading_source_proof(bag.reading), **measurement_proof},
        replacement_of=creation.replacement_of,
        **method_values,
    )
    return count, evaluation.recount_causes


def complete_count(count: EggCountAttempt, causes: tuple[str, ...]) -> None:
    from lab.history import publish_lab_fact
    from lab.recounts import carry_pending_obligations, ensure_count_requests

    ensure_count_requests(count, causes)
    carry_pending_obligations(count)
    publish_lab_fact(count)


def count_method_values(actor: UploadActor, values: dict[str, Any]) -> dict[str, Any]:
    if "viable_eggs" not in values:
        if values.get("method_version") is not None or "total_examined" in values:
            raise LabConflictError("lab_viability_invalid")
        return {
            "viable_eggs": None,
            "total_examined": None,
            "viability_percent": None,
            "viability_reason": "not_requested",
            "method_version": None,
            "verification": None,
        }
    method, verification = configured_method(
        actor.organization.pk, values["method_version"], "viability"
    )
    result = viability(ExaminedFacts(values["viable_eggs"], values["total_examined"]))
    return {
        "viable_eggs": values["viable_eggs"],
        "total_examined": values["total_examined"],
        "viability_percent": result.percent,
        "viability_reason": result.reason or "",
        "method_version": method,
        "verification": verification,
    }


def count_projection(count: EggCountAttempt) -> dict[str, Any]:
    return {
        "id": str(count.pk),
        "bag_id": str(count.bag_id),
        "bag_code": count.bag.code,
        "value": count.value,
        "ordinal": count.ordinal,
        "viable_eggs": count.viable_eggs,
        "total_examined": count.total_examined,
        "viability_percent": None
        if count.viability_percent is None
        else str(count.viability_percent),
        "viability_reason": count.viability_reason,
        "method_version": None if count.method_version_id is None else str(count.method_version_id),
        "method": method_pin(count.method_version),
        "verification_id": None if count.verification_id is None else str(count.verification_id),
        "rules": count.rules,
        "source_proof": count.source_proof,
        "created_at": count.created_at.isoformat(),
        "created_by": str(count.created_by_id),
        "voided": hasattr(count, "void_fact"),
        "expected_revision": count.result_revision.revision,
    }
