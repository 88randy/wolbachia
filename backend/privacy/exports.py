"""Official exports (W57): CSV/XLSX of releases, readings and lab results.

The personal-data column (`operator_rfc`) is filled only when a live, unrevoked data-transfer
authorization covers the recipient and the row context; otherwise it is empty and the `note`
column says so. Every export leaves one access-log entry.
"""

import csv
import io
import zipfile
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import date
from typing import Any
from uuid import UUID
from xml.sax.saxutils import escape

from accounts.models import Personnel
from accounts.rfc_crypto import RfcEnvelope, decrypt_rfc
from core.exceptions import FieldValidationError
from core.time import server_now
from lab.models import EggCountAttempt
from organizations.selectors import filter_by_effective_scope
from ovitraps.models import Bag, OvitrapReading
from privacy.models import DataTransferAuthorization, ExportLog
from privacy.permissions import EXPORT_RUN
from releases.models import Release
from uploads.access import UploadActor

EXPORT_MAX_ROWS = 20_000
NOTE_RFC_NOT_AUTHORIZED = "rfc_not_authorized"
RFC_COLUMN = "operator_rfc"
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")

_RELEASE_CENTER = "permit_version__permit__center_id"
_RELEASE_QUADRANT = "permit_version__permit__quadrant_id"
_READING_CENTER = "ovitrap__sampling_point__block__quadrant__center_id"
_READING_QUADRANT = "ovitrap__sampling_point__block__quadrant_id"


@dataclass(frozen=True)
class Dataset:
    columns: tuple[str, ...]
    rows: Callable[[UploadActor, date, date], list[dict[str, Any]]]


def _span(date_from: date, date_to: date, field: str) -> dict[str, Any]:
    return {f"{field}__date__gte": date_from, f"{field}__date__lte": date_to}


def _releases(actor: UploadActor, date_from: date, date_to: date) -> list[dict[str, Any]]:
    rows = Release.objects.filter(
        organization=actor.organization, **_span(date_from, date_to, "device_time")
    )
    rows = filter_by_effective_scope(rows, _membership(actor), EXPORT_RUN)
    return [
        {
            "id": str(r["id"]),
            "device_time": r["device_time"].isoformat(),
            "quantity": str(r["quantity"]),
            "quadrant_code": r["permit_version__permit__quadrant__code"],
            "_user": r["created_by_id"],
            "_center": r[_RELEASE_CENTER],
            "_quadrant": r[_RELEASE_QUADRANT],
        }
        for r in rows.order_by("device_time", "id").values(
            "id",
            "device_time",
            "quantity",
            "permit_version__permit__quadrant__code",
            "created_by_id",
            _RELEASE_CENTER,
            _RELEASE_QUADRANT,
        )[: EXPORT_MAX_ROWS + 1]
    ]


def _readings(actor: UploadActor, date_from: date, date_to: date) -> list[dict[str, Any]]:
    rows = OvitrapReading.objects.filter(
        organization=actor.organization, **_span(date_from, date_to, "created_at")
    )
    rows = filter_by_effective_scope(rows, _membership(actor), EXPORT_RUN)
    return [
        {
            "id": str(r["id"]),
            "recorded_at": r["created_at"].isoformat(),
            "epi_week": r["epi_week"],
            "finding_code": r["finding_code"],
            "paddle_present": r["paddle_present"],
            "has_eggs": "" if r["has_eggs"] is None else r["has_eggs"],
            "_user": r["created_by_id"],
            "_center": r[_READING_CENTER],
            "_quadrant": r[_READING_QUADRANT],
        }
        for r in rows.order_by("created_at", "id").values(
            "id",
            "created_at",
            "epi_week",
            "finding_code",
            "paddle_present",
            "has_eggs",
            "created_by_id",
            _READING_CENTER,
            _READING_QUADRANT,
        )[: EXPORT_MAX_ROWS + 1]
    ]


def _lab_results(actor: UploadActor, date_from: date, date_to: date) -> list[dict[str, Any]]:
    bags = filter_by_effective_scope(
        Bag.objects.filter(organization=actor.organization), _membership(actor), EXPORT_RUN
    )
    rows = EggCountAttempt.objects.filter(
        organization=actor.organization, bag__in=bags, **_span(date_from, date_to, "created_at")
    )
    center = f"bag__{Bag.scope_center_lookup}"
    quadrant = f"bag__{Bag.scope_quadrant_lookup}"
    return [
        {
            "id": str(r["id"]),
            "counted_at": r["created_at"].isoformat(),
            "bag_code": r["bag__code"],
            "ordinal": r["ordinal"],
            "egg_count": r["value"],
            "viable_eggs": "" if r["viable_eggs"] is None else r["viable_eggs"],
            "total_examined": "" if r["total_examined"] is None else r["total_examined"],
            "_user": r["created_by_id"],
            "_center": r[center],
            "_quadrant": r[quadrant],
        }
        for r in rows.order_by("created_at", "id").values(
            "id",
            "created_at",
            "bag__code",
            "ordinal",
            "value",
            "viable_eggs",
            "total_examined",
            "created_by_id",
            center,
            quadrant,
        )[: EXPORT_MAX_ROWS + 1]
    ]


DATASETS: dict[str, Dataset] = {
    "releases": Dataset(("id", "device_time", "quantity", "quadrant_code"), _releases),
    "readings": Dataset(
        ("id", "recorded_at", "epi_week", "finding_code", "paddle_present", "has_eggs"), _readings
    ),
    "lab_results": Dataset(
        ("id", "counted_at", "bag_code", "ordinal", "egg_count", "viable_eggs", "total_examined"),
        _lab_results,
    ),
}


