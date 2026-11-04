# Glossary: domain terms and their English names

One English name per domain term across backend, mobile and web. Spanish appears only in user-facing text (`packages/i18n`) and when talking with the client. Code, API routes, DB fields, events and logs use the **English name** below.

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
| folio | sampling point code | `/sampling-points/`, `code` on `sampling_point` [ASSUMPTION] | Fixed human code of a sampling point (e.g. OV-010). |
| punto de muestreo | sampling point | `sampling_point` | Has a code (folio). |
| manzana | block | `/blocks/`, `block` | City block that groups sampling points. |
| cuadrante | quadrant | `/quadrants/`, `quadrant` | Work area assigned to a courier; versioned. |
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
| paquete de configuración | snapshot | `/field/catalog/`, `/field/rules/`, `version` | Compact copy of a configuration that the phone keeps offline; `version` is a content hash and the `ETag`. |

## Release

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| liberación | release | `/releases/`, `release` | Release of Wolbachia mosquitoes. Not an app release: app builds are `app-versions` (`/app-versions/`). |
| dispositivo de liberación | release device | `/release-devices/`, `release_device` | |
| permiso | permit | `/permits/`, `permit` | Authorization for a release zone; may expire (`PermitExpiredError`). |

## Inventory and money-like control

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| insumo | supply | `/supply-types/`, `supply` | Anything the courier is assigned and consumes. |
| lote | lot | `/lots/`, `lot` | Lot of a supply (`ReleaseLot` for release lots). |
| merma | shrinkage | `shrinkage` | Expected or unexplained loss in a reconciliation. |
| baja | write-off | `/write-offs/`, `write_off` | Removal from stock, with reason and evidence. |
| conciliación | reconciliation | `/reconciliations/`, `reconciliation` | Assigned vs used vs returned, per courier and day. |
| discrepancia | discrepancy | `/discrepancies/`, `discrepancy` | Unjustified difference found in a reconciliation or reception. |
| centro | center | `center` | Operational center (US spelling, never "centre"). |

## People

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| repartidor | courier | `courier` | The field user of the mobile app. Not "worker", "delivery worker" or "field user". |
| entomólogo | entomologist | `entomologist` | Counts eggs in the web. |
| promotor | community promoter | `community_promoter` | Short form in UI profile codes: PRO. |
| supervisor | supervisor | `supervisor` | |

## Fleet

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| motocicleta | motorcycle | `/motorcycles/`, `motorcycle` | Never "bike". |

## Records and corrections

| Spanish | English name in code | API / field form | Notes |
| --- | --- | --- | --- |
| anulación | void | `POST .../void/`, `voided_at`, `voided_by`, `void_reason` | Nothing is deleted; a void references the original (decision 3). |
| incidencia | incident | `/incidents/`, `incident` | |

## Resolved conflicts (2026-11-03)

- `Bike`/`BikeCheck`/`bike-check-item` → `Motorcycle`/`MotorcycleCheck`/`motorcycle-check-item` (#3, #8).
- `Trap`/`TrapReading`/`trap.*` → `Ovitrap`/`OvitrapReading`/`ovitrap.*` (#5, #9, #14).
- "worker", "field worker", "field user", "delivery worker" → `courier`; profile slug `courier` (#2, #9, #13, #14, decision 4).
- "egg paper" → `egg paddle` (#21). "epidemiological week" → `epi week` (#38, CLAUDE.md).
- `/mobile-releases/` → `/app-versions/` (`docs/web-api-needs.md`).
