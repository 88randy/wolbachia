"""Version hashes and conditional responses for the field snapshots (`/api/v1/field/...`).

A snapshot is the complete, compact copy of some configuration that a phone keeps offline. Its
`version` is a hash of the canonical payload, so it changes if and only if the content changes.
The same value is the `ETag`, which lets a client revalidate with `If-None-Match` and get `304`.
"""

import hashlib
import json
from collections.abc import Mapping
from typing import Any

from drf_spectacular.utils import OpenApiParameter
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from core.constants import ORGANIZATION_HEADER

SNAPSHOT_CACHE_CONTROL = "private, no-cache"
WEAK_PREFIX = "W/"

IF_NONE_MATCH_PARAMETER = OpenApiParameter(
    name="If-None-Match",
    type=str,
    location=OpenApiParameter.HEADER,
    required=False,
    description=(
        "The `ETag` (the snapshot `version`) the client already holds. When it is still current "
        "the answer is `304` with no body."
    ),
)


def snapshot_hash(payload: Mapping[str, Any]) -> str:
    """SHA-256 of the canonical JSON of the payload (sorted keys, compact separators)."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def with_version(payload: Mapping[str, Any]) -> dict[str, Any]:
    """The payload preceded by its `version` (the hash of the payload itself)."""
    return {"version": snapshot_hash(payload), **payload}


def etag_matches(request: Request, version: str) -> bool:
    """True when `If-None-Match` lists the version (or `*`); weak `W/` prefixes are ignored."""
    parts = {part.strip() for part in request.headers.get("If-None-Match", "").split(",")}
    if "*" in parts:
        return True
    return version in {part.removeprefix(WEAK_PREFIX).strip('"') for part in parts}


def snapshot_response(request: Request, snapshot: Mapping[str, Any]) -> Response:
    """`200` with the snapshot, or `304` with no body when the client already has this version.

    Authentication and permissions are checked before this runs, so a `304` is never sent to a
    caller who could not read the snapshot.
    """
    version = str(snapshot["version"])
    headers = {
        "ETag": f'"{version}"',
        "Cache-Control": SNAPSHOT_CACHE_CONTROL,
        # The same URL answers differently per active organization.
        "Vary": ORGANIZATION_HEADER,
    }
    if etag_matches(request, version):
        return Response(status=status.HTTP_304_NOT_MODIFIED, headers=headers)
    return Response(dict(snapshot), headers=headers)
