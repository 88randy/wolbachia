# Backlog to a complete, locally operable product

Planning snapshot: 2026-11-04, commit eb3b68c415e3e482fb4b2d53cba8ff3a093ecc54.

Owner direction: finish backend, web and mobile, prove the integrated product locally, deploy production only at the end, and conduct field research after delivery. This replaces #13's old before-implementation timing. This document creates no GitHub issues, branches, PRs or deployments.

## Evidence and limits

Read AGENTS.md, .claude/agents/planner.md, .claude/agents/README.md, CLAUDE.md, engineering rules, glossary, decisions, API conventions, W1-W71 screen inventory, P1-P32 mobile inventory, web API proposal, both design READMEs, root/backend/web/mobile/packages READMEs and all 44 numbered issue mirrors. Also inspected backend URL registration, web area registration, first-parent merge history, the mobile spike report, mobile screen source headings, and P14/W35/W19 design images and relevant source. This is a functional scope audit, not visual certification of all 103 screens.

Both 'gh issue list --state open --limit 200 --json number,title,body,labels,url' and 'gh issue view 8' returned HTTP 401 Requires authentication. The authorized fallback is issues/. Mirrors contain no issue state and omit newer issues. Therefore the live open-issue inventory is **[PENDING verification]**. The reconciliation table covers all mirrors and referenced newer work; it must not be presented as a verified GitHub snapshot. Before creating any proposal, compare the authenticated live list and bodies, and reuse matching existing issues.

Present in this checkout: tenant/auth/catalog/rule/sync foundations and generated client; #68 immutable shift open/close; web shell/auth/reset; shared table/void controls; W67 phone list; mobile spike. Backend URLs do not expose the remaining domain APIs; web areas mostly remain placeholders. mobile/README.md identifies a stub with no production app package. Merge evidence is not CI, device, deployment or integrated acceptance evidence. No application tests or runtime services were run for this planning task.

## Counts and common delivery contract

**98 executable proposals: 34 backend, 39 web, 17 mobile, 8 integration/operations.** This counts reused issues and new proposals once, not 98 newly created GitHub issues. Split epics and completed foundations are not extra deliverables. There are 95 preproduction packages, I-06 for production delivery, and two post-delivery packages (I-07 and conditionally I-08). S = small bounded change; M = one domain workflow; L = substantial cohesive workflow. These are relative sizes, not calendar estimates. Split an L further if one reviewer cannot assess it as one PR, preserving scope and updating the count.

Before implementation, expand every proposal into the nine-section issue template, with exact file manifest and criterion-to-test map. Paths below are proposed ownership boundaries, not claims those modules already exist. Each proposal owns implementation, appropriate tests, its folder README and its domain contract documentation. Every API-changing backend PR also updates docs and regenerates packages/api-client in that same PR. API changes include events, sync deltas, permissions, responses and WebSocket contracts. Client tasks consume merged contracts; discovered contract gaps return to the serialized backend lane.

Common constraints, applicable to every scope and proof below:

- Organization and center/quadrant isolation, default-deny permissions from /me/, no profile-name branching or organization in URLs. Human-code UI routes resolve through scoped ?code=; API detail routes keep IDs. Seeds never restore revoked permissions.
- Business records are immutable; correction appends a void/decision with reason. Never rewrite FieldEvent ingest status. In-review events have no effects before authorized acceptance applies them once. Preserve account lock order, per-courier sequence and idempotency.
- The phone commits locally before success; no UI step waits for network. Web lab counts advance after server confirmation. Keep both timestamps; skew is measured with sent_at. The courier submits paddle_present and nullable has_eggs, never an egg count.
- Reuse API client, tokens, i18n, DataTable/FilterBar and void controls. Every feature includes designed loading/empty/error/offline/permission/blocked/voided/success states, es-MX/en, themes, keyboard/TalkBack as applicable, and accessible map/chart tables. Other requires text in every open list.
- Each proof below protects acceptance criteria/invariants under engineering rules section 9, once at the cheapest sufficient layer plus essential wiring/journey checks. Concurrency uses barriers/deferred promises, never arbitrary waits. Rules sections 4/6/7 govern backend isolation, validation and logging; section 5 governs client boundaries.
- Verify libraries/APIs against official documentation during implementation. This backlog selects no unverified version, scientific formula, legal deadline or final endpoint payload. Accepted decisions/conventions supersede stale mirrors and pixels.

## Backend proposals (34)

### B-01 - Complete organization configuration, scope and roles

Expose centers and organization settings (timezone, epi week, languages, logo and label phone), scoped role/permission and membership administration. Resolve empty-scope semantics, protect last-admin and external read-only access, audit changes and finish #35 launch catalog metadata/in-use indicators and protected Other labels. Preserve the existing shared-user identity model.

**Screens:** W48-W49, W62-W65, W68; all scoped screens. **Dependencies:** I-01. **Size:** L. **API change:** Yes.

**Proposed files:** backend/organizations/, backend/catalogs/. **Acceptance proof:** Cross-center/org denial, last-admin race, seed non-regrant, protected Other and effective-date behavior. Apply the common engineering/test contract above.

### B-02 - People administration, protected RFC and durable access log

Implement user create/edit/deactivate and membership/device-session integration, encrypted RFC under a reviewed key policy, and append-only access receipts. Reveal is explicit, permissioned and non-cacheable; supervisor views expose only permitted fields. Deactivation invalidates access without erasing authored records.

**Screens:** W48-W49, W60, W67. **Dependencies:** B-01, B-32. **Size:** L. **API change:** Yes.

**Proposed files:** backend/accounts/, proposed backend/audit/. **Acceptance proof:** Deactivation/last-admin races, RFC absent from lists/cache/log text, durable reveal receipt and scope denial. Apply the common engineering/test contract above.

### B-03 - Training eligibility and versioned evaluations

Implement courses, validity-dated certifications, enabled actions, expiry alerts, weighted evaluation sections and repeated-low-result HR notice. Retain attempts and configuration versions. Confirm weights and recipients or expose unconfigured status; sample screen scores are not defaults.

**Screens:** W50-W51, P19, P30. **Dependencies:** B-02, B-07. **Size:** L. **API change:** Yes.

**Proposed files:** proposed backend/people/. **Acceptance proof:** Expired training blocks action, missing weights explicit, third low result emits one notice. Apply the common engineering/test contract above.

### B-04 - Authenticated attachments and resumable field uploads

Deliver deferred photo/evidence/signature authorization, upload and finalization with bounded content checks and private access. Keep upload retry independent from event ingestion; never call external storage while sync holds account/courier locks. A failed upload must not erase a locally saved record.

**Screens:** W7, W13, W17-W18, W21, W29-W41 as applicable; P5-P8, P13-P27. **Dependencies:** B-01. **Size:** M. **API change:** Yes.

**Proposed files:** proposed backend/uploads/. **Acceptance proof:** Foreign references denied, incomplete/oversize upload refused, retry finalizes once, revoked download access. Apply the common engineering/test contract above.

### B-05 - Fleet operations and fuel events

Extend the existing Motorcycle model with fleet list/record, services, responsibility letters, fuel/odometer history and efficiency/service-due metrics. Register fuel.load and provide an authorized severe-fault inspection/clearance workflow. Preserve #68 server semantics without implying a blocked motorcycle can depart.

**Screens:** W20-W21, P4-P6, P22. **Dependencies:** B-04. **Size:** M. **API change:** Yes.

**Proposed files:** backend/shifts/ and proposed fleet modules. **Acceptance proof:** Concurrent motorcycle use denied, authorized service clearance only, fuel/odometer limits and retry. Apply the common engineering/test contract above.

### B-06 - Incidents, evidence gates and automatic escalation

Implement configured types, severity, response times, owners, blockers and evidence; list/detail/comments/reassign/change severity/close/void and immutable timeline. Register incident.report and emergency.accident. Run idempotent overdue escalation with a confirmed final target; missing required evidence blocks closure server-side.

**Screens:** W6-W7, W64; incident links; P23-P24. **Dependencies:** B-02, B-04. **Size:** L. **API change:** Yes.

**Proposed files:** proposed backend/incidents/, scheduler registration. **Acceptance proof:** Evidence gate, concurrent close/reassign, escalation retry, scope and Other protection. Apply the common engineering/test contract above.

### B-07 - Notifications, read state, preferences and channels (reuse #49)

Deliver rejected/review/critical notifications, incident/suspension/observation/expiry producers, cursor lists, read/read-all and sync deltas. Support designed in-app/email preferences using the selected local email transport; select any additional push channel explicitly. Delivery/retry must preserve per-recipient idempotency and expose failures.

**Screens:** W5, P28-P31. **Dependencies:** B-06. **Size:** M. **API change:** Yes.

**Proposed files:** proposed backend/notifications/, sync producer registration. **Acceptance proof:** No duplicate recipients, no cross-scope delivery, cursor resumes without lost commits, email preference honored. Apply the common engineering/test contract above.

### B-08 - Supply/location master data, lots and biological conditions

Implement supply attributes, locations/centers and stock, piece/lot identity, biological drafts/completeness, expiry, shelf life and storage ranges. Condition readings outside limits block the lot and create an incident. Preserve provenance and insecticide-free flags; derive stock from traceable movements.

**Screens:** W8-W11, W18. **Dependencies:** B-01, B-04, B-06. **Size:** L. **API change:** Yes.

**Proposed files:** proposed backend/inventory/. **Acceptance proof:** Draft/expired/blocked dispatch denied, condition breach incident once, foreign location/piece denied, reading completeness. Apply the common engineering/test contract above.

### B-09 - Signed dispatch, reception and discrepancies

Implement transfers with sender/receiver signatures and expected-versus-scanned reception, missing-item photos and discrepancy resolution. Make transitions and stock effects atomic/idempotent. A resolution removes only its own blockers and records reason/evidence.

**Screens:** W12-W14. **Dependencies:** B-08. **Size:** M. **API change:** Yes.

**Proposed files:** inventory transfer/discrepancy modules. **Acceptance proof:** Concurrent dispatch cannot overspend, duplicate receipt safe, missing item discrepancy once, signatures enforced. Apply the common engineering/test contract above.

### B-10 - Courier supplies, reconciliation and biological write-offs

Provide scheduled-material suggestions, scanned courier allocation, signed receipt, consumption/returns/shrinkage and reconciliation. An unexplained nonzero difference creates a discrepancy without blocking shift closure. Warehouse/lab write-offs require reasons and biological RPBI evidence, preserving stock and correction provenance.

**Screens:** W15-W17, W39, P8, P12, P26-P27. **Dependencies:** B-09. **Size:** L. **API change:** Yes.

**Proposed files:** inventory allocation/reconciliation/write-off services and handlers. **Acceptance proof:** Duplicate receipt/reconcile safe, no double consumption, difference permits close, RPBI gate. Apply the common engineering/test contract above.

### B-11 - Versioned quadrants, blocks and fixed sampling points

Implement scoped geometry, quadrant version history and point/block maintenance, organization-configured spacing warnings and suggestions. Publishing must resolve every excluded point. Verify the geometry implementation rather than assuming an installed DB extension, and reject stale concurrent edits.

**Screens:** W22-W24. **Dependencies:** B-01. **Size:** L. **API change:** Yes.

**Proposed files:** proposed backend/geography/. **Acceptance proof:** Outside-point publish gate, fixed code/version history, scope, concurrent publication. Apply the common engineering/test contract above.

### B-12 - Risk imports, courier assignments and scheduling

