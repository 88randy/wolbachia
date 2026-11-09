"""Independent human facts append under the existing Lab command and Organization arbiter."""

from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Any, cast
from uuid import UUID

from django.db.models import QuerySet
from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from accounts.models import User
from core.snapshots import snapshot_hash
from lab.access import scoped_readings
from lab.commands import LabCommandInput, LabOutcome
from lab.corrections import lab_void_reason
from lab.counting import COUNT_LIMIT_KEY, capture_lab_rules
from lab.dependencies import require_physical_material
from lab.exceptions import LabConflictError
from lab.independent_qa.commands import action_alternatives
from lab.independent_qa.policies import RecountComparison, requires_third
from lab.independent_qa.selectors import (
    cause_ids,
    current_first_result,
    current_qa_revision,
    eligibility_reason,
    request_for_action,
    role_authorized,
)
from lab.methods import configured_method
from lab.models import (
    EggCountAttempt,
    LabCommand,
    LabMethodVersion,
    LabNumericDisclosure,
    LabQAPolicyVersion,
    LabResultRevision,
    RecountAttempt,
    RecountClaim,
    RecountIndependenceAttestation,
    RecountRequest,
    RecountResolution,
    RecountRevision,
)
from lab.permissions import COUNT_READ, METHOD_MANAGE, RECOUNT_ADJUDICATE
from lab.policies import CountFacts, ExaminedFacts, LabPolicyError, evaluate_count, viability
from lab.transactions import lab_transaction, require_lab_lock
from uploads.access import UploadActor, current_scope


@dataclass(frozen=True)
class QAFrame:
    request: RecountRequest
    first_result: LabResultRevision
    revision: int


@dataclass(frozen=True)
class NumericPublication:
    permission: str
    surface: str


@contextmanager
def numeric_read_transaction(actor: UploadActor) -> Iterator[None]:
    """Pin the actual publishing actor and configuration across query/render/receipt.

    Existing command/sync callers already own this actor before Organization;
    reacquiring it is reentrant and never discovers another historical User.
    """
    from lab.transactions import lock_users, mapped_transaction
    from organizations.models import Organization
    from uploads.access import lock_actor

    with mapped_transaction():
        lock_users({actor.user.pk})
        lock_actor(actor)
        Organization.objects.select_for_update(nowait=True, no_key=True).get(
            pk=actor.organization.pk
        )
        yield


_response_publications: ContextVar[list[tuple[Any, NumericPublication]] | None] = ContextVar(
    "lab_response_publications", default=None
)


@contextmanager
def response_publications(actor: UploadActor) -> Iterator[None]:
    """A domain409 rolls back effects, but its actually disclosed classification persists.

    Flush outside the command's effect savepoint and inside its retained outer
    transaction. Exceptions that produce no saved response publish nothing.
    """
    pending: list[tuple[Any, NumericPublication]] = []
    token = _response_publications.set(pending)
    try:
        yield
    finally:
        _response_publications.reset(token)
    for count, context in pending:
        publish_numeric_access(actor, count, context)


def publish_numeric_access(
    actor: UploadActor, count: EggCountAttempt, context: NumericPublication
) -> None:
    """Write only the publishing actor FK; serialize delivery/claim on the same Org arbiter.

    Nested sync already owns this actor User before its account/Org locks. No
    historical author, source or recipient is newly locked by this publication.
    """
    from lab.independent_qa.selectors import can_read_numeric

    with numeric_read_transaction(actor):
        if (
            not scoped_readings(actor, context.permission)
            .filter(pk=count.receipt.reading_id)
            .exists()
        ):
            raise Http404
        if not can_read_numeric(actor, count):
            raise Http404
        pending = _response_publications.get()
        if pending is not None:
            pending.append((count, context))
            return
        LabNumericDisclosure.objects.get_or_create(
            count=count,
            created_by=actor.user,
            defaults={"organization": actor.organization, "surface": context.surface},
        )


def publish_history_batch(actor: UploadActor, payloads: list[dict[str, Any]]) -> None:
    """Record only the selected/delivered payloads, with one current scoped count query."""
    from lab.independent_qa.selectors import blind_visible_counts

    numeric = {"lab_count", "lab_void", "lab_recount", "lab_adjudication", "lab_paddle_reuse"}
    identifiers = {
        UUID(str(payload["count_id"]))
        for payload in payloads
        if payload.get("kind") in numeric and payload.get("count_id")
    }
    if not identifiers:
        return
    with numeric_read_transaction(actor):
        visible = blind_visible_counts(
            actor,
            EggCountAttempt.objects.filter(
                organization=actor.organization,
                pk__in=identifiers,
                receipt__reading__in=scoped_readings(actor, COUNT_READ),
            ),
        )
        if set(visible.values_list("pk", flat=True)) != identifiers:
            raise Http404
        LabNumericDisclosure.objects.bulk_create(
            [
                LabNumericDisclosure(
                    organization=actor.organization,
                    created_by=actor.user,
                    count_id=identifier,
                    surface="history",
                )
                for identifier in sorted(identifiers)
            ],
            ignore_conflicts=True,
        )


