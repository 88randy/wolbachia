"""Scoped personnel commands and commit-before-disclosure RFC access."""

from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from typing import Any, NoReturn
from uuid import UUID, uuid4

from django.db import DatabaseError, IntegrityError, transaction
from django.views.decorators.debug import sensitive_variables
from rest_framework.exceptions import NotFound

from accounts.models import AccessLog, Device, DeviceSession, Personnel, RevokeReason, User
from accounts.personnel_scope import authorize_membership_scope
from accounts.revocation import Revocation, revoke_active
from accounts.rfc_crypto import RfcEnvelope, decrypt_rfc, encrypt_rfc, rotate_rfc
from core.exceptions import FieldValidationError
from organizations.exceptions import AdministrationBusyError, StaleRevisionError
from organizations.models import Center, Membership, Organization
from organizations.services import deactivate_personnel_membership, effective_scope
from uploads.access import UploadActor, lock_actor


@contextmanager
def personnel_transaction(
    actor: UploadActor, subject_id: UUID | None, *, durable: bool = False
) -> Iterator[None]:
    """Sorted Users -> Devices -> Sessions -> Pair -> Organization -> personnel.

    The target User prevents a login from interleaving with scoped deactivation.
    Organization arbitration is shared with every membership/profile removal.
    External key operations must finish before entering this transaction.
    """
    try:
        with transaction.atomic(durable=durable):
            user_ids = {actor.user.pk} | ({subject_id} if subject_id is not None else set())
            list(
                User.objects.filter(pk__in=user_ids)
                .order_by("pk")
                .select_for_update(nowait=True, no_key=True)
            )
            sessions = DeviceSession.objects.filter(user_id__in=user_ids)
            device_ids = set(sessions.values_list("device_id", flat=True))
            if actor.device_id is not None:
                device_ids.add(actor.device_id)
            list(
                Device.objects.filter(pk__in=device_ids)
                .order_by("pk")
                .select_for_update(nowait=True, no_key=True)
            )
            list(sessions.order_by("pk").select_for_update(nowait=True, no_key=True))
            lock_actor(actor)
            Organization.objects.select_for_update(nowait=True, no_key=True).get(
                pk=actor.organization.pk
            )
            yield
    except DatabaseError as error:
        if getattr(error.__cause__, "sqlstate", None) in {"55P03", "40P01"}:
            raise AdministrationBusyError from error
        raise


def authorize_personnel(  # noqa: PLR0913 -- actor, action and complete paired context
    actor: UploadActor, permission: str, center_id: UUID, quadrant_id: UUID | None
) -> None:
    """Fresh complete paired authority; absent and foreign contexts are opaque."""
    member = (
        Membership.objects.filter(user_id=actor.user.pk, organization=actor.organization)
        .select_related("user", "organization")
        .first()
    )
    if member is None or not effective_scope(member).allows(
        permission, str(center_id), None if quadrant_id is None else str(quadrant_id)
    ):
        raise NotFound


def _context(actor: UploadActor, permission: str, fields: Mapping[str, Any]) -> None:
    center = Center.objects.filter(pk=fields["center_id"], organization=actor.organization).first()
    if center is None:
        raise NotFound
    quadrant_id = fields.get("quadrant_id")
    if quadrant_id is not None:
        from geography.models import Quadrant

        if not Quadrant.objects.filter(
            pk=quadrant_id, organization=actor.organization, center=center
        ).exists():
            raise NotFound
    authorize_personnel(actor, permission, center.pk, quadrant_id)


def _locked_person(actor: UploadActor, user_id: UUID, permission: str) -> Personnel:
    person = (
        Personnel.objects.select_for_update(nowait=True, no_key=True)
        .filter(organization=actor.organization, membership__user_id=user_id)
        .select_related("membership")
        .first()
    )
    if person is None:
        raise NotFound
    authorize_personnel(actor, permission, person.center_id, person.quadrant_id)
    authorize_membership_scope(actor, permission, person.membership)
    return person


def _origin(actor: UploadActor) -> str:
    return (
        AccessLog.Origin.DEVICE
        if actor.session_id
        else AccessLog.Origin.WEB
        if actor.web_session_key
        else AccessLog.Origin.INTERNAL
    )


def _receipt(actor: UploadActor, person: Personnel, action: str) -> None:
    AccessLog.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        target=person,
        center_id=person.center_id,
        quadrant_id=person.quadrant_id,
        action=action,
        origin=_origin(actor),
        revision=person.revision,
    )


def _set_envelope(person: Personnel, envelope: RfcEnvelope) -> None:
    for field in ("ciphertext", "nonce", "wrapped_key", "key_version", "fingerprint"):
        setattr(person, f"rfc_{field}", getattr(envelope, field))


def _envelope(person: Personnel) -> RfcEnvelope:
    return RfcEnvelope(
        ciphertext=bytes(person.rfc_ciphertext),
        nonce=bytes(person.rfc_nonce),
        wrapped_key=bytes(person.rfc_wrapped_key),
        key_version=person.rfc_key_version,
        fingerprint=person.rfc_fingerprint,
    )


