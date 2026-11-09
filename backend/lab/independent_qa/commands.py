"""Concrete QA action preflight extends the one LabCommand persistence/receipt owner."""

from dataclasses import dataclass, replace
from typing import Any
from uuid import UUID

from django.http import Http404

from lab.access import LabTarget, PreparedLabSubject, prepare_lab_subject, scoped_readings
from lab.commands import LabCommandInput, LabOutcome, execute_prepared_command
from lab.exceptions import LabInProgressError
from lab.independent_qa.selectors import request_for_action
from lab.models import LabBlindObservation, LabCommand, RecountAttempt, RecountResolution
from lab.permissions import COUNT_READ, RECOUNT_ADJUDICATE, RECOUNT_CREATE
from lab.transactions import lab_transaction, require_lab_lock
from organizations.models import Membership
from uploads.access import UploadActor

QA_ACTIONS = frozenset({"recount_claim", "recount", "recount_adjudicate", "recount_attest"})


@dataclass(frozen=True)
class PreparedQACommand:
    request_id: UUID
    subject: PreparedLabSubject
    permissions: tuple[str, ...]


def action_alternatives(action: str) -> tuple[str, ...]:
    if action == "recount_adjudicate":
        return (RECOUNT_CREATE, RECOUNT_ADJUDICATE)
    return (RECOUNT_ADJUDICATE,) if action == "recount_attest" else (RECOUNT_CREATE,)


def prepare_independent_command(actor: UploadActor, command: LabCommandInput) -> PreparedQACommand:
    identifier = (
        UUID(str(command.values["request_id"]))
        if command.action == "recount"
        else command.target.identifier
    )
    alternatives = action_alternatives(command.action)
    request = request_for_action(actor, identifier, alternatives)
    if command.action == "recount" and request.count.bag_id != command.target.identifier:
        raise Http404
    permission = next(
        permission
        for permission in alternatives
        if scoped_readings(actor, permission).filter(pk=request.count.receipt.reading_id).exists()
    )
    subject = prepare_lab_subject(actor, LabTarget("bag", request.count.bag_id), permission)
    permissions: tuple[str, ...] = (permission,)
    if command.action == "recount_attest":
        if not scoped_readings(actor, COUNT_READ).filter(pk=subject.reading_id).exists():
            raise Http404
        permissions = (*permissions, COUNT_READ)
        target = Membership.objects.filter(
            organization=actor.organization,
            user_id=command.values["counter_id"],
            is_active=True,
            user__is_active=True,
        ).first()
        if target is None:
            raise Http404
        subject = replace(subject, author_ids=tuple(sorted({*subject.author_ids, target.user_id})))
    return PreparedQACommand(request.pk, subject, permissions)


def execute_independent_command(actor: UploadActor, command: LabCommandInput) -> LabOutcome:
    prepared = prepare_independent_command(actor, command)
    with lab_transaction(actor, (prepared.subject,)):
        if prepare_independent_command(actor, command) != prepared:
            raise LabInProgressError
        return execute_prepared_command(actor, command, prepared.subject.source_id)


def authorize_alternative_subject(actor: UploadActor, subject: dict[str, Any]) -> None:
    """Each alternative proves the complete real pair; grants never donate separate axes."""
    if not any(
        scoped_readings(actor, permission).filter(pk=subject["reading_id"]).exists()
        for permission in subject["permissions_any"]
    ):
        raise Http404


