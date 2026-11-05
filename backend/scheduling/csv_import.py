"""Bounded plain-text CSV parsing. Errors never contain hostile cell content."""

import csv
import io
import unicodedata
from collections.abc import Iterator
from typing import Any

MAX_UPLOAD_BYTES = 1024 * 1024
MAX_DATA_ROWS = 5000
MAX_CELL_LENGTH = 128
MAX_PROTOCOL_LENGTH = 80
CATEGORIES = ("low", "medium", "high")
SOURCES = ("official_import", "company_rule")
REQUIRED_COLUMNS = {"block_code", "category"}
ALLOWED_COLUMNS = REQUIRED_COLUMNS | {"protocol"}
# Configure once at module initialization; changing a process-global limit per request races.
csv.field_size_limit(MAX_CELL_LENGTH)


class InvalidCellError(ValueError):
    pass


def normalized_cell(value: str) -> str:
    """Reject formula prefixes even behind whitespace; controls never survive normalization."""
    if any(unicodedata.category(character).startswith("C") for character in value):
        raise InvalidCellError
    normalized = " ".join(unicodedata.normalize("NFC", value).split())
    if normalized.startswith(("=", "+", "-", "@")):
        raise InvalidCellError
    return normalized


def _row_values(cells: list[str], columns: list[str]) -> dict[str, str]:
    if len(cells) != len(columns):
        raise ValueError("invalid_row")
    try:
        values = {name: normalized_cell(value) for name, value in zip(columns, cells, strict=True)}
    except InvalidCellError as error:
        raise ValueError("unsafe_cell") from error
    if not values["block_code"] or len(values["block_code"]) > 50:
        raise ValueError("invalid_block_code")
    if values["category"] not in CATEGORIES:
        raise ValueError("invalid_category")
    if len(values.get("protocol", "")) > MAX_PROTOCOL_LENGTH:
        raise ValueError("invalid_protocol")
    return {**values, "protocol": values.get("protocol", "")}


def _check_duplicate(code: str, seen: set[str]) -> None:
    if code in seen:
        raise ValueError("duplicate_block")


def _parse_rows(
    reader: Iterator[list[str]], columns: list[str]
) -> tuple[list[dict[str, str]], list[dict[str, Any]]]:
    rows: list[dict[str, str]] = []
    errors: list[dict[str, Any]] = []
    seen: set[str] = set()
    for number, cells in enumerate(reader, start=2):
        if number > MAX_DATA_ROWS + 1:
            errors.append({"row": number, "code": "too_many_rows"})
            break
        try:
            values = _row_values(cells, columns)
            _check_duplicate(values["block_code"], seen)
            seen.add(values["block_code"])
            rows.append(values)
        except ValueError as error:
            errors.append({"row": number, "code": str(error)})
    return rows, errors


def parse_csv(content: bytes) -> tuple[list[dict[str, str]], list[dict[str, Any]]]:
    """Return normalized accepted rows and coded errors; no domain writes or formula evaluation."""
    if len(content) > MAX_UPLOAD_BYTES:
        return [], [{"row": 0, "code": "file_too_large"}]
    try:
        decoded = content.decode("utf-8-sig", errors="strict")
    except UnicodeDecodeError:
        return [], [{"row": 0, "code": "invalid_utf8"}]
    reader = csv.reader(io.StringIO(decoded, newline=""), dialect="excel", strict=True)
    try:
        columns = next(reader, [])
        if not REQUIRED_COLUMNS <= set(columns) <= ALLOWED_COLUMNS or len(columns) != len(
            set(columns)
        ):
            return [], [{"row": 1, "code": "invalid_columns"}]
        rows, errors = _parse_rows(reader, columns)
    except csv.Error:
        return [], [{"row": reader.line_num, "code": "invalid_csv"}]
    if not rows and not errors:
        errors.append({"row": 2, "code": "empty_import"})
    return rows, errors