def _check_revision(person: Personnel, expected_revision: int) -> None:
    if person.revision != expected_revision:
        raise StaleRevisionError


def _duplicate_code(
    actor: UploadActor, context: Mapping[str, Any], membership: Membership | None
) -> str:
    try:
        _context(actor, "user.reveal_rfc", context)
        if membership is not None:
            authorize_membership_scope(actor, "user.reveal_rfc", membership)
    except NotFound:
        return "rejected"
    return "duplicate"


@sensitive_variables()
def _reject_duplicate_rfc(
    actor: UploadActor, fields: Mapping[str, Any], user_id: UUID | None = None
) -> NoReturn:
    """Commit a safe attempt receipt after the failed write has fully rolled back."""
    with personnel_transaction(actor, user_id, durable=True):
        person = None if user_id is None else _locked_person(actor, user_id, "user.update")
        context = {
            "center_id": fields["center_id"]
            if person is None
            else fields.get("center_id", person.center_id),
            "quadrant_id": fields.get("quadrant_id")
            if person is None
            else fields.get("quadrant_id", person.quadrant_id),
        }
        _context(actor, "user.create" if person is None else "user.update", context)
        membership = None if person is None else person.membership
        if person is None and fields.get("membership_id") is not None:
            membership = Membership.objects.filter(
                pk=fields["membership_id"], organization=actor.organization
            ).first()
            if membership is None:
                raise NotFound
            authorize_membership_scope(actor, "user.create", membership)
        code = _duplicate_code(actor, context, membership)
        AccessLog.objects.create(
            organization=actor.organization,
            created_by=actor.user,
            target=person,
            center_id=context["center_id"] if person is None else person.center_id,
            quadrant_id=context.get("quadrant_id") if person is None else person.quadrant_id,
            action=AccessLog.Action.CREATE if person is None else AccessLog.Action.UPDATE,
            origin=_origin(actor),
            result=AccessLog.Result.RFC_REJECTED,
            revision=1 if person is None else person.revision,
        )
    raise FieldValidationError("rfc", code) from None


@sensitive_variables()
def create_personnel(actor: UploadActor, fields: Mapping[str, Any]) -> Personnel:
    """Create an org-private file for an existing membership or a new unprivileged identity.

    An existing shared identity can only be selected through this organization's
    existing Membership. Creating a login never attaches a foreign username.
    Role/scope delegation stays exclusively in the existing membership API.
    """
    _context(actor, "user.create", fields)
    membership = None
    if fields.get("membership_id") is not None:
        membership = Membership.objects.filter(
            pk=fields["membership_id"], organization=actor.organization
        ).first()
        if membership is None:
            raise NotFound
        authorize_membership_scope(actor, "user.create", membership)
    identifier = uuid4()
    envelope = (
        encrypt_rfc(actor.organization.pk, identifier, fields["rfc"]) if fields.get("rfc") else None
    )
    try:
        with personnel_transaction(actor, None if membership is None else membership.user_id):
            _context(actor, "user.create", fields)
            if membership is not None:
                authorize_membership_scope(actor, "user.create", membership)
            if membership is None:
                if (
                    not fields.get("username")
                    or User.objects.filter(username=fields["username"]).exists()
                ):
                    raise FieldValidationError("username", "unavailable")
                user = User(username=fields["username"])
                user.set_unusable_password()
                user.save()
                membership = Membership.objects.create(
                    organization=actor.organization, user=user, created_by=actor.user
                )
            person = Personnel(
                id=identifier,
                organization=actor.organization,
                membership=membership,
                created_by=actor.user,
                **{
                    name: fields[name]
                    for name in (
                        "display_name",
                        "center_id",
                        "quadrant_id",
                        "work_email",
                        "work_phone",
                    )
                    if name in fields
                },
            )
            if envelope is not None:
                _set_envelope(person, envelope)
            person.save()
            _receipt(actor, person, AccessLog.Action.CREATE)
    except IntegrityError as error:
        constraint = getattr(getattr(error.__cause__, "diag", None), "constraint_name", "")
        if constraint == "personnel_unique_org_rfc":
            _reject_duplicate_rfc(actor, fields)
        if constraint in {"accounts_user_username_key", "accounts_personnel_membership_id_key"}:
            raise FieldValidationError("membership_id", "unavailable") from None
        raise
    return person