Implement preview/apply risk imports with category provenance, configured company rules, courier/quadrant allocation, workload targets and risk-ordered day/week schedules. Reassign pending work without duplicate tasks; retain the assignment history still cached by offline phones.

**Screens:** W25-W27, P9-P10. **Dependencies:** B-11. **Size:** L. **API change:** Yes.

**Proposed files:** proposed backend/scheduling/. **Acceptance proof:** Preview has no writes, apply retry safe, reassign race has one owner, scope. Apply the common engineering/test contract above.

### B-13 - Offline bootstrap, bundles and replay-safe change delivery

Deliver missing assigned points, supplies, permits, eligibility, decisions/history and map manifests through versioned full bootstrap and incremental deltas. Establish producer interfaces for later domains. Preserve rule/catalog ETags/effective refresh and per-courier sequencing; do not revive the superseded timestamp watermark.

**Screens:** P3, P7-P10, P18-P20, P28-P31; W25-W29. **Dependencies:** B-03, B-05, B-10, B-12, M-01. **Size:** L. **API change:** Yes.

**Proposed files:** backend/field_sync/ and proposed bundle/change modules. **Acceptance proof:** Expired cursor/full resync preserves pending data, scope-bound cursor, late commits delivered, due rule refresh. Apply the common engineering/test contract above.

### B-14 - Ovitrap placement/checking and bag provenance

Implement placement/reading models and ovitrap.place/check using agreed QR grammar, GPS/accuracy/distance rules, findings, conditional Yes/No eggs, conditions, bag identity, lagged and repeat checks. Integrate stock consumption with B-10. Never accept field counts; retain lagged countability and configured index exclusions.

**Screens:** P11-P14, P21; W4, W24, W34-W35, W53. **Dependencies:** B-04, B-06, B-11, B-13. **Size:** L. **API change:** Yes.

**Proposed files:** proposed backend/ovitraps/. **Acceptance proof:** No-paddle implies null eggs, duplicate reading/bag safe, foreign courier/point, historical rules and findings. Apply the common engineering/test contract above.

### B-15 - Replacement, relocation proposals and removal

Register ovitrap.replace/relocate/remove with evidence, configured incident/closed-house thresholds, physical identity history and recovery state. Relocation remains a proposal until approval. Discovering an abandoned/removed trap creates an incident; corrections reference the immutable source event.

**Screens:** P15-P17; W4, W31, W33. **Dependencies:** B-14. **Size:** M. **API change:** Yes.

**Proposed files:** ovitrap lifecycle modules. **Acceptance proof:** Point code survives replacement, proposal does not move approved geometry, unrecovered transitions, void ownership. Apply the common engineering/test contract above.

### B-16 - Location ingestion and scoped live-shift WebSocket (reuse #19)

Add deferred location.ping handling and track retrieval before #19 fan-out: #68 only shipped shift open/close. Publish committed positions over Channels/Daphne with scoped session auth, initial-state/reconnect reconciliation and close withdrawal. Configure cadence/retention and stop tracking outside an open shift.

**Screens:** W28-W29, P9-P10. **Dependencies:** B-05, B-13. **Size:** M. **API change:** Yes.

**Proposed files:** shift location modules, ASGI/Channels configuration. **Acceptance proof:** Anonymous/foreign scope refused, late ping not broadcast, close/reconnect race, Redis failure leaves REST usable. Apply the common engineering/test contract above.

### B-17 - Append-only reviews and shift validation

Implement accept/void/open-incident and closed-shift approve/observe using new immutable decision records. Derive decision state without rewriting FieldEvent status or adopting #34's stale mutable Shift.status proposal. Apply a deferred valid event once under existing locks and deliver observation reasons to offline phones.

**Screens:** W29-W30, P28-P29. **Dependencies:** B-07, B-14, B-16. **Size:** L. **API change:** Yes.

**Proposed files:** backend/reviews/ and shift decision modules. **Acceptance proof:** One simultaneous decision/effect, deferred void applies once, invalid rejection cannot bypass validation, offline observation. Apply the common engineering/test contract above.

### B-18 - Lab reception and authoritative egg counts (backend of #30/#31)

Implement continuous bag reception, expected/missing/no-reading incidents, no count expectation without paddle, append-only counts/attempts and void-plus-replacement. Resolve #30's proposed 422 status explicitly against the accepted error envelope/OpenAPI. Counts include author/time and next-queue behavior. Include designed viable-egg/viability and reasoned rejection under a reviewed lab method; an unconfirmed method blocks that capability rather than silently omitting it.

**Screens:** W34-W35, W4, W53. **Dependencies:** B-02, B-06, B-14. **Size:** L. **API change:** Yes.

**Proposed files:** proposed backend/lab/. **Acceptance proof:** Duplicate scan, durable no-reading incident, count race, invalid/plausibility input and immutable correction. Apply the common engineering/test contract above.

### B-19 - Independent recounts and paddle reuse

Implement the confirmed lab-only recount trigger, independent-counter permissions and full attempt history. Track washing/drying and reuse limits with stock return linkage. Never use field-versus-lab difference or silently substitute the sample ten-percent rule.

**Screens:** W36-W37, P14. **Dependencies:** B-10, B-18. **Size:** M. **API change:** Yes.

**Proposed files:** lab recount/reuse modules. **Acceptance proof:** Independent person required, third reuse refused under current rule, attempts preserved, missing trigger explicit. Apply the common engineering/test contract above.

### B-20 - Permits, release devices and revalidated release events

Implement permit types, polygons/validity/requirements, immediate suspension and notifications, release-device/source-lot provenance and release.record. Validate permit, training, schedule, lot and GPS under the approved capture/sync policy. Server safety checks remain authoritative with stale offline permissions.

**Screens:** W43-W47, P18-P19. **Dependencies:** B-03, B-07, B-08, B-11, B-13. **Size:** L. **API change:** Yes.

**Proposed files:** proposed backend/releases/. **Acceptance proof:** Expired/suspended/zone/GPS/training blockers, suspend/sync race, consumption once. Apply the common engineering/test contract above.

### B-21 - Samples and Wolbachia result attempts

Register sample.collect with origin/method/location and reading/lot/release links, lab reception and append-only Wolbachia result attempts. Invalid results can be repeated without replacement. Distinguish missing, invalid and negative results and supply validated prevalence inputs.

**Screens:** P20, W40, W54. **Dependencies:** B-14, B-20. **Size:** M. **API change:** Yes.

**Proposed files:** release sample and lab result modules. **Acceptance proof:** Collection retry once, invalid repeat retains attempts, foreign source denied, valid inputs only in prevalence. Apply the common engineering/test contract above.

### B-22 - UIEB shipments and third-party material delivery

Implement shipment provenance/Annex VI data and material requests with CENAPRECE notification evidence before delivery. Apply B-24 transfer checks; keep shipment snapshots and later source corrections traceable. B-25 alone owns rendering/download mechanics.

**Screens:** W38, W41. **Dependencies:** B-10, B-18, B-21, B-24. **Size:** M. **API change:** Yes.

**Proposed files:** lab shipment/material-request modules. **Acceptance proof:** Notification-before-delivery, duplicate delivery safe, revoked authorization masks RFC, correction flags history. Apply the common engineering/test contract above.

### B-23 - Larval EA-1 and validated scientific indices

Deliver the optional organization-enableable module as part of the complete product. Capture raw surveys and versioned reviewed calculations/official ICP bands. Obtain authoritative pending pupae/IPP/ICPP formulas before computing them; disablement preserves prior records rather than dropping W42 from scope.

**Screens:** W42, W53 where applicable. **Dependencies:** B-11, I-01. **Size:** M. **API change:** Yes.

**Proposed files:** larval survey modules and approved calculation fixtures. **Acceptance proof:** Approved examples, zero denominator, disabled gate and preserved history. Apply the common engineering/test contract above.

### B-24 - ARCO, transfer authorization and retention receipts

Implement legal-request ownership/status/deadline configuration, scoped transfer grants/revocation, retention policies and scheduled receipts. Explicitly reconcile anonymization/retention with no-delete and insert-only guarantees. Never turn a screen's sample deadline into a legal claim or prune protected business data implicitly.

**Screens:** W58-W61, W38, W57. **Dependencies:** B-02. **Size:** L. **API change:** Yes.

**Proposed files:** proposed backend/privacy/, audit integration. **Acceptance proof:** Legal-calendar fixtures, revoked/expired transfer denied, nightly retry once, anonymization preserves provenance. Apply the common engineering/test contract above.

### B-25 - Server reports/exports and all five QR label types

Deliver E-Ov2/Annex VI preview/history, bounded CSV/PDF export and large-job status/download/notification. Resolve DRF format negotiation collision with real renderers or an approved convention change. Print ovitrap, reading-bag, lot, release-device and sample labels using agreed grammar, organization branding/phone and human codes; remove field-count boxes.

**Screens:** W19, W38, W57, W71 and export lists. **Dependencies:** B-07, B-20, B-22, B-23, B-24, B-34. **Size:** L. **API change:** Yes.

**Proposed files:** proposed backend/reporting/, renderers/templates. **Acceptance proof:** Real CSV/PDF negotiation, authorization/audit, CSV formula safety, physical dimensions and QR round trip. Apply the common engineering/test contract above.

### B-26 - Entomology, prevalence and operations read models

Compute reviewed block/quadrant/epi-week indices, prevalence/confidence method, operations metrics and comparisons with source-list filters. Expose numerators/denominators/exclusions, versioned bands and release/intervention context. Distinguish no data from zero, preserve historical policy and show unconfigured thresholds.

**Screens:** W53-W56, W4, W69-W70. **Dependencies:** B-05, B-10, B-18, B-19, B-21, B-23, B-33, B-34. **Size:** L. **API change:** Yes.

**Proposed files:** proposed backend/analytics/. **Acceptance proof:** Worked examples, zero/excluded/partial states, epi-year boundary, aggregate equals filtered records. Apply the common engineering/test contract above.

### B-27 - Home, universal search and unified history

Compose permission-scoped attention/critical home summaries, grouped code search including marked voids, and unified timelines linking field/lab/decision/incident/export history. Never leak inaccessible record existence or personal data; provide resolvable provenance and compatible filtered destinations.

**Screens:** W2-W4 and record links. **Dependencies:** B-26. **Size:** M. **API change:** Yes.

**Proposed files:** core read/search/history modules. **Acceptance proof:** Foreign/unknown code indistinguishable, hidden types/counts, void provenance, home counts match links. Apply the common engineering/test contract above.

### B-28 - Institution keys and aggregate portal API

Implement hashed one-time keys and isolated read-only summary/map/trends/download endpoints. Resolve public versus authenticated government access, apply cut-off dates and configured small-group suppression equally to people and keys. Exclude personal data and precise staff tracks from every aggregate path.

**Screens:** W66, W69-W71. **Dependencies:** B-24, B-25, B-26. **Size:** L. **API change:** Yes.

**Proposed files:** proposed backend/portal/, key authentication. **Acceptance proof:** Secret once/not logged, revoke/expiry/geo/endpoint/rate controls, suppression resistant to differencing. Apply the common engineering/test contract above.

### B-29 - Signed app versions and internal update service

Implement signed APK upload/verification/publication, notes, minimum version and device reporting under the reviewed update protocol. Bind checksums, signature and authorized download; retain rollout audit and bad-build withdrawal. Minimum-version enforcement must preserve authorized recovery of unsent data.