def publish_inferred_counts(
    actor: UploadActor, rows: QuerySet[EggCountAttempt], permission: str
) -> None:
    """A successful numeric-state facet can disclose its predicate even with an empty page."""
    from lab.independent_qa.selectors import blind_visible_counts

    with numeric_read_transaction(actor):
        candidates = blind_visible_counts(
            actor, rows.filter(receipt__reading__in=scoped_readings(actor, permission))
        )
        LabNumericDisclosure.objects.bulk_create(
            [
                LabNumericDisclosure(
                    organization=actor.organization,
                    created_by=actor.user,
                    count_id=identifier,
                    surface="result",
                )
                for identifier in candidates.values_list("pk", flat=True)
            ],
            ignore_conflicts=True,
        )


def require_action(actor: UploadActor, request: RecountRequest, permission: str) -> None:
    if not scoped_readings(actor, permission).filter(pk=request.count.receipt.reading_id).exists():
        raise Http404


def active_frame(actor: UploadActor, operation: LabCommandInput) -> QAFrame:
    identifier = (
        UUID(str(operation.values["request_id"]))
        if operation.action == "recount"
        else operation.target.identifier
    )
    request = request_for_action(actor, identifier, action_alternatives(operation.action))
    if operation.action == "recount" and request.count.bag_id != operation.target.identifier:
        raise Http404
    revision = current_qa_revision(request)
    current = current_first_result(request)
    if operation.values["expected_revision"] != revision:
        raise LabConflictError("lab_state_conflict", revision)
    if current is None or current.count_id != request.count_id or hasattr(request, "supersession"):
        raise LabConflictError("lab_recount_superseded", revision)
    if operation.values.get("expected_result_revision", current.revision) != current.revision:
        raise LabConflictError("lab_state_conflict", current.revision)
    from reviews.effect_receipts import is_effective

    if not is_effective(request.count.receipt.reading.event):
        raise LabConflictError("no_reading")
    require_physical_material(request.count.bag)
    return QAFrame(request, current, revision)


def current_policy(organization_id: UUID) -> LabQAPolicyVersion:
    require_lab_lock(organization_id)
    policy = LabQAPolicyVersion.objects.filter(organization_id=organization_id).first()
    if policy is None or policy.qa_method_version_id is None:
        raise LabConflictError("lab_qa_configuration_unavailable")
    configured_method(organization_id, policy.qa_method_version_id, "independent_qa")
    return cast(LabQAPolicyVersion, policy)


def write_qa_policy(actor: UploadActor, values: dict[str, Any]) -> LabQAPolicyVersion:
    with lab_transaction(actor):
        if not current_scope(actor).allows(METHOD_MANAGE):
            raise PermissionDenied
        previous = LabQAPolicyVersion.objects.filter(organization=actor.organization).first()
        revision = 0 if previous is None else previous.revision
        if values["expected_revision"] != revision:
            raise LabConflictError("lab_state_conflict", revision)
        for key, capability in (
            ("qa_method_version", "independent_qa"),
            ("reuse_method_version", "paddle_reuse"),
        ):
            if values.get(key) is not None:
                method = LabMethodVersion.objects.filter(
                    organization=actor.organization, pk=values[key]
                ).first()
                if method is None:
                    raise Http404
                if not getattr(method, "supports_" + capability):
                    raise LabConflictError("lab_method_capability_required")
        fields = {
            key: values[key]
            for key in (
                "absolute_tolerance",
                "relative_per_100",
                "qa_method_version",
                "reuse_method_version",
            )
        }
        return LabQAPolicyVersion.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            revision=revision + 1,
            absolute_tolerance=fields["absolute_tolerance"],
            relative_per_100=fields["relative_per_100"],
            qa_method_version_id=fields["qa_method_version"],
            reuse_method_version_id=fields["reuse_method_version"],
            content_hash=snapshot_hash(
                {
                    key: str(value) if isinstance(value, UUID) else value
                    for key, value in fields.items()
                }
            ),
        )


