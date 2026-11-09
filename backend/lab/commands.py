"""Exact immutable command results; an authorized lost reply never selects a new queue item."""

import json
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.http import Http404

from core.snapshots import snapshot_hash
from lab.access import LabTarget, prepare_lab_subject, scoped_readings
from lab.exceptions import LabConflictError
from lab.models import LabCommand, LabCommandResult
from lab.permissions import BAG_RECEIVE, COUNT_CREATE, COUNT_VOID, REJECTION_CREATE
from lab.transactions import lab_transaction
from uploads.access import UploadActor
from uploads.limits import FIELD_UPLOAD

ACTION_PERMISSION = {
    "receive": BAG_RECEIVE,
    "receive_reading": BAG_RECEIVE,
    "missing": BAG_RECEIVE,
    "count": COUNT_CREATE,
    "reject": REJECTION_CREATE,
    "void_count": COUNT_VOID,
    "void_rejection": COUNT_VOID,
}


@dataclass(frozen=True)
class LabCommandInput:
    action: str
    target: LabTarget
    command_id: UUID
    values: dict[str, Any]


@dataclass(frozen=True)
class LabOutcome:
    status: int
    body: dict[str, Any]
    replayed: bool = False


def canonical_values(values: dict[str, Any]) -> dict[str, Any]:
    """Structural serializer output has no live method/catalog/state dependencies."""
    encoded = json.dumps(values, cls=DjangoJSONEncoder, sort_keys=True, ensure_ascii=False)
    return dict(_normalize(json.loads(encoded)))


def canonical_command_input(request: LabCommandInput) -> dict[str, Any]:
    """Pin exact treatment instants without changing released command/response encoding."""
    if request.action != "paddle_reuse":
        return canonical_values(request.values)
    values = dict(request.values)
    for key in ("washed_at", "dried_at"):
        if isinstance(value := values.get(key), datetime):
            instant = value.isoformat(timespec="microseconds")
            values[key] = (
                instant.removesuffix("+00:00") + "Z" if instant.endswith("+00:00") else instant
            )
    return canonical_values(values)


def _normalize(value: Any) -> Any:  # noqa: ANN401 -- recursive validated JSON boundary
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value.replace("\r\n", "\n")).strip()
    if isinstance(value, dict):
        return {key: _normalize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_normalize(item) for item in value]
    return value


def execute_lab_command(actor: UploadActor, request: LabCommandInput) -> LabOutcome:
    from lab.independent_qa.commands import QA_ACTIONS, execute_independent_command
    from lab.independent_qa.evidence import PADDLE_ACTIONS

    if request.action in PADDLE_ACTIONS:
        from lab.independent_qa.paddles import execute_paddle_command

        return execute_paddle_command(actor, request)

    if request.action in QA_ACTIONS:
        return execute_independent_command(actor, request)
    permission = ACTION_PERMISSION[request.action]
    prepared = prepare_lab_subject(actor, request.target, permission)
    with lab_transaction(actor, (prepared,)):
        current = prepare_lab_subject(actor, request.target, permission)
        if current != prepared:
            raise LabConflictError("lab_state_conflict")
        for action in extra_permissions(request):
            if not scoped_readings(actor, action).filter(pk=prepared.reading_id).exists():
                raise Http404
        return execute_prepared_command(actor, request, prepared.source_id)


def execute_prepared_command(
    actor: UploadActor, request: LabCommandInput, source_id: UUID | None
) -> LabOutcome:
    """One persistence/replay kernel, called only inside the owning retained transaction."""
    from lab.transactions import require_lab_lock

    require_lab_lock(actor.organization.pk)
    values = canonical_command_input(request)
    digest = snapshot_hash(
        {"action": request.action, "target": str(request.target.identifier), "values": values}
    )
    if existing := LabCommand.objects.filter(
        organization=actor.organization, command_id=request.command_id
    ).first():
        return replay_command(actor, existing, (request, digest))
    command = LabCommand.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        command_id=request.command_id,
        action=request.action,
        target_id=request.target.identifier,
        input_hash=digest,
        canonical_input=values,
        source_id=source_id,
    )
    return apply_command(actor, command, request)


