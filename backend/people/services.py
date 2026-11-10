"""Exact commands append real facts under one prepared account/Organization boundary."""

from dataclasses import dataclass
from datetime import timedelta
from typing import Any, cast
from uuid import UUID

from django.http import Http404

from core.exceptions import FieldValidationError
from core.snapshots import snapshot_hash
from core.time import server_now
from core.void_reason import resolve_void_reason, validate_void_reason, visible_length
from organizations.models import Membership
from organizations.services import effective_scope
from people.exceptions import PeopleConflictError
from people.models import (
    ActionTrainingRequirementVersion,
    Certification,
    CertificationRevocation,
    Evaluation,
    EvaluationAttempt,
    EvaluationCompletion,
    EvaluationNoticePolicyVersion,
    EvaluationRubric,
    EvaluationRubricVersion,
    EvaluationVoid,
    PeopleCommand,
    Training,
    TrainingNoticeCause,
    TrainingVersion,
)
from people.permissions import (
    EVALUATION_CREATE,
    EVALUATION_READ,
    TRAINING_MANAGE,
    PeopleContext,
    active_subject,
    allows_contexts,
    real_context,
    require_contexts,
    require_global,
)
from people.policy import RubricPolicy, ValidityWindow, score_evaluation
from people.selectors import (
    active_completions,
    certificate_context,
    certification_revision,
    completion_sequence,
    current_attempt,
)
from people.transactions import people_transaction
from uploads.access import UploadActor


@dataclass(frozen=True)
class PeopleWrite:
    actor: UploadActor
    command_id: UUID
    operation: str
    values: dict[str, Any]
    original_body: dict[str, Any]
    target_id: UUID | None = None


def _context(command: PeopleWrite) -> PeopleContext:
    return real_context(
        command.actor, command.values["center_id"], command.values.get("quadrant_id")
    )


def _revision(expected: int, actual: int) -> None:
    if expected != actual:
        raise PeopleConflictError("stale_revision")


def _body_hash(command: PeopleWrite) -> str:
    return snapshot_hash(
        {
            "operation": command.operation,
            "target": None if command.target_id is None else str(command.target_id),
            "subject": None
            if command.values.get("subject_id") is None
            else str(command.values["subject_id"]),
            "action": command.values.get("action"),
            "body": command.original_body,
        }
    )


def _saved_command(command: PeopleWrite) -> PeopleCommand | None:
    row = PeopleCommand.objects.filter(
        organization=command.actor.organization, command_id=command.command_id
    ).first()
    if row is not None and row.created_by_id != command.actor.user.pk:
        raise Http404
    return row


def _replay(command: PeopleWrite, saved: PeopleCommand) -> dict[str, Any]:
    for permission in {row["permission"] for row in saved.subjects}:
        rows = [row for row in saved.subjects if row["permission"] == permission]
        if rows[0].get("global"):
            require_global(command.actor, permission)
        else:
            require_contexts(
                command.actor,
                permission,
                tuple(
                    PeopleContext(
                        UUID(row["center_id"]),
                        None if row["quadrant_id"] is None else UUID(row["quadrant_id"]),
                    )
                    for row in rows
                ),
            )
    if (
        saved.operation != command.operation
        or saved.target_id != command.target_id
        or saved.body_hash != _body_hash(command)
    ):
        raise PeopleConflictError("command_id_conflict")
    return cast(dict[str, Any], saved.response)


def _target(command: PeopleWrite, model: Any) -> Any:  # noqa: ANN401 -- closed domain model dispatcher
    row = model.objects.filter(
        organization=command.actor.organization, pk=command.target_id
    ).first()
    if row is None:
        raise Http404
    return row