def append_revision(command: LabCommand, request: RecountRequest, fact: Any) -> RecountRevision:  # noqa: ANN401 -- closed immutable cause union below
    previous = RecountRevision.objects.filter(request=request).first()
    keys = {
        RecountClaim: "claim",
        RecountAttempt: "attempt",
        RecountResolution: "resolution",
        RecountIndependenceAttestation: "attestation",
    }
    return RecountRevision.objects.create(
        organization=command.organization,
        created_by=command.created_by,
        request=request,
        command=command,
        revision=1 if previous is None else previous.revision + 1,
        previous=previous,
        **{keys[type(fact)]: fact},
    )


def comparison(request: RecountRequest, second: RecountAttempt) -> RecountComparison:
    policy = second.claim.policy
    return RecountComparison(
        request.count.value, second.value, policy.absolute_tolerance, policy.relative_per_100
    )


def independence_proof(actor: UploadActor, frame: QAFrame, role: str) -> dict[str, Any]:
    if not role_authorized(actor, frame.request, role):
        raise Http404
    if reason := eligibility_reason(actor, frame.request, role):
        raise LabConflictError(reason)
    boundary = getattr(frame.request.count, "blind_boundary", None)
    attestation = RecountIndependenceAttestation.objects.filter(
        request=frame.request, first_result=frame.first_result, counter=actor.user, role=role
    ).first()
    return {
        "policy": "lab.blind.v1",
        "first_count_id": str(frame.request.count_id),
        "first_result_id": str(frame.first_result.pk),
        "boundary_id": None if boundary is None else str(boundary.pk),
        "attestation_id": None if attestation is None else str(attestation.pk),
        "counter_id": str(actor.user.pk),
        "role": role,
        "cause_ids": cause_ids(frame.request),
    }


def require_open_role(actor: UploadActor, frame: QAFrame, role: str) -> RecountClaim | None:
    if RecountAttempt.objects.filter(request=frame.request, role=role).exists():
        raise LabConflictError("lab_recount_role_completed")
    second = RecountAttempt.objects.filter(request=frame.request, role="second").first()
    if role == "third" and (
        second is None or not requires_third(comparison(frame.request, second))
    ):
        raise LabConflictError("lab_recount_third_not_required")
    previous = (
        RecountClaim.objects.filter(request=frame.request, role=role)
        .order_by("-qa_revision__revision")
        .first()
    )
    if previous is not None and previous.counter_id != actor.user.pk:
        counter = UploadActor(previous.counter, actor.organization)
        if (
            previous.counter.is_active
            and role_authorized(counter, frame.request, role)
            and eligibility_reason(counter, frame.request, role) is None
        ):
            raise LabConflictError("lab_recount_claimed")
    return previous


def claim_request(
    actor: UploadActor, command: LabCommand, operation: LabCommandInput
) -> LabOutcome:
    frame = active_frame(actor, operation)
    role = operation.values["role"]
    proof = independence_proof(actor, frame, role)
    previous = require_open_role(actor, frame, role)
    policy = current_policy(actor.organization.pk)
    claim = RecountClaim.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        request=frame.request,
        counter=actor.user,
        role=role,
        previous=previous,
        first_result=frame.first_result,
        policy=policy,
        command=command,
        independence_proof=proof,
    )
    revision = append_revision(command, frame.request, claim)
    return LabOutcome(
        201,
        {
            "claim": {
                "id": str(claim.pk),
                "request_id": str(frame.request.pk),
                "role": role,
                "revision": revision.revision,
            }
        },
    )


def claimed_role(actor: UploadActor, frame: QAFrame) -> RecountClaim:
    roles = []
    for role in ("second", "third"):
        latest = (
            RecountClaim.objects.filter(request=frame.request, role=role)
            .order_by("-qa_revision__revision")
            .first()
        )
        if (
            latest is not None
            and latest.counter_id == actor.user.pk
            and not hasattr(latest, "attempt")
        ):
            roles.append(latest)
    if len(roles) != 1:
        raise LabConflictError("lab_recount_claim_required")
    return cast(RecountClaim, roles[0])


