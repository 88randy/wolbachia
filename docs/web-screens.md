# Web screen inventory (W1–W71)

Source: Wolbachia web design canvas. Screens are designed at 1280×800. W2, W22, W53 and W54 also exist at 1440×900. English variants: W2, W35, W53. Dark variants: W53, W54.

## Profile codes

| Code | Profile | Status |
|---|---|---|
| SUP | Supervisor (center) | decided |
| ENT | Entomologist (lab) | decided |
| PRO | Promoter (community) | decided |
| ADM | Admin | decided |
| COO | Coordinator (supervisor of supervisors) | [PENDING] own profile or SUP scope |
| ALM | Warehouse | [PENDING] own profile or permission set |
| REG | Regulatory / privacy | [PENDING] own profile or ADM permission set |
| GOB | Government, external read-only (portal) | [PENDING] confirm |

"Profiles" in the table below is the **design proposal**. The final mapping lives in the role matrix (W65), and the backend is the source of truth.

## Global states

These apply to every screen. Designed once on the global-states board; they are not repeated per row:

- loading (skeleton)
- empty, with what the screen is for and the first action
- error, with retry
- offline / API unreachable
- no permission
- blocked (reason + who unblocks)
- voided record (struck through, reason, author)
- success toast

## Inventory

| Code | Screen | Profiles | Designed states / variants | Journey |
|---|---|---|---|---|
| W1 | Sign-in | all | wrong credentials; other states shown next to it; no "create account" | — |
| W2 | Home | all (content per profile) | with a critical item (red band + link), daily sentence, cards, "needs your attention"; 1440; EN | — |
| W3 | Universal search | internal | results grouped by type; voided object marked; no results; code from another organization | — |
| W4 | Universal record (e.g. point OV-010, History tab) | internal | history with physical ovitraps, readings, approved relocation, closed incident | R8 |
| W5 | Notifications panel | internal | unread first, grouped by type, link to object; per-type preferences (in-app / email / both) | — |
| W6 | Incident tray | SUP, COO, ADM | "My zone" tab; critical pinned; overdue auto-escalated and marked "Escalated to coordinator" | R6 |
| W7 | Incident detail | SUP, COO, ADM | escalated; what it blocks; timer; thread; reassign; change severity; close with the evidence its type requires | R6 |
| W8 | Supply catalog | ADM, ALM | per type: unit, biological, QR per piece or lot, expiry, shelf life, range, chemical, spec | — |
| W9 | Lots | ALM, SUP | filter "expires soon"; blocked with reason; draft not dispatchable | R1 |
| W10 | New biological lot | ALM | incomplete data, saved as draft and not dispatchable | R1 |
| W11 | Locations | ADM, ALM | map + list; "insecticide-free" flag; inventory per location | — |
| W12 | Transfers / create dispatch | ALM | origin, destination, pieces by scan or selection, sender signature; status table | R1 |
| W13 | Reception at center | SUP | continuous scan; expected vs scanned; "Missing" with photo; receiver signature | R1 |
| W14 | Discrepancies (D-0042) | ALM, SUP | detail; what it blocks; close with reason | R1 |
| W15 | Assignment to couriers | SUP | suggestion from scheduled points; delivery scan; courier signs on phone | — |
| W16 | Daily reconciliation | SUP | assigned / used / returned / shrinkage / difference; non-zero in red with "Open discrepancy" or "Justify" | — |
| W17 | Shrinkage and write-offs | ALM, SUP | biological write-off asks for the RPBI handling receipt | — |
| W18 | Biological lot conditions | ALM, ENT | two readings per day; chart with allowed band; out of range → lot "Blocked" + incident link | — |
| W19 | QR labels (print) | ALM | five label types at real size | R1 |
| W20 | Motorcycles | SUP, ADM | econ. number, plate, center, km, next service, real vs expected fuel efficiency, status | — |
| W21 | Motorcycle record (M-03) | SUP, ADM | tabs: Summary, Services, Responsibility letters, Fuel, Incidents | — |
| W22 | Quadrant map | SUP, COO, ENT | per center (color + pattern); toggleable layers; side list; 1440 | — |
| W23 | Quadrant editor (C-07, new version) | COO, ENT | cannot save until every point left outside the polygon is resolved | R2 |
| W24 | Blocks and sampling points | ENT, COO | block suggestion; 4 points with fixed codes; warning if two points are closer than the configured distance (50 m) | R2 |
| W25 | Quadrant assignment | SUP, COO | couriers as columns, quadrants as cards; drag or "Move to…" with keyboard; load vs target (40) | — |
| W26 | Scheduling (week / day) | SUP | points to check / place / remove per courier, sorted by risk; "Reassign pending" | — |
| W27 | Risk categories (weekly import) | ENT | origin per category (official import or company rule); preview before applying | — |
| W28 | Today's shifts (live map) | SUP, COO | only open shifts; the dot disappears when the shift closes | — |
| W29 | Validate shift | SUP | closed-shift summary; map timeline; "Observe" with reason returns it to the courier | R7 |
| W30 | Review queue | SUP | records flagged by the system: what happened, evidence, Accept / Void with reason / Open incident | — |
| W31 | Relocations | SUP | reason, old/new location, photo, same code; reject creates a task for the next day | R7 |
| W32 | Third-party interventions | SUP, ENT | spraying, fogging, larvicide by other institutions; shown as markers on dashboards | — |
| W33 | Quadrant closure | SUP, COO | wizard; blocked while an ovitrap is "Not recovered" or removal is unconfirmed | — |
| W34 | Lab bag reception | ENT | continuous scan; code, block, reading, date, collector, **egg paddle present + has eggs (Yes/No)**; "no reading" and "missing" open an incident | R3 |
| W35 | Egg count and validation | ENT | keyboard and scanner only; fixed focus on the big field; Enter saves and moves to the next bag; visible shortcuts; EN | R3 |
| W36 | Recounts | ENT | lab count and recount by another person, side by side; history keeps all attempts | R3 |
| W37 | Recycled egg paddles | ENT | negative paddles washed and dried with use number; a third use is not offered | — |
| W38 | UIEB shipment (Annex VI preview) | ENT, REG | RFC column empty when the data transfer is not authorized | R4 |
| W39 | Lab biological write-offs | ENT | select bags or lots, reason, date, owner, RPBI receipt | — |
| W40 | Wolbachia results | ENT | samples received and results; an invalid result is repeated and the previous attempt is kept | — |
| W41 | Third-party material requests | ENT, REG | delivery blocked until the CENAPRECE notification is recorded | — |
| W42 | Larval studies EA-1 (optional module) | ENT | survey capture, computed indices, official ICP bands | — |
| W43 | Permit types | REG, ADM | empty state: what they are for + create the first one | R5 |
| W44 | Permits (table + map) | REG | number, type, authority, zone, validity, status, requirements met | R5 |
| W45 | Permit detail / "Suspend now" | REG | immediate effect, notice to couriers in the zone, reason required | R5 |
| W46 | Releases | COO, REG | table + map; each blocked release says which condition failed | R5 |
| W47 | Release devices | ALM, COO | inventory by status with source lot and conditions | — |
| W48 | Users | ADM | profiles, center, status, expired trainings, app version; RFC masked | — |
| W49 | Person record | ADM (SUP limited) | RFC locked, "Show" is logged; "Sign out on their phone" for lost phones | — |
| W50 | Trainings | ADM | courses with validity and which actions they enable; per-person record; expiry alerts | — |
| W51 | Evaluation sheet | SUP, COO | Presentation, Execution, Coverage; computed result; HR notice after three low results | — |
| W52 | Community | PRO | notices, talks, meetings with zone, attendance and agreements; complaints linked to an incident; never neighbor names or phones | — |
| W53 | Entomology dashboard | ENT, COO, SUP | with bands; without configured thresholds; drill-down to a reading in ≤ 5 clicks; table per chart; exclusions note; 1440; EN; dark | R8 |
| W54 | Wolbachia prevalence | ENT, COO | line per quadrant with confidence interval; release band; dotted threshold; 1440; dark | — |
| W55 | Operations dashboard | SUP, COO | coverage, productivity vs target, closed houses, readings without count, fleet, supplies, sync | — |
| W56 | Comparison | COO | bars + table across centers or quadrants for one indicator | built (`/dashboards/comparison`, `GET /analytics/comparison/`); numbers do not link to record lists yet |
| W57 | Official exports (E-Ov2 preview) | REG, ENT | 3-step wizard; RFC empty without authorization; export history | — |
| W58 | ARCO requests | REG | type, received date, remaining legal time (bar changes color), owner, status | — |
| W59 | Data transfers | REG | authorizations for personal data leaving the platform; exports check this list | R4 |
| W60 | Access log | REG, ADM | who viewed/exported personal data, when, from where, what; read-only; filters + export | — |
| W61 | Retention | REG, ADM | per data type: period, action at expiry, last nightly run + receipt | read-only (`/regulatory/retention`, `GET /retention/`) over the two existing jobs (#54); no policy model or run receipt exists yet |
| W62 | Rule parameters (versioned) | ADM | editing creates a new version; before/after; effective date; history; never overwrites | R9; built in #36 (`/settings/rule-parameters`) |
| W63 | Catalogs | ADM | tabs per catalog; items in use are deactivated, never deleted | implemented in #35 (`/settings/catalogs`); in-use counts and authors need backend follow-up |
| W64 | Incident types | ADM | icon, default severity, owner, response time, escalation, what it blocks, required evidence; "Other" cannot be deactivated | — |
| W65 | Roles and permissions matrix | ADM | profiles × actions with scope per cell; external profiles fixed read-only | — |
| W66 | API keys | ADM | one key per institution with geo scope, endpoints, limit, validity; shown once | built (`/settings/api-keys`, `/api-keys/`); no endpoint consumes a key yet |
| W67 | Mobile app versions and phones | ADM | published and minimum version; signed APK upload with notes; phones with version | phones list built in #29 (`/settings/phones`); the rest — |
| W68 | Organization | ADM | name, country, time zone, epi week, languages, logo, label phone | — |
| W69 | Portal home | GOB | 3-section top nav; plain-language sentence; data cut-off date per figure; access-log notice | R10 |
| W70 | Portal map and trends | GOB | aggregated layers only; simplified charts with tables | R10 |
| W71 | Portal downloads | GOB | reports with cut-off date in PDF/CSV; "API access" docs; key handed out by admin | R10 |

## Journeys (clickable prototype)

| Journey | Flow |
|---|---|
| R1 | Biological lot: register, print labels, dispatch, reception with missing papers, close D-0042 |
| R2 | New version of quadrant C-07: resolve points left outside, plus 4 points in a new block |
| R3 | Lab receives 20 bags and counts (see the design adjustment below) |
| R4 | UIEB shipment / Annex VI with the RFC column empty |
| R5 | First permit type, a permit, suspension, release blocked |
| R6 | Critical incident overdue, escalated and closed with evidence |
| R7 | Approve relocation OV-011 and observe a shift |
| R8 | From the block-level index (PHMR) to the bag in under five clicks |
| R9 | Versioned parameter: revisit frequency from 7 to 6 days |
| R10 | Government portal |

## Design adjustments pending (from decisions taken after the design)

1. **No field egg count.** W34, W35, W36, the W53 drill-down and journeys R3/R8 show a "field egg count" and send a bag to recount when field and lab differ by more than 10 %. Both are wrong. Mobile only sends whether the egg paddle is present and, if so, whether it has eggs (Yes/No).
   - Replace the field column with that value.
   - **[PENDING]** What triggers a recount. Options: random sample, a second-entomologist rule, or a count outside the expected range.
2. **Parameters per organization.** W62 is designed "per region". The decision is per organization. **[PENDING]** Is there a regional override inside an organization?
3. **"Other (specify)".** It is guaranteed in incident types (W64). It must also be checked in every open list (relocation reasons, write-off reasons, intervention types, ARCO types, etc.).
4. **Small text.** Some badges and chart labels use 10–11px. Raise them to at least 12px.

W22-W24 implementation (#157): [geography workflow](../web/src/quadrants/README.md). W24 is a section of /quadrants/<code>/versions.
