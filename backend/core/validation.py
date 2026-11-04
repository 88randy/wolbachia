"""Helpers for DRF validation errors."""

import json
from typing import Any

NON_FIELD_KEY = "non_field_errors"


PARAMS_MARKER = "params:"


def params_message(params: dict[str, Any]) -> str:
    """Text of an `ErrorDetail` that carries `params` (DRF keeps only text and code).

    `flatten_error_details` turns it back into `params`; the text is never shown to anyone.
    """
    return PARAMS_MARKER + json.dumps(params, sort_keys=True)


def _params_of(message: object) -> dict[str, Any]:
    """Internal contract: DRF rebuilds every `ErrorDetail` from its text and code, so a subclass
    cannot carry `params` through `ValidationError`; the text does, behind `PARAMS_MARKER`.
    Anything that is not valid JSON after the marker (a message that merely starts with it) means
    "no params": the error handler must never fail while reporting an error."""
    text = str(message)
    if not text.startswith(PARAMS_MARKER):
        return {}
    try:
        loaded = json.loads(text[len(PARAMS_MARKER) :])
    except ValueError:
        return {}
    return loaded if isinstance(loaded, dict) else {}


def _is_leaf(details: object) -> bool:
    return isinstance(details, dict) and set(details) == {"message", "code"}


def flatten_error_details(details: object, prefix: str = "") -> dict[str, list[dict[str, Any]]]:
    """`ValidationError.get_full_details()` as `{field: [{code, params}]}` (nested keys dotted)."""
    if isinstance(details, dict) and _is_leaf(details):
        item = {"code": str(details["code"]), "params": _params_of(details["message"])}
        return {prefix or NON_FIELD_KEY: [item]}
    if isinstance(details, dict):
        flat: dict[str, list[dict[str, Any]]] = {}
        for key, value in details.items():
            nested = flatten_error_details(value, f"{prefix}.{key}" if prefix else str(key))
            for name, items in nested.items():
                flat.setdefault(name, []).extend(items)
        return flat
    if isinstance(details, list):
        flat = {}
        for index, item in enumerate(details):
            leaf_or_group = _is_leaf(item)
            key = prefix if leaf_or_group else (f"{prefix}.{index}" if prefix else str(index))
            for name, items in flatten_error_details(item, key).items():
                flat.setdefault(name, []).extend(items)
        return flat
    return {prefix or NON_FIELD_KEY: [{"code": str(details), "params": {}}]}
