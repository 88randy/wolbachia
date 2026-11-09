"""Named configuration and independent retained verification facts, never seeded science."""

from typing import Any
from uuid import UUID

from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied

from core.snapshots import snapshot_hash
from core.time import server_now
from lab.exceptions import LabConflictError
from lab.models import LabMethod, LabMethodVerification, LabMethodVersion
from lab.permissions import METHOD_MANAGE, METHOD_VERIFY
from lab.transactions import lab_transaction, require_lab_lock
from uploads.access import UploadActor, current_scope


def configured_method(
    organization_id: UUID, identifier: UUID, capability: str
) -> tuple[LabMethodVersion, LabMethodVerification]:
    require_lab_lock(organization_id)
    version = (
        LabMethodVersion.objects.filter(organization_id=organization_id, pk=identifier)
        .select_for_update(nowait=True, no_key=True)
        .first()
    )
    if version is None:
        raise Http404
    current = (
        LabMethodVersion.objects.filter(method=version.method, effective_from__lte=server_now())
        .order_by("-effective_from", "-revision")
        .first()
    )
    verification = version.verifications.first()
    if (
        current is None
        or current.pk != version.pk
        or not version.procedure.strip()
        or not version.reference.strip()
        or verification is None
        or verification.decision != "verify"
        or verification.content_hash != version.content_hash
        or not getattr(version, "supports_" + capability, False)
    ):
        raise LabConflictError("lab_method_unverified")
    return version, verification


def method_pin(version: LabMethodVersion | None) -> dict[str, Any] | None:
    """An authorized measured result retains its exact named procedure, never latest config."""
    if version is None:
        return None
    return {
        "id": str(version.pk),
        "method_id": str(version.method_id),
        "revision": version.revision,
        "name": version.name,
        "procedure": version.procedure,
        "reference": version.reference,
        "effective_from": version.effective_from.isoformat(),
        "content_hash": version.content_hash,
    }


def write_method(
    actor: UploadActor, values: dict[str, Any], method_id: UUID | None = None
) -> LabMethodVersion:
    with lab_transaction(actor):
        if not current_scope(actor).allows(METHOD_MANAGE):
            raise PermissionDenied
        if method_id is None:
            if values.get("expected_revision", 0) != 0:
                raise LabConflictError("lab_state_conflict", 0)
            if LabMethod.objects.filter(
                organization=actor.organization, code=values["code"]
            ).exists():
                raise LabConflictError("lab_method_code_reserved")
            method = LabMethod.objects.create(
                organization=actor.organization, created_by=actor.user, code=values["code"]
            )
        else:
            method = get_object_or_404(
                LabMethod.objects.filter(organization=actor.organization), pk=method_id
            )
        previous = method.versions.first()
        revision = 0 if previous is None else previous.revision
        if values.get("expected_revision", 0) != revision:
            raise LabConflictError("lab_state_conflict", revision)
        fields = {
            key: values[key]
            for key in (
                "name",
                "procedure",
                "reference",
                "effective_from",
                "supports_viability",
                "supports_rejection",
            )
        }
        fields.update(
            supports_independent_qa=values.get("supports_independent_qa", False),
            supports_paddle_reuse=values.get("supports_paddle_reuse", False),
        )
        proof = {**fields, "effective_from": fields["effective_from"].isoformat()}
        return LabMethodVersion.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            method=method,
            revision=revision + 1,
            content_hash=snapshot_hash(proof),
            **fields,
        )


def decide_method(
    actor: UploadActor, version_id: UUID, values: dict[str, Any]
) -> LabMethodVerification:
    with lab_transaction(actor):
        if not current_scope(actor).allows(METHOD_VERIFY):
            raise PermissionDenied
        version = LabMethodVersion.objects.filter(
            organization=actor.organization, pk=version_id
        ).first()
        if version is None:
            raise Http404
        previous = version.verifications.first()
        revision = 0 if previous is None else previous.revision
        if values["expected_revision"] != revision:
            raise LabConflictError("lab_state_conflict", revision)
        if values["decision"] == "verify" and (
            not version.procedure.strip() or not version.reference.strip()
        ):
            raise LabConflictError("lab_method_unverified")
        return LabMethodVerification.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            method_version=version,
            revision=revision + 1,
            decision=values["decision"],
            reference=values["reference"],
            content_hash=version.content_hash,
        )
