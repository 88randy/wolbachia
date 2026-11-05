"""Limit multipart file bytes before Django's memory/disk upload handlers consume them."""

from typing import Any, cast

from django.core.files.uploadhandler import FileUploadHandler, StopUpload
from rest_framework.throttling import UserRateThrottle

from scheduling.csv_import import MAX_UPLOAD_BYTES


class RiskUploadThrottle(UserRateThrottle):
    scope = "risk_import_upload"


class BoundedRiskUploadHandler(FileUploadHandler):
    def __init__(self, request: Any) -> None:  # noqa: ANN401
        super().__init__(request)
        self.received = 0

    def receive_data_chunk(self, raw_data: bytes, start: int) -> bytes:
        self.received += len(raw_data)
        if self.received > MAX_UPLOAD_BYTES:
            cast(Any, self.request).risk_upload_too_large = True
            raise StopUpload(connection_reset=False)
        return raw_data

    def file_complete(self, file_size: int) -> None:
        return None