**Screens:** W67, P31 and update states. **Dependencies:** B-02, B-04, M-01. **Size:** M. **API change:** Yes.

**Proposed files:** app-version modules and device reporting. **Acceptance proof:** Wrong signer/package refused, minimum-version versus final-upload gate, interrupted download, publish/revoke permission. Apply the common engineering/test contract above.

### B-30 - Per-device rejection quota (reuse #56)

Bound rejected-event storage with configured per-device local-day quota and alerting. Define a mixed-batch retry contract so accepted/in-review work still progresses while new rejections are limited. Record limit/Retry-After audit and never instruct the phone to discard pending work.

**Screens:** W30, W55, P28. **Dependencies:** B-07. **Size:** M. **API change:** Yes.

**Proposed files:** sync quota/throttle modules. **Acceptance proof:** Concurrent limit, local-midnight reset, duplicate not recounted, mixed batch makes valid progress. Apply the common engineering/test contract above.

### B-31 - Safe ended-session token-family retention (reuse #54)

Decide and implement retention or archival of ended TokenPair families with scheduled receipts. Preserve reuse detection for live sessions and pending final uploads. Record any approved exception to no-delete; without that decision retain data/report capacity, never prune merely because this backlog exists.

**Screens:** W61 operational receipt. **Dependencies:** B-24. **Size:** S. **API change:** No.

**Proposed files:** account retention services/tasks. **Acceptance proof:** Live/refreshable/final-upload families untouched, policy-eligible archive/prune retry safe. Apply the common engineering/test contract above.

### B-32 - Close auth policy and global-state contract gaps

Resolve second factor, notice acceptance, expiry/extension, request-access and error-correlation states. Implement the selected policy with working contracts, or an explicit configurable/disabled disposition. Keep fixed 12-hour/no-keep-alive behavior until superseded; reserve an API slot even if the final decision adds no endpoint.

**Screens:** W1 and global session/permission/error states. **Dependencies:** I-01, B-01. **Size:** M. **API change:** Yes.

**Proposed files:** account/session policy modules. **Acceptance proof:** Selected policy works end-to-end, no enumeration, CSRF/session races preserved, disabled controls absent. Apply the common engineering/test contract above.

### B-33 - Relocation decisions, interventions and quadrant closure

Implement relocation approve/reject preserving point code and creating next-day work on rejection; third-party intervention type/product/source/area/dates; and closure readiness/close. Unrecovered traps or unconfirmed removals block closure. Preserve geometry/decision history and handle late offline work without silently reopening geography.

**Screens:** W31-W33, P9, P16-P17. **Dependencies:** B-12, B-15, B-17. **Size:** L. **API change:** Yes.

**Proposed files:** geography/ovitrap decisions and intervention modules. **Acceptance proof:** Reject creates one next-day task, closure blockers exhaustive, decision race, late-event policy. Apply the common engineering/test contract above.

### B-34 - Community activities and complaint links

Register community.activity and web activities with zone, attendance totals and agreements. Link complaints to incidents without neighbor names, phones or personal attendance registries. Validate payload privacy/ownership, preserve history and provide scoped operations-summary inputs.

**Screens:** W52, P25. **Dependencies:** B-06, B-13. **Size:** M. **API change:** Yes.

**Proposed files:** proposed backend/community/. **Acceptance proof:** Retry once, foreign zone denied, forbidden identity fields refused, scoped incident link. Apply the common engineering/test contract above.


## Web proposals (39)

### W-01 - Versioned rule editor (reuse #36)

Build current/unconfigured values, before/after edits, local effective dates, scheduled-version void and read-only history. Follow decision 42: organization-wide values, past dates refused, multiple immediate changes allowed. Discard stale regional-override proposals.

**Screens:** W62. **Dependencies:** I-01; existing #3/#29/#32. **Size:** M. **API change:** No.

**Proposed files:** web/src/settings/rules/. **Acceptance proof:** Effective-date/conflict/void paths, author/history, keyboard recovery; R9 wiring in I-03. Apply the common engineering/test contract above.

### W-02 - Launch catalog editor (reuse #35)

Implement tabs, bilingual labels/fallback, in-use indicators, add/edit/reorder/activate/deactivate and fixed Other using finalized metadata. Cover the approved launch list; old records retain deactivated labels. No duplicate table implementation.

**Screens:** W63. **Dependencies:** B-01, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/settings/catalogs/. **Acceptance proof:** Other protection, keyboard reorder, fallback, deactivation and stale conflict. Apply the common engineering/test contract above.

### W-03 - Organization, roles, scope and center selection

Build permission/scope administration and organization configuration, safe logo/CSP behavior and permitted shell center filters. Clear scoped queries on context changes; never infer access from a profile name or restore revoked permissions.

**Screens:** W65, W68 and shell. **Dependencies:** B-01, I-02. **Size:** L. **API change:** No.

**Proposed files:** web/src/settings/organization/, roles/ and shell center selector. **Acceptance proof:** Keyboard matrix, last-admin refusal, center cache isolation, external read-only lock. Apply the common engineering/test contract above.

### W-04 - Users/person record (reuse #37)

Implement create/edit/deactivate, profiles/center/training/device summaries, limited supervisor access and lost-phone revocation. RFC reveal is explicit, temporary, audited and non-cacheable. Reuse the completed phone list.

**Screens:** W48-W49. **Dependencies:** B-02, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/people/users/. **Acceptance proof:** Reveal/unmount clearance, deactivation conflict, session revocation and forbidden deep link. Apply the common engineering/test contract above.

### W-05 - Trainings and evaluation sheets

Implement validity/eligibility, per-person certifications, versioned weighted evaluations, expiry and repeated-low-result notice provenance. Unconfigured weights explain why no score exists; preserve all attempts.

**Screens:** W50-W51. **Dependencies:** B-03, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/people/trainings/ and evaluations/. **Acceptance proof:** Expired eligibility, missing weights, result/history and keyboard form. Apply the common engineering/test contract above.

### W-06 - Incident-type configuration

Build icon/severity/owner/response/escalation/blocker/evidence settings with accessible controls and protected Other. Show applicable configuration without rewriting prior incidents.

**Screens:** W64. **Dependencies:** B-06, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/settings/incident-types/. **Acceptance proof:** Evidence/escalation round trip, protected Other, coded field errors. Apply the common engineering/test contract above.

### W-07 - Incident tray/detail (reuse #33)

Build My zone, critical/overdue ordering, linked counts, escalation labels, blockers, thread/timeline and reassignment/severity/close/void. Required evidence disables closure with reason/unblocker; API remains authoritative.

**Screens:** W6-W7. **Dependencies:** B-06, B-04, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/incidents/. **Acceptance proof:** R6, conflict refresh, keyboard evidence/thread/void, count links. Apply the common engineering/test contract above.

### W-08 - Notifications and channel preferences

Replace the shell placeholder with unread/grouped cursor results, read controls, object links and per-type in-app/email preferences. Keep counts/read state coherent across reconnect and provide recoverable failure states.

**Screens:** W5. **Dependencies:** B-07, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/notifications/ and shell trigger. **Acceptance proof:** Read/read-all/preferences, reconnect paging, focus return and announcements. Apply the common engineering/test contract above.

### W-09 - Supply catalog, lots and locations

Build supply attributes, expiry filters, biological draft capture, blocked reasons and location stock/map/list. Keep incomplete drafts visible and nondispatchable, with server-side filters and traceable stock links.

**Screens:** W8-W11. **Dependencies:** B-08, I-02. **Size:** L. **API change:** No.

**Proposed files:** web/src/inventory/catalog/, lots/, locations/. **Acceptance proof:** Draft save/dispatch refusal, expiry/blockers, linked stock and map/list. Apply the common engineering/test contract above.

### W-10 - Dispatch, center reception and discrepancies

Build signed dispatch, continuous expected-versus-scanned reception, missing-photo flow and discrepancy resolution. Restore scanner focus after responses and distinguish retries from new stock movements.

**Screens:** W12-W14. **Dependencies:** B-09, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/inventory/transfers/ and discrepancies/. **Acceptance proof:** R1 transfer segment, duplicate feedback, signature/evidence gate and close. Apply the common engineering/test contract above.

### W-11 - Courier allocation, reconciliation and write-offs

Implement scheduled suggestions, delivery scan/signature status and visible assigned/used/returned/shrinkage equation. Offer justify/discrepancy actions without blocking close. Share biological write-off behavior across warehouse and lab, requiring RPBI evidence.

**Screens:** W15-W17, W39. **Dependencies:** B-10, I-02. **Size:** L. **API change:** No.

**Proposed files:** web/src/inventory/assignments/, reconciliation/, write-offs/ and W39 entry. **Acceptance proof:** Nonzero difference actions, phone signature status, RPBI gate, lab entry wiring. Apply the common engineering/test contract above.

### W-12 - Biological lot conditions

Build readings, allowed-band chart/table, daily completeness and blocked-lot navigation. Missing readings/ranges are explicit and historical readings retain their applicable range.

**Screens:** W18. **Dependencies:** B-08, I-02. **Size:** S. **API change:** No.

**Proposed files:** web/src/inventory/conditions/. **Acceptance proof:** Breach incident link, missing range/readings, keyboard chart table. Apply the common engineering/test contract above.

### W-13 - Five QR label formats and printing

Build type/quantity/paper/printer preview/download and reprint history for all five types. Use real server PDFs, human codes and organization branding/phone. Remove field-count boxes and illustrative QR patterns.

**Screens:** W19. **Dependencies:** B-25, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/inventory/labels/. **Acceptance proof:** PDF selection/dimensions, R1 label segment and print-to-scan in I-03. Apply the common engineering/test contract above.

### W-14 - Motorcycles and full fleet record

Build summary/services/responsibility/fuel/incident tabs, next-service and efficiency metrics, center filters and authorized severe-fault clearance. Keep gaps and blockers visible.

**Screens:** W20-W21. **Dependencies:** B-05, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/fleet/. **Acceptance proof:** Service clearance, fuel filters, tab deep links and list alternatives. Apply the common engineering/test contract above.

### W-15 - Quadrant map/editor and sampling points

Implement lazy MapLibre layers with patterns/list alternatives, version history, outside-point resolution, block suggestions and fixed codes/spacing warnings. Do not silently move omitted points or lose historical geometry.

**Screens:** W22-W24. **Dependencies:** B-11, I-02. **Size:** L. **API change:** No.

**Proposed files:** web/src/quadrants/geography/ and shared map primitives. **Acceptance proof:** R2, unresolved point prevents publish, keyboard map/list, 1280/1440. Apply the common engineering/test contract above.

### W-16 - Assignment, schedule and risk import

Build courier load/target assignment with drag and keyboard alternatives, risk-sorted day/week schedule and preview/apply imports with provenance. Retain filters in URLs and handle concurrent reassignment.

**Screens:** W25-W27. **Dependencies:** B-12, W-15, I-02. **Size:** L. **API change:** No.

**Proposed files:** web/src/quadrants/scheduling/ and risk/. **Acceptance proof:** Keyboard Move to, preview no writes, apply/reassign conflicts and targets. Apply the common engineering/test contract above.

### W-17 - Live open-shift map

Combine REST initial/reconnect state with authorized WebSocket updates and open-shift list. Remove closed dots, label stale positions and provide useful REST fallback when live delivery fails.

**Screens:** W28. **Dependencies:** B-16, W-15, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/operations/live/. **Acceptance proof:** Close/reconnect race, session recovery, scoped refusal, accessible list. Apply the common engineering/test contract above.

