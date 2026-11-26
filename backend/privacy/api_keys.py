"""Institution API keys (W66): issue, revoke and verify. The secret is shown once, never stored.

Format: `cq_live_<prefix>.<secret>`. `prefix` (12 hex characters) is public and finds the row;
`secret` is 256 random bits, of which only the SHA-256 digest is stored. Comparison is constant
time and runs even when the prefix is unknown, so a miss and a wrong secret look the same.
Nothing here logs the token, the secret or the digest.
"""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.http import Http404

from accounts.models import User
from core.exceptions import FieldValidationError
from core.time import server_now
from core.void_reason import validate_void_reason
from geography.models import Quadrant
from organizations.models import Center, Organization
from privacy.models import ApiKey, ApiKeyEvent
from privacy.portal import PORTAL_INDICATORS

TOKEN_PREFIX = "cq_live_"  # noqa: S105 -- public label of the token, not a secret
MAX_RATE_LIMIT_PER_DAY = 1_000_000
_DAY_SECONDS = 90_000  # a little over a day so the counter outlives its own day
_DUMMY_DIGEST = hashlib.sha256(b"no-such-key").hexdigest()


class ApiKeyRefused(Exception):  # noqa: N818 -- a refusal answer, not an error condition
    """The key cannot be used. `code` is machine readable: never shown to the caller as text."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class ApiKeyInput:
    institution: str
    center_id: UUID
    quadrant_id: UUID | None
    endpoints: tuple[str, ...]
    rate_limit_per_day: int
    valid_from: datetime
    valid_until: datetime


def _digest(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def _validate(data: ApiKeyInput) -> str:
    institution = data.institution.strip()
    if not institution or len(institution) > 200:  # noqa: PLR2004
        raise FieldValidationError("institution", "invalid")
    if not data.endpoints or not set(data.endpoints) <= set(PORTAL_INDICATORS):
        raise FieldValidationError("endpoints", "invalid")
    if not 0 < data.rate_limit_per_day <= MAX_RATE_LIMIT_PER_DAY:
        raise FieldValidationError("rate_limit_per_day", "invalid")
    if data.valid_until <= data.valid_from:
        raise FieldValidationError("valid_until", "invalid_interval")
    return institution


def issue_api_key(
    organization: Organization, author: User, data: ApiKeyInput
) -> tuple[ApiKey, str]:
    """Create the key and return it with the full token, which exists only in this return value."""
    institution = _validate(data)
    center = Center.objects.filter(organization=organization, pk=data.center_id).first()
    if center is None:
        raise Http404
    if (
        data.quadrant_id is not None
        and not Quadrant.objects.filter(
            organization=organization, center=center, pk=data.quadrant_id
        ).exists()
    ):
        raise Http404
    prefix = secrets.token_hex(6)
    secret = secrets.token_urlsafe(32)
    try:
        with transaction.atomic():
            key = ApiKey.objects.create(
                organization=organization,
                created_by=author,
                institution=institution,
                prefix=prefix,
                secret_digest=_digest(secret),
                center=center,
                quadrant_id=data.quadrant_id,
                endpoints=list(data.endpoints),
                rate_limit_per_day=data.rate_limit_per_day,
                valid_from=data.valid_from,
                valid_until=data.valid_until,
            )
            ApiKeyEvent.objects.create(
                organization=organization, created_by=author, key=key, kind="created"
            )
    except IntegrityError as error:
        # The only constraint a caller can trip is one live key per institution.
        raise FieldValidationError("institution", "already_has_live_key") from error
    return key, f"{TOKEN_PREFIX}{prefix}.{secret}"


def revoke_api_key(target: ApiKey, author: User, reason: str) -> ApiKey:
    """Revoke for good, with a reason. A revoked key stays on record and cannot be reactivated.

    `target` comes from an organization-scoped lookup; the row is locked and re-read so two
    concurrent revocations cannot both succeed.
    """
    cleaned = validate_void_reason(reason, "reason", enforce_minimum=True)
    organization = target.organization
    with transaction.atomic():
        key = (
            ApiKey.objects.select_for_update()
            .filter(organization=organization, pk=target.pk)
            .first()
        )
        if key is None:
            raise Http404
        if key.revoked_at is not None:
            raise FieldValidationError("reason", "already_revoked")
        key.revoked_at = server_now()
        key.revoked_by = author
        key.revoke_reason = cleaned
        key.save(update_fields=["revoked_at", "revoked_by", "revoke_reason"])
        ApiKeyEvent.objects.create(
            organization=organization, created_by=author, key=key, kind="revoked", detail=cleaned
        )
    return key


def authenticate_api_key(token: str, endpoint: str, now: datetime | None = None) -> ApiKey:
    """Return the live key for `token` that may read `endpoint`, or raise `ApiKeyRefused`.

    Checks, in this order: format, secret (constant time), revocation, validity window, endpoint,
    daily rate limit. The rate counter only moves for a key that passed every other check.
    """
    moment = now or server_now()
    prefix, secret = _split(token)
    key = ApiKey.objects.filter(prefix=prefix).select_related("organization").first()
    expected = key.secret_digest if key is not None else _DUMMY_DIGEST
    matches = hmac.compare_digest(_digest(secret), expected)
    if key is None or not matches:
        raise ApiKeyRefused("invalid_key")
    if key.revoked_at is not None:
        raise ApiKeyRefused("revoked_key")
    if not key.valid_from <= moment < key.valid_until:
        raise ApiKeyRefused("key_not_valid_now")
    if endpoint not in key.endpoints:
        raise ApiKeyRefused("endpoint_not_allowed")
    if not _within_rate_limit(key, moment):
        raise ApiKeyRefused("rate_limited")
    return key


def _split(token: str) -> tuple[str, str]:
    if not token.startswith(TOKEN_PREFIX) or "." not in token:
        raise ApiKeyRefused("invalid_key")
    prefix, _dot, secret = token[len(TOKEN_PREFIX) :].partition(".")
    if len(prefix) != 12 or not secret or len(secret) > 128:  # noqa: PLR2004
        raise ApiKeyRefused("invalid_key")
    return prefix, secret


def _within_rate_limit(key: ApiKey, moment: datetime) -> bool:
    counter = f"api-key-rate:{key.pk}:{moment.date().isoformat()}"
    cache.add(counter, 0, timeout=_DAY_SECONDS)
    return int(cache.incr(counter)) <= key.rate_limit_per_day
