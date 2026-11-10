"""Authorized byte read of a permit version's official document."""

import hashlib
from uuid import UUID

from django.http import Http404, HttpResponse

from releases.models import PermitVersion
from uploads.access import UploadActor
from uploads.exceptions import UploadStorageError
from uploads.storage import read_object


def permit_document_response(actor: UploadActor, permit_id: UUID, revision: int) -> HttpResponse:
    """Serve the original bytes as a download, never inline (PDFs may carry active content)."""
    version = (
        PermitVersion.objects.filter(
            organization=actor.organization, permit_id=permit_id, revision=revision
        )
        .select_related("official_document")
        .first()
    )
    if version is None:
        raise Http404
    document = version.official_document
    content = read_object(document.object_key)
    if (
        len(content) != document.size_bytes
        or hashlib.sha256(content).hexdigest() != document.sha256
    ):
        raise UploadStorageError
    response = HttpResponse(content, content_type=document.content_type)
    response["Cache-Control"] = "private, no-store"
    response["Pragma"] = "no-cache"
    response["X-Content-Type-Options"] = "nosniff"
    response["Content-Disposition"] = f'attachment; filename="permit-document-{revision}"'
    return response