### W-18 - Shift validation (reuse #34)

Build summary/threshold versions, map timeline/list and approve/observe-with-reason. Consume append-only decisions instead of stale mutable Shift assumptions. Show gaps, conflicts and offline-delivery state.

**Screens:** W29. **Dependencies:** B-17, W-15, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/operations/validation/. **Acceptance proof:** R7 observation, open-shift reason, missing GPS list and concurrent conflict. Apply the common engineering/test contract above.

### W-19 - Review queue, relocations and quadrant closure

Implement evidence-driven accept/void/open-incident, old/new relocation and next-day rejection outcome, and closure wizard. Distinguish ingest outcome from supervisor decision; preserve earlier evidence and explain each recovery/removal blocker.

**Screens:** W30-W31, W33. **Dependencies:** B-17, B-33, W-15, I-02. **Size:** L. **API change:** No.

**Proposed files:** web/src/operations/reviews/, relocations/, closure/. **Acceptance proof:** R7 relocation, conflict refresh and complete closure-blocker flow. Apply the common engineering/test contract above.

### W-20 - Third-party interventions

Build capture/list/map markers with type/product/source/area/dates and history. Keep interventions distinct from company releases and link their dashboard context to a real record.

**Screens:** W32. **Dependencies:** B-33, W-15, I-02. **Size:** S. **API change:** No.

**Proposed files:** web/src/operations/interventions/. **Acceptance proof:** Other validation, scoped blocks and marker/list deep link. Apply the common engineering/test contract above.

### W-21 - Continuous lab reception (reuse #30)

Implement expected/received summary and duplicate/unknown/missing/no-reading paths from the finalized contract. Replace field count with paddle presence/conditional Yes-No; absent-paddle bags do not enter the count queue.

**Screens:** W34. **Dependencies:** B-18, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/lab/reception/. **Acceptance proof:** 20-bag keyboard flow, live results, incident link, no field count. Apply the common engineering/test contract above.

### W-22 - Egg count capture (reuse #31)

Build fixed-focus numeric entry, queue/shortcuts, server-confirmed next and void/replacement. Keep input on network errors and expose plausibility/conflict states. Never compare against nonexistent field counts. Include viable-egg/viability and reasoned rejection only through the approved lab contract.

**Screens:** W35. **Dependencies:** B-18, W-21, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/lab/counting/. **Acceptance proof:** Enter-save-next focus, retained retry value, count conflict, correction history and EN expansion. Apply the common engineering/test contract above.

### W-23 - Independent recounts and recycled paddles

Build lab-count/recount history with trigger/eligibility explanation and wash/dry reuse tracking. Never offer a prohibited third reuse or field-versus-lab comparison.

**Screens:** W36-W37. **Dependencies:** B-19, W-22, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/lab/recounts/ and paddles/. **Acceptance proof:** Independent user, attempts visible and exhausted reuse unavailable. Apply the common engineering/test contract above.

### W-24 - UIEB shipments and material requests

Build selection, Annex VI preview/download and request/notification/delivery flow. Explain omitted RFC and disabled delivery; preserve source and shipment correction history.

**Screens:** W38, W41. **Dependencies:** B-22, B-25, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/lab/shipments/ and material-requests/. **Acceptance proof:** R4, unauthorized RFC blank, notification gate and source correction. Apply the common engineering/test contract above.

### W-25 - Wolbachia sample results

Build sample reception/result attempts, invalid/repeat flow and provenance. Distinguish missing and invalid from negative, and never replace earlier results silently.

**Screens:** W40. **Dependencies:** B-21, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/lab/wolbachia/. **Acceptance proof:** Invalid repeat preserves original, keyboard entry and source link. Apply the common engineering/test contract above.

### W-26 - Larval EA-1 workspace

Implement survey capture, reviewed indices/bands and equivalent tables. W42 remains in complete-product scope even when disabled by an organization; test both states locally.

**Screens:** W42. **Dependencies:** B-23, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/lab/larval/. **Acceptance proof:** Enabled calculation journey, disabled gate, missing/zero denominator. Apply the common engineering/test contract above.

### W-27 - Permit types, permits and suspension

Build first-type empty state, zone/validity/requirements table/map, detail and Suspend now. Show blockers and notification outcome; preserve history and refresh stale conflicts.

**Screens:** W43-W45. **Dependencies:** B-20, W-15, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/releases/permits/. **Acceptance proof:** R5 type/permit/suspend, reason and accessible zone alternative. Apply the common engineering/test contract above.

### W-28 - Releases and release-device provenance

Build release map/table and equipment status/source-lot/conditions. Every blocked release names failed prerequisites and authorized unblockers without exposing inaccessible details.

**Screens:** W46-W47. **Dependencies:** B-20, W-27, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/releases/records/ and devices/. **Acceptance proof:** R5 blocked release, lot provenance and permission-safe blocker links. Apply the common engineering/test contract above.

### W-29 - Community workspace

Implement activity types, attendance totals, agreements and complaint/incident links. Offer neither neighbor identity capture nor personal attendance export.

**Screens:** W52. **Dependencies:** B-34, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/community/. **Acceptance proof:** Complaint link, zone filters, keyboard flow and no neighbor PII. Apply the common engineering/test contract above.

### W-30 - Entomology dashboard and drill-down (reuse #38)

Build indices/bands/exclusions/partial weeks and filtered block-point-reading-bag provenance with accessible tables, themes/locales and 1280/1440 layouts. Only lab counts contribute; sample thresholds are not configuration.

**Screens:** W53, W4 navigation. **Dependencies:** B-26, B-27, W-22, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/dashboards/entomology/ and shared chart primitives. **Acceptance proof:** R8 at most five clicks, no-band/empty/zero variants, chart tables. Apply the common engineering/test contract above.

### W-31 - Prevalence, operations and comparisons

Build confidence intervals, release/intervention context, coverage/fleet/supply/sync metrics and comparisons using shared chart primitives. Every figure links to the actual server-filtered records.

**Screens:** W54-W56. **Dependencies:** B-26, W-30, I-02. **Size:** L. **API change:** No.

**Proposed files:** web/src/dashboards/prevalence/, operations/, comparison/. **Acceptance proof:** Partial/no data, chart-table equality and matching drill-down filters. Apply the common engineering/test contract above.

### W-32 - Official exports and history

Build selection/preview/authorized CSV-PDF download, background progress and history. Preserve cut-off, omissions and original artifacts when source corrections arrive later.

**Screens:** W57. **Dependencies:** B-25, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/exports/ and export-job UI. **Acceptance proof:** E-Ov2 preview/download, RFC omissions, async retry and correction history. Apply the common engineering/test contract above.

### W-33 - ARCO and data-transfer administration

Implement ownership/status/legal-calendar display and transfer scope/validity/revocation. Show unconfigured policy instead of sample deadlines; explain authorized export columns without revealing their contents.

**Screens:** W58-W59. **Dependencies:** B-24, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/regulatory/arco/ and transfers/. **Acceptance proof:** Configured deadline states, authorization revoke effect and Other text. Apply the common engineering/test contract above.

### W-34 - Access log and retention operations

Build audit filtering/export and retention configuration/run receipts including RFC and token-family provenance. Do not claim nightly execution when a job failed or policy is unconfigured.

**Screens:** W60-W61. **Dependencies:** B-24, B-25, B-31, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/regulatory/access-log/ and retention/. **Acceptance proof:** Read-only cursor audit/export, failed/successful receipts, policy permission. Apply the common engineering/test contract above.

### W-35 - Institution API-key administration

Build geo/endpoints/rate/validity/revoke and API docs links. Display creation secret once, clear it on close/navigation and exclude it from query caches/logs and later lists.

**Screens:** W66. **Dependencies:** B-28, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/settings/api-keys/. **Acceptance proof:** One-time secret cleared on unmount, scoped creation, revoke/expiry. Apply the common engineering/test contract above.

### W-36 - App versions and phone actions

Complete signed APK/notes/publish/minimum cards around the existing phone table. Add user/version filters and authorized revoke; explain pending-data recovery and actual rollout receipts instead of rebuilding completed phones.

**Screens:** W67. **Dependencies:** B-29, W-04, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/settings/app-versions/, existing web/src/devices/. **Acceptance proof:** Invalid APK, publish/minimum conflict, phone revoke and existing list. Apply the common engineering/test contract above.

### W-37 - Government portal

Build separate layout and API experience with plain summaries, aggregate layers/trends, tables, reports/API docs and cut-off dates. Respect approved government access/suppression; test phone-width reflow and exclude internal menus/precise personal routes.

**Screens:** W69-W71. **Dependencies:** B-28, W-30, W-32, I-02. **Size:** L. **API change:** No.

**Proposed files:** web/src/portal/ and separate portal routes. **Acceptance proof:** R10, read-only/access policy, suppression, cut-off downloads and keyboard maps. Apply the common engineering/test contract above.

### W-38 - Home, universal search and unified record

Replace placeholders with attention/critical cards, grouped code search and full timeline including marked voids. Match every figure to its filters and provide useful contact-admin behavior for members with no work access.

**Screens:** W2-W4. **Dependencies:** B-27, I-02. **Size:** L. **API change:** No.

**Proposed files:** web/src/home/, search/, records/ and shell search trigger. **Acceptance proof:** Unknown/foreign equivalence, history links, empty-permission home and provenance. Apply the common engineering/test contract above.

### W-39 - Complete W1 and global state policy

Wire resolved auth/notice/session policies and selected access-request/error-correlation controls, preserving session revision and draft safety. Finish reason/unblocker presentation. Define epi-week-closing notice from the approved reporting policy; no invented blocking rule or unwired designed control.

**Screens:** W1, all web global states. **Dependencies:** B-32, B-02, I-02. **Size:** M. **API change:** No.

**Proposed files:** web/src/auth/, session/, states/ and shared blocked control. **Acceptance proof:** Selected auth/state matrix, draft-safe reauth, stale 401 ignored and no dead-end controls. Apply the common engineering/test contract above.


## Mobile proposals (17)

### M-01 - Close mobile foundation decisions with bench evidence (reuse #1)

Finish technical store/QR/offline-map/navigation/speed/dedicated-mode/update recommendations with measured local bench evidence. Retain the S24 Ultra PMTiles result as evidence of that build only; repeat invalid Organic Maps and unconfirmed full-screen fixes. Demo OfflineManager still crashed. This is controlled technical validation, not post-delivery field research.

**Screens:** P7, P10-P11, P31-P32 and globals. **Dependencies:** I-01. **Size:** M. **API change:** No.

**Proposed files:** spikes/mobile-foundations/, report and ADR rows 6-7. **Acceptance proof:** Force-stop/reboot durability, offline file map, denied camera/GPS, allowlisted navigation and interrupted update. Apply the common engineering/test contract above.

### M-02 - Production app, durable outbox and inbox (reuse #6)

Bootstrap the real Android app with chosen store, navigation, secure boundaries, tokens/Inter/i18n. Implement transactional events/outbox/attachments, retry/backoff, pull/full-resync and P28 with notifications/reviews and quota response support. Establish later-producer interfaces. Initial full recovery uses merged sync/review/notification contracts; assignment/map bootstrap is wired by M-04/M-06 after B-13. Switch APK CI from spike to mobile and document a runnable local test path.

**Screens:** P28 and shared save/sync shell. **Dependencies:** M-01, B-04, B-07, B-32, I-02; existing #5/#12/#17. **Size:** L. **API change:** No.

