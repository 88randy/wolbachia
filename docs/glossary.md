# Glossary: domain terms and their English names

One English name per domain term across backend, mobile and web. Spanish appears only in user-facing text (`packages/i18n`) and when talking with the client. Code, API routes, DB fields, events and logs use the **English name** below.

## Private evidence (#102)

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| carga de evidencia | evidence upload | Upload, upload_id | Private tenant-scoped identity; optional client_id preserves offline UUID. |
| autorización temporal de carga | upload lease | UploadLease, Upload-Lease | Append-only 15-minute authenticated PUT authorization. |
| recibo de bytes originales | upload source | UploadSource, sha256 | Immutable private original object; never served. |
| verificación de evidencia | upload verification | UploadVerification, verified_at | Sanitized image plus its separate SHA-256; no parent authority implied. |
| vínculo de evidencia | attachment link | AttachmentLink, context | One immutable authorized source/fault binding per upload. |

Rules:

- Add a row here **before** introducing a new domain term in code. If a term is missing, open an issue or add it in the PR that needs it, and flag it for review.
- Do not invent synonyms (`bike`, `worker`, `egg paper`, `batch`...). If you find one in code or docs, fix it or open an issue.
- Names are singular in code (`Quadrant`, `sampling_point`) and plural kebab-case in API routes (`/sampling-points/`), as in `docs/api-conventions.md`.

## Field work

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| ovitrampa | ovitrap | `ovitrap` | Trap that holds the egg paddle. Models `Ovitrap`, `OvitrapReading`; sync events `ovitrap.place|check|replace|relocate|remove`. |
| papeleta | egg paddle | `/egg-paddles/`, `paddle_present`, `paddle_type` | The courier only records presence and Yes/No eggs; never a count (decision 14). |
| ¿tiene huevos? | has eggs | `has_eggs` (`bool`, `null` when there is no paddle) | Yes/No by the courier; the egg count is the entomologist's (web). |
| folio | sampling point code | `/sampling-points/`, `code` on `SamplingPoint` | Fixed organization-unique sampling point code, retained across all location versions (e.g. OV-010). |
| punto de muestreo | sampling point | `sampling_point` | Immutable identity (code/folio and block); PointVersion appends location and retirement history. |
| manzana | block | `/blocks/`, `block` | Organization-coded child of a quadrant; BlockVersion appends polygon history. |
| cuadrante | quadrant | `/quadrants/`, `quadrant` | Organization-coded work area belonging to a Center; QuadrantVersion is append-only. Current geometry is the highest revision; captured_at resolves past geometry. |
| resoluci?n de punto excluido | excluded point resolution | `ExcludedPointResolution`, `point_resolutions` | Authored keep/move/remove decision with evidence for every point outside a proposed quadrant geometry; remove appends a retired PointVersion. |
| jornada | shift | `/shifts/`, `shift` | Courier's work day, from start to closing. |
| lectura desfasada | lagged reading | `is_lagged` | Reading outside the expected interval (rule from rule parameters). |
| hallazgo | finding | `finding` | Result noted when checking an ovitrap. |
| casa cerrada | closed house | — (not defined yet) | Visit result: nobody let the courier in. |
| semana epidemiológica | epi week | `epi_week` | Always "epi week" in code and docs; never "epidemiological week". |
| colocar | place | `place` (action) | Fixed action on an ovitrap. Event `ovitrap.place`. |
| revisar | check | `check` (action) | Fixed action. |
| reemplazar | replace | `replace` (action) | Fixed action. |
| reubicar | relocate | `relocate` (action), `/relocations/` | Fixed action; also a proposal that the supervisor approves. |
| retirar | remove | `remove` (action) | Fixed action. |
| resolución de retiro no recuperado | removal resolution | `RemovalResolution`, `removal.resolve` | Supervisor's append-only recovered_later or written_off disposition for one removal; original recovery evidence remains unchanged. |
| bolsa | bag | `/bags/`, `bag_code` | Bag with the paddle sent to the lab. |
| muestra | sample | `/wolbachia-samples/`, `sample` | Lab sample (e.g. for Wolbachia results). |


## Configuration

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| catálogo | catalog | `/catalogs/`, `Catalog`, `slug` | Per-organization option list (e.g. `removal-reason`). Created by the seed; `is_open` says it ends with "Other". |
| opción de catálogo | catalog item | `/catalogs/{slug}/items/`, `CatalogItem`, `code` | One option; deactivated (`is_active`), never deleted. Labels `label_es` / `label_en` are data. |
| Otro (especificar) | other item | `is_other`, code `other` | Fixed last item of an open catalog; cannot be deactivated; choosing it requires free text. |
| parámetro de regla | rule parameter | `/rule-parameters/`, `RuleParameter`, `key` | A threshold (e.g. `max_distance_to_point_m`) with type, unit and optional bounds. |
| versión de parámetro | rule parameter version | `/rule-parameters/{key}/versions/`, `RuleParameterVersion` | One value from `effective_from` on; insert-only; voided (not deleted) if wrong and still scheduled. |
| modo de alcance | scope mode | `scope.centers.mode`, `scope.quadrants.mode` | Explicit none/selected/all; empty selected denies, all requires an explicit grant, selected never expands to new centers. |
| alcance efectivo | effective scope | `effective_scope` | The action-granting profile scope intersects membership scope in both applicable dimensions; unrelated grants never combine into a new pair. |
| revisión de configuración | configuration revision | `ConfigurationRevision`, `revision`, `expected_revision` | Immutable authored snapshot of organization settings, profile permissions or membership assignments. |
| paquete de configuración | snapshot | `/field/catalog/`, `/field/rules/`, `version` | Compact copy of a configuration that the phone keeps offline; `version` is a content hash and the `ETag`. |