@sensitive_variables()
def update_personnel(actor: UploadActor, user_id: UUID, fields: Mapping[str, Any]) -> Personnel:
    """CAS update; encrypt outside locks, then reauthorize old and new contexts."""
    before = Personnel.objects.filter(
        organization=actor.organization, membership__user_id=user_id
    ).first()
    if before is None:
        raise NotFound
    authorize_personnel(actor, "user.update", before.center_id, before.quadrant_id)
    authorize_membership_scope(actor, "user.update", before.membership)
    envelope = (
        encrypt_rfc(actor.organization.pk, before.pk, fields["rfc"]) if "rfc" in fields else None
    )
    try:
        with personnel_transaction(actor, user_id):
            person = _locked_person(actor, user_id, "user.update")
            _check_revision(person, fields["expected_revision"])
            context = {
                "center_id": fields.get("center_id", person.center_id),
                "quadrant_id": fields.get("quadrant_id", person.quadrant_id),
            }
            _context(actor, "user.update", context)
            for name in ("display_name", "work_email", "work_phone", "center_id", "quadrant_id"):
                if name in fields:
                    setattr(person, name, fields[name])
            if envelope is not None:
                _set_envelope(person, envelope)
            person.revision += 1
            person.save()
            _receipt(actor, person, AccessLog.Action.UPDATE)
    except IntegrityError as error:
        if (
            getattr(getattr(error.__cause__, "diag", None), "constraint_name", "")
            == "personnel_unique_org_rfc"
        ):
            _reject_duplicate_rfc(actor, fields, user_id)
        raise
    return person


def deactivate_personnel(actor: UploadActor, user_id: UUID, expected_revision: int) -> Personnel:
    """End only this membership and its sessions, atomically with the last-admin guard."""
    with personnel_transaction(actor, user_id):
        person = _locked_person(actor, user_id, "user.deactivate")
        _check_revision(person, expected_revision)
        person.membership = deactivate_personnel_membership(
            person.membership, actor.user, person.membership.revision
        )
        revoke_active(
            DeviceSession.objects.filter(user_id=user_id, organization=actor.organization),
            Revocation(RevokeReason.MEMBERSHIP_INACTIVE, actor.user),
        )
        # An already-revoked phone must not retain a previously granted final upload.
        DeviceSession.objects.filter(
            user_id=user_id, organization=actor.organization, final_upload_deadline__isnull=False
        ).update(final_upload_deadline=None)
        person.revision += 1
        person.save(update_fields=["revision"])
        _receipt(actor, person, AccessLog.Action.DEACTIVATE)
    return person


def revoke_scoped_personnel_sessions(
    actor: UploadActor, user_id: UUID, allow_final_upload: bool
) -> int:
    """Reauthorize the retained revocation action after account and organization locks."""
    permission = "user.revoke_device_sessions"
    with personnel_transaction(actor, user_id):
        target = Membership.objects.filter(organization=actor.organization, user_id=user_id).first()
        if target is None:
            raise NotFound
        authorize_membership_scope(actor, permission, target)
        person = Personnel.objects.filter(
            membership=target, organization=actor.organization
        ).first()
        if person is not None:
            authorize_personnel(actor, permission, person.center_id, person.quadrant_id)
        return revoke_active(
            DeviceSession.objects.filter(user_id=user_id, organization=actor.organization),
            Revocation(RevokeReason.ADMIN_REVOKE, actor.user, allow_final_upload),
        )


@sensitive_variables()
def reveal_personnel_rfc(actor: UploadActor, user_id: UUID) -> str:
    """No plaintext escapes until its receipt has durably committed with fresh authority."""
    before = Personnel.objects.filter(
        organization=actor.organization, membership__user_id=user_id
    ).first()
    if before is None or not before.rfc_ciphertext:
        raise NotFound
    authorize_personnel(actor, "user.reveal_rfc", before.center_id, before.quadrant_id)
    authorize_membership_scope(actor, "user.reveal_rfc", before.membership)
    plaintext = decrypt_rfc(actor.organization.pk, before.pk, _envelope(before))
    with personnel_transaction(actor, user_id, durable=True):
        person = _locked_person(actor, user_id, "user.reveal_rfc")
        _check_revision(person, before.revision)
        _receipt(actor, person, AccessLog.Action.REVEAL_RFC)
    return plaintext


@sensitive_variables()
def rotate_personnel_rfc(actor: UploadActor, user_id: UUID, expected_revision: int) -> Personnel:
    """Internal maintenance under reveal authority; HMAC key remains stable across rotation."""
    before = Personnel.objects.filter(
        organization=actor.organization, membership__user_id=user_id
    ).first()
    if before is None or not before.rfc_ciphertext:
        raise NotFound
    authorize_personnel(actor, "user.reveal_rfc", before.center_id, before.quadrant_id)
    authorize_membership_scope(actor, "user.reveal_rfc", before.membership)
    _check_revision(before, expected_revision)
    envelope = rotate_rfc(actor.organization.pk, before.pk, _envelope(before))
    with personnel_transaction(actor, user_id):
        person = _locked_person(actor, user_id, "user.reveal_rfc")
        _check_revision(person, expected_revision)
        _set_envelope(person, envelope)
        person.revision += 1
        person.save()
        _receipt(actor, person, AccessLog.Action.ROTATE_RFC)
    return person
