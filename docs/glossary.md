# Glossary: domain terms and their English names

One English name per domain term across backend, mobile and web. Spanish appears only in user-facing text (`packages/i18n`) and when talking with the client. Code, API routes, DB fields, events and logs use the **English name** below.

## UIEB shipment and transfer eligibility (#118)

| Spanish | English name in code | Notes |
| --- | --- | --- |
| envío UIEB | UiebShipment | Immutable technical source projection with cutoff and linked supersession. |
| fuente de envío | ShipmentSource | Genuine selected Bag, WolbachiaSample or Lot identity; not a legal Annex VI template. |
| muestra de Wolbachia | WolbachiaSample | Canonical minimal B21 identity with actual collection event, origin, method and Reading or Lot provenance. |
| solicitud de material | MaterialRequest | Actual recipient, lot, storage, unit, quantity and optional piece. |
| evidencia de notificación CENAPRECE | NotificationEvidence | Recorded reference/date and verified owned private upload. |
| recibo de entrega | DeliveryReceipt | Unique authenticated command, verified signature and one real stock debit. |
| autorización de transferencia | DataTransferAuthorization | Exact recipient/purpose/field, actual scope pair and explicit validity interval. |
| revocación de transferencia | DataTransferRevocation | Append-only withdrawal; never rewrites earlier evidence or stores an RFC value. |

## Private evidence (#102)

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| carga de evidencia | evidence upload | Upload, upload_id | Private tenant-scoped identity; optional client_id preserves offline UUID. |
| autorización temporal de carga | upload lease | UploadLease, Upload-Lease | Append-only 15-minute authenticated PUT authorization. |
| recibo de bytes originales | upload source | UploadSource, sha256 | Immutable private original object; never served. |
| verificación de evidencia | upload verification | UploadVerification, verified_at | Sanitized image plus its separate SHA-256; no parent authority implied. |
| vínculo de evidencia | attachment link | AttachmentLink, context | Exactly one immutable field_event, motorcycle_fault, incident, review_item or transfer_event parent per upload. Current parent authorization is rechecked; retained verification never grants permanent access or reparenting. |

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
| sugerencia de reubicación | relocation advisory | `/field/ovitrap-advisories/{id}/`, `as_of` | Optional point-wide OP03 aggregate at an explicit source cutoff with observed rule provenance; neither original capture proof nor capture permission. |
| retirar | remove | `remove` (action) | Fixed action. |
| resolución de retiro no recuperado | removal resolution | `RemovalResolution`, `removal.resolve` | Supervisor's append-only recovered_later or written_off disposition for one removal; original recovery evidence remains unchanged. |
| bolsa | bag | `/bags/`, `bag_code` | Bag with the paddle sent to the lab. |
| muestra | sample | `/wolbachia-samples/`, `sample` | Lab sample (e.g. for Wolbachia results). |