def _authority(command: PeopleWrite) -> list[dict[str, Any]]:
    permissions: tuple[str, ...]
    if command.operation in {
        "training.create",
        "training.version",
        "rubric.create",
        "rubric.version",
    }:
        require_global(command.actor)
        return [{"permission": TRAINING_MANAGE, "global": True}]
    if command.operation in {"evaluation.revise", "evaluation.void"}:
        row = _target(command, Evaluation)
        context = PeopleContext(row.center_id, row.quadrant_id)
        permissions = (EVALUATION_CREATE, EVALUATION_READ)
    elif command.operation == "certification.revoke":
        context = certificate_context(_target(command, Certification))
        permissions = (TRAINING_MANAGE,)
    else:
        context = _context(command)
        permissions = (
            (EVALUATION_CREATE,) if command.operation == "evaluation.create" else (TRAINING_MANAGE,)
        )
        if command.operation == "notice_policy.version":
            permissions = (TRAINING_MANAGE, EVALUATION_READ)
    contexts = {context}
    if command.operation == "notice_policy.version":
        from people.notices import notice_contexts

        for cause in _reroute_causes(command):
            contexts.update(notice_contexts(cause))
    vector = tuple(
        sorted(contexts, key=lambda value: (str(value.center_id), str(value.quadrant_id)))
    )
    for permission in permissions:
        require_contexts(command.actor, permission, vector)
    return [
        {"permission": permission, **item.payload()}
        for permission in permissions
        for item in vector
    ]


def _reroute_causes(command: PeopleWrite) -> list[TrainingNoticeCause]:
    identifiers = command.values.get("reroute_cause_ids", [])
    rows = list(
        TrainingNoticeCause.objects.filter(
            organization=command.actor.organization, pk__in=identifiers, kind="third_adverse"
        )
    )
    if len(rows) != len(identifiers):
        raise Http404
    return rows


def _reroute_users(command: PeopleWrite) -> set[UUID]:
    from people.notices import _current_route, notice_contexts, notice_participants

    users: set[UUID] = set()
    for cause in _reroute_causes(command):
        users.update(notice_participants(cause))
        route = _current_route(command.actor.organization, notice_contexts(cause))
        if route.recipient is not None:
            users.add(route.recipient.user_id)
    return users


def _participants(command: PeopleWrite) -> tuple[UUID, ...]:
    identifiers = {command.actor.user.pk, *_reroute_users(command)}
    if subject := command.values.get("subject_id"):
        identifiers.add(subject)
    if command.operation in {"evaluation.revise", "evaluation.void"}:
        target = _target(command, Evaluation)
        identifiers.update((target.subject_id, target.created_by_id))
        identifiers.update(target.attempts.values_list("created_by_id", flat=True))
    if command.operation == "certification.revoke":
        target = _target(command, Certification)
        identifiers.update((target.subject_id, target.created_by_id))
    # Discover only the episode's actual policy vectors, not an organization HR roster.
    if command.operation.startswith("evaluation."):
        subject_id = command.values.get("subject_id") or _target(command, Evaluation).subject_id
        completions = list(active_completions(command.actor.organization.pk, subject_id))
        identifiers.update(
            row.created_by_id for row in completions if row.created_by_id is not None
        )
        identifiers.update(
            row.attempt.evaluation.created_by_id
            for row in completions
            if row.attempt.evaluation.created_by_id is not None
        )
        contexts = {
            PeopleContext(row.attempt.evaluation.center_id, row.attempt.evaluation.quadrant_id)
            for row in completions
        }
        contexts.add(
            _context(command)
            if command.operation == "evaluation.create"
            else PeopleContext(target.center_id, target.quadrant_id)
        )
        for context in contexts:
            policy = (
                EvaluationNoticePolicyVersion.objects.filter(
                    organization=command.actor.organization,
                    **context.lookups(),
                )
                .order_by("-revision")
                .select_related("recipient_membership")
                .first()
            )
            if policy is not None:
                identifiers.add(policy.recipient_membership.user_id)
    if recipient := command.values.get("recipient_membership_id"):
        member = Membership.objects.filter(
            organization=command.actor.organization, pk=recipient
        ).first()
        if member is None:
            raise Http404
        identifiers.add(member.user_id)
    identifiers.discard(None)
    return tuple(sorted(identifiers))


def write_people(command: PeopleWrite) -> dict[str, Any]:
    if command.operation not in _WRITERS:
        raise FieldValidationError("operation", "invalid_choice")
    saved = _saved_command(command)
    if saved is not None:
        with people_transaction(command.actor):
            return _replay(command, saved)
    _authority(command)
    participants = _participants(command)
    with people_transaction(command.actor, participants):
        subjects = _authority(command)
        if not set(_participants(command)).issubset(participants):
            from field_sync.exceptions import SyncInProgressError

            raise SyncInProgressError
        if saved := _saved_command(command):
            return _replay(command, saved)
        result = _WRITERS[command.operation](command)
        response = {"command_id": str(command.command_id), **result}
        PeopleCommand.objects.create(
            organization=command.actor.organization,
            created_by=command.actor.user,
            command_id=command.command_id,
            operation=command.operation,
            target_id=command.target_id,
            body_hash=_body_hash(command),
            response=response,
            subjects=subjects,
        )
        from people.projections import publish_changed_eligibility

        if command.operation in {
            "training.version",
            "requirement.version",
            "certification.issue",
            "certification.revoke",
        }:
            publish_changed_eligibility(command.actor.organization)
        return response


