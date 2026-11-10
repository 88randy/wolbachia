# web/src/releases

Permit official documents (#354). `PermitDocumentPicker` accepts PDF, JPEG and PNG (the backend
limit is 10 MiB by default) and shows the file name and size before the upload.
`uploadPermitDocument` runs authorize, PUT and finalize through the existing upload endpoints and
returns the verified upload id for `official_document`. `downloadPermitDocument` calls
`GET /api/v1/permits/{id}/versions/{revision}/document/` (attachment, authorized per organization).
Backend upload error codes map to `errors.upload.*` keys through `uploadErrorKey`.
Field-evidence pickers stay images-only. Mobile does not upload permit documents.

## Permit types, permits and suspension (W43-W45, #166)

Folder `permits/`. Routes: `/releases/permit-types` (W43), `/releases/permits` (W44) and
`/releases/permits/<code>` (W45); all need `permit.manage` and the permit list uses the human code
resolved by `?code=` (an unknown, foreign or out-of-scope code is the same not-found state).

- Types need a whole-organization scope to be created; a permit needs at least one quadrant in
  scope. Otherwise the button is disabled and the reason is on screen. Suspend needs
  `permit.suspend` (hidden without it) and is disabled with its reason once suspended.
- The only requirement a type carries today is `max_gps_accuracy_m` (backend `validate_requirements`).
- Zone: pasted GeoJSON Polygon from the official document (shape-checked in the browser, validated by
  the backend). The record shows it as a vertex table; a map is not drawn yet.
- Dates are typed in the organization's zone and sent as UTC instants (`permit-dates.ts`).
- Suspension: reason (min 10, as the backend) plus `expected_revision`; a 409 refreshes the record and
  keeps the typed reason. The notice outcome per recipient kind comes from `suspension.notices`
  (`recorded` / `delivery_unavailable`, counts only); no channel is claimed beyond that.
- Backend contract added in the same PR: `center_code`, `quadrant_code`, `type_name` on `Permit` and
  `suspension.notices` (kind, status, count); `suspension` is nullable in the schema.
