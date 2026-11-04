"""Helpers for DRF validation errors."""

from typing import Any

NON_FIELD_KEY = "non_field_errors"


def flatten_error_codes(codes: object, prefix: str = "") -> dict[str, list[dict[str, Any]]]:
    """Turn `ValidationError.get_codes()` into `{field: [{code, params}]}` (nested keys dotted)."""
    if isinstance(codes, dict):
        flat: dict[str, list[dict[str, Any]]] = {}
        for key, value in codes.items():
            flat.update(flatten_error_codes(value, f"{prefix}.{key}" if prefix else str(key)))
        return flat
    if isinstance(codes, list):
        if all(isinstance(item, str) for item in codes):
            return {prefix or NON_FIELD_KEY: [{"code": code, "params": {}} for code in codes]}
        flat = {}
        for index, item in enumerate(codes):
            flat.update(flatten_error_codes(item, f"{prefix}.{index}" if prefix else str(index)))
        return flat
    return {prefix or NON_FIELD_KEY: [{"code": str(codes), "params": {}}]}
