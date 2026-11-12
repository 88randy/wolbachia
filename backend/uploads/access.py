"""Fresh identity before short upload commits; never called beneath a domain lock."""

import hmac
from dataclasses import dataclass, field
from typing import cast
from uuid import UUID

from django.contrib.sessions.models import Session
from rest_framework.authentication import get_authorization_header
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from accounts.exceptions import InvalidTokenError, SessionRevokedError, TokenExpiredError
from accounts.models import Device, DeviceSession, TokenPair, User
from accounts.token_pairs import is_access_superseded, is_retired_sibling
from accounts.tokens import hash_token
from core.time import server_now
from field_sync.selectors import captured_scope, membership_snapshots
from organizations.models import Organization
from organizations.scope import EffectiveScope
from uploads.limits import FIELD_UPLOAD


@dataclass(frozen=True)
class UploadActor:
    user: User = field(repr=False)
    organization: Organization
    device_id: UUID | None = None
    session_id: UUID | None = None
    pair_id: UUID | None = None
    web_session_key: str | None = field(default=None, repr=False)


def actor_from_request(request: Request) -> UploadActor:
    session = request.auth if isinstance(request.auth, DeviceSession) else None
    pair_id = None
    if session is not None:
        header = get_authorization_header(request).split()
        if len(header) != 2:
            raise InvalidTokenError
        pair_id = (
            TokenPair.objects.filter(access_hash=hash_token(header[1].decode("ascii")))
            .values_list("pk", flat=True)
            .first()
        )
        if pair_id is None:
            raise InvalidTokenError
    return UploadActor(
        cast(User, request.user),
        request.organization,  # type: ignore[attr-defined]
        None if session is None else session.device_id,
        None if session is None else session.pk,
        pair_id,
        None
        if session is not None
        else getattr(getattr(request, "session", None), "session_key", None),
    )


def current_scope(actor: UploadActor) -> EffectiveScope:
    member = membership_snapshots(actor.organization).filter(user_id=actor.user.pk).first()
    if member is None:
        raise PermissionDenied
    return captured_scope(member)


def require_upload_permission(actor: UploadActor) -> EffectiveScope:
    scope = current_scope(actor)
    if not scope.allows(FIELD_UPLOAD):
        raise PermissionDenied
    return scope


def lock_actor(actor: UploadActor, *, nowait: bool = True) -> None:
    """User -> Device -> Session -> Pair, NOWAIT for writes, before the Upload arbiter.

    A read that must pin the actor passes `nowait=False`: it waits (bounded by the transaction's
    `lock_timeout`) instead of answering 429 to a harmless concurrent read.
    """
    user = User.objects.select_for_update(nowait=nowait, no_key=True).get(pk=actor.user.pk)
    if not user.is_active or not hmac.compare_digest(user.password, actor.user.password):
        raise SessionRevokedError
    if actor.session_id is not None:
        _lock_bearer(actor, user, nowait=nowait)
    elif actor.web_session_key:
        _check_web_session(actor, user)


def _check_web_session(actor: UploadActor, user: User) -> None:
    session = Session.objects.filter(
        session_key=actor.web_session_key, expire_date__gt=server_now()
    ).first()
    decoded = {} if session is None else session.get_decoded()
    hashes = (user.get_session_auth_hash(), *user.get_session_auth_fallback_hash())
    if str(decoded.get("_auth_user_id")) != str(user.pk) or not any(
        hmac.compare_digest(str(decoded.get("_auth_user_hash", "")), candidate)
        for candidate in hashes
    ):
        raise SessionRevokedError


def _lock_bearer(actor: UploadActor, user: User, *, nowait: bool = True) -> None:
    now = server_now()
    if actor.device_id is None or actor.session_id is None or actor.pair_id is None:
        raise InvalidTokenError
    device = Device.objects.select_for_update(nowait=nowait, no_key=True).get(pk=actor.device_id)
    session = DeviceSession.objects.select_for_update(nowait=nowait, no_key=True).get(
        pk=actor.session_id
    )
    pair = (
        TokenPair.objects.select_for_update(nowait=nowait, no_key=True)
        .filter(pk=actor.pair_id)
        .first()
    )
    if pair is None:
        raise InvalidTokenError
    if (
        session.user_id != actor.user.pk
        or session.device_id != actor.device_id
        or session.organization_id != actor.organization.pk
        or pair.session_id != session.pk
        or device.organization_id != actor.organization.pk
        or pair.organization_id != actor.organization.pk
        or session.revoked_at is not None
        or device.is_revoked
    ):
        raise SessionRevokedError
    session.user, session.device, pair.session = user, device, session
    if pair.access_expires_at <= now:
        raise TokenExpiredError
    if is_access_superseded(pair, now) or is_retired_sibling(pair):
        raise InvalidTokenError
