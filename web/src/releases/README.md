# web/src/releases

Permit official documents (#354). `PermitDocumentPicker` accepts PDF, JPEG and PNG (the backend
limit is 10 MiB by default) and shows the file name and size before the upload.
`uploadPermitDocument` runs authorize, PUT and finalize through the existing upload endpoints and
returns the verified upload id for `official_document`. `downloadPermitDocument` calls
`GET /api/v1/permits/{id}/versions/{revision}/document/` (attachment, authorized per organization).
Backend upload error codes map to `errors.upload.*` keys through `uploadErrorKey`.
Field-evidence pickers stay images-only. Mobile does not upload permit documents.
