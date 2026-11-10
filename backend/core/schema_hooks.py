"""OpenAPI post-processing: additive display labels stay optional for API clients."""

from typing import Any

_OPTIONAL_LABELS = frozenset({"author_name", "reviewer_name", "decided_by_name"})


def _is_optional_label(name: str) -> bool:
    return name.endswith("_by_name") or name in _OPTIONAL_LABELS


def optional_author_names(result: dict[str, Any], **kwargs: Any) -> dict[str, Any]:  # noqa: ANN401, ARG001 -- spectacular hook signature
    """Mark the author-name labels (`created_by_name`...) as not required.

    They are always sent, but making them optional in the contract keeps older clients and test
    fixtures valid; the id fields stay required.
    """
    for component in result.get("components", {}).get("schemas", {}).values():
        required = component.get("required")
        if not required:
            continue
        kept = [name for name in required if not _is_optional_label(name)]
        if kept:
            component["required"] = kept
        else:
            del component["required"]
    return result
