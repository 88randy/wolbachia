"""CSV results from the external laboratory: parse, preview with per-row errors, then apply.

Columns (Spanish or English headers): muestra|sample, objetivo|target, resultado|outcome,
serotipo|serotype, ct. Values accept Spanish or English words; Ct accepts a decimal comma.
"""

import csv
import io
import unicodedata
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from lab.pcr.models import SEROTYPES, PcrBatch
from lab.pcr.selectors import batch_status
from lab.pcr.services import ResultRow, validate_result_rows
from uploads.access import UploadActor

MAX_CSV_CHARS = 200_000
MAX_CSV_ROWS = 2_000
HEADERS = {
    "muestra": "sample",
    "sample": "sample",
    "sample_code": "sample",
    "objetivo": "target",
    "target": "target",
    "resultado": "outcome",
    "outcome": "outcome",
    "result": "outcome",
    "serotipo": "serotype",
    "serotype": "serotype",
    "ct": "ct",
}
TARGET_WORDS = {"wolbachia": "wolbachia", "dengue": "dengue", "denv": "dengue"}
OUTCOME_WORDS = {
    "positivo": "positive",
    "positive": "positive",
    "+": "positive",
    "negativo": "negative",
    "negative": "negative",
    "-": "negative",
    "invalido": "invalid",
    "invalid": "invalid",
}
TEMPLATE_HEADER = ("muestra", "objetivo", "resultado", "serotipo", "ct")


def _plain(value: str) -> str:
    text = unicodedata.normalize("NFKD", value.strip().lower())
    return "".join(char for char in text if not unicodedata.combining(char))


def _serotype(value: str) -> str | None:
    text = value.strip().upper().replace(" ", "").replace("_", "-")
    if not text:
        return ""
    if text.isdigit():
        text = f"DENV-{text}"
    if text.startswith("DENV") and not text.startswith("DENV-"):
        text = "DENV-" + text[4:]
    return text if text in SEROTYPES else None


def _ct(value: str) -> tuple[Decimal | None, bool]:
    text = value.strip().replace(",", ".")
    if not text:
        return None, True
    try:
        number = Decimal(text)
    except InvalidOperation:
        return None, False
    if not number.is_finite() or number < 0 or number > 60:  # noqa: PLR2004 -- Ct cycles
        return None, False
    return number.quantize(Decimal("0.01")), True


def template_csv(batch: PcrBatch) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(TEMPLATE_HEADER)
    for entry in batch.samples.select_related("sample").order_by("sample__code"):
        for target in batch.targets:
            writer.writerow([entry.sample.code, target, "", "", ""])
    return buffer.getvalue()


def preview_csv(actor: UploadActor, batch: PcrBatch, content: str) -> dict[str, Any]:
    """Never writes. Every row carries its normalized values and its errors."""
    if len(content) > MAX_CSV_CHARS:
        return {"rows": [], "valid_count": 0, "error_count": 0, "file_error": "pcr_csv_too_large"}
    text = content.lstrip("﻿")
    sample_line = text.splitlines()[0] if text else ""
    delimiter = ";" if sample_line.count(";") > sample_line.count(",") else ","
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    try:
        header = next(reader)
    except StopIteration:
        return {"rows": [], "valid_count": 0, "error_count": 0, "file_error": "pcr_csv_empty"}
    columns = [HEADERS.get(_plain(name)) for name in header]
    if not {"sample", "target", "outcome"} <= set(columns):
        return {"rows": [], "valid_count": 0, "error_count": 0, "file_error": "pcr_csv_header"}
    codes = {
        entry.sample.code.upper(): entry.sample_id
        for entry in batch.samples.select_related("sample")
    }
    parsed: list[dict[str, Any]] = []
    for line, raw in enumerate(reader, start=2):
        if not any(cell.strip() for cell in raw):
            continue
        if len(parsed) >= MAX_CSV_ROWS:
            return {
                "rows": [],
                "valid_count": 0,
                "error_count": 0,
                "file_error": "pcr_csv_too_many_rows",
            }
        values = {
            column: raw[index].strip() if index < len(raw) else ""
            for index, column in enumerate(columns)
            if column
        }
        parsed.append(_parse_row(line, values, codes))
    _attach_domain_errors(actor, batch, parsed)
    valid = sum(1 for row in parsed if not row["problems"])
    return {
        "rows": parsed,
        "valid_count": valid,
        "error_count": len(parsed) - valid,
        "file_error": None,
        "status": batch_status(batch),
    }


def _parse_row(line: int, values: dict[str, str], codes: dict[str, Any]) -> dict[str, Any]:
    errors: list[dict[str, Any]] = []
    code = values.get("sample", "")
    sample_id = codes.get(code.upper())
    if sample_id is None:
        errors.append({"field": "sample", "code": "pcr_sample_not_in_batch", "params": {}})
    target = TARGET_WORDS.get(_plain(values.get("target", "")))
    if target is None:
        errors.append({"field": "target", "code": "pcr_target_invalid", "params": {}})
    outcome = OUTCOME_WORDS.get(_plain(values.get("outcome", "")))
    if outcome is None:
        errors.append({"field": "outcome", "code": "pcr_outcome_invalid", "params": {}})
    serotype = _serotype(values.get("serotype", ""))
    if serotype is None:
        errors.append({"field": "serotype", "code": "pcr_serotype_invalid", "params": {}})
    ct_value, ct_ok = _ct(values.get("ct", ""))
    if not ct_ok:
        errors.append({"field": "ct", "code": "pcr_ct_invalid", "params": {"min": 0, "max": 60}})
    return {
        "line": line,
        "sample_code": code,
        "sample_id": str(sample_id) if sample_id else None,
        "target": target,
        "outcome": outcome,
        "serotype": serotype or "",
        "ct_value": None if ct_value is None else str(ct_value),
        "problems": errors,
    }


def _attach_domain_errors(
    actor: UploadActor, batch: PcrBatch, parsed: list[dict[str, Any]]
) -> None:
    candidates = [row for row in parsed if not row["problems"]]
    rows = [
        ResultRow(
            sample_id=UUID(row["sample_id"]),
            target=row["target"],
            outcome=row["outcome"],
            serotype=row["serotype"],
            ct_value=None if row["ct_value"] is None else Decimal(row["ct_value"]),
        )
        for row in candidates
    ]
    for row, problems in zip(candidates, validate_result_rows(actor, batch, rows), strict=True):
        row["problems"].extend(problems)