**Proposed files:** mobile/ foundation/store/sync, root JS lock, mobile CI workflow. **Acceptance proof:** Kill mid-write/send, lost response, partial results, expired cursor and network-independent save. Apply the common engineering/test contract above.

### M-03 - Login, PIN/biometric unlock and revoke (reuse #7)

Implement signal-required first login, device tokens, Keystore-backed PIN/biometrics, idle warning/lock and configured attempt threshold/password fallback. Locks/reset/revoke preserve drafts/outbox; authorized final upload runs once, denied reasons receive no grace and logout cannot discard work.

**Screens:** P1-P2. **Dependencies:** M-02; existing #4. **Size:** M. **API change:** No.

**Proposed files:** mobile/src/features/access/ and auth adapter. **Acceptance proof:** Offline unlock, PIN fallback, biometrics denial, refresh ordering and final-upload boundaries. Apply the common engineering/test contract above.

### M-04 - Home and open shift

Build no-shift home, motorcycle/checklist, odometer/photo and offline-map preparation around existing #68 handlers. Commit local shift UUID before proceeding. A severe-fault motorcycle cannot depart; interrupted/missing map preparation never claims absent coverage ready.

**Screens:** P3-P7. **Dependencies:** M-03, B-05, B-13. **Size:** M. **API change:** No.

**Proposed files:** mobile/src/features/shift-open/. **Acceptance proof:** Offline open/restart, severe fault prevents departure, odometer warning, map failure recovery. Apply the common engineering/test contract above.

### M-05 - Scanned supply receipt and courier signature

Build expected/scanned supplies, discrepancy and signature from assigned stock. Save locally with evidence; preserve actual receipt even when an assignment changes while offline and show subsequent server review/incident feedback.

**Screens:** P8. **Dependencies:** M-04, B-10. **Size:** M. **API change:** No.

**Proposed files:** mobile/src/features/supply-receipt/. **Acceptance proof:** Duplicate scan, mismatch/signature survives restart and receipt syncs once. Apply the common engineering/test contract above.

### M-06 - Day list, offline map and external navigation

Build schedule/risk/progress and map layers with licensed local assets, region boundary messages and how-to-get-there. Verify dedicated-mode navigation return; a usable list remains when map/GPS fails.

**Screens:** P9-P10. **Dependencies:** M-04, B-13. **Size:** M. **API change:** No.

**Proposed files:** mobile/src/features/day/ and map/navigation adapter. **Acceptance proof:** Airplane cold start, assignment delta, GPS denial and navigator present/absent. Apply the common engineering/test contract above.

### M-07 - QR routing, supply detail and invalid-code states

Implement camera/torch/manual input and shared-grammar routing to assigned offline objects. Explain damaged/unknown/foreign/wrong-courier codes without revealing foreign objects or waiting for the server to route a local scan.

**Screens:** P11-P12, P21. **Dependencies:** M-06, B-14, B-10. **Size:** M. **API change:** No.

**Proposed files:** mobile/src/features/scanner/ and typed route adapter. **Acceptance proof:** Camera/manual fallback, type matrix, duplicate scan, malformed/foreign codes. Apply the common engineering/test contract above.

### M-08 - Place/check ovitraps with conditional Yes/No eggs

Build shortest normal-check path, findings/Other, paddle/eggs, conditions, bag scan/manual entry and reinstatement/reuse. Follow #14 over the obsolete PNG; cover closed-house/absent/destroyed/lagged/already-checked flows. Commit event/evidence before success.

**Screens:** P13-P14, P21. **Dependencies:** M-07, B-14, I-01. **Size:** L. **API change:** No.

**Proposed files:** mobile/src/features/placement/ and ovitrap-check/. **Acceptance proof:** Positive/negative/no-paddle branches, no count field, closed-house path, lagged bag and correction. Apply the common engineering/test contract above.

### M-09 - Replace, propose relocation and remove

Implement reason/evidence/GPS and physical identity/recovery states while preserving point code. Saved relocation is a proposal, not an approved move; consume rejection/next-day tasks later. Never discard original or unuploaded corrections.

**Screens:** P15-P17. **Dependencies:** M-08, B-15. **Size:** M. **API change:** No.

**Proposed files:** mobile/src/features/ovitrap-lifecycle/. **Acceptance proof:** Offline lifecycle, pending proposal, thresholds/Other and approval/rejection after sync. Apply the common engineering/test contract above.

### M-10 - Release, blocked release and sample collection

Implement cached permit/zone/lot/training/schedule validation and GPS accuracy gate. P19 has no bypass; a later server rejection/review is explained without blame. Preserve sample source/method/codes and lab-delivery reminder.

**Screens:** P18-P20. **Dependencies:** M-07, B-20, B-21. **Size:** L. **API change:** No.

**Proposed files:** mobile/src/features/releases/ and samples/. **Acceptance proof:** Offline valid release, every blocker, stale permit rejected by server, sample restart. Apply the common engineering/test contract above.

### M-11 - Fuel capture and receipt retake

Build fixed motorcycle, quantities/units/odometer, receipt and illegible-photo recovery. Permitted plausibility warnings allow local save and later review feedback without losing entered fields.

**Screens:** P22. **Dependencies:** M-04, B-05. **Size:** S. **API change:** No.

**Proposed files:** mobile/src/features/fuel/. **Acceptance proof:** Photo retake keeps input, efficiency advisory and offline upload once. Apply the common engineering/test contract above.

### M-12 - Incidents, emergency and supervisor conversation

Build configurable searchable types/evidence, pending/sent status, own incidents and supervisor comments. Provide configured emergency contact actions and offline accident capture with safe close option; never imply an offline alert reached a supervisor.

**Screens:** P23-P24. **Dependencies:** M-04, B-06, B-07. **Size:** M. **API change:** No.

**Proposed files:** mobile/src/features/incidents/ and emergency/. **Acceptance proof:** Offline report later sent, pulled comments, contact fallback and critical notification once. Apply the common engineering/test contract above.

### M-13 - Community activity capture

Capture configured activity, zone, attendance totals and agreements locally. Link complaints to incidents and never collect neighbor names or phone numbers.

**Screens:** P25. **Dependencies:** M-04, B-34. **Size:** S. **API change:** No.

**Proposed files:** mobile/src/features/community/. **Acceptance proof:** Replay, Other text, no neighbor identity and scoped complaint link. Apply the common engineering/test contract above.

### M-14 - Close shift and reconcile with truthful delivery states

Build pending-point decisions, visible supply equation, shrinkage reason/photo, closing odometer and confirmation. Unexplained difference creates discrepancy without preventing close; distinguish phone-closed/server-received. Stop GPS after local close and retain pending work through supervisor observation.

**Screens:** P26-P27. **Dependencies:** M-05, M-08, M-09, M-10, M-11, M-12, M-13, B-10, B-17. **Size:** M. **API change:** No.

**Proposed files:** mobile/src/features/shift-close/. **Acceptance proof:** Nonzero difference, offline close/reboot/sync, observation return and no post-close tracking. Apply the common engineering/test contract above.

### M-15 - History, training/evaluations and settings

Build shift/event history/code search, training/evaluation feedback and language/theme/accessibility preferences. Explain pending-data logout, preserve drafts/outbox and expose updater/support state without claiming a successful update.

**Screens:** P29-P31. **Dependencies:** M-14, B-03, B-13, B-27, B-29. **Size:** M. **API change:** No.

**Proposed files:** mobile/src/features/history/, training/, settings/. **Acceptance proof:** Offline history/observations, expired eligibility, persisted preferences, safe logout. Apply the common engineering/test contract above.

### M-16 - Speed lock and complete global/accessibility states

Implement configured speed/hysteresis lock, no-signal/GPS/accuracy/battery/storage/clock/session/update states and reviewed safe emergency access. Preserve partial forms. Complete themes, EN and TalkBack/130-percent coverage; GPS failure is explicit, never a guessed speed.

**Screens:** P32, all P screens and S14-S16. **Dependencies:** M-14, M-15, M-12. **Size:** M. **API change:** No.

**Proposed files:** mobile safety/global-state modules and journey matrix. **Acceptance proof:** Deterministic speed/GPS, no false saved on full disk, skew, TalkBack/130-percent forms. Apply the common engineering/test contract above.

### M-17 - Dedicated-device provisioning and safe internal upgrades

Productize tested Device Owner/lock-task mechanism, allowed external navigator, signed release build and recovery guide. Serialize update operations and verify download/signature/install while preserving local DB/outbox. Keys remain external; prove local internal distribution before actual production rollout.

**Screens:** P31 and update globals. **Dependencies:** M-01, M-16, B-29. **Size:** L. **API change:** No.

**Proposed files:** mobile native provisioning/updater/build and IT docs. **Acceptance proof:** Two signed local builds retain pending data, wrong signer/package refusal, interruption/relaunch. Apply the common engineering/test contract above.


## Integration, operations and delivery proposals (8)

### I-01 - Reconcile full scope, issue registry and policy decisions

Prepare nine-section issue specs and reconcile live state when authentication is restored, splitting epics without duplication. Record owner direction, QR grammar and #14/W19/W34-W36/W53 corrections. Scientific/legal unknowns stay explicit and block affected acceptance; do not reopen accepted paging/auth/org-wide rules or shrink scope.

**Screens:** W1-W71, P1-P32. **Dependencies:** none. **Size:** M. **API change:** No.

**Proposed files:** issue specs/mirrors, docs/decisions.md and design change records. **Acceptance proof:** Every screen/issue owned once, policies have resolver and downstream task. Apply the common engineering/test contract above.

### I-02 - Reproducible isolated local stack and real-service harness

Provide root-only stack/test entry with unique project/port validation, synthetic two-org role/scope data, isolated object storage/email capture, scheduler and real-API web/Android driver configuration. Use test-only management fixtures, not admin endpoints. Preserve existing mocked tests for their narrower proofs.

**Screens:** all. **Dependencies:** I-01. **Size:** M. **API change:** No.

**Proposed files:** root compose/scripts, test-only fixture command, harness configuration/docs. **Acceptance proof:** Clean owned volumes, 5432 refused, health/worker/email/storage and deterministic reset. Apply the common engineering/test contract above.

### I-03 - Whole-product local acceptance and capacity run

Run real local builds through ten web and seven mobile journeys and connected operating-day/lab/privacy loops. Exercise cold offline restart, concurrency, delayed uploads and agreed synthetic capacity/latency budgets. Record criterion-to-evidence links and blocking defects; no invented field performance claims.

**Screens:** W1-W71, P1-P32. **Dependencies:** all B/W/M, I-05. **Size:** L. **API change:** No.

**Proposed files:** dedicated acceptance suites and docs/release/local-acceptance/ only. **Acceptance proof:** Entire checklist with build/command evidence, actual services and no skipped required behavior. Apply the common engineering/test contract above.

### I-04 - Independent security, accessibility and design acceptance

Audit isolation, immutable decisions, auth races, uploads/RFC/keys/exports/portal privacy, dependency/Android permissions and placeholders. Verify WCAG 2.2 AA, scanner/keyboard, themes/locales, desktop variants and TalkBack/130-percent text. Findings block release rather than becoming silent exceptions.

**Screens:** all screens/global variants. **Dependencies:** all B/W/M, I-05. **Size:** L. **API change:** No.

