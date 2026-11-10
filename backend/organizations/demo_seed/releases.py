"""Demo release permit and release device, built through the release services (writes)."""

import hashlib
from datetime import timedelta
from io import BytesIO
from typing import Any
from uuid import UUID

from django.utils import timezone

from geography.models import Quadrant
from inventory.models import Lot
from organizations.models import Organization
from releases.models import Permit, ReleaseDevice
from releases.services import create_permit, create_permit_type, create_release_device
from uploads.access import UploadActor
from uploads.services import (
    LEASE_HEADER,
    UploadBody,
    UploadRequest,
    authorize_upload,
    finalize_upload,
    receive_upload,
)

PERMIT_TYPE_CODE = "PT-DEMO"
PERMIT_CODE = "PERMIT-DEMO-01"
DEVICE_CODE = "RD-DEMO-01"


def _demo_pdf() -> bytes:
    """A minimal, structurally valid PDF with no content (synthetic)."""
    body = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"
    return (
        body
        + b"xref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 /Root 1 0 R >>\nstartxref\n"
        + str(len(body)).encode()
        + b"\n%%EOF\n"
    )


def _upload_pdf(actor: UploadActor) -> UUID:
    content = _demo_pdf()
    request = UploadRequest(
        "application/pdf", len(content), hashlib.sha256(content).hexdigest(), None, None
    )
    answer = authorize_upload(actor, request)
    identifier = UUID(str(answer["upload_id"]))
    receive_upload(actor, UploadBody(identifier, answer["headers"][LEASE_HEADER], BytesIO(content)))
    finalize_upload(actor, identifier)
    return identifier


def _permit_values(actor: UploadActor, quadrant: Quadrant, type_id: UUID) -> dict[str, Any]:
    version = quadrant.versions.order_by("-revision").first()
    if version is None:
        raise RuntimeError("The demo quadrant has no geometry version.")
    return {
        "code": PERMIT_CODE,
        "quadrant_id": quadrant.pk,
        "type_id": type_id,
        "number": "DEMO-0001",
        "authority": "Synthetic demo authority",
        "official_document_id": _upload_pdf(actor),
        "document_attestation": "Synthetic demo document, not a real permit",
        "geometry": version.geometry,
        "valid_from": timezone.now() - timedelta(days=1),
        "valid_to": timezone.now() + timedelta(days=365),
    }


def ensure_permit(organization: Organization, actor: UploadActor, quadrant: Quadrant) -> Permit:
    """The demo permit with its type, found by code (writes)."""
    existing = Permit.objects.filter(organization=organization, code=PERMIT_CODE).first()
    if existing is not None:
        return existing
    kind = create_permit_type(
        actor,
        {
            "code": PERMIT_TYPE_CODE,
            "name": "Demo permit type",
            "requirements": {"max_gps_accuracy_m": 15},
        },
    )
    return create_permit(actor, _permit_values(actor, quadrant, kind.pk))


def ensure_release_device(
    organization: Organization, actor: UploadActor, lot: Lot
) -> ReleaseDevice:
    """The demo release device fed by the biological lot, found by code (writes)."""
    existing = ReleaseDevice.objects.filter(organization=organization, code=DEVICE_CODE).first()
    if existing is not None:
        return existing
    return create_release_device(
        actor,
        {"code": DEVICE_CODE, "quadrant_id": lot.quadrant_id, "source_lot_id": lot.pk},
    )