def _membership(actor: UploadActor) -> Any:  # noqa: ANN401
    from organizations.models import Membership

    return Membership.objects.get(user=actor.user, organization=actor.organization)


class _RfcResolver:
    """Decides per (center, quadrant) whether RFC may leave, and decrypts on demand."""

    def __init__(self, actor: UploadActor, recipient: str) -> None:
        self._actor = actor
        self._recipient = recipient.strip()
        self._decisions: dict[tuple[Any, Any], bool] = {}
        self._rfc: dict[Any, str] = {}

    def _authorized(self, center: Any, quadrant: Any) -> bool:  # noqa: ANN401
        key = (center, quadrant)
        if key not in self._decisions:
            now = server_now()
            grants = DataTransferAuthorization.objects.filter(
                organization=self._actor.organization,
                recipient_institution=self._recipient,
                fields=["rfc"],
                valid_from__lte=now,
                valid_until__gt=now,
                revocation__isnull=True,
                center_id=center,
            )
            self._decisions[key] = bool(self._recipient) and (
                grants.filter(quadrant__isnull=True).exists()
                or grants.filter(quadrant_id=quadrant).exists()
            )
        return self._decisions[key]

    def resolve(self, user_id: UUID | None, center: Any, quadrant: Any) -> tuple[str, str]:  # noqa: ANN401
        if user_id is None or not self._authorized(center, quadrant):
            return "", NOTE_RFC_NOT_AUTHORIZED
        if user_id not in self._rfc:
            person = Personnel.objects.filter(
                organization=self._actor.organization, membership__user_id=user_id
            ).first()
            self._rfc[user_id] = (
                decrypt_rfc(
                    self._actor.organization.pk,
                    person.pk,
                    RfcEnvelope(
                        ciphertext=bytes(person.rfc_ciphertext),
                        nonce=bytes(person.rfc_nonce),
                        wrapped_key=bytes(person.rfc_wrapped_key),
                        key_version=person.rfc_key_version,
                        fingerprint=person.rfc_fingerprint,
                    ),
                )
                if person is not None and person.rfc_ciphertext
                else ""
            )
        return self._rfc[user_id], ""


def _safe(value: object) -> object:
    """Neutralize spreadsheet formulas in text cells."""
    if isinstance(value, str) and value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value


@dataclass(frozen=True)
class ExportRequest:
    dataset: str
    date_from: date
    date_to: date
    recipient_institution: str = ""


def build_export(
    actor: UploadActor, request: ExportRequest
) -> tuple[tuple[str, ...], list[list[object]]]:
    spec = DATASETS[request.dataset]
    raw = spec.rows(actor, request.date_from, request.date_to)
    if len(raw) > EXPORT_MAX_ROWS:
        raise FieldValidationError("date_to", "too_many_rows", {"max_rows": EXPORT_MAX_ROWS})
    resolver = _RfcResolver(actor, request.recipient_institution)
    header = (*spec.columns, RFC_COLUMN, "note")
    table: list[list[object]] = []
    for row in raw:
        rfc, note = resolver.resolve(row["_user"], row["_center"], row["_quadrant"])
        table.append([_safe(row[c]) for c in spec.columns] + [_safe(rfc), note])
    ExportLog.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        dataset=request.dataset,
        date_from=request.date_from,
        date_to=request.date_to,
        recipient_institution=request.recipient_institution.strip(),
        row_count=len(table),
        rfc_rows_released=sum(1 for row in table if row[-1] == ""),
    )
    return header, table


def to_csv(header: Iterable[str], table: list[list[object]]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(header)
    writer.writerows(table)
    return buffer.getvalue().encode("utf-8-sig")


def _cell(ref: str, value: object) -> str:
    if isinstance(value, bool):
        return f'<c r="{ref}" t="b"><v>{int(value)}</v></c>'
    if isinstance(value, int | float):
        return f'<c r="{ref}"><v>{value}</v></c>'
    return f'<c r="{ref}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>'


def _column(index: int) -> str:
    name = ""
    index += 1
    while index:
        index, rest = divmod(index - 1, 26)
        name = chr(65 + rest) + name
    return name


def to_xlsx(header: Iterable[str], table: list[list[object]]) -> bytes:
    """Minimal SpreadsheetML workbook (stdlib only, no new dependency)."""
    rows_xml = []
    for number, row in enumerate([list(header), *table], start=1):
        cells = "".join(_cell(f"{_column(i)}{number}", v) for i, v in enumerate(row))
        rows_xml.append(f'<row r="{number}">{cells}</row>')
    sheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f"<sheetData>{''.join(rows_xml)}</sheetData></worksheet>"
    )
    parts = {
        "[Content_Types].xml": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            "</Types>"
        ),
        "_rels/.rels": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            "</Relationships>"
        ),
        "xl/workbook.xml": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="export" sheetId="1" r:id="rId1"/></sheets></workbook>'
        ),
        "xl/_rels/workbook.xml.rels": (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            "</Relationships>"
        ),
        "xl/worksheets/sheet1.xml": sheet,
    }
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in parts.items():
            archive.writestr(name, content)
    return buffer.getvalue()


__all__ = ["DATASETS", "build_export", "to_csv", "to_xlsx"]