## Release

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| liberación | release | `/releases/`, `release` | Release of Wolbachia mosquitoes. Not an app release: app builds are `app-versions` (`/app-versions/`). |
| dispositivo de liberación | release device | `/release-devices/`, `release_device` | |
| permiso | permit | `/permits/`, `permit` | Authorization for a release zone; may expire (`PermitExpiredError`). |

## Inventory and money-like control

Inventory foundation (#105) retains these distinct facts: `SupplyTypeVersion`
(supply master revision), `BiologicalProtocolVersion` (named ranges/shelf life and
reading windows), `LocationVersion` (storage master revision), `LotVersion` (lot
draft/detail revision), `LotAdmission` (authored opening custody), `Piece` (immutable
inventory identity), `StockOperation`/`StockMovement` (source and signed ledger leg),
`ConditionReading` (both clocks and evaluated protocol), `ConditionBreach` (owned
hold), `ConditionIncidentLink` (once-only incident linkage) and
`AutomaticIncidentOrigin` (explicit system source). A piece is not implicitly an
Ovitrap/client UUID. Stock is a physical quantity, never financial valuation.

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| insumo | supply | `/supply-types/`, `supply` | Anything the courier is assigned and consumes. |
| lote | lot | `/lots/`, `lot` | Lot of a supply (`ReleaseLot` for release lots). |
| merma | shrinkage | `shrinkage` | Expected or unexplained loss in a reconciliation. |
| baja | write-off | `/write-offs/`, `write_off` | Removal from stock, with reason and evidence. |
| conciliación | reconciliation | `/reconciliations/`, `reconciliation` | Assigned vs used vs returned, per courier and day. |
| discrepancia | discrepancy | `/discrepancies/`, `discrepancy` | Unjustified difference found in a reconciliation or reception. |
| centro | center | `/centers/`, `Center`, `code`, `name`, `is_active` | Organization-scoped operational center; code unique per organization, deactivate rather than delete. US spelling, never "centre". |

## People

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| repartidor | courier | `courier` | The field user of the mobile app. Not "worker", "delivery worker" or "field user". |
| entomólogo | entomologist | `entomologist` | Counts eggs in the web. |
| promotor | community promoter | `community_promoter` | Short form in UI profile codes: PRO. |
| supervisor | supervisor | `supervisor` | |
| membresía [ASSUMPTION: Spanish label] | membership | `Membership`, `memberships`, `is_active` | A user's place in one organization: its profiles (roles) and work scope. |

## Fleet

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| evento de bloqueo de motocicleta | motorcycle block event | `MotorcycleBlockEvent`, `action` (`block`, `unblock`) | Insert-only audit of severe-check blocks and manual unblocks; stores the actor and reason. |
| motocicleta | motorcycle | `/motorcycles/`, `motorcycle` | Never "bike". |
| revisión de la moto | motorcycle check | `MotorcycleCheck`, `checks`, `result` (`ok`, `minor`, `severe`) | One line of the checklist done when the shift opens; the items are the catalog `motorcycle-check-item`. A `severe` result blocks the motorcycle. |
| odómetro | odometer | `odometer_km`, `odometer_open_km`, `odometer_close_km` | Kilometers shown by the motorcycle. Never "mileage". |

## Records and corrections

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| anulación | void | `POST .../void/`, `voided_at`, `voided_by`, `void_reason`, `void_reason_code` | Nothing is deleted; a void references the original (decision 3). |
| incidencia | incident | `/incidents/`, `incident` | |

## Sync

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| lote de sincronización | sync batch | `events` in `POST /field/sync/` | The events the phone uploads in one request. Never "batch" for supply lots (that is `lot`). |
| evento de campo | field event | `FieldEvent`, `event`, `/field/sync/` | One immutable record sent by the phone; its id is a UUID generated on the phone. Status `accepted`, `rejected` or `in_review`. |
| elemento de revisión | review item | `ReviewItem`, `/review-items/` [ASSUMPTION: Spanish label] | What a supervisor must look at: a rejected or in-review field event. Insert-only; decisions arrive with #22. |

## Devices and sessions

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| teléfono / dispositivo (del repartidor) | device | `Device`, `/devices/`, `device_id` | The registered phone of the mobile app. Never `release_device` (that is release equipment) and never "terminal" or "handset". |
| sesión del dispositivo | device session | `DeviceSession`, `revoke-device-sessions` | One login of a user on a device: an access + refresh token pair, revoked and never deleted. |
| baja del dispositivo | device revocation | `POST /devices/{id}/revoke/`, `is_revoked` | Lost or retired phone: it cannot log in again. |
| última carga | final upload | `final_upload_deadline`, `X-Session-Revoked`, `FinalUploadMixin` | The one upload a revoked phone may still make. |
| — | token pair | `TokenPair`, `accounts/token_pairs.py` | Hashes of one access + refresh pair of a device session. A refresh consumes its pair and issues a child pair. Live families are kept in full for reuse detection. Ended families are pruned together by retention (#54); their device session audit row is kept. |
| — | sibling pair | `is_retired_sibling`, `MAX_SIBLING_PAIRS` | A pair reissued for a lost refresh response inside the grace window. Per parent, only the first sibling used stays valid. |
| — | session revision | `currentRevision()`, `web/src/session/session-revision.ts` | Web counter that changes only on an accepted login and a confirmed sign-out. Tells whether a response still belongs to the current session, without clocks or booleans. |

## Resolved conflicts (2026-11-03)

- `Bike`/`BikeCheck`/`bike-check-item` → `Motorcycle`/`MotorcycleCheck`/`motorcycle-check-item` (#3, #8).
- `Trap`/`TrapReading`/`trap.*` → `Ovitrap`/`OvitrapReading`/`ovitrap.*` (#5, #9, #14).
- "worker", "field worker", "field user", "delivery worker" → `courier`; profile slug `courier` (#2, #9, #13, #14, decision 4).
- "egg paper" → `egg paddle` (#21). "epidemiological week" → `epi week` (#38, CLAUDE.md).
- `/mobile-releases/` → `/app-versions/` (`docs/web-api-needs.md`).


## Ovitrap provenance (#111)

| Term | English code | Meaning |
| --- | --- | --- |
| Physical ovitrap UUID | client_uuid | Phone-generated identity, unique per organization; public id/code and sync ovitrap_id. Internal PK is generated separately by the server. |
| Placement attempt | PlacementAttempt | Immutable applied placement plus opaque supply/evidence UUID refs; doubtful attempts remain only in FieldEvent/ReviewItem. |
| Ovitrap reading | OvitrapReading | Event-unique visit, conditional eggs and retained point/rule/catalog provenance. |
| Ovitrap void lifecycle | OvitrapVoid | New authored lifecycle record linking a record.void event to its target; no original row is deleted. |
| Index exclusion | is_index_excluded | Derived lagged exclusion provenance; does not remove lab countability. |
| Archived catalog | CatalogSnapshot | Exact immutable delivered catalog content resolved by organization and submitted version hash. |


## Scheduling and risk (B-12)

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| carga de importaci?n de riesgo | risk import upload | RiskImportUpload, upload_id | Immutable bounded CSV bytes and SHA-256, organization/author scoped. |
| importaci?n de riesgo | risk import | RiskImport, /risk-category-imports/ | Immutable preview; unique appended RiskImportApplication applies it once. |
| versi?n de categor?a de riesgo | risk category version | RiskCategoryVersion, /risk-categories/ | Block/epi-week, source/origin/protocol provenance; never permit authority. |
| versi?n de asignaci?n | assignment version | AssignmentVersion, /quadrant-assignments/ | Retained quadrant/courier validity history. |
| tarea programada | scheduled task | ScheduledTask, /schedule/ | Unique point/action/local due date. |
| titularidad de tarea | task ownership | TaskOwnership, revision | Append-only courier decision; highest revision owns the task. |
| revisi?n de agenda | schedule revision | ScheduleRevision, expected_revision | Organization counter serializes planning changes. |
| meta diaria de tareas | daily task target | daily_task_target | Configurable operational target, never a hard cap. |

## Offline day work (#135)

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| tarea asignada | assigned task | `AssignedTask`, `assignments` | Downloaded scheduling assignments v2 task (#109): code -> point_code, point -> point_id, revision -> version, category -> risk. quadrant_assignment is ownership metadata, never a task. No server completion status or coordinates; [ASSUMPTION] progress uses local captures and server removal, while optional location/reference/history enrichment awaits #196. |
| manifiesto de mapa | map manifest | `MapManifest`, `map_manifests` | Licensed offline asset metadata (asset id/version/hash/size/quadrant); it does not publish a download URL or certify local file readiness. |

## Scoped incidents (#104)

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| versión de tipo de incidente | incident type version | IncidentTypeVersion, type_id | Immutable UUID pins explicit SLA, severity, evidence and named chain. |
| incidente reportado | reported incident | Incident, kind=reported | Separate from legacy fleet MotorcycleBlockEvent IDs. |
| evento de incidente | incident event | IncidentEvent, expected_revision | Append-only full state/comment/closure snapshot. |
| bloqueo propio | owned blocker | IncidentBlocker | Only its owning incident can resolve it. |
| acuse de escalamiento | escalation receipt | EscalationReceipt | Unique stage/deadline; final reminders also use rolling hours. |
| intención de aviso | notice intent | IncidentNoticeIntent | Durable scoped B-07 producer fact, never delivery proof. |
| origen de incidente | incident origin | IncidentOrigin | Explicit adoption of an opaque ovitrap marker; no historic ID rewrite. |
