"""Regulatory writes arbitrate accounts, Organization/couriers, Permit, then Upload."""

from math import isfinite
from typing import Any, cast
from uuid import UUID

from django.db import IntegrityError
from django.http import Http404

from core.exceptions import FieldValidationError
from core.time import server_now
from core.void_reason import validate_void_reason, visible_length
from geography.geometry import validate_polygon
from inventory.models import Lot, LotVersion
from people.transactions import people_transaction
from releases.exceptions import ReleaseConflictError
from releases.models import (
    Permit,
    PermitSuspension,
    PermitType,
    PermitVersion,
    ReleaseDevice,
    ReleaseDeviceStatus,
)
from releases.permissions import (
    PERMIT_MANAGE,
    PERMIT_SUSPEND,
    authorized_quadrant,
    require_global,
    require_pair,
)
from releases.selectors import (
    current_device_status,
    device_revision,
    permit_revision,
    scoped_devices,
    scoped_permits,
)
from uploads.access import UploadActor
from uploads.limits import FIELD_UPLOAD
from uploads.models import AttachmentLink, Upload, UploadVerification


def validate_requirements(value: object) -> dict[str, float]:
    """No GPS threshold is invented; each immutable type explicitly supplies it."""
    threshold = value.get("max_gps_accuracy_m") if isinstance(value, dict) else None
    if (
        not isinstance(value, dict)
        or set(value) != {"max_gps_accuracy_m"}
        or isinstance(threshold, bool)
        or not isinstance(threshold, int | float)
    ):
        raise FieldValidationError("requirements", "invalid_requirements")
    try:
        number = float(threshold)
    except OverflowError as error:
        raise FieldValidationError("requirements", "invalid_requirements") from error
    if not isfinite(number) or number <= 0:
        raise FieldValidationError("requirements", "invalid_requirements")
    return {"max_gps_accuracy_m": number}


def normalize_reason(reason: str) -> str:
    cleaned = validate_void_reason(reason, "reason", enforce_minimum=False)
    if visible_length(cleaned) < 10:
        raise FieldValidationError("reason", "void_reason_too_short", {"min_length": 10})
    return cleaned


def create_permit_type(actor: UploadActor, values: dict[str, Any]) -> PermitType:
    require_global(actor)
    requirements = validate_requirements(values["requirements"])
    try:
        with people_transaction(actor):
            require_global(actor)
            return PermitType.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                code=values["code"],
                name=values["name"],
                requirements=requirements,
            )
    except IntegrityError as error:
        if (
            getattr(getattr(error.__cause__, "diag", None), "constraint_name", None)
            == "releases_type_code"
        ):
            raise ReleaseConflictError("permit_type_code_conflict") from error
        raise


DOCUMENT_CONTENT_TYPES = frozenset({"application/pdf"})


def _official_document(actor: UploadActor, values: dict[str, Any]) -> UploadVerification:
    uploads = Upload.objects.filter(
        organization=actor.organization,
        public_id=values["official_document_id"],
        uploader=actor.user,
    )
    uploads = (
        uploads.filter(device__isnull=True)
        if actor.device_id is None
        else uploads.filter(device_id=actor.device_id)
    )
    upload = uploads.select_for_update(nowait=True, no_key=True).first()
    if upload is None:
        raise Http404
    verification = UploadVerification.objects.filter(
        organization=actor.organization,
        upload=upload,
        source__upload=upload,
        source__organization=actor.organization,
    ).first()
    if verification is None or AttachmentLink.objects.filter(upload=upload).exists():
        raise ReleaseConflictError("permit_document_not_ready")
    if verification.content_type not in DOCUMENT_CONTENT_TYPES:
        raise FieldValidationError("official_document_id", "permit.document_type_invalid")
    if PermitVersion.objects.filter(official_document=verification).exists():
        raise ReleaseConflictError("permit_document_already_bound")
    return cast(UploadVerification, verification)


def _append_version(actor: UploadActor, permit: Permit, values: dict[str, Any]) -> PermitVersion:
    kind = PermitType.objects.filter(organization=actor.organization, pk=values["type_id"]).first()
    if kind is None:
        raise Http404
    require_pair(actor, FIELD_UPLOAD, permit.quadrant)
    if values["valid_to"] <= values["valid_from"]:
        raise FieldValidationError("valid_to", "invalid_interval")
    return PermitVersion.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        permit=permit,
        revision=permit_revision(permit) + 1,
        type=kind,
        number=values["number"],
        authority=values["authority"],
        official_document=_official_document(actor, values),
        document_attestation=normalize_reason(values["document_attestation"]),
        geometry=validate_polygon(values["geometry"]),
        valid_from=values["valid_from"],
        valid_to=values["valid_to"],
    )