def independent_measurement(
    actor: UploadActor, claim: RecountClaim, values: dict[str, Any]
) -> dict[str, Any]:
    policy = current_policy(actor.organization.pk)
    if policy.pk != claim.policy_id or str(values["method_version"]) != str(
        policy.qa_method_version_id
    ):
        raise LabConflictError("lab_qa_policy_changed")
    method, verification = configured_method(
        actor.organization.pk, values["method_version"], "independent_qa"
    )
    rules = capture_lab_rules(actor.organization)
    try:
        evaluate_count(
            CountFacts(
                values["value"],
                values["confirmed_implausible"],
                rules[COUNT_LIMIT_KEY]["value"],
                True,
            )
        )
        measured = "viable_eggs" in values
        if measured and not method.supports_viability:
            raise LabConflictError("lab_method_capability_required")
        ratio = (
            viability(ExaminedFacts(values["viable_eggs"], values["total_examined"]))
            if measured
            else None
        )
    except LabPolicyError as error:
        raise LabConflictError(str(error)) from error
    return {
        "value": values["value"],
        "viable_eggs": values.get("viable_eggs"),
        "total_examined": values.get("total_examined"),
        "viability_percent": None if ratio is None else ratio.percent,
        "viability_reason": "not_requested" if ratio is None else ratio.reason or "",
        "method_version": method,
        "verification": verification,
        "rules": rules,
    }


def record_independent(
    actor: UploadActor, command: LabCommand, operation: LabCommandInput
) -> LabOutcome:
    frame = active_frame(actor, operation)
    claim = claimed_role(actor, frame)
    independence_proof(actor, frame, claim.role)
    if claim.first_result_id != frame.first_result.pk:
        raise LabConflictError("lab_recount_superseded")
    if claim.independence_proof.get("cause_ids") != cause_ids(frame.request):
        raise LabConflictError("lab_recount_frame_changed")
    if RecountAttempt.objects.filter(request=frame.request, role=claim.role).exists():
        raise LabConflictError("lab_recount_role_completed")
    measured = independent_measurement(actor, claim, operation.values)
    attempt = RecountAttempt.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        request=frame.request,
        claim=claim,
        receipt=frame.request.count.receipt,
        bag=frame.request.count.bag,
        command=command,
        role=claim.role,
        source_proof={
            "first_source": frame.request.count.source_proof,
            "independence": claim.independence_proof,
            "first_result_id": str(frame.first_result.pk),
        },
        **measured,
    )
    revision = append_revision(command, frame.request, attempt)
    from lab.history import publish_qa_fact

    publish_qa_fact(attempt)
    from lab.independent_qa.selectors import next_recount_snapshot, request_state

    return LabOutcome(
        201,
        {
            "attempt": {
                "id": str(attempt.pk),
                "request_id": str(frame.request.pk),
                "role": attempt.role,
                "value": attempt.value,
                "method_version": str(attempt.method_version_id),
                "revision": revision.revision,
            },
            "qa_state": request_state(frame.request),
            **next_recount_snapshot(actor, frame.request),
        },
    )


def resolution_candidates(
    actor: UploadActor, frame: QAFrame
) -> tuple[RecountAttempt, RecountAttempt | None]:
    second = RecountAttempt.objects.filter(request=frame.request, role="second").first()
    if second is None:
        raise LabConflictError("lab_recount_second_required")
    third = RecountAttempt.objects.filter(request=frame.request, role="third").first()
    if requires_third(comparison(frame.request, second)):
        if third is None:
            raise LabConflictError("lab_recount_third_required")
        if actor.user.pk != third.created_by_id or not role_authorized(
            actor, frame.request, "third"
        ):
            raise Http404
    elif actor.user.pk == second.created_by_id:
        if not role_authorized(actor, frame.request, "second"):
            require_action(actor, frame.request, RECOUNT_ADJUDICATE)
    else:
        require_action(actor, frame.request, RECOUNT_ADJUDICATE)
    return second, third


