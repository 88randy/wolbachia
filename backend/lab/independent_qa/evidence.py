"""Paddle facts reuse the existing verified-unbound Lab evidence lifecycle."""

from typing import Any, cast
from uuid import UUID

from django.http import Http404

from inventory.allocations.scope import require_contexts
from lab.evidence import verified_rejection_evidence
from lab.models import EggPaddle, LabCommand, PaddleBagBinding, PaddleReuse
from lab.permissions import PADDLE_REUSE
from uploads.access import UploadActor
from uploads.limits import FIELD_UPLOAD
from uploads.models import AttachmentLink, Upload

PADDLE_ACTIONS = frozenset({"paddle_register", "paddle_bind", "paddle_reuse"})


def verified_paddle_evidence(
    actor: UploadActor, identifiers: list[UUID], contexts: list[dict[str, Any]]
) -> tuple[Upload, ...]:
    require_contexts(actor, FIELD_UPLOAD, contexts)
    return verified_rejection_evidence(actor, identifiers)


def bind_paddle_evidence(command: LabCommand, uploads: tuple[Upload, ...]) -> None:
    for upload in uploads:
        AttachmentLink.objects.create(
            organization=command.organization,
            created_by=command.created_by,
            upload=upload,
            lab_paddle_command=command,
        )


def concrete_paddle_fact(command: LabCommand) -> EggPaddle | PaddleBagBinding | PaddleReuse:
    models: dict[str, Any] = {
        "paddle_register": EggPaddle,
        "paddle_bind": PaddleBagBinding,
        "paddle_reuse": PaddleReuse,
    }
    model = models.get(command.action)
    if model is None or not hasattr(command, "result") or command.result.status != 201:
        raise Http404
    fact = model.objects.filter(
        command=command, organization=command.organization, created_by=command.created_by
    ).first()
    if fact is None:
        raise Http404
    return cast(EggPaddle | PaddleBagBinding | PaddleReuse, fact)


def authorize_paddle_attachment(
    actor: UploadActor, identifier: UUID, upload: Upload
) -> dict[str, Any]:
    command = LabCommand.objects.filter(
        organization=actor.organization,
        pk=identifier,
        created_by=actor.user,
        action__in=PADDLE_ACTIONS,
    ).first()
    if (
        command is None
        or upload.uploader_id != actor.user.pk
        or upload.device_id != actor.device_id
    ):
        raise Http404
    fact = concrete_paddle_fact(command)
    if str(
        upload.public_id
    ) not in fact.evidence_ids or fact.evidence_ids != command.canonical_input.get("evidence_ids"):
        raise Http404
    from lab.independent_qa.paddles import fact_contexts

    contexts = fact_contexts(fact)
    require_contexts(actor, PADDLE_REUSE, contexts)
    require_contexts(actor, FIELD_UPLOAD, contexts)
    if isinstance(fact, PaddleReuse):
        require_contexts(actor, "inventory.reconcile", contexts)
    return {"lab_paddle_command": command}


def authorize_paddle_download(actor: UploadActor, identifier: UUID) -> None:
    command = LabCommand.objects.filter(
        organization=actor.organization, pk=identifier, action__in=PADDLE_ACTIONS
    ).first()
    if command is None:
        raise Http404
    from lab.independent_qa.paddles import fact_contexts

    require_contexts(actor, PADDLE_REUSE, fact_contexts(concrete_paddle_fact(command)))