## Configuration

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| catálogo | catalog | `/catalogs/`, `Catalog`, `slug` | Per-organization option list (e.g. `removal-reason`). Created by the seed; `is_open` says it ends with "Other". |
| opción de catálogo | catalog item | `/catalogs/{slug}/items/`, `CatalogItem`, `code` | One option; deactivated (`is_active`), never deleted. Labels `label_es` / `label_en` are data. |
| revisión de catálogo | catalog revision | `Catalog.revision`, item `catalog_version`, request `version` | Integer counter for one Catalog, checked by reorder and conditional availability. Item responses retain that write's revision; field configuration snapshot versions are separate content hashes. |
| Otro (especificar) | other item | `is_other`, code `other` | Fixed last item of an open catalog; cannot be deactivated; choosing it requires free text. |
| parámetro de regla | rule parameter | `/rule-parameters/`, `RuleParameter`, `key` | A threshold (e.g. `max_distance_to_point_m`) with type, unit and optional bounds. |
| versión de parámetro | rule parameter version | `/rule-parameters/{key}/versions/`, `RuleParameterVersion` | One value from `effective_from` on; insert-only; voided (not deleted) if wrong and still scheduled. |
| modo de alcance | scope mode | `scope.centers.mode`, `scope.quadrants.mode` | Explicit none/selected/all; empty selected denies, all requires an explicit grant, selected never expands to new centers. |
| alcance efectivo | effective scope | `effective_scope` | The action-granting profile scope intersects membership scope in both applicable dimensions; unrelated grants never combine into a new pair. |
| contexto de captura | capture context | `capture_context` | Current self effective `field_event.sync` whole paired grants observed in bootstrap/changes; neither immutable original authority nor a permanent offline permission. |
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
| vida útil | shelf life | `shelf_life_seconds` | Explicit elapsed duration from the laid-on local midnight, added in UTC. A calendar `expiry_date` instead ends at its following local midnight; neither supplies a scientific default (#105). |
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
| actividad comunitaria | community activity | `CommunityActivity`, `/community-activities/` | One aggregate attendance observation, not a resident list or a unique-person metric. Public `zone_id` is the actual Block UUID and retains its BlockVersion. |
| vínculo de queja | complaint incident link | `ComplaintIncidentLink` | Immutable link to a real reported Incident in the same pair; it never grants Incident/evidence read authority or closes independent holds. |
| recibo de actividad | community command receipt | `CommunityCommandReceipt` | Exact original actor/body/target/origin identity; HTTP never fabricates a FieldEvent and cross-origin reuse conflicts. |

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| anulación | void | `POST .../void/`, `voided_at`, `voided_by`, `void_reason`, `void_reason_code` | Nothing is deleted; a void references the original (decision 3). |
| incidencia | incident | `/incidents/`, `incident` | |

## Sync

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| lote de sincronización | sync batch | `events` in `POST /field/sync/` | The events the phone uploads in one request. Never "batch" for supply lots (that is `lot`). |
| evento de campo | field event | `FieldEvent`, `event`, `/field/sync/` | One immutable record sent by the phone; its id is a UUID generated on the phone. Status `accepted`, `rejected` or `in_review`. |
| elemento de revisión | review item | `ReviewItem`, `/review-items/` [ASSUMPTION: Spanish label] | A rejected or in-review field event for supervisor review. Insert-only ingest history; later ReviewDecision records remain separate. |

## Devices and sessions

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| teléfono / dispositivo (del repartidor) | device | `Device`, `/devices/`, `device_id` | The registered phone of the mobile app. Never `release_device` (that is release equipment) and never "terminal" or "handset". |
| sesión del dispositivo | device session | `DeviceSession`, `revoke-device-sessions` | One login of a user on a device: an access + refresh token pair, revoked and never deleted. |
| auditoría del fin de sesión | session-end audit | `ended_at`, `end_basis`, `retention_anchor`, `dissociated_at` | Truthful closed-session proof; legacy unknown end keeps a distinct cutover anchor. Direct session-person references are removed after configured retention; device/business/log correlation remains separate. |
| retención por investigación de seguridad | session audit hold | `hold_until`, `hold_purpose`, `hold_reference` | Finite, session-specific operator action; blocks audit dissociation only, not TokenPair pruning. No permanent/public grant or implied legal certification. |
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

## Append-only review decisions (#113)

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| decisión de revisión | review decision | ReviewDecision | Separate immutable audit; original ingest never rewritten. |
| recibo de efecto | effect receipt | ReviewEffectReceipt | Exactly-once applied operation or proven legacy adoption. |
| disposición de seguridad | safety disposition | ReviewSafetyDisposition | Current administrative attestation with real inspection/proof; only its source hold. |
| validación de jornada | shift validation | ShiftDecision | Approve/observe a CLOSED frame, independent from Shift lifecycle. |
| historial del recolector | courier history | CourierHistoryEntry | One typed producer with actual CourierChange/publication receipt and current scope. |
| resolución de dependencia | dependency resolution | ReviewDependencyResolution | Exact append-only parent proof; no automatic child replay. |
| reserva de identidad padre | parent claim | ReviewParentClaim | Immutable typed identity reservation for one source; cancellation does not reassign it or authorize a child. |

## Geography decisions (#126)

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| decisión de reubicación | relocation decision | RelocationDecision | Terminal audit references the immutable proposal source. |
| tarea del día siguiente | next-day task | NextDayTask | Unique proposal/decision provenance to a real ScheduledTask on the next org-local date. |
| intervención de terceros | third-party intervention | ThirdPartyIntervention | Metadata across authorized real blocks; no company release authority. |
| cierre de cuadrante | quadrant closure | QuadrantClosure | Immutable audit of one published QuadrantVersion; no implicit reopening. |

## Signed facility custody (#106)

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| transferencia | transfer | Transfer, `/transfers/` | Signed expected manifest between two real locations; preparation reserves no stock. |
| evento de transferencia | transfer event | TransferEvent | Immutable prepared/dispatch/receive/resolution fact; event UUID differs from transfer and stock operation UUIDs. |
| línea esperada | transfer line | TransferLine | Exact lot/optional piece/unit/quantity and both retained location versions. |
| recepción real | transfer receipt line | TransferReceiptLine | Independently signed actual receipt, bounded by expected dispatch. |
| mercancía en tránsito | outstanding custody | outstanding | Derived unreceived dispatch; never a spendable location or balance. |
| resolución de discrepancia | discrepancy resolution | DiscrepancyResolution, ResolutionOutcome | Complete accountable partition; bounded recovery/return or reference to a real separate signed correction. |
| sobrante sin identificar | unidentified extra | unidentified_extra | Literal observation under an authorized real transfer, no resource FK or stock credit. |
| recibo de comando | transfer command receipt | TransferCommandReceipt | Immutable replay proof; internal persistence, not delivery or a new client command on close. |
| padre de evidencia de transferencia | transfer event parent | transfer_event | Fifth closed upload parent for HTTP custody; source captures retain their actual FieldEvent primary parent. |

## Laboratory first-pass results (#114)

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| recepción de laboratorio | bag receipt | BagReceipt, /bags/receive/ | A real authorized Reading; no-paddle has a null Bag and no count expectation. No courier delivery claim. |
| discrepancia de recepción | reception discrepancy | ReceptionDiscrepancy | Real expected/missing or ineffective-source cause, distinct from facility-transfer discrepancies. |
| política de incidencias de recepción | reception incident policy | ReceptionIncidentPolicyVersion | Public CAS mapping to exact real incident-type versions; configuration can remain pending. |
| método de laboratorio | lab method | LabMethod, LabMethodVersion | Named immutable procedure/reference and retained verification; not a seeded scientific approval. |
| primer conteo | first-pass egg count | EggCountAttempt | Authoritative nonnegative integer; zero is an observation, never missing data. |
| huevos examinados | examined eggs | total_examined | Sample denominator retained with viable_eggs; no inferred relation to full paddle count. |
| viabilidad | viability | viability_percent | Decimal6 ratio of viable/examined; null reason distinguishes zero_examined and not_requested. |
| rechazo de laboratorio | lab rejection | LabRejection | Reasoned named-method result with exact verified private evidence, never value zero. |
| anulación de resultado | lab result void | LabResultVoid, LabResultRevision | Immutable catalog reason/note and optional atomic same-Bag replacement. |
| solicitud de reconteo independiente | recount request | RecountRequest | Durable first-counter/source/rule cause; #115 owns execution, adjudication and reuse. |
| muestra diaria de control | daily recount sample | DailyRecountSample | Closed org-local-day population/selection proof; a request is not an executed recount. |

## Courier custody additions (#107)

SupplyAssignment: explicit courier custodian/dated immutable plan, not a Location.
OriginReleaseProof: genuine origin eligibility and reservation manifest, not receipt.
SupplyReceipt: signed actual credited custody; zero differs from missing receipt.
ReceiptDraft: retained owner-bound phone observation of original release lines;
local signing and server credit/review are distinct facts.
SupplyUse / SupplyShrinkage: explicit source/line deltas in the original declared unit.
ReturnDeclaration: uncredited courier statement. ReturnAcceptance: separately signed
warehouse custody transfer to the real destination. ReconciliationVersion: immutable
R-U-T-S frame, with separate Q-R delivery variance. SupplyDiscrepancy: one retained
case per reconciliation; SupplyDiscrepancyDecision explains one exact frame without
inventing stock. InventoryIntent: concrete immutable HTTP evidence declaration,
before operational execution. LotWriteOff: numeric loss from available Location
custody. BagDisposition: whole real Bag disposal preserving Lab/source/QA history.
CourierTransitPolicyVersion: named authored evidence-review procedure, not a seeded
scientific recipe or a storage certification. Material unavailable: actual disposed
material cannot support another physical act even when its audit can be corrected.

## Training and evaluations (#101)

| Spanish | English name | Meaning |
| --- | --- | --- |
| curso | Training, TrainingVersion | Stable course identity and explicitly configured immutable validity/action version. |
| certificación | Certification, CertificationRevocation | Evidence-backed subject/context qualification and append-only effective withdrawal; a score is not a certificate. |
| requisito de capacitación | ActionTrainingRequirementVersion | Nonempty exact acceptable training/version pins for a real action/context/effective instant. |
| rúbrica | EvaluationRubric, EvaluationRubricVersion | Stable identity and immutable weights/threshold/critical checks, without retroactive rescoring. |
| evaluación | Evaluation, EvaluationAttempt, EvaluationCompletion, EvaluationVoid | Retained observation/successor, genuine server completion order and reasoned void fact. |
| recibo de evaluación de elegibilidad | EligibilityAssessmentReceipt | Genuine self/session semantic publication proof; historical scalar pair UUID permits token pruning. |
| causa de aviso de capacitación | TrainingNoticeCause | Unique actual third-adverse episode or certificate-expiry cause, distinct from delivery. |
| intención de aviso | TrainingNoticeIntent, TrainingNoticeRoute, TrainingNoticePublication | Current authorized retained routing and truthful unpublished/unavailable observations. |
| comando de capacitación | PeopleCommand | Immutable exact UUID/body/subject response receipt, independently reauthorized on replay. |

## Independent observations and physical paddle reuse (#115)

RecountClaim: an authenticated counter's append-only second/third role claim for
one actual RecountRequest and first-result frame. RecountAttempt: a genuine new
independent observation, separate from the immutable first-pass population.
RecountResolution: a reasoned selection of an exact first/second/third candidate,
never an averaged or edited first value. LabQAPolicyVersion: the single authored
tolerance/method configuration, with no inferred scientific verification.
Numeric disclosure: a minimal actor/first-attempt publication receipt; no copied
value and no certification of knowledge outside the system.
EggPaddle: a forward proven physical identity for one actual inventory Piece.
PaddleBagBinding: immutable Bag/Reading/source and issued-unit proof for one
physical cycle. PaddleReuse: an authored verified-treatment fact retaining its
current negative QA/material/rule frame. PaddleStockReturn: a concrete exactly-once
same-Piece/lot/unit recovery backed by a genuine consumed debit and cycle; it never
reverses SupplyUse or invents a facility transfer.