def create_permit(actor: UploadActor, values: dict[str, Any]) -> Permit:
    authorized_quadrant(actor, values["quadrant_id"], PERMIT_MANAGE)
    try:
        with people_transaction(actor):
            quadrant = authorized_quadrant(actor, values["quadrant_id"], PERMIT_MANAGE)
            permit = Permit.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                code=values["code"],
                quadrant=quadrant,
                center_id=quadrant.center_id,
            )
            _append_version(actor, permit, values)
            from releases.producers import publish_permit

            publish_permit(permit)
            return permit
    except IntegrityError as error:
        if (
            getattr(getattr(error.__cause__, "diag", None), "constraint_name", None)
            == "releases_permit_code"
        ):
            raise ReleaseConflictError("permit_code_conflict") from error
        raise


def _locked_permit(actor: UploadActor, identifier: UUID, permission: str) -> Permit:
    permit = (
        scoped_permits(actor, permission)
        .filter(pk=identifier)
        .select_for_update(nowait=True, no_key=True, of=("self",))
        .first()
    )
    if permit is None:
        raise Http404
    require_pair(actor, permission, permit.quadrant)
    return cast(Permit, permit)


def append_permit_version(
    actor: UploadActor, identifier: UUID, values: dict[str, Any]
) -> PermitVersion:
    if not scoped_permits(actor).filter(pk=identifier).exists():
        raise Http404
    with people_transaction(actor):
        permit = _locked_permit(actor, identifier, PERMIT_MANAGE)
        if values["expected_revision"] != permit_revision(permit):
            raise ReleaseConflictError("permit_revision_conflict")
        if PermitSuspension.objects.filter(permit=permit).exists():
            raise ReleaseConflictError("permit_suspended")
        version = _append_version(actor, permit, values)
        from releases.producers import publish_permit

        publish_permit(permit)
        return version


def suspend_permit(
    actor: UploadActor, identifier: UUID, values: dict[str, Any]
) -> PermitSuspension:
    if not scoped_permits(actor, PERMIT_SUSPEND).filter(pk=identifier).exists():
        raise Http404
    reason = normalize_reason(values["reason"])
    with people_transaction(actor):
        permit = _locked_permit(actor, identifier, PERMIT_SUSPEND)
        revision = permit_revision(permit)
        if values["expected_revision"] != revision:
            raise ReleaseConflictError("permit_revision_conflict")
        if PermitSuspension.objects.filter(permit=permit).exists():
            raise ReleaseConflictError("permit_suspended")
        suspension = PermitSuspension.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            permit=permit,
            revision=revision + 1,
            reason=reason,
            effective_from=server_now(),
        )
        from releases.producers import publish_permit

        publish_permit(permit)
        return suspension


def create_release_device(actor: UploadActor, values: dict[str, Any]) -> ReleaseDevice:
    authorized_quadrant(actor, values["quadrant_id"], PERMIT_MANAGE)
    try:
        with people_transaction(actor):
            quadrant = authorized_quadrant(actor, values["quadrant_id"], PERMIT_MANAGE)
            lot = (
                Lot.objects.filter(
                    organization=actor.organization,
                    pk=values["source_lot_id"],
                    center_id=quadrant.center_id,
                    quadrant=quadrant,
                )
                .select_for_update(nowait=True, no_key=True)
                .first()
            )
            if lot is None:
                raise Http404
            version = (
                LotVersion.objects.filter(organization=actor.organization, lot=lot)
                .select_related("supply_version")
                .order_by("-revision")
                .first()
            )
            if version is None or not version.supply_version.is_biological:
                raise ReleaseConflictError("release_source_lot_invalid")
            return ReleaseDevice.objects.create(
                organization=actor.organization,
                created_by=actor.user,
                code=values["code"],
                center_id=quadrant.center_id,
                quadrant=quadrant,
                source_lot=lot,
                source_lot_version=version,
            )
    except IntegrityError as error:
        if (
            getattr(getattr(error.__cause__, "diag", None), "constraint_name", None)
            == "releases_device_code"
        ):
            raise ReleaseConflictError("release_device_code_conflict") from error
        raise


def change_release_device_status(
    actor: UploadActor, identifier: UUID, values: dict[str, Any]
) -> ReleaseDeviceStatus:
    if not scoped_devices(actor, PERMIT_MANAGE).filter(pk=identifier).exists():
        raise Http404
    reason = normalize_reason(values["reason"])
    with people_transaction(actor):
        device = (
            scoped_devices(actor, PERMIT_MANAGE)
            .filter(pk=identifier)
            .select_for_update(nowait=True, no_key=True, of=("self",))
            .first()
        )
        if device is None:
            raise Http404
        revision = device_revision(device)
        if values["expected_revision"] != revision:
            raise ReleaseConflictError("release_device_revision_conflict")
        if current_device_status(device) == "retired":
            raise ReleaseConflictError("release_device_retired")
        return ReleaseDeviceStatus.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            device=device,
            revision=revision + 1,
            status=values["status"],
            reason=reason,
        )