def _receipt(row: Any, revision: int, evaluation: dict[str, Any] | None = None) -> dict[str, Any]:  # noqa: ANN401 -- our immutable row, never an arbitrary serialized object
    return {
        "id": str(row.pk),
        "revision": revision,
        "recorded_at": row.created_at.isoformat(),
        "evaluation": evaluation,
    }


def _training_create(command: PeopleWrite) -> dict[str, Any]:
    _revision(command.values["expected_revision"], 0)
    if Training.objects.filter(
        organization=command.actor.organization, code=command.values["code"]
    ).exists():
        raise PeopleConflictError("code_already_used")
    row = Training.objects.create(
        organization=command.actor.organization,
        created_by=command.actor.user,
        code=command.values["code"],
        name=command.values["name"],
    )
    return _receipt(row, 0)


def _training_version(command: PeopleWrite) -> dict[str, Any]:
    training = _target(command, Training)
    current = training.versions.order_by("-version").first()
    revision = 0 if current is None else current.version
    _revision(command.values["expected_revision"], revision)
    row = TrainingVersion.objects.create(
        organization=command.actor.organization,
        created_by=command.actor.user,
        training=training,
        version=revision + 1,
        validity_seconds=command.values["validity_seconds"],
        enabled_actions=command.values["enabled_actions"],
        effective_from=command.values["effective_from"],
        is_active=command.values["is_active"],
    )
    return _receipt(row, row.version)


def _requirement_version(command: PeopleWrite) -> dict[str, Any]:
    context = _context(command)
    expected = {
        str(key): [str(identifier) for identifier in identifiers]
        for key, identifiers in command.values["acceptable_versions"].items()
    }
    for training_id, identifiers in expected.items():
        versions = TrainingVersion.objects.filter(
            organization=command.actor.organization, training_id=training_id, pk__in=identifiers
        )
        if versions.count() != len(identifiers) or any(
            command.values["action"] not in row.enabled_actions or not row.is_active
            for row in versions
        ):
            raise FieldValidationError("acceptable_versions", "invalid_training_version")
    previous = (
        ActionTrainingRequirementVersion.objects.filter(
            organization=command.actor.organization,
            action=command.values["action"],
            **context.lookups(),
        )
        .order_by("-revision")
        .first()
    )
    revision = 0 if previous is None else previous.revision
    _revision(command.values["expected_revision"], revision)
    row = ActionTrainingRequirementVersion.objects.create(
        organization=command.actor.organization,
        created_by=command.actor.user,
        action=command.values["action"],
        center_id=context.center_id,
        quadrant_id=context.quadrant_id,
        revision=revision + 1,
        effective_from=command.values["effective_from"],
        acceptable_versions=expected,
    )
    return _receipt(row, row.revision)


def _certification_issue(command: PeopleWrite) -> dict[str, Any]:
    from people.evidence import bind_certification_evidence, verified_certification_evidence

    context = _context(command)
    subject = active_subject(command.actor, command.values["subject_id"], context)
    version = TrainingVersion.objects.filter(
        organization=command.actor.organization, pk=command.values["training_version_id"]
    ).first()
    if version is None:
        raise Http404
    _revision(command.values["expected_revision"], 0)
    if not version.is_active:
        raise PeopleConflictError("training_configuration_unavailable")
    try:
        ValidityWindow(
            command.values["valid_from"],
            command.values["valid_to"],
            timedelta(seconds=version.validity_seconds),
        )
    except (ValueError, OverflowError) as error:
        raise FieldValidationError("valid_to", "invalid_validity") from error
    uploads = verified_certification_evidence(
        command.actor, context, command.values["evidence_ids"]
    )
    row = Certification.objects.create(
        organization=command.actor.organization,
        created_by=command.actor.user,
        subject=subject.user,
        training_version=version,
        center_id=context.center_id,
        quadrant_id=context.quadrant_id,
        valid_from=command.values["valid_from"],
        valid_to=command.values["valid_to"],
        evidence_ids=[str(value) for value in command.values["evidence_ids"]],
        issuer_reference=command.values["issuer_reference"],
        attestation=command.values["attestation"],
    )
    bind_certification_evidence(row, uploads)
    return _receipt(row, 1)