def adjudicate(actor: UploadActor, command: LabCommand, operation: LabCommandInput) -> LabOutcome:
    frame = active_frame(actor, operation)
    second, third = resolution_candidates(actor, frame)
    if current_policy(actor.organization.pk).pk != second.claim.policy_id:
        raise LabConflictError("lab_qa_policy_changed")
    configured_method(actor.organization.pk, second.method_version_id, "independent_qa")
    from lab.models import PaddleReuse

    if PaddleReuse.objects.filter(binding__bag=frame.request.count.bag).exists():
        raise LabConflictError("lab_material_dependency")
    requested = str(operation.values["final_attempt_id"])
    candidates = [
        candidate
        for candidate in (frame.request.count, second, third)
        if candidate is not None and str(candidate.pk) == requested
    ]
    if len(candidates) != 1:
        raise LabConflictError("lab_recount_candidate_required")
    choice = lab_void_reason(operation.values, actor.organization.pk)
    selected = candidates[0]
    previous = (
        RecountResolution.objects.filter(request=frame.request)
        .order_by("-qa_revision__revision")
        .first()
    )
    resolution = RecountResolution.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        request=frame.request,
        previous=previous,
        first_result=frame.first_result,
        second=second,
        third=third,
        selected_count=selected if isinstance(selected, EggCountAttempt) else None,
        selected_attempt=selected if isinstance(selected, RecountAttempt) else None,
        policy=second.claim.policy,
        command=command,
        comparison_proof={
            "cause_ids": cause_ids(frame.request),
            "cause_count": len(cause_ids(frame.request)),
            "first": frame.request.count.value,
            "second": second.value,
            "third": None if third is None else third.value,
            "absolute_tolerance": second.claim.policy.absolute_tolerance,
            "relative_per_100": second.claim.policy.relative_per_100,
        },
        reason_code=choice.code,
        reason=choice.reason,
    )
    revision = append_revision(command, frame.request, resolution)
    from lab.history import publish_qa_fact

    publish_qa_fact(resolution)
    return LabOutcome(
        201,
        {
            "resolution": {
                "id": str(resolution.pk),
                "request_id": str(frame.request.pk),
                "final_attempt_id": requested,
                "candidate_kind": "first"
                if isinstance(selected, EggCountAttempt)
                else selected.role,
                "revision": revision.revision,
            },
            "qa_state": "resolved",
        },
    )


def attest_independence(
    actor: UploadActor, command: LabCommand, operation: LabCommandInput
) -> LabOutcome:
    frame = active_frame(actor, operation)
    require_action(actor, frame.request, RECOUNT_ADJUDICATE)
    require_action(actor, frame.request, COUNT_READ)
    identifier = operation.values["counter_id"]
    counter = User.objects.filter(pk=identifier, is_active=True).first()
    if counter is None or counter.pk in {actor.user.pk, frame.request.first_counter_id}:
        raise Http404
    target = UploadActor(counter, actor.organization)
    role = operation.values["role"]
    if not role_authorized(target, frame.request, role):
        raise Http404
    target_exclusion = eligibility_reason(target, frame.request, role)
    if target_exclusion not in (None, "lab_independence_unproven"):
        raise LabConflictError(target_exclusion)
    if (
        role == "third"
        and RecountAttempt.objects.filter(
            request=frame.request, role="second", created_by=counter
        ).exists()
    ):
        raise LabConflictError("lab_recount_distinct_required")
    if LabNumericDisclosure.objects.filter(
        count__bag=frame.request.count.bag, created_by=counter
    ).exists():
        raise LabConflictError("lab_recount_disclosed")
    if hasattr(frame.request.count, "blind_boundary"):
        raise LabConflictError("lab_attestation_not_required")
    if RecountAttempt.objects.filter(request=frame.request, role=role).exists():
        raise LabConflictError("lab_recount_role_completed")
    if RecountIndependenceAttestation.objects.filter(
        request=frame.request, first_result=frame.first_result, counter=counter, role=role
    ).exists():
        raise LabConflictError("lab_independence_already_attested")
    reason = lab_void_reason(operation.values, actor.organization.pk)
    quadrant = frame.request.count.receipt.reading.ovitrap.sampling_point.block.quadrant
    context = {"center_id": str(quadrant.center_id), "quadrant_id": str(quadrant.pk)}
    target_actions = (
        ["recount.create", "recount.adjudicate"] if role == "third" else ["recount.create"]
    )
    attestation = RecountIndependenceAttestation.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        request=frame.request,
        first_result=frame.first_result,
        counter=counter,
        role=role,
        command=command,
        external_reference=operation.values["external_reference"],
        reason_code=reason.code,
        reason=reason.reason,
        authority_proof={
            "actual_context": context,
            "attester_actions": [RECOUNT_ADJUDICATE, COUNT_READ],
            "target_actions": target_actions,
            "attester_id": str(actor.user.pk),
            "counter_id": str(counter.pk),
            "request_id": str(frame.request.pk),
            "first_count_id": str(frame.request.count_id),
            "first_result_id": str(frame.first_result.pk),
            "qa_revision": frame.revision,
            "role": role,
            "cause_ids": cause_ids(frame.request),
            "cause_count": len(cause_ids(frame.request)),
            "declaration_kind": "external_operational_assessment",
        },
    )
    revision = append_revision(command, frame.request, attestation)
    return LabOutcome(
        201,
        {
            "attestation": {
                "id": str(attestation.pk),
                "request_id": str(frame.request.pk),
                "counter_id": str(counter.pk),
                "role": role,
                "revision": revision.revision,
            }
        },
    )