def command_subjects(
    actor: UploadActor, command: LabCommand, request: LabCommandInput
) -> list[dict[str, Any]]:
    prepared = prepare_independent_command(actor, request)
    reading = str(prepared.subject.reading_id)
    subjects: list[dict[str, Any]] = [
        {"reading_id": reading, "permission": code} for code in prepared.permissions
    ]
    if request.action == "recount_adjudicate":
        resolution = RecountResolution.objects.filter(command=command).first()
        own_second = RecountAttempt.objects.filter(
            request_id=prepared.request_id, role="second", created_by=actor.user
        ).exists()
        subjects = (
            [{"reading_id": reading, "permissions_any": [RECOUNT_CREATE, RECOUNT_ADJUDICATE]}]
            if own_second and (resolution is None or resolution.third_id is None)
            else [{"reading_id": reading, "permission": RECOUNT_ADJUDICATE}]
        )
        if resolution is not None and resolution.third_id is not None:
            subjects.append({"reading_id": reading, "permission": RECOUNT_CREATE})
    if request.action == "recount_attest":
        for code in (
            (RECOUNT_CREATE, RECOUNT_ADJUDICATE)
            if request.values["role"] == "third"
            else (RECOUNT_CREATE,)
        ):
            subjects.append(
                {
                    "reading_id": reading,
                    "permission": code,
                    "user_id": str(request.values["counter_id"]),
                }
            )
    third = (
        request.action == "recount_claim" and request.values.get("role") == "third"
    ) or RecountAttempt.objects.filter(command=command, role="third").exists()
    if third:
        subjects.append({"reading_id": reading, "permission": RECOUNT_ADJUDICATE})
    return subjects


def complete_blind_boundary(command: LabCommand) -> None:
    """Only a NEW count being completed can acquire forward proof, never a cached reply."""
    require_lab_lock(command.organization_id)
    count = getattr(command, "count", None)
    if (
        count is not None
        and command.action == "count"
        and count.ordinal == 1
        and count.replacement_of_id is None
    ):
        LabBlindObservation.objects.create(
            organization=command.organization,
            created_by=command.created_by,
            count=count,
            command=command,
        )


def authorize_saved_subject(actor: UploadActor, subject: dict[str, Any]) -> None:
    """Saved participant authority is fresh, without a new actor/claim/directory lookup."""
    if identifier := subject.get("user_id"):
        member = (
            Membership.objects.filter(
                organization=actor.organization,
                user_id=identifier,
                is_active=True,
                user__is_active=True,
            )
            .select_related("user")
            .first()
        )
        if member is None:
            raise Http404
        actor = UploadActor(member.user, actor.organization)
    if "contexts" in subject:
        from inventory.allocations.scope import require_contexts

        require_contexts(actor, subject["permission"], subject["contexts"])
    elif "permissions_any" in subject:
        authorize_alternative_subject(actor, subject)
    elif (
        not scoped_readings(actor, subject["permission"]).filter(pk=subject["reading_id"]).exists()
    ):
        raise Http404


def publish_command_numbers(actor: UploadActor, command: LabCommand, body: dict[str, Any]) -> None:
    """Inspect the closed saved count slot only; no current queue/candidate is selected."""
    from lab.independent_qa.services import NumericPublication, publish_numeric_access
    from lab.models import EggCountAttempt
    from lab.permissions import COUNT_CREATE, COUNT_VOID

    published = body.get("count")
    if isinstance(published, dict) and "value" in published:
        count = EggCountAttempt.objects.get(organization=actor.organization, pk=published["id"])
        permission = COUNT_CREATE if command.action == "count" else COUNT_VOID
        publish_numeric_access(actor, count, NumericPublication(permission, "replay"))


def dispatch_independent_command(
    actor: UploadActor, command: LabCommand, request: LabCommandInput
) -> LabOutcome:
    from lab.independent_qa.services import (
        adjudicate,
        attest_independence,
        claim_request,
        record_independent,
    )

    handlers = {
        "recount_claim": claim_request,
        "recount": record_independent,
        "recount_adjudicate": adjudicate,
        "recount_attest": attest_independence,
    }
    return handlers[request.action](actor, command, request)


def qa_subject_authors(requests: Any) -> set[UUID]:  # noqa: ANN401 -- concrete related-manager query input
    from lab.models import RecountClaim, RecountIndependenceAttestation, RecountResolution

    identifiers: set[UUID] = set(requests.values_list("first_counter_id", flat=True))
    for model in (RecountClaim, RecountAttempt, RecountIndependenceAttestation, RecountResolution):
        rows = model.objects.filter(request__in=requests)
        identifiers.update(rows.values_list("created_by_id", flat=True))
        if model in (RecountClaim, RecountIndependenceAttestation):
            identifiers.update(rows.values_list("counter_id", flat=True))
    return identifiers