**Proposed files:** docs/release/security-accessibility/ only; source read-only. **Acceptance proof:** Review matrix, automated and manual focus/contrast/scanner/device evidence. Apply the common engineering/test contract above.

### I-05 - Local production-shaped operations and recovery

Assemble backend/nginx/worker/scheduler/Redis/storage/updater locally, rehearse fresh/upgrade migrations, DB-plus-artifact backup/restore, bounded jobs, health, redacted logs, alerts and rollback. Include session cleanup/retention/rejection alerts and consolidated phase ADR/glossary closeout. No external deployment here.

**Screens:** all, especially W18, W55, W60-W61, W67. **Dependencies:** all B/W/M, I-02. **Size:** L. **API change:** No.

**Proposed files:** deployment recipes, local ops scripts, docs/operations/ and recovery evidence. **Acceptance proof:** Separate-volume restore, worker/Redis/storage failures, migration and rollback compatibility. Apply the common engineering/test contract above.

### I-06 - Deliver/deploy the accepted complete product (reuse #18)

Expand #18 to backend/web/worker/scheduler/update server, immutable artifacts, TLS/proxy/cookies/CSP/storage/mail, migrations and observability. Deploy only the locally accepted exact candidate after production approval. Verify production separately and deliver links/build IDs and IT/operator guides; staging after local acceptance cannot replace it.

**Screens:** all. **Dependencies:** I-03, I-04, I-05. **Size:** L. **API change:** No.

**Proposed files:** release/deploy workflows, runbooks and final environment. **Acceptance proof:** Owner-approved candidate, health/journey/artifact checks, proxy defense and tested rollback. Apply the common engineering/test contract above.

### I-07 - Post-delivery field research (reuse #13)

Run outdoor one-handed/glare/gloves/noise comprehension/completion/taps research after delivery with consented evidence. Use delivered build and file prioritized follow-ups. Do not defer specified functions to this study or claim it as an executed local prerequisite.

**Screens:** P1-P32 through seven routes. **Dependencies:** I-06. **Size:** M. **API change:** No.

**Proposed files:** research protocol/results and follow-up specs. **Acceptance proof:** 3-5 courier route sheets, prioritized findings, no personal data committed. Apply the common engineering/test contract above.

### I-08 - Retire legacy reset URL compatibility (reuse #62 if open)

Remove legacy path route/component/tests/nginx exception only after confirming #58 deployment plus one token lifetime (currently one hour). If no old links were ever issued, prove that and retire before release; if previous deployment already satisfies the interval, move earlier. Preserve fragment handling and no-token logs.

**Screens:** W1 reset. **Dependencies:** I-06 by default; earlier only with deployment/lifetime evidence. **Size:** S. **API change:** No.

**Proposed files:** web auth/router/nginx compatibility and tests. **Acceptance proof:** Fragment reset works, old route absent, token-free logs. Apply the common engineering/test contract above.

## Existing issues: one disposition, no duplicated implementation

This is the permitted mirror fallback, not a claim all these issues remain open. Preserve original issue numbers for existing UI children; extract only the backend contract scope into the named B package, amend/link scopes, and do not create two implementations. Shared B packages are implemented once and consumed by multiple UI children. All 44 numbered mirrors have nine top-level sections, but epics need concrete child-level models/contracts/errors/criteria and many bodies are superseded by ADRs.

| Existing issue | Evidence and disposition | Remaining ownership |
|---|---|---|
| #1 mobile spike | Code merged #43/#77; report recommendation/trials incomplete | Reuse M-01 |
| #2 bootstrap | Integrated #46; no recreation | Baseline; B-01 only extends scope |
| #3 catalogs/rules | Integrated #50; accepted dates/org scope supersede mirror | Baseline; B-01 metadata gaps; W-01/W-02 consumers |
| #4 auth | Integrated #51 | Baseline; only unresolved policy B-32/W-39 |
| #5 sync | Integrated #55; domain handlers explicitly deferred | Baseline; B-04/B-13 and individual domain handlers |
| #6 mobile foundation | Production app still stub | Reuse M-02 |
| #7 access | No production app yet | Reuse M-03 |
| #8 shift epic | #68 already supplies open/close backend subset | B-05/B-10/B-12/B-13/B-16; M-04/M-05/M-06/M-14; CLOSE ONCE SPLIT |
| #9 ovitrap epic | Missing domain implementation | B-14/B-15; M-07/M-08/M-09; CLOSE ONCE SPLIT |
| #10 release/sample epic | Include web permit prerequisites | B-20/B-21; M-10; W-25/W-27/W-28; CLOSE ONCE SPLIT |
| #11 fixed/system epic | Missing production phone/backend features | B-05/B-06/B-07/B-29/B-34; M-11/M-12/M-13/M-15/M-16/M-17; CLOSE ONCE SPLIT |
| #12 client/schema | Integrated #48 | Baseline; regenerate in each API-changing B PR |
| #13 field research | Old before-screens timing superseded by owner | Reuse I-07 after delivery |
| #14 P14 design | Inspected PNG/source still missing Yes/No eggs | Retain design child in I-01; M-08 implements/B-14 validates; no duplicate design issue |
| #15 baseline | Integrated #39 | No remaining package |
| #16 tooling | Integrated #40 | No tooling rewrite |
| #17 tokens/i18n | Integrated #42 | Feature copy stays in each feature PR |
| #18 deployment | Not evidenced deployed; mirror backend-only | Reuse I-06 expanded to full stack; local rehearsal only I-05 |
| #19 live positions | #68 did not add location.ping | Reuse B-16 including missing ingestion/track |
| #20 foundation epic | #26/#27/#28/#29/#32 integrated; W2-W5 still absent | W-08/W-38/W-39 and I-04 residual acceptance; CLOSE ONCE SPLIT |
| #21 lab epic | Preserve W34-W42, including optional module | B-18/B-19/B-21/B-22/B-23; shared B-10/B-24/B-25; W-11/W-21-W-26; CLOSE ONCE SPLIT |
| #22 supervision epic | Includes assignment/scheduling and approvals | B-06/B-12/B-16/B-17/B-33; W-07/W-16-W-20; CLOSE ONCE SPLIT |
| #23 config epic | Base API integrated, richer configuration absent | B-01/B-06/B-08; W-01/W-02/W-06/W-09; CLOSE ONCE SPLIT |
| #24 people/privacy epic | Identity foundations do not complete screens | B-01/B-02/B-03/B-24/B-28/B-29/B-31; W-03-W-05/W-33-W-36; CLOSE ONCE SPLIT |
| #25 analytics/portal epic | No domain API in URL registration | B-25/B-26/B-28; W-30/W-31/W-32/W-37; CLOSE ONCE SPLIT |
| #26 shell | Integrated #47 | Baseline, not all W screens |
| #27 web spike | Integrated #41; ADR 0001 accepted | Do not reselect stack |
| #28 web auth | Integrated #57 and #58 improvements | Baseline; B-32/W-39 residual policy |
| #29 tables | Integrated #74, phones consumer built; mirror also asks W6/W35 usage | Baseline; W-07/W-22 + I-04 residual consumers, no duplicate table issue |
| #30 reception | Retain issue for UI, extract backend scope | W-21 consumes B-18 |
| #31 counts | Retain issue for UI, extract backend scope | W-22 consumes B-18 |
| #32 void pattern | Integrated #76, domain consumers still needed | Baseline; each feature wires it, I-03 checks history |
| #33 incident UI | Retain UI, extract backend/escalation | W-07 consumes B-06 |
| #34 validation UI | Retain UI; mutable shift proposal superseded | W-18 consumes B-17 |
| #35 catalog editor | Retain, correct outdated assumptions | W-02; B-01 only missing metadata/protection |
| #36 parameter UI | Retain, follow accepted effective-date behavior | W-01 |
| #37 people UI | Retain, extract RFC/security/audit contract | W-04 consumes B-02 |
| #38 entomology UI | Retain, extract calculations/contracts | W-30 consumes B-26 |
| #44 Phase 0 close | Integrated #45 | No repeat closeout issue |
| #49 notifications | Missing producers/delivery | Reuse B-07; W-08/M-02 consume |
| #54 token retention | No policy/task evidence | Reuse B-31 |
| #56 rejection quota | No implementation evidence | Reuse B-30 |
| #58 fragment reset | Integrated #61 | Baseline; I-08 alone retires compatibility |
| #59 Phase 1 close | Integrated #60 | No repeat closeout issue |

Referenced newer issues without local mirrors: #62 reset compatibility maps to I-08 (decision 83). #63 APK CI (#69), #64 PMTiles (#81), #65 proxy fix (#66), #67 i18n split (#70), #68 shift lifecycle (#71), #73 immutable-trigger guard (#87), #78 agent tuning (#79) and #85 AGENTS (#86) have local merge evidence. Preserve as baseline and fetch actual bodies/state before reopening/closing. Other live-only issues cannot be enumerated while GitHub auth fails; I-01 must reconcile them before creating anything. Split-epic closure means administrative supersession after every requirement/criterion has a linked owner, not delivery of its children.

## Screen coverage ledger

Each row has one primary completion owner; shared acceptance is not duplicate implementation. Every owner covers the full designed state matrix, not only a happy path. Backend dependencies are above.

| Web codes | Primary owner | Mobile codes | Primary owner |
|---|---|---|---|
| W1 | W-39 + existing auth | P1-2 | M-03 |
| W2-4 | W-38 | P3-7 | M-04 |
| W5 | W-08 | P8 | M-05 |
| W6-7 | W-07 | P9-10 | M-06 |
| W8-11 | W-09 | P11-12 | M-07 |
| W12-14 | W-10 | P13-14 | M-08 |
| W15-17 | W-11 | P15-17 | M-09 |
| W18 | W-12 | P18-20 | M-10 |
| W19 | W-13 | P21 | M-07 |
| W20-21 | W-14 | P22 | M-11 |
| W22-24 | W-15 | P23-24 | M-12 |
| W25-27 | W-16 | P25 | M-13 |
| W28 | W-17 | P26-27 | M-14 |
| W29 | W-18 | P28 | M-02 |
| W30-31 | W-19 | P29-31 | M-15 (M-17 supplies P31 updater) |
| W32 | W-20 | P32 | M-16 |
| W33 | W-19 |  |  |
| W34 | W-21 |  |  |
| W35 | W-22 |  |  |
| W36-37 | W-23 |  |  |
| W38 | W-24 |  |  |
| W39 | W-11 |  |  |
| W40 | W-25 |  |  |
| W41 | W-24 |  |  |
| W42 | W-26 (included optional module) |  |  |
| W43-45 | W-27 |  |  |
| W46-47 | W-28 |  |  |
| W48-49 | W-04 |  |  |
| W50-51 | W-05 |  |  |
| W52 | W-29 |  |  |
| W53 | W-30 |  |  |
| W54-56 | W-31 |  |  |
| W57 | W-32 |  |  |
| W58-59 | W-33 |  |  |
| W60-61 | W-34 |  |  |
| W62 | W-01 |  |  |
| W63 | W-02 |  |  |
| W64 | W-06 |  |  |
| W65 | W-03 |  |  |
| W66 | W-35 |  |  |
| W67 | W-36 + existing phones |  |  |
| W68 | W-03 |  |  |
| W69-71 | W-37 |  |  |

Web global states belong to W-39 and each feature. Mobile S14 global/S15 English/S16 accessibility belong to M-16 verification plus each feature's behavior. No W or P screen is deferred to an MVP or field research.

## Conflict-free execution waves

