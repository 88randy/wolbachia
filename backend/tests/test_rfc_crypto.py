"""Synthetic RFC protection; no AWS connection or persistent key material."""

import hashlib
import hmac
import secrets
from dataclasses import replace
from typing import cast
from uuid import UUID, uuid4

import pytest
from botocore.exceptions import ClientError

from accounts import rfc_crypto
from accounts.rfc_crypto import (
    RfcKeyUnavailableError,
    decrypt_rfc,
    encrypt_rfc,
    normalize_rfc,
    rotate_rfc,
)
from core.exceptions import FieldValidationError

SYNTHETIC_RFC = "TEST000101AA0"


class FakeKms:
    def __init__(self) -> None:
        self.mac_key = secrets.token_bytes(32)
        self.envelopes: dict[bytes, tuple[bytes, object, str]] = {}
        self.fail = False

    def generate_data_key(self, **kwargs: object) -> dict[str, object]:
        if self.fail:
            raise ClientError({"Error": {"Code": "Unavailable"}}, "GenerateDataKey")
        assert kwargs["KeySpec"] == "AES_256"
        plaintext = secrets.token_bytes(32)
        wrapped = secrets.token_bytes(48)
        version = str(kwargs["KeyId"])
        self.envelopes[wrapped] = (plaintext, kwargs["EncryptionContext"], version)
        return {"Plaintext": plaintext, "CiphertextBlob": wrapped, "KeyId": version}

    def generate_mac(self, **kwargs: object) -> dict[str, object]:
        assert kwargs["MacAlgorithm"] == "HMAC_SHA_256"
        assert SYNTHETIC_RFC.encode() not in cast(bytes, kwargs["Message"])
        return {"Mac": hmac.digest(self.mac_key, cast(bytes, kwargs["Message"]), hashlib.sha256)}

    def decrypt(self, **kwargs: object) -> dict[str, object]:
        plaintext, context, version = self.envelopes[cast(bytes, kwargs["CiphertextBlob"])]
        if kwargs["EncryptionContext"] != context or kwargs["KeyId"] != version:
            raise ClientError({"Error": {"Code": "InvalidCiphertext"}}, "Decrypt")
        return {"Plaintext": plaintext}


@pytest.fixture
def kms(monkeypatch: pytest.MonkeyPatch, settings: object) -> FakeKms:
    client = FakeKms()
    monkeypatch.setattr(rfc_crypto, "_kms_client", lambda: client)
    monkeypatch.setattr(settings, "RFC_KMS_KEY_ID", "wrap-v1", raising=False)
    monkeypatch.setattr(settings, "RFC_KMS_HMAC_KEY_ID", "synthetic-mac-key", raising=False)
    return client


def test_normalized_duplicates_share_only_the_same_organization_fingerprint(kms: FakeKms) -> None:
    organization_id, personnel_id = uuid4(), uuid4()
    original = encrypt_rfc(organization_id, personnel_id, " test-000101-aa0 ")
    equivalent = encrypt_rfc(organization_id, uuid4(), SYNTHETIC_RFC)
    foreign = encrypt_rfc(uuid4(), uuid4(), SYNTHETIC_RFC)

    assert decrypt_rfc(organization_id, personnel_id, original) == SYNTHETIC_RFC
    assert original.fingerprint == equivalent.fingerprint
    assert foreign.fingerprint != original.fingerprint
    assert original.nonce != equivalent.nonce
    assert original.wrapped_key != equivalent.wrapped_key
    assert SYNTHETIC_RFC.encode() not in original.ciphertext
    assert SYNTHETIC_RFC.encode() not in original.wrapped_key


@pytest.mark.parametrize("corruption", ["ciphertext", "nonce", "organization", "personnel"])
def test_corrupt_or_rebound_envelope_fails_closed(kms: FakeKms, corruption: str) -> None:
    organization_id, personnel_id = uuid4(), uuid4()
    envelope = encrypt_rfc(organization_id, personnel_id, SYNTHETIC_RFC)
    if corruption in {"ciphertext", "nonce"}:
        value = getattr(envelope, corruption)
        envelope = replace(envelope, **{corruption: bytes([value[0] ^ 1]) + value[1:]})
    if corruption == "organization":
        organization_id = uuid4()
    if corruption == "personnel":
        personnel_id = uuid4()

    with pytest.raises(RfcKeyUnavailableError):
        decrypt_rfc(organization_id, personnel_id, envelope)


def test_rotation_preserves_mac_and_old_key_version(
    kms: FakeKms, settings: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    organization_id, personnel_id = uuid4(), uuid4()
    original = encrypt_rfc(organization_id, personnel_id, SYNTHETIC_RFC)
    monkeypatch.setattr(settings, "RFC_KMS_KEY_ID", "wrap-v2")

    rotated = rotate_rfc(organization_id, personnel_id, original)

    assert original.key_version == "wrap-v1"
    assert rotated.key_version == "wrap-v2"
    assert rotated.fingerprint == original.fingerprint
    assert decrypt_rfc(organization_id, personnel_id, original) == SYNTHETIC_RFC
    assert decrypt_rfc(organization_id, personnel_id, rotated) == SYNTHETIC_RFC

    kms.mac_key = secrets.token_bytes(32)
    with pytest.raises(RfcKeyUnavailableError):
        rotate_rfc(organization_id, personnel_id, rotated)


def test_unavailable_kms_and_invalid_input_have_safe_errors(kms: FakeKms) -> None:
    kms.fail = True
    with pytest.raises(RfcKeyUnavailableError) as error:
        encrypt_rfc(uuid4(), uuid4(), SYNTHETIC_RFC)
    assert error.value.code == "rfc_key_unavailable"
    assert SYNTHETIC_RFC not in str(error.value)
    assert error.value.__cause__ is None

    with pytest.raises(FieldValidationError) as invalid:
        normalize_rfc("synthetic-invalid-input")
    assert invalid.value.fields == {"rfc": [{"code": "invalid", "params": {}}]}


def test_unconfigured_kms_refuses_before_contacting_external_service(
    settings: object, monkeypatch: pytest.MonkeyPatch
) -> None:
    def reject_connection(*args: object, **kwargs: object) -> None:
        pytest.fail("Unconfigured protection must not contact an external service")

    monkeypatch.setattr(settings, "RFC_KMS_REGION", "", raising=False)
    monkeypatch.setattr(rfc_crypto.boto3, "client", reject_connection)

    with pytest.raises(RfcKeyUnavailableError):
        encrypt_rfc(UUID(int=1), UUID(int=2), SYNTHETIC_RFC)