def replay_command(
    actor: UploadActor, command: LabCommand, expected: tuple[LabCommandInput, str]
) -> LabOutcome:
    request, digest = expected
    if command.created_by_id != actor.user.pk:
        raise Http404
    if (
        command.action != request.action
        or command.target_id != request.target.identifier
        or command.input_hash != digest
    ):
        raise LabConflictError("lab_command_conflict")
    result = command.result
    from lab.independent_qa.commands import authorize_saved_subject, publish_command_numbers

    for subject in result.subjects:
        authorize_saved_subject(actor, subject)
    publish_command_numbers(actor, command, dict(result.body))
    return LabOutcome(result.status, dict(result.body), True)


def apply_command(actor: UploadActor, command: LabCommand, request: LabCommandInput) -> LabOutcome:
    from lab.independent_qa.services import response_publications

    with response_publications(actor):
        try:
            with transaction.atomic():
                outcome = dispatch_command(actor, command, request)
        except LabConflictError as error:
            outcome = LabOutcome(
                409, {"code": error.code, "detail": error.detail, "blocked_by": error.blocked_by}
            )
    from lab.independent_qa.commands import QA_ACTIONS, command_subjects, complete_blind_boundary
    from lab.independent_qa.evidence import PADDLE_ACTIONS

    if request.action in PADDLE_ACTIONS:
        from lab.independent_qa.paddles import paddle_subjects

        subjects = paddle_subjects(actor, request)
    elif request.action in QA_ACTIONS:
        subjects = command_subjects(actor, command, request)
    else:
        reading = str(
            prepare_lab_subject(actor, request.target, ACTION_PERMISSION[request.action]).reading_id
        )
        subjects = [
            {"reading_id": reading, "permission": permission}
            for permission in (ACTION_PERMISSION[request.action], *extra_permissions(request))
        ]
    if next_bag := outcome.body.get("next_bag"):
        subjects.append({"reading_id": str(next_bag["reading_id"]), "permission": COUNT_CREATE})
    if next_recount := outcome.body.get("next_recount"):
        from lab.permissions import RECOUNT_ADJUDICATE, RECOUNT_CREATE

        subjects.append(
            {"reading_id": str(next_recount["reading_id"]), "permission": RECOUNT_CREATE}
        )
        if next_recount["state"] == "awaiting_third":
            subjects.append(
                {"reading_id": str(next_recount["reading_id"]), "permission": RECOUNT_ADJUDICATE}
            )
    body = canonical_values(outcome.body)
    complete_blind_boundary(command)
    from lab.independent_qa.commands import publish_command_numbers

    publish_command_numbers(actor, command, body)
    LabCommandResult.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        command=command,
        status=outcome.status,
        body=body,
        subjects=subjects,
        content_hash=snapshot_hash(body),
    )
    return LabOutcome(outcome.status, body)


def replacement_permissions(values: dict[str, Any]) -> tuple[str, ...]:
    replacement = values.get("replacement")
    if not replacement:
        return ()
    return (
        (COUNT_CREATE, REJECTION_CREATE, FIELD_UPLOAD)
        if replacement.get("kind") == "rejection"
        else (COUNT_CREATE,)
    )


def extra_permissions(request: LabCommandInput) -> tuple[str, ...]:
    return (
        *((FIELD_UPLOAD,) if request.action == "reject" else ()),
        *replacement_permissions(request.values),
    )


def dispatch_command(
    actor: UploadActor, command: LabCommand, request: LabCommandInput
) -> LabOutcome:
    from lab.independent_qa.commands import QA_ACTIONS, dispatch_independent_command
    from lab.independent_qa.evidence import PADDLE_ACTIONS

    if request.action in PADDLE_ACTIONS:
        from lab.independent_qa.paddles import dispatch_paddle_command

        return dispatch_paddle_command(actor, command, request)

    if request.action in QA_ACTIONS:
        return dispatch_independent_command(actor, command, request)
    from lab.corrections import void_result
    from lab.counting import record_count
    from lab.reception import record_reception
    from lab.rejections import record_rejection

    if request.action in {"receive", "receive_reading", "missing"}:
        return record_reception(actor, command, request)
    if request.action == "count":
        return record_count(actor, command, request)
    if request.action == "reject":
        return record_rejection(actor, command, request)
    return void_result(actor, command, request)