Each wave starts from the accepted merged base of the preceding wave; all listed prerequisites must already be available. Workers use isolated worktrees. **At most one API-changing backend PR is active, including review and generated-client changes.** No task is done just because its scheduled wave has arrived.

This conservative schedule deliberately pairs one backend task with at most one production UI task. W and M production tasks both touch locale indices/root JS locks and are not paired. It can be optimized later only after exact file manifests prove disjointness. Wave 2 has an exception: M-01 is spike/report work rather than production UI.

| Lane | Exclusive writes during parallel waves | Read-only for the other lane |
|---|---|---|
| B | backend/**, packages/api-client/**, docs/api-conventions.md, docs/sync.md, docs/glossary.md for new domain terms before code, per-B contract docs; existing sync/error locale modules for machine codes | These contracts, generated types, seeds and backend registries |
| One W or production M | Its app feature and central route/navigation files, app tests/README, distinct feature locale modules, both locale index.ts files, placeholder allowlist; root JS manifests/lock if needed | New feature locale composition, root JS lock and UI code |
| M-01 in wave 2 | Spike/report and mobile-foundation ADR rows 6-7 only | B-01 uses its own contract document, not docs/decisions.md; W-01 only its feature README |
| I | Dedicated integration waves; I-03/I-04 have separate evidence trees | No simultaneous product mutation during acceptance |

Backend new messages use existing sync/errors namespaces; UI owns separate feature namespaces. Neither lane edits the other's common/shell translations or root configuration. Backend dependencies use backend/pyproject.toml and uv.lock, UI uses root JS lock. New feature locale areas/indices are written only by the single UI lane. Consolidated decision/phase closeout occurs in I-05; each backend PR adds new domain terms to docs/glossary.md before code and UI consumes those names; domain documentation uses per-issue files meanwhile. Reject a manifest expansion that overlaps an active worker and reschedule it, rather than resolving it through concurrent edits.

[ASSUMPTION] M-01 needs no root JS manifest/localization changes during wave 2. If it does, move it to a dedicated wave before M-02; do not overlap W-01. I-02 establishes fixture/driver contracts; actual Android consumer integration lands with M-02/features as the app becomes available. B-13/M-02 establish interfaces for later producers, whose own backend/client tasks wire them. This is not permission to omit local Android acceptance.

| Wave | Parallel work packages | Barrier / ownership |
|---|---|---|
| 1 | I-01 | Reconcile specs, issue ownership and decision resolvers |
| 2 | B-01, W-01, M-01 | Existing rule API UI + org/catalog backend + spike/report only |
| 3 | I-02 | Isolated local fixtures/harness |
| 4 | B-32, W-02 | Disjoint backend/UI lane; clients consume earlier contracts |
| 5 | B-02, W-03 | Disjoint backend/UI lane; clients consume earlier contracts |
| 6 | B-04, W-04 | Disjoint backend/UI lane; clients consume earlier contracts |
| 7 | B-05, W-39 | Disjoint backend/UI lane; clients consume earlier contracts |
| 8 | B-06, W-14 | Disjoint backend/UI lane; clients consume earlier contracts |
| 9 | B-07, W-06 | Disjoint backend/UI lane; clients consume earlier contracts |
| 10 | B-08, M-02 | Disjoint backend/UI lane; clients consume earlier contracts |
| 11 | B-09, M-03 | Disjoint backend/UI lane; clients consume earlier contracts |
| 12 | B-10, W-07 | Disjoint backend/UI lane; clients consume earlier contracts |
| 13 | B-11, W-08 | Disjoint backend/UI lane; clients consume earlier contracts |
| 14 | B-12, W-09 | Disjoint backend/UI lane; clients consume earlier contracts |
| 15 | B-03, W-10 | Disjoint backend/UI lane; clients consume earlier contracts |
| 16 | B-13, W-11 | Disjoint backend/UI lane; clients consume earlier contracts |
| 17 | B-14, W-15 | Disjoint backend/UI lane; clients consume earlier contracts |
| 18 | B-15, W-16 | Disjoint backend/UI lane; clients consume earlier contracts |
| 19 | B-16, W-05 | Disjoint backend/UI lane; clients consume earlier contracts |
| 20 | B-17, M-04 | Disjoint backend/UI lane; clients consume earlier contracts |
| 21 | B-33, M-05 | Disjoint backend/UI lane; clients consume earlier contracts |
| 22 | B-34, M-06 | Disjoint backend/UI lane; clients consume earlier contracts |
| 23 | B-20, M-07 | Disjoint backend/UI lane; clients consume earlier contracts |
| 24 | B-21, M-08 | Disjoint backend/UI lane; clients consume earlier contracts |
| 25 | B-18, M-09 | Disjoint backend/UI lane; clients consume earlier contracts |
| 26 | B-19, W-12 | Disjoint backend/UI lane; clients consume earlier contracts |
| 27 | B-24, W-17 | Disjoint backend/UI lane; clients consume earlier contracts |
| 28 | B-22, W-18 | Disjoint backend/UI lane; clients consume earlier contracts |
| 29 | B-23, W-19 | Disjoint backend/UI lane; clients consume earlier contracts |
| 30 | B-25, W-20 | Disjoint backend/UI lane; clients consume earlier contracts |
| 31 | B-26, W-21 | Disjoint backend/UI lane; clients consume earlier contracts |
| 32 | B-27, W-22 | Disjoint backend/UI lane; clients consume earlier contracts |
| 33 | B-28, W-23 | Disjoint backend/UI lane; clients consume earlier contracts |
| 34 | B-29, W-24 | Disjoint backend/UI lane; clients consume earlier contracts |
| 35 | B-30, W-25 | Disjoint backend/UI lane; clients consume earlier contracts |
| 36 | B-31, W-26 | Disjoint backend/UI lane; clients consume earlier contracts |
| 37 | W-13 | Merge and verify before next wave |
| 38 | W-27 | Merge and verify before next wave |
| 39 | W-28 | Merge and verify before next wave |
| 40 | W-29 | Merge and verify before next wave |
| 41 | W-30 | Merge and verify before next wave |
| 42 | W-31 | Merge and verify before next wave |
| 43 | W-32 | Merge and verify before next wave |
| 44 | W-33 | Merge and verify before next wave |
| 45 | W-34 | Merge and verify before next wave |
| 46 | W-35 | Merge and verify before next wave |
| 47 | W-36 | Merge and verify before next wave |
| 48 | W-37 | Merge and verify before next wave |
| 49 | W-38 | Merge and verify before next wave |
| 50 | M-10 | Merge and verify before next wave |
| 51 | M-11 | Merge and verify before next wave |
| 52 | M-12 | Merge and verify before next wave |
| 53 | M-13 | Merge and verify before next wave |
| 54 | M-14 | Merge and verify before next wave |
| 55 | M-15 | Merge and verify before next wave |
| 56 | M-16 | Merge and verify before next wave |
| 57 | M-17 | Merge and verify before next wave |
| 58 | I-05 | Local production-shaped operations/recovery and phase closeout |
| 59 | I-03, I-04 | Frozen candidate; separate evidence trees and isolated test stacks |
| 60 | I-06 | All local gates pass; production approval for exact candidate |
| 61 | I-08, I-07 | Delivered build research; reset cleanup only after verified time gate |

I-03 and I-04 must use separate DB/Redis/buckets/mail sinks and write only their evidence trees; source remains frozen. Fix findings in new scoped defect PRs, rerun affected checks and freeze a new candidate. I-07 writes research results while I-08 touches reset compatibility only. I-08 may move earlier when deployment/lifetime evidence permits; never infer that from a date alone. Deployment approval is for a concrete accepted artifact and is neither requested nor assumed by this planning document.

## Decisions and assumptions requiring explicit disposition

| Topic | Resolver / owner package | Required before dependent acceptance |
|---|---|---|
| Live issue inventory/bodies | Orchestrator, I-01 | Normal authenticated reconciliation, map each once, no wholesale mirror recreation |
| Store, QR, offline source/license/package, updater | Technical owner, M-01 | Measured recommendation and ADR; PMTiles observation is not full certification; no offline public OSM tile downloads |
| Shared QR grammar/labels | Domain/technical owner, I-01/B-14/B-25 | One type/code/version grammar, manual fallback and all five label types |
| Empty scope and COO/ALM/REG/GOB | Owner/security, B-01/B-28 | Explicit all/deny semantics and data-driven permissions; external fixed read-only |
| Portal public or authenticated | Owner/privacy, B-28 | Same suppression and no-PII guarantees across browser and institution key |
| 2FA, notice, expiry/extension, request-access/error reference | Owner/security, B-32/W-39 | Implement selected contract or explicit configurable/disabled disposition; fixed 12 h stands until superseded |
| Launch catalogs, bounds and defaults | Program owner/entomologist, B-01/domain producer | Confirm values or visible unconfigured state; a missing safety gate cannot appear passed |
| Recount, plausibility, viable eggs/viability | Entomologist, B-18/B-19 | Lab-only rules/method, independent counter, never field-vs-lab sample rule |
| Indices, confidence intervals/bands and suppression | Entomologist/privacy, B-23/B-26/B-28 | Reviewed formulas/examples, no invented 60-percent threshold; W42 included |
| Evaluation weights and repeated-low-result path | Operations/HR, B-03 | Configured/versioned weights and authorized recipient |
| ARCO calendar/retention/transfers/RFC encryption | Legal/security, B-02/B-24/B-31 | Recorded policy consistent with immutability; no guessed legal deadline or implicit pruning |
| Whole-shift/per-point decisions and late offline work | Operations, B-17/B-33 | Append-only decision/replay policy and explicit closure blockers |
| Ping/track retention and speed emergency access | Operations/privacy/safety, B-16/M-16 | Open-shift collection only, configured cadence/retention, safe emergency behavior |
| Notification channels and final escalation target | Operations/IT, B-06/B-07 | Working in-app/email design, critical recipients and delivery failure visibility; no assumed push vendor |
| Geometry dependency and CSV/PDF negotiation | Technical owner, B-11/B-25 | Officially verified dependency/APIs and real renderers or accepted convention change |
| Same-origin/CSP/assets/tiles and Android API address | IT/security, I-02/I-05 | Local proxy/device connectivity works without remote defaults or weakened security |
| Devices, browsers and capacity budgets | Owner/QA, M-01/I-03/I-04 | Explicit tested matrix, release-build measurements and honest hardware gaps |
| Region/domain/registry/mail/signing custody | Infrastructure owner, I-06 | External secrets and approved release gate after local completion |
| Legacy reset deployment date | Infrastructure owner, I-08 | Deployment plus token-lifetime evidence or proof no old links issued |

I-01 may advance independent planning while decisions await owners, but affected capabilities cannot be accepted as done. No scientific/legal value is invented. W42 and missing-epic screens remain included. Real-logo availability and web phone-width layouts require a recorded visual disposition; final delivery must identify any explicit owner-approved asset exception. Outdoor research is post-delivery; controlled local device engineering tests are required beforehand.

## Whole-product local acceptance before production

This checklist is **planned, not executed**. I-03/I-04 record exact commit/build, environment, commands/results and criterion-to-evidence links. Unit/contract tests prove individual rules once; e2e proves cross-layer journeys and accessibility. Enabled W42 is included. #13 outdoor field research is deliberately not a preproduction dependency.

### Isolated, repeatable environment

- [ ] Orchestrator assigns a unique compose project and verifies free explicit host PostgreSQL port from 55432 upward plus unique API/web/Redis/storage/email ports. This prompt assigns no runnable project/ports: do not start services with defaults. Backend compose currently defaults to host 5432; I-02 must guard against omission. Never use host 5432 or another project's services.
- [ ] Start from root compose only with locked dependencies and synthetic A/B organizations, limited centers/quadrants, all permission sets, two supervisors/entomologists and a courier. Use test-only fake credentials generated per repository rules, no real personal data, secrets or .env-file changes.
- [ ] Record owned container/volume/bucket identities before/after. Real PostgreSQL/Redis/API/web/worker/scheduler/private object storage/email capture and Android-to-local-API connectivity work. Test local production-shaped TLS/cookies/proxy behavior. No external production/mail/storage account is required.
- [ ] Fresh migrations and populated-schema upgrade work; migration drift and schema/client drift are clean. Backup DB plus attachments/builds and restore into separate owned volumes, retaining business/audit provenance. Cleanup only run-owned resources after preserving evidence; never globally prune.

### Identity, isolation and immutable records

- [ ] Web login/CSRF, captured-email fragment reset, invalid/expired link, logout and expired-session reauthentication work against real API. Drafts survive; generic errors do not enumerate users. Selected 2FA/notice/expiry policy has no dead-end control; late responses cannot restore a signed-out session.
- [ ] Phone first login requires signal, PIN/biometric offline unlock works, wrong attempts require full password, idle/speed lock preserves forms. Refresh rotation/lost-response/concurrent use respects token families. Explicit single final upload enters review; denied revoke/reset reasons get no grace. No revoke/logout/update path discards unsent events.
- [ ] Cross-org AND limited-center/quadrant list/read/create/relation/decision/export/download/WS tests pass per domain. External keys/portal cannot access internals. Organization/scope changes clear old caches, last-admin protections hold, permission seeds never re-grant revoked codes.
- [ ] No business DELETE/mutation bypass, FieldEvent status rewrite or count overwrite. New immutable tables have trigger guard coverage. Void uses common normalized visible-character validation (default min 10, max 1000), and reason/author/time remain visible in search/history. Deferred acceptance applies once; unrelated void does not remove a blocker.

### Connected operating-day journeys

- [ ] W62/W63/W64/W65/W68 configure org/timezone/epi week, permissions/scope, Other/fallback, rules and valid trainings. R9 changes revisit frequency 7 to 6; scheduled values reach phone snapshots when due and old records retain versions. Missing safety settings are visibly unconfigured.
- [ ] R1/W8-W19: save nondispatchable biological draft, complete it, record two daily conditions and an out-of-range block/incident; print labels, sign dispatch, scan center receipt with missing items, resolve discrepancy, assign courier stock and receive phone signature. Test expiry, concurrent dispatch and receipt retry.
- [ ] All five W19 PDFs have real physical dimensions, readable fallback codes, safe QR decode, organization phone/logo and reprint receipt. No field-count box; lot/ovitrap/bag/release-device/sample types route correctly through actual scanner.
- [ ] R2/W22-W27: publish quadrant version only after resolving outside points; create block/four fixed-code points, spacing warning, preview/apply risk import, keyboard allocation and pending reassign. Historical visits retain geometry/assignment.
- [ ] P3-P12: no-shift/open flow, checklist/odometer/map readiness, severe-fault motorcycle departure prevention, scanned signed supplies, day/list/offline map and navigation. Damaged/invalid/foreign/wrong-courier codes, denied camera/GPS and absent external navigator have usable recovery.
- [ ] P13-P17: place/check positive, negative, no-paddle, closed-house, Other, absent/destroyed/lagged and already-checked correction, replacement/relocation/removal/recovery. No numeric field count in UI/API payload. Point code survives physical replacement; bag and corrections retain provenance; third paddle reuse refused under current rule.
- [ ] R5/W43-W47/P18-P20: first permit type/zone/requirements, source lot/device and valid release/sample. Exercise training, schedule, lot, zone and GPS blockers. Suspend on web while phone is offline; stale release is refused/reviewed server-side per policy, with correct recipient notification.
- [ ] P22-P25/W20-W21/W52: fuel receipt/retake and efficiency advisory, offline incident/accident then critical delivery, supervisor comments and emergency capability fallback; community totals/agreements/complaint link without neighbor PII. Never falsely show an offline alert delivered.
- [ ] W28/R6/R7/W29-W31: live map has only open scoped shifts, reconnect reconciles close, late ping never revives a dot. Overdue incident escalates and requires evidence to close. Two supervisors race: one decision/effect, second conflict. Accept applies deferred work once, reject relocation creates one next-day task, observe returns reason to offline courier.
- [ ] P26-P31/W15-W17/W33/W39: pending-point decisions, stock returns/shrinkage/difference, RPBI evidence and odometer close. Nonzero difference opens discrepancy without blocking close. Phone-closed/server-received differ; GPS stops immediately. History/training/settings and observation work; quadrant closure blocks until all recovery/removal conditions resolve.

### Lab, analytics, privacy and portal

- [ ] R3/W34-W37: receive 20 bags without mouse, covering duplicate/no-reading/missing/no-paddle, then fixed-focus Enter-save-next counting. Network loss retains value, concurrent count cannot overwrite. Void/replacement, viable-egg/viability under reviewed method, reasoned rejection and independent recount keep attempts. Washing/drying and max reuse enforced.
- [ ] W40-W42: receive field samples, repeat invalid Wolbachia result retaining previous attempt, distinguish negative/missing/invalid, require CENAPRECE notification before material delivery. Enable W42 and run approved EA-1 worked examples; test disabled module and retained history too.
- [ ] R4/W38/W57/W58-W61: real Annex VI/E-Ov2 preview/CSV/PDF negotiation and history; revoked/absent transfer leaves RFC blank with note. Explicit reveal/export has W60 receipt and no personal content in normal cache/logs. ARCO uses approved calendar; retention/anonymization and token-family archive/prune honor live/final-upload protection.
- [ ] R8/W53-W56: worked-example numerators/denominators match linked filtered lists, exclusions, rules and epi-week/timezone boundaries. Reach bag from block index in at most five clicks. Verify prevalence confidence/release/intervention context, comparisons and no-band/zero-denominator/partial/no-data states. Every chart has equal table and every number an honest destination.
- [ ] R10/W66/W69-W71: portal access model and keys enforce read-only/geo/endpoint/rate/expiry/revoke; one-time secret never returns in lists/caches/logs. Cut-off reports match; small groups resisted against differencing; no personal identities or precise staff tracks; API docs/downloads work.
- [ ] W2-W5: home/critical counts match filtered destinations, grouped search indistinguishable for unknown/foreign codes, marked voids and complete history traverse field/lab/decisions/export provenance. Notification read/read-all/channel preferences work. No permissive pending area, empty placeholder route or unwired feature action remains.

### Offline, recovery and internal distribution

- [ ] Run all seven mobile prototype routes on real production app/local API, airplane mode, cold start/force-stop/reboot with queued events/photos; every local save persists and later syncs once. Include lost committed response, duplicate IDs/concurrency, partial accepted/rejected/review batch, rejection quota and valid progress, expired cursor/full recovery, stale snapshots and reassignment.
- [ ] Simulate full/low storage, battery, denied sensors, wrong clock, unavailable API/Redis/storage/email and worker/scheduler restart. No false saved/delivered status, silent error or secret/PII logs. Use deterministic clocks/conditions and bounded Retry-After/backoff.
- [ ] Provision a controlled Device Owner test phone, restrict escape, allow navigator, install two signed local release builds with pending records/drafts and upgrade. Verify signer/package/checksum/minimum gate, interruption/download/install/relaunch/lock task and data retention. Distinguish actual hardware/Android/build from emulator coverage. Local bench tests precede release; courier research follows delivery.
- [ ] Speed lock uses deterministic location traces plus controlled bench validation, safe emergency access and intact drafts; collection ceases at local close. Stationary/emulator tests do not prove outdoor GPS/sunlight scanner behavior.
- [ ] At agreed synthetic capacity, measure queue drain, server paging/export/map/chart behavior, memory/storage and recovery against agreed budgets using release builds. Restore DB/artifacts and repeat jobs safely; test migration/image rollback compatibility without losing audit/event history.

### Visual, accessibility and release gate

- [ ] Every W1-W71/global state: keyboard/scanner, axe plus manual semantics/focus/contrast, modal trap/return, live results, filters/void details, map/chart tables, WCAG 2.2 AA targets and text/pattern status. Test W35 fixed focus with real scanner input.
- [ ] Web 1280x800 and applicable 1440x900 variants; EN W2/W35/W53, dark W53/W54, es-MX/en and themes throughout, +30-percent text, 320 CSS-pixel reflow, portal phone width. Record actual phone/tablet browser coverage separately; no inference from desktop.
- [ ] P1-P32, S14 states, English samples, dark theme, TalkBack/130-percent text, safe-area insets and supported Android matrix. Record decisions-over-pixels deviations, particularly P14, no field counts and organization rules; real logo disposition is explicit.
- [ ] Appropriate feature suites, final static/build/contract checks and independent code/security review pass. Map every test to criterion/invariant; no redundant framework tests. Required legal/scientific setting/device capability unavailable means gate PENDING, never passed.
- [ ] Freeze candidate and link I-03/I-04/I-05, CI and review evidence separately. Provide operator/IT/update/recovery guides and unresolved-issue disposition. Only then obtain production approval for exact I-06 artifact. Verify production separately; deliver before I-07. I-08 requires deployment/lifetime evidence.

### Command vocabulary for the future acceptance run

These are documented current commands, **not product validation executed during this planning task**. Set isolated process configuration with externally provided secrets; do not edit .env files. Run at the appropriate gate and rerun only after relevant failures/changes. Future mobile/ops driver commands must be documented by their packages before I-03, not invented here.

| Check | Command | Evidence / limit |
|---|---|---|
| Root checks | npm run lint; npm run format:check; npm run typecheck (separate commands) | Clean outputs and locked toolchain |
| Shared/unit tests | npm test --workspaces --if-present | Actual suites found; absence of production mobile suite is not a pass |
| Backend | In backend/: uv run pytest --cov | PostgreSQL behaviors, coverage gate, criterion map |
| Types | In backend/: uv run mypy . | Strict services/selectors |
| Python lint/format | In backend/: uvx ruff@0.17.3 check --config pyproject.toml .; uvx ruff@0.17.3 format --check --config pyproject.toml . | Separate documented checks |
| Migration drift | In backend/: uv run python manage.py makemigrations --check --dry-run | No missing migration |
| API contract | npm run api:generate, then git diff --exit-code -- packages/api-client | Validated schema/client current |
| Web build | npm run build -w @wolbachia/web | Configured local base URL and runnable production build |
| Web e2e | npm run e2e -w @wolbachia/web, E2E_BASE_URL for isolated real-service instance/new suites | Existing page.route mocked auth alone is insufficient |
| Repo gate | pre-commit run --all-files | Hygiene/static/secret checks; never install shared hooks |
| Local stack | I-02 documents explicit docker compose -p <assigned-project> -f compose.yaml commands and validated ports | Owned services/volumes, no default 5432 |
| Android | M-02/M-17 document exact local build/install/driver commands | Production mobile build and actual device evidence; current APK CI builds spike |

Merged, CI-green, locally accepted, production deployed, production verified and post-delivery field-tested are distinct states. Completion before production means the specified product is implemented, integrated locally, reviewed and operable with evidence.
