"""RFC envelopes backed by external KMS keys; callers perform I/O outside row locks."""

import hashlib
import hmac
import re
import secrets
import unicodedata
from dataclasses import dataclass
from http import HTTPStatus
from typing import Protocol, cast
from uuid import UUID

import boto3  # type: ignore[import-untyped]
from botocore.config import Config  # type: ignore[import-untyped]
from botocore.exceptions import BotoCoreError, ClientError  # type: ignore[import-untyped]
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from django.conf import settings
from django.views.decorators.debug import sensitive_variables

from core.exceptions import DomainError, FieldValidationError

NONCE_LENGTH = 12
DATA_KEY_LENGTH = 32
RFC_PATTERN = re.compile(r"[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}")
PURPOSE = "personnel-rfc-v1"


class RfcKeyUnavailableError(DomainError):
    code = "rfc_key_unavailable"
    status_code = HTTPStatus.SERVICE_UNAVAILABLE
    default_detail = "The protected value is unavailable."


class KmsClient(Protocol):
    def generate_data_key(self, **kwargs: object) -> dict[str, object]: ...

    def generate_mac(self, **kwargs: object) -> dict[str, object]: ...

    def decrypt(self, **kwargs: object) -> dict[str, object]: ...


@dataclass(frozen=True)
class RfcEnvelope:
    ciphertext: bytes
    nonce: bytes
    wrapped_key: bytes
    key_version: str
    fingerprint: str


@sensitive_variables()
def normalize_rfc(rfc: str) -> str:
    """Canonicalize equivalent input without retaining or reporting the source value."""
    normalized = re.sub(r"[\s-]", "", unicodedata.normalize("NFKC", rfc).upper())
    if RFC_PATTERN.fullmatch(normalized) is None:
        raise FieldValidationError("rfc", "invalid")
    return normalized


def _context(organization_id: UUID, personnel_id: UUID) -> dict[str, str]:
    return {
        "purpose": PURPOSE,
        "organization": str(organization_id),
        "personnel": str(personnel_id),
    }


def _aad(context: dict[str, str]) -> bytes:
    return "|".join(context[name] for name in ("purpose", "organization", "personnel")).encode()


def _kms_client() -> KmsClient:
    region = _configured_key("RFC_KMS_REGION")
    return cast(
        KmsClient,
        boto3.client(
            "kms",
            region_name=region,
            config=Config(connect_timeout=3, read_timeout=3, retries={"total_max_attempts": 1}),
        ),
    )


def _configured_key(name: str) -> str:
    key_id = getattr(settings, name, "")
    if not isinstance(key_id, str) or not key_id:
        raise RfcKeyUnavailableError
    return key_id


def _response_bytes(response: dict[str, object], name: str) -> bytes:
    value = response[name]
    if not isinstance(value, bytes):
        raise RfcKeyUnavailableError
    return value


@sensitive_variables()
def encrypt_rfc(organization_id: UUID, personnel_id: UUID, rfc: str) -> RfcEnvelope:
    """Create a fresh AES-256-GCM envelope and organization-separated duplicate MAC."""
    normalized = normalize_rfc(rfc)
    context = _context(organization_id, personnel_id)
    try:
        client = _kms_client()
        key = client.generate_data_key(
            KeyId=_configured_key("RFC_KMS_KEY_ID"), KeySpec="AES_256", EncryptionContext=context
        )
        mac = client.generate_mac(
            KeyId=_configured_key("RFC_KMS_HMAC_KEY_ID"),
            MacAlgorithm="HMAC_SHA_256",
            Message=f"{PURPOSE}|fingerprint-key|{organization_id}".encode(),
        )
        return _encrypt_envelope(normalized, context, (key, mac))
    except (BotoCoreError, ClientError, KeyError, TypeError, ValueError):
        raise RfcKeyUnavailableError from None


@sensitive_variables()
def _encrypt_envelope(
    normalized: str, context: dict[str, str], responses: tuple[dict[str, object], dict[str, object]]
) -> RfcEnvelope:
    key, mac = responses
    plaintext_key = _response_bytes(key, "Plaintext")
    key_version = key["KeyId"]
    organization_key = _response_bytes(mac, "Mac")
    if len(plaintext_key) != DATA_KEY_LENGTH or not isinstance(key_version, str) or not key_version:
        raise RfcKeyUnavailableError
    if len(organization_key) != DATA_KEY_LENGTH:
        raise RfcKeyUnavailableError
    nonce = secrets.token_bytes(NONCE_LENGTH)
    return RfcEnvelope(
        ciphertext=AESGCM(plaintext_key).encrypt(nonce, normalized.encode(), _aad(context)),
        nonce=nonce,
        wrapped_key=_response_bytes(key, "CiphertextBlob"),
        key_version=key_version,
        fingerprint=hmac.digest(organization_key, normalized.encode(), hashlib.sha256).hex(),
    )


@sensitive_variables()
def decrypt_rfc(organization_id: UUID, personnel_id: UUID, envelope: RfcEnvelope) -> str:
    """Authenticate the exact organization/personnel envelope or fail without plaintext."""
    context = _context(organization_id, personnel_id)
    try:
        key = _kms_client().decrypt(
            CiphertextBlob=envelope.wrapped_key,
            KeyId=envelope.key_version,
            EncryptionContext=context,
        )
        plaintext_key = _response_bytes(key, "Plaintext")
        if len(plaintext_key) != DATA_KEY_LENGTH or len(envelope.nonce) != NONCE_LENGTH:
            raise RfcKeyUnavailableError
        plaintext = AESGCM(plaintext_key).decrypt(
            envelope.nonce, envelope.ciphertext, _aad(context)
        )
        return plaintext.decode("utf-8")
    except (BotoCoreError, ClientError, InvalidTag, KeyError, TypeError, ValueError):
        raise RfcKeyUnavailableError from None


@sensitive_variables()
def rotate_rfc(organization_id: UUID, personnel_id: UUID, envelope: RfcEnvelope) -> RfcEnvelope:
    """Re-encrypt using the current wrapping key while preserving duplicate identity.

    The HMAC key is stable across wrapping-key rotation. Changing its custody requires
    a separately coordinated reindex; it must never silently create a second namespace.
    """
    normalized = decrypt_rfc(organization_id, personnel_id, envelope)
    rotated = encrypt_rfc(organization_id, personnel_id, normalized)
    if rotated.fingerprint != envelope.fingerprint:
        raise RfcKeyUnavailableError
    return rotated
