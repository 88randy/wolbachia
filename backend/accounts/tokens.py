"""Opaque token generation and hashing. Plaintext tokens exist only in memory and in responses."""

import hashlib
import secrets

TOKEN_BYTES = 32  # 256 bits of entropy


def generate_token() -> str:
    """A new random URL-safe token. Never store or log it: store `hash_token(token)` instead."""
    return secrets.token_urlsafe(TOKEN_BYTES)


def hash_token(token: str) -> str:
    """Hex SHA-256 of a token.

    The tokens are long random values, not passwords, so a fast unsalted hash is enough: there is
    nothing to brute-force, and it keeps the unique-index lookup by digest possible.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