def _reason(command: PeopleWrite) -> tuple[str, str]:
    resolved = resolve_void_reason(
        command.actor.organization.pk, command.values["reason"], command.values["reason_code"]
    )
    reason = validate_void_reason(resolved.reason, "reason")
    if visible_length(reason) < 10:
        raise FieldValidationError("reason", "void_reason_too_short", {"min_length": 10})
    return resolved.code, reason


def _certification_revoke(command: PeopleWrite) -> dict[str, Any]:
    certificate = _target(command, Certification)
    revision = certification_revision(certificate)
    _revision(command.values["expected_revision"], revision)
    code, reason = _reason(command)
    row = CertificationRevocation.objects.create(
        organization=command.actor.organization,
        created_by=command.actor.user,
        certification=certificate,
        revision=revision + 1,
        effective_from=command.values["effective_from"],
        reason_code=code,
        reason=reason,
    )
    return _receipt(row, row.revision)


def _rubric_create(command: PeopleWrite) -> dict[str, Any]:
    _revision(command.values["expected_revision"], 0)
    if EvaluationRubric.objects.filter(
        organization=command.actor.organization, code=command.values["code"]
    ).exists():
        raise PeopleConflictError("code_already_used")
    row = EvaluationRubric.objects.create(
        organization=command.actor.organization,
        created_by=command.actor.user,
        code=command.values["code"],
        name=command.values["name"],
    )
    return _receipt(row, 0)


def _rubric_version(command: PeopleWrite) -> dict[str, Any]:
    rubric = _target(command, EvaluationRubric)
    previous = rubric.versions.order_by("-version").first()
    revision = 0 if previous is None else previous.version
    _revision(command.values["expected_revision"], revision)
    RubricPolicy(
        command.values["weights"],
        command.values["pass_threshold"],
        tuple(command.values["critical_checks"]),
    )
    row = EvaluationRubricVersion.objects.create(
        organization=command.actor.organization,
        created_by=command.actor.user,
        rubric=rubric,
        version=revision + 1,
        weights=command.values["weights"],
        pass_threshold=command.values["pass_threshold"],
        critical_checks=command.values["critical_checks"],
        effective_from=command.values["effective_from"],
    )
    return _receipt(row, row.version)


def _observations(command: PeopleWrite, version: EvaluationRubricVersion) -> Any:  # noqa: ANN401 -- immutable score dataclass
    if set(command.values["critical_responses"]) - set(version.critical_checks):
        raise FieldValidationError("critical_responses", "unknown_check")
    policy = RubricPolicy(version.weights, version.pass_threshold, tuple(version.critical_checks))
    return score_evaluation(
        policy, command.values["section_scores"], command.values["critical_responses"]
    )


def _append_attempt(
    command: PeopleWrite, evaluation: Evaluation, predecessor: EvaluationAttempt | None
) -> dict[str, Any]:
    from people.notices import reassess_notices

    score = _observations(command, evaluation.rubric_version)
    revision = 1 if predecessor is None else predecessor.revision + 1
    code, reason = ("", "") if predecessor is None else _reason(command)
    attempt = EvaluationAttempt.objects.create(
        organization=command.actor.organization,
        created_by=command.actor.user,
        evaluation=evaluation,
        predecessor=predecessor,
        revision=revision,
        observed_at=command.values["observed_at"],
        section_scores={
            key: None if value is None else str(value)
            for key, value in command.values["section_scores"].items()
        },
        critical_responses=command.values["critical_responses"],
        score=score.total,
        outcome=score.outcome,
        reason_code=code,
        reason=reason,
    )
    sequence = None
    if score.outcome != "incomplete":
        sequence = completion_sequence(command.actor.organization.pk, evaluation.subject_id) + 1
        EvaluationCompletion.objects.create(
            organization=command.actor.organization,
            created_by=command.actor.user,
            subject_id=evaluation.subject_id,
            sequence=sequence,
            attempt=attempt,
        )
    reassess_notices(command.actor.organization, evaluation.subject_id)
    return _receipt(
        evaluation,
        revision,
        {
            "attempt_id": str(attempt.pk),
            "rubric_version_id": str(evaluation.rubric_version_id),
            "outcome": score.outcome,
            "score": None if score.total is None else str(score.total),
            "completion_sequence": sequence,
        },
    )


