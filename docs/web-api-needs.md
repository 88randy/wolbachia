# Endpoints needed by the web

This is a proposal, used as input for the OpenAPI + `packages/api-client` issue. Paths, names and payloads are **proposals**; the backend issue decides the final contract. Profile codes are defined in `docs/web-screens.md`.

## Cross-cutting conventions (proposed)

- **Base path and naming:** base is `/api/v1/`. Resources are plural kebab-case English nouns, and actions are `POST /<resource>/{id}/<verb>/`.
- **Organization:** taken from the authenticated user. Any `organization_id` sent by the client is ignored. Objects from another organization return `404`, not `403`, so their existence is not leaked.
- **No `DELETE` on business data.** Corrections use `POST …/void/` with `{ "reason_code": string, "reason"?: string }` (#80). Voided objects return `voided_at`, `voided_by`, `void_reason_code` and `void_reason`. Lists exclude them unless `?include_voided=true`.
- **Lists** support filters, `ordering`, and paging. Paging style per `docs/api-conventions.md` (page number for admin tables, cursor for streams).
  - Every list endpoint that backs a dashboard figure must accept the same filters the dashboard uses, so every number links to its records.
- **Exports:** `GET …/export/?format=csv|pdf`, applied server-side. Columns with personal data come out empty unless a valid data-transfer authorization exists (W59). Every export is logged in the access log (W60).
- **Objects by code:** objects with a human code (I-0236, OV-010, B-4471, C-07, D-0042) can be fetched by code (`/{code}/` or `?code=`). Final form: `?code=` on the list endpoint (`docs/api-conventions.md`).
- **Blocked actions:** an action that is blocked returns `409` with `{ "blocked_by": [{ "reason", "unblocked_by_role", "link" }] }`. The UI shows the reason and who unblocks it.
- **Errors:** follow DRF validation format, with `code` per field for i18n. Error envelope per `docs/api-conventions.md`.
- **Live data:** for live shifts, use a Django Channels WebSocket. Path and auth: #19.

## Auth, session, core

| Method | Path | Returns | Who | Screens |
|---|---|---|---|---|
| POST | /auth/login/ | web: session cookie + CSRF; mobile: tokens (#4); generic error message | public | W1 |
| POST | /auth/logout/ | 204 | all | — |
| POST | /auth/password-reset/ | 202 (same answer whether the account exists or not) | public | W1 |
| POST | /auth/password-reset/confirm/ | 204; body `{uid, token, new_password}`; `400 invalid_reset_token` or password validator codes in `fields.new_password` | public | W1 |
| GET | /auth/csrf/ | 204 + CSRF cookie; send it back as `X-CSRFToken` on every unsafe request, login included | public | W1 |
| GET | /me/ | user `{id, username, email, first_name, last_name}`, organization `{id, slug, name, country, timezone, languages, logo_url}` or `null` (several memberships and no `X-Organization`), profiles `[{slug, label_es, label_en}]`, `permissions[]`, scope (centers/quadrants), `organizations[{slug, name}]`; real shape in `docs/api-conventions.md` (#4). No epi week or user language yet | all | all |
| GET | /home/summary/ | attention items per profile, critical band, cards with counts + link filters | internal | W2 |
| GET | /search/?q= | results grouped by type, with `voided` flag; nothing from other orgs | internal | W3 |
| GET | /records/{type}/{code}/history/ | unified timeline of an object (readings, relocations, incidents, voids) | internal | W4 |
| GET | /notifications/ | paged, unread first, grouped by type | internal | W5 |
| POST | /notifications/{id}/read/ · /notifications/read-all/ | 204 | internal | W5 |
| GET/PUT | /me/notification-preferences/ | channel per type (in-app, email, both) | internal | W5 |

## Incidents

| Method | Path | Returns | Who | Screens |
|---|---|---|---|---|
| GET | /incidents/ | list with severity, type, status, due time, escalation level, what it blocks | SUP, COO, ADM | W6 |
| POST | /incidents/ | created incident (type from catalog; "Other" requires text) | internal | W6, W30, W34 |
| GET | /incidents/{id}/ | detail + timeline + required evidence by type | SUP, COO, ADM | W7 |
| POST | /incidents/{id}/comments/ | comment | SUP, COO, ADM | W7 |
| POST | /incidents/{id}/reassign/ · /change-severity/ | updated incident + timeline event | SUP, COO, ADM | W7 |
| POST | /incidents/{id}/close/ | closed incident; `400` if the evidence required by its type is missing | SUP, COO, ADM | W7 |
| POST | /incidents/{id}/void/ | voided incident | COO, ADM | W7 |

## Inventory

| Method | Path | Returns | Who | Screens |
|---|---|---|---|---|
| GET/POST/PATCH | /supply-types/ | supply types and attributes | ADM, ALM | W8 |
| POST | /supply-types/{id}/deactivate/ | deactivated type (in use = never removed) | ADM | W8 |
| GET/POST/PATCH | /lots/ | lots; `status` (draft, available, blocked + reason), expiry | ALM, SUP | W9, W10 |
| GET/POST | /lots/{id}/conditions/ | condition readings + allowed range; out of range → blocked + incident | ALM, ENT | W18 |
| GET | /lots/{id}/labels/?format=pdf | printable QR labels **[PENDING: generated by backend or web]** | ALM | W19 |
| GET/POST/PATCH | /locations/ | biofactories, warehouses, centers (GeoJSON point), owner, insecticide-free flag | ADM, ALM | W11 |
| GET | /locations/{id}/stock/ | stock per location | ADM, ALM, SUP | W11 |
| GET | /locations/{id}/movements/ | actual signed legs, exact source/unit version/author/time, dual location.read + lot.read, scoped filters before paging (#270) | current granted actions | W11 |
| GET | /locations/owner-options/ | minimal eligible membership_id/label under actual location.create or location.update; no role.read (#270) | current granted actions | W11 |
| GET | /locations/placement-options/ | closed location.create / lot.create modes or immutable lot.update context; real locations versus explicit center-only draft (#270) | current granted actions | W10, W11 |
| GET | /supply-types/protocol-incident-type-options/ | active latest incident-type VERSION UUID/code/label under supply create/update; no incident.read (#270) | current granted actions | W8 |
| GET/POST | /transfers/ | transfers and status | ALM, SUP | W12 |
| POST | /transfers/{id}/dispatch/ | dispatched; sender signature | ALM | W12 |
| POST | /transfers/{id}/receive/ | received; scanned vs expected; missing items with photo; receiver signature → discrepancy | SUP | W13 |
| GET | /discrepancies/ · /discrepancies/{id}/ | discrepancy, what it blocks, evidence | ALM, SUP | W14 |
| POST | /discrepancies/{id}/close/ | closed with reason | ALM, SUP | W14 |
| GET | /courier-assignments/suggestion/?date= | suggested material per courier from scheduled points | SUP | W15 |
| POST | /courier-assignments/ | assignment; courier signs on mobile | SUP | W15 |
| GET | /reconciliations/?date=&center= | assigned / used / returned / shrinkage / difference per courier | SUP | W16 |
| POST | /reconciliations/{id}/justify/ | justified line | SUP | W16 |
| POST | /write-offs/ · GET /write-offs/ | write-off with reason, evidence, owner; biological ones require an RPBI receipt | ALM, SUP, ENT | W17, W39 |

Inventory #270 also provides exact pinned Lot.supply_version, minimal retained
location_version and admission_id, Protocol.incident_type and Location.owner_label.
Lot labels require lot.read; current Location data still requires location.read.
Lot lists add current blocked_by facets and organization-local expiry_from_date /
expiry_before_date boundaries. See api-conventions.md for precise query modes,
write-payload mapping, errors and retained grants. Transfer/dispatch/reception rows
above remain #106/#107 plans, not implemented #270 operations.

## Fleet

| Method | Path | Returns | Who | Screens |
|---|---|---|---|---|
| GET/POST/PATCH | /motorcycles/ | list with km, next service, real vs expected efficiency, status | SUP, ADM | W20 |
| GET/POST | /motorcycles/{id}/services/ · /responsibility-letters/ · /fuel-loads/ | record tabs | SUP, ADM | W21 |
| GET | /motorcycles/{id}/incidents/ | incidents of that motorcycle | SUP, ADM | W21 |

## Quadrants, sampling, scheduling

| Method | Path | Returns | Who | Screens |
|---|---|---|---|---|
| GET | /quadrants/ | GeoJSON with center, courier, points, weekly progress | SUP, COO, ENT | W22 |
| GET | /quadrants/{id}/versions/ | version history | COO, ENT | W23 |
| POST | /quadrants/{id}/versions/ | new version; `409` until every point outside the polygon has a decision | COO, ENT | W23 |
| GET | /blocks/?quadrant= | blocks (GeoJSON) | ENT, COO | W24 |
| GET | /blocks/suggestion/?quadrant= | suggested blocks per organization rule | ENT, COO | W24 |
| GET/POST | /sampling-points/ | points with fixed code; warning when two points are closer than the configured minimum distance | ENT, COO | W24 |
| GET/PUT | /quadrant-assignments/ | courier ↔ quadrants, load vs target | SUP, COO | W25 |
| GET | /schedule/?week=&courier= | points to check / place / remove, sorted by risk | SUP | W26 |
| POST | /schedule/reassign-pending/ | reassigned items | SUP | W26 |
| GET | /risk-categories/ | category per block with origin (import / rule) | ENT | W27 |
| POST | /risk-category-imports/ → POST /risk-category-imports/{id}/apply/ | preview, then apply | ENT | W27 |

## Operations / supervision

| Method | Path | Returns | Who | Screens |
|---|---|---|---|---|
| GET | /shifts/?date=&status= | shifts of the day | SUP, COO | W28 |
| WS | live shift positions **[PENDING path]** | positions of open shifts only | SUP, COO | W28 |
| GET | /shifts/{id}/ | summary + timeline (GeoJSON track) | SUP | W29 |
| POST | /shifts/{id}/approve/ · /shifts/{id}/observe/ | approved, or returned to courier with reason | SUP | W29 |
| GET | /review-items/ | records flagged by system rules, with evidence | SUP | W30 |
| POST | /review-items/{id}/accept/ · /void/ · /open-incident/ | result | SUP | W30 |
| GET | /relocations/ | field proposals | SUP | W31 |
| POST | /relocations/{id}/approve/ · /reject/ | rejection creates a next-day task | SUP | W31 |
| GET/POST | /third-party-interventions/ | type (catalog), product, blocks, dates, source | SUP, ENT | W32 |
| GET | /quadrants/{id}/closure/ | ovitrap status and removal progress, blockers | SUP, COO | W33 |
| POST | /quadrants/{id}/close/ | closed; `409` with blockers | SUP, COO | W33 |

## Entomology lab

| Method | Path | Returns | Who | Screens |
|---|---|---|---|---|
| POST | /bags/receive/ | received bag by scan: code, block, reading, date, collector, `paddle_present` and `has_eggs` (from mobile; `has_eggs` is null without paddle); errors for "no reading" / "missing" (opens incident) | ENT | W34 |
| GET | /bags/?status= | bags pending count, counted, in recount | ENT | W34, W35 |
| POST | /bags/{id}/counts/ | egg count saved (entomologist + timestamp); next bag in queue | ENT | W35 |
| GET | /recounts/ · POST /bags/{id}/recount/ | recount by another person; all attempts kept. Trigger rule: **[PENDING]** | ENT | W36 |
| GET/POST | /egg-paddles/{id}/reuses/ | reuse count; a third use is rejected | ENT | W37 |
| GET/POST | /uieb-shipments/ | shipments | ENT, REG | W38 |
| GET | /uieb-shipments/{id}/annex-vi/?format=preview\|pdf | Annex VI; RFC empty without transfer authorization | ENT, REG | W38 |
| GET/POST | /wolbachia-samples/ · POST /wolbachia-samples/{id}/results/ | results; an invalid result is repeated and the previous attempt is kept | ENT | W40 |
| GET/POST | /material-requests/ | third-party requests | ENT, REG | W41 |
| POST | /material-requests/{id}/cenaprece-notification/ · /deliver/ | deliver returns `409` until the notification is recorded | ENT, REG | W41 |
| GET/POST | /larval-surveys/ | survey + computed indices + ICP bands (optional module) | ENT | W42 |

## Releases and permits

| Method | Path | Returns | Who | Screens |
|---|---|---|---|---|
| GET/POST/PATCH | /permit-types/ | permit types | REG, ADM | W43 |
| GET/POST | /permits/ | permits (GeoJSON zone), validity, requirements met | REG | W44, W45 |
| POST | /permits/{id}/suspend/ | suspended now; notifies couriers in the zone; reason required | REG | W45 |
| GET | /releases/ | releases with `blocked_by` conditions | COO, REG | W46 |
| GET | /release-devices/ | devices by status with source lot | ALM, COO | W47 |

## People and community

| Method | Path | Returns | Who | Screens |
|---|---|---|---|---|
| GET/POST/PATCH | /users/ | users; RFC always masked | ADM | W48, W49 |
| POST | /users/{id}/deactivate/ | deactivated (never deleted) | ADM | W48 |
| POST | /users/{id}/reveal-rfc/ | full RFC, one time, logged in the access log | ADM | W49 |
| POST | /users/{id}/revoke-device-sessions/ | signs the user out on their phone | ADM | W49 |
| GET/POST | /trainings/ · /users/{id}/trainings/ | courses, validity, enabled actions; per person | ADM | W50 |
| GET/POST | /evaluations/ | evaluation sheet; computed result. Section weights: **[PENDING]** | SUP, COO | W51 |
| GET/POST | /community-activities/ | activities with zone, attendance, agreements; no neighbor personal data | PRO | W52 |

## Dashboards and exports

| Method | Path | Returns | Who | Screens |
|---|---|---|---|---|
| GET | /dashboards/entomology/?week=&quadrant= | indices + configured bands + exclusions; each figure has `link_filters` for its list | ENT, COO, SUP | W53 |
| GET | /dashboards/prevalence/ | prevalence per quadrant with CI, release periods, threshold | ENT, COO | W54 |
| GET | /dashboards/operations/ | coverage, productivity vs target, closed houses, readings without count, fleet, supplies, sync | SUP, COO | W55 |
| GET | /dashboards/compare/?metric=&group_by= | values per center/quadrant | COO | W56 |
| GET/POST | /official-exports/ · GET /official-exports/{id}/preview/ | formats, preview, history | REG, ENT | W57 |

## Regulatory / privacy

| Method | Path | Returns | Who | Screens |
|---|---|---|---|---|
| GET/POST/PATCH | /arco-requests/ | type, received, legal deadline remaining, owner, status. Deadline: **[PENDING legal]** | REG | W58 |
| GET/POST | /data-transfer-authorizations/ · POST /{id}/revoke/ | authorizations | REG | W59 |
| GET | /access-log/ | read-only access log, filters, export | REG, ADM | W60 |
| GET/PATCH | /retention-policies/ · GET /retention-runs/ | policies and nightly runs with receipt | REG, ADM | W61 |

## Configuration

| Method | Path | Returns | Who | Screens |
|---|---|---|---|---|
| GET | /rule-parameters/ | current value + effective date per key (e.g. min point distance 50 m, max speed 10 km/h, revisit days) | ADM (read: internal) | W62 |
| POST | /rule-parameters/{key}/versions/ | new version with `effective_from`; never overwrites | ADM | W62 |
| GET | /rule-parameters/{key}/versions/ | history | ADM | W62 (author names and `include_voided`: #88, done) |
| GET | /catalogs/ · GET/POST/PATCH /catalogs/{slug}/items/ | catalogs (incl. motorcycle checklist, reasons, intervention types); "Other (specify)" fixed | ADM (read: internal) | W63 |
| POST | /catalogs/{slug}/items/{id}/deactivate/ | deactivated; "Other" returns `409` | ADM | W63 |
| GET/POST/PATCH | /incident-types/ | severity, owner, response time, escalation, blocks, required evidence | ADM | W64 |
| GET | /roles/ · PUT /roles/{id}/permissions/ | matrix profile × action with scope; external roles read-only | ADM | W65 |
| GET/POST | /api-keys/ · POST /api-keys/{id}/revoke/ | secret returned only in the create response | ADM | W66 |
| GET/POST | /app-versions/ · PATCH /app-versions/minimum/ | published versions, signed APK upload, minimum version | ADM | W67 |
| GET | /devices/ | phones with app version | ADM | W67 |
| GET/PATCH | /organization/ | name, country, tz, epi week, languages, logo, label phone | ADM | W68 |

## Public portal (aggregated, no personal data)

| Method | Path | Returns | Who | Screens |
|---|---|---|---|---|
| GET | /portal/summary/ | headline figures with cut-off date | GOB | W69 |
| GET | /portal/map-layers/ · /portal/trends/ | aggregated indices per block, prevalence per quadrant, release zones with permit | GOB | W70 |
| GET | /portal/downloads/ · /portal/downloads/{id}/?format=pdf\|csv | reports with cut-off date | GOB | W71 |

Machine access via API keys (W66) uses the same `/portal/` endpoints, limited by the key's scope and rate limit. **[PENDING]** Confirm.

## W-03 web consumption limits (#147)

The merged B-01 serializers are authoritative: country is read-only; profile scope applies to its whole permission bundle. `Profile` lacks a fixed/external discriminator and a permission catalog. W65 conservatively locks empty/portal-only bundles without branching on names; explicit fixed metadata is required to distinguish a revoked internal bundle from a fixed external one. No per-action scopes, export/void endpoints, revision history or effective timestamps are projected. Memberships expose ids without user labels. The current logo validator accepts restricted PNG only; W68 normalizes all PNG/JPEG/WebP raster input through browser decoding and canvas to bounded RGB/RGBA PNG before multipart upload. Organization-global settings, roles and memberships have no center filter parameter; the shell selection is only applicable to resources declaring that parameter.
W63 (#35): the boolean `in_use` is shown with an accessible icon/text badge in Status.
The usage count, authorship and atomic reorder remain follow-up #182; the editor omits
the design's count and author columns until the API provides those fields.

## Laboratory API boundary (#114)

B-18 supplies the real Bag/Reading reception/count/rejection/correction APIs in
api-conventions.md, including current action-scoped queue and exact committed
next/replay snapshots, minimal SUP void contexts, public incident policy and named
method verification. Unknown scans create no parent. A missing method explicitly
blocks viability/rejection while simple counting remains available. Null/zero,
has_eggs=false, no effective reading, rejection and pending independent QA remain
distinct. The two rule labels use the current configuration UI/i18n pattern.

This backend change supplies no Lab client screen or scanner workflow. A future
client must retain command UUID/input, current org/session/paired authority, drafts
and ambiguous-write recovery, and must not select a new next candidate on a lost
reply. It must present actual method/configuration blockers and exact source proof,
not invent scientific defaults or delivery. #115 owns independent execution/blind
adjudication/paddle reuse; durable RecountRequest ids are the handoff, not a claim
that those operations already ran. Evidence follows the real sixth Lab parent.
