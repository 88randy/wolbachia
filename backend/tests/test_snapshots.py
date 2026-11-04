import pytest
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from core.snapshots import (
    etag_matches,
    snapshot_hash,
    snapshot_response,
    with_version,
)

VERSION = "abc123"


def request_with(if_none_match: str | None) -> Request:
    extra = {} if if_none_match is None else {"HTTP_IF_NONE_MATCH": if_none_match}
    return Request(APIRequestFactory().get("/", **extra))


def test_hash_ignores_key_order() -> None:
    assert snapshot_hash({"a": 1, "b": [1, 2]}) == snapshot_hash({"b": [1, 2], "a": 1})


def test_hash_changes_when_content_changes() -> None:
    assert snapshot_hash({"a": 1}) != snapshot_hash({"a": 2})


def test_hash_keeps_list_order() -> None:
    assert snapshot_hash({"a": [1, 2]}) != snapshot_hash({"a": [2, 1]})


def test_with_version_puts_the_hash_of_the_payload_first() -> None:
    payload = {"items": [1]}

    snapshot = with_version(payload)

    assert list(snapshot) == ["version", "items"]
    assert snapshot["version"] == snapshot_hash(payload)


@pytest.mark.parametrize(
    "header",
    [f'"{VERSION}"', f'W/"{VERSION}"', f'"other", "{VERSION}"', "*"],
)
def test_etag_matches_listed_versions(header: str) -> None:
    assert etag_matches(request_with(header), VERSION) is True


@pytest.mark.parametrize("header", [None, "", '"other"', "W/other"])
def test_etag_does_not_match_other_versions(header: str | None) -> None:
    assert etag_matches(request_with(header), VERSION) is False


def test_response_is_304_without_body_when_the_version_matches() -> None:
    response = snapshot_response(request_with(f'"{VERSION}"'), {"version": VERSION, "x": 1})

    assert response.status_code == 304
    assert response.data is None
    assert response["ETag"] == f'"{VERSION}"'
    assert response["Cache-Control"] == "private, no-cache"


def test_response_is_200_with_etag_when_the_client_is_stale() -> None:
    response = snapshot_response(request_with('"old"'), {"version": VERSION, "x": 1})

    assert response.status_code == 200
    assert response.data == {"version": VERSION, "x": 1}
    assert response["ETag"] == f'"{VERSION}"'


def test_response_varies_by_organization_header() -> None:
    response = snapshot_response(request_with(None), {"version": VERSION})

    assert response["Vary"] == "X-Organization"