def _evaluation_create(command: PeopleWrite) -> dict[str, Any]:
    context = _context(command)
    subject = active_subject(command.actor, command.values["subject_id"], context)
    _revision(command.values["expected_revision"], 0)
    version = EvaluationRubricVersion.objects.filter(
        organization=command.actor.organization, pk=command.values["rubric_version_id"]
    ).first()
    if version is None:
        raise Http404
    if version.effective_from > server_now():
        raise PeopleConflictError("rubric_not_effective")
    row = Evaluation.objects.create(
        organization=command.actor.organization,
        created_by=command.actor.user,
        subject=subject.user,
        rubric_version=version,
        center_id=context.center_id,
        quadrant_id=context.quadrant_id,
    )
    return _append_attempt(command, row, None)


def _current_evaluation(command: PeopleWrite) -> tuple[Evaluation, EvaluationAttempt]:
    row = _target(command, Evaluation)
    previous = current_attempt(row)
    if EvaluationVoid.objects.filter(evaluation=row).exists():
        raise PeopleConflictError("already_voided")
    _revision(command.values["expected_revision"], previous.revision)
    if command.values["expected_completion_sequence"] != completion_sequence(
        command.actor.organization.pk, row.subject_id
    ):
        raise PeopleConflictError("stale_completion_sequence")
    return row, previous


def _evaluation_revise(command: PeopleWrite) -> dict[str, Any]:
    row, previous = _current_evaluation(command)
    return _append_attempt(command, row, previous)


def _evaluation_void(command: PeopleWrite) -> dict[str, Any]:
    from people.notices import reassess_notices

    row, previous = _current_evaluation(command)
    code, reason = _reason(command)
    void = EvaluationVoid.objects.create(
        organization=command.actor.organization,
        created_by=command.actor.user,
        evaluation=row,
        attempt=previous,
        revision=previous.revision + 1,
        reason_code=code,
        reason=reason,
    )
    reassess_notices(command.actor.organization, row.subject_id)
    return _receipt(void, void.revision)


def _notice_policy_version(command: PeopleWrite) -> dict[str, Any]:
    from people.notices import NoticeReroute, reroute_pending

    context = _context(command)
    recipient = Membership.objects.filter(
        organization=command.actor.organization,
        pk=command.values["recipient_membership_id"],
        is_active=True,
        user__is_active=True,
    ).first()
    if recipient is None or not allows_contexts(
        effective_scope(recipient), EVALUATION_READ, (context,)
    ):
        raise Http404
    previous = (
        EvaluationNoticePolicyVersion.objects.filter(
            organization=command.actor.organization,
            **context.lookups(),
        )
        .order_by("-revision")
        .first()
    )
    revision = 0 if previous is None else previous.revision
    _revision(command.values["expected_revision"], revision)
    row = EvaluationNoticePolicyVersion.objects.create(
        organization=command.actor.organization,
        created_by=command.actor.user,
        center_id=context.center_id,
        quadrant_id=context.quadrant_id,
        recipient_membership=recipient,
        revision=revision + 1,
    )
    causes = tuple(command.values.get("reroute_cause_ids", []))
    reroute_pending(NoticeReroute(command.actor, command.command_id, causes), row)
    return {**_receipt(row, row.revision), "rerouted_cause_ids": [str(value) for value in causes]}


_WRITERS = {
    "training.create": _training_create,
    "training.version": _training_version,
    "requirement.version": _requirement_version,
    "certification.issue": _certification_issue,
    "certification.revoke": _certification_revoke,
    "rubric.create": _rubric_create,
    "rubric.version": _rubric_version,
    "evaluation.create": _evaluation_create,
    "evaluation.revise": _evaluation_revise,
    "evaluation.void": _evaluation_void,
    "notice_policy.version": _notice_policy_version,
}
