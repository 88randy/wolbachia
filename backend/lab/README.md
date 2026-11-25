# Laboratory reception and authoritative counts (#114)

`samples/` adds B-21/#117 collection, reception and immutable Wolbachia result
attempts, using canonical Reading/Lot/Release sources and the existing named
LabMethodVersion owner. `supports_wolbachia` is explicit and defaults false.
See [samples/README.md](samples/README.md) for commands, analytical eligibility,
current paired scope and correction dependencies. No operational assay is seeded.

This domain implements B-18 against real immutable `ovitraps.Bag` and Reading
sources. Unknown, foreign and currently unauthorized human codes share 404 and
create no command, receipt, source, incident, count or attachment. A no-paddle
receipt belongs to a real authorized Reading and has a null Bag. It never joins
the count queue. Reception is an observation, not proof of courier delivery.

## Commands and current authority

The existing Bag/Reading facades delegate to `facade.py`; no second bags router
exists. `commands.py` retains a unique org/command UUID, structural input hash and
exact committed result including the next candidate/queue context. Replay checks
the current actor, action, real target and EVERY saved response subject, then
returns the original body before current source/method/CAS checks. A new input
uses a new command UUID. A lost reply never selects another candidate or submits
another count. Queue candidates are committed observations, not reservations.

Action codes and actual center AND quadrant authority come from current
membership/profile bindings. One complete binding must cover the pair; crossed
grants, none/empty/malformed scope and government clamping cannot create a parent.
Selectors filter scope/effectiveness before order/page. Legacy Bag/Reading GETs,
`status`, code, point/week and `reading.read` remain intact. Their additive Lab
projection requires current Lab authority. `lab_status` filtering requires
bag.receive in addition to the original facade permission.

Lock order is sorted authentic actor/collector/counter/receiver Users, actor Device/Session/Pair,
known source FieldEvents, Organization NOWAIT NO KEY UPDATE, planned courier TRY
locks, domain rows and sorted Uploads. Identity changes abort for a fresh preflight.
History recipients are prepared before Organization even when they cannot download
today. No file, sanitizer, network, broker or notification execution occurs under
Lab locks. Only known retryable lock states map to 429/Retry-After; no ambiguous
write is automatically retried.

## Reception and measured results

`reception.py` receives effective real paddles continuously. Explicit missing
observations and known ineffective sources retain deduplicated discrepancies.
`incidents.py` exposes a public CAS mapping to exact current named incident-type
versions with a real finite owner chain, zero report photos and no invented
blockers. An unavailable configuration retains the cause and returns an explicit
gate. Bounded keyset recovery creates its actual incident/link once and republishes
the source projection; an intent is not delivery. Recovery links are system facts,
not counterfeit human observations or FieldEvents.

Counts are strict nonnegative JSON integers up to 2**53-1. Zero is an authored
observation, distinct from no count and `has_eggs=false`. OP06 defaults to 1000
(configurable 100..10000); a larger observation requires explicit confirmation and
an actual durable independent request. Positive counts against the original false
eggs flag add their separate cause. Lag/index-excluded effective paddles remain
countable. No numeric field count is compared with the laboratory observation.

Viability retains viable/examined integers and computes Decimal6
`100 * viable / examined`. Zero examined yields null with `zero_examined`;
unrequested measurement yields null with `not_requested`. No relation between
examined sample and full paddle value is inferred. A named procedure/reference,
exact effective LabMethodVersion and retained verification are mandatory for
viability and rejection. Simple counting works without a method. No scientific
procedure or operational approval is seeded; technical fixtures certify nothing.
Result reads retain the EXACT procedure pin rather than latest configuration.

Rejection requires a reason, exact verified owned private evidence and the named
method. `lab_rejection` is the sixth closed parent in the existing upload owner.
No bytes are read beneath Lab locks. A void-only supervisor can read the minimal
exact-target context and its bound evidence without receiving list/history/queue,
count-create or general upload authority.

## Manual egg annotation (W35)

The existing count and count-replacement commands accept an optional `annotation`
with `upload_id`, `marks`, `tool_version` and optional active `elapsed_seconds`.
The value is the number of marks, including mixed boxes and points; an explicitly
different numeric value is rejected. Empty marks are an authored zero. Numeric
commands retain their prior canonical input and behavior. The same UUID replay,
CAS revision, implausible-count confirmation, queue response and transaction apply.
There is no separate counting command or mobile transport.

`EggAnnotation` retains the exact count, Bag, actor and verified image dimensions.
Pixel coordinates have a top-left origin and must be strict JSON integers. Points
require `0 <= x < width`, `0 <= y < height`; boxes additionally require positive
`w`/`h` and `x+w <= width`, `y+h <= height`. The server rejects out-of-bounds marks;
the UI clamps its gestures to the image before submitting. There are at most 5000
marks per annotation, checked before individual mark validation. Facade command
JSON bodies above 2 MiB return `413 payload_too_large` before JSON parsing.
The upload must have purpose `egg_annotation`, be verified, owned by the current
actor and device, and unbound. No storage or image decoding occurs under Lab locks.

Count, annotation and the `egg_annotation` attachment parent commit atomically.
Same-organization/source/image/count guards and insert-only triggers protect SQL
writes. A correction creates a new annotation and keeps the voided predecessor.
`GET /egg-counts/{id}/annotation/` and paged `/egg-annotations/` (exact `code`,
`author`, `created_from`, exclusive `created_before`) use current `egg_count.read`,
paired scope and independent-QA blindness before filtering/page. Images use the
existing authorized attachment download with before/after-I/O access checks.
Numeric disclosure is recorded even when only the image is downloaded.

`tests/test_egg_annotations.py` covers mark validation, count equality/mismatch,
atomic rollback, explicit confirmation/replay, correction retention, permissions,
organization isolation and immutable persistence; the module belongs once to
`regular-lab`. Migrations `0015`/`0016` retain facts; uploads `0012`/`0013` add a
nullable parent, metadata default and separately validated constraints.
Reversal refuses populated annotations or their upload purpose.

## Training dataset exports (W72)

`EggAnnotationExport` is an immutable organization-scoped request with retained
`EggAnnotationExportItem` selection and voided flags. Separate immutable
`EggAnnotationExportStatus` facts derive `queued -> running -> ready | failed`
and `ready -> expired`;
the worker claims each queued request once under its row lock. A request fixes
its selected annotation UUIDs before dispatch, so later annotations or voids do
not silently change a queued dataset. `EggAnnotationExportDownload` records the
authenticated actor and UTC timestamp of every authorized download.

Every endpoint under `/api/v1/lab/egg-annotation-exports/` requires
`egg_annotation.export`, registered through `lab.permissions.ADMIN_CODES` in
`organizations/defaults.py`. It is admin-only by default, like Lab method
management and recount adjudication; routine entomologists are not granted bulk
data transfer. Every admin with this permission can see and download every
export in the organization, including another requester's export, subject to
current whole paired scope and independent-QA visibility. Each download is logged.
`seed_organization_defaults --apply` adds this new code to
eligible seeded admin profiles using the existing non-restoration policy.
Current whole paired scope and the independent-QA visibility predicate precede
selection, list counts, paging and access to an indivisible archive. Losing access
to any selected count hides the entire export. The first disclosure of ready
totals publishes only selected counts without an existing actor/count receipt.
Repeated polls of the same immutable exports perform no disclosure writes or
materialization of previously disclosed counts. Lists, detail and downloads use
this existing idempotent disclosure boundary; exports cannot bypass
independent recount blindness. Download checks current identity and authority,
then checks the sealed size with stat and verifies SHA-256 while streaming. A
digest mismatch aborts the stream rather than delivering a successful completion.

Creation takes inclusive organization-local `date_from`/`date_to` (at most 366
days), optional same-organization author User UUID, `include_voided` (default
false) and `format: coco | yolo`. The limit is 5,000 selected images;
`annotation_export_too_many_images` identifies an oversized request. The documented
`MAX_EXPORT_BYTES` constant also caps the sum of selected verified image sizes at
2 GiB (2,147,483,648 bytes); `annotation_export_too_many_bytes` includes `max_bytes`.
The create transaction holds the existing organization arbiter: at most one
queued/running request per requester and two per organization. A conflicting
request returns `annotation_export_in_progress`. Counts refer
to the immutable selected annotations, including one image for each point-only
annotation. Empty selections produce valid empty archives. Failures retain
`annotation_export_failed` without exposing exception text. A worker refuses an
inactive requester or one whose current permission has been removed with
`annotation_export_requester_unauthorized`.

`recover_annotation_exports` runs every minute and appends
`annotation_export_timed_out` failure facts for queued/running requests older
than the 1,860-second hard time limit plus a 120-second margin. The task keeps
the project's existing early acknowledgment policy; persisted requests and beat
recovery cover lost messages, worker restarts and hard kills.
`expire_annotation_exports` runs hourly. `ANNOTATION_EXPORT_RETENTION_DAYS`
is an environment-configurable setting (default 7 days), measured from the ready
fact. Expiry removes only archive bytes and appends `expired`; requests,
selection, ready facts and download receipts remain. Expired downloads return
`annotation_export_expired`; W72 can regenerate the same filters.

The Celery task builds one ZIP into a temporary file. JSON arrays are separately
spooled to disk and selected rows are iterated in batches of 200. Images come only
from the existing verified sanitized upload, with size/SHA-256 checked; originals
with EXIF are never included. The same private storage backend stores completed
archives at private `dataset/<random UUID>.zip` keys, with an immutable result
size and SHA-256. A temporary name in the same directory is atomically published
with `os.replace`, so interrupted copies never expose a partial final object.
Failure after storage discards the unreferenced ZIP. This archive stream does not change the individual upload's
10 MiB cap. No whole dataset is buffered in memory and no storage I/O holds SQL
locks. Downloads stream an attachment with `private, no-store` and `nosniff`.
The web uses its existing session cookie and a same-origin download anchor;
ZIP bytes never enter a JavaScript Blob. Headerless cookie navigation resolves
only a current active membership of the export's organization and rechecks normal
export permission/scope. Generation uses the `export` throttle; downloads have
their own `export_download` scope at 30/hour. HEAD does not log a download.

COCO contains `annotations.json` and `images/<annotation public UUID>.<ext>`.
Detection annotations retain pixel `bbox: [x,y,w,h]`, area, `iscrowd: 0`, and
category 1 `aedes_egg`; image/annotation IDs are consistent integers. Metadata
identifies AedesVision, export UUID and UTC creation time; licenses are empty.
YOLO contains the same images, corresponding `labels/<UUID>.txt` with class 0
and normalized center/width/height to six decimals, `classes.txt`, and `data.yaml`
with `train: images`, `val: images`, `nc: 1`, `names: [aedes_egg]` and no `path`.
The dataset is unsplit: the YAML comment and README require consumers to create
an independent training/validation split. These keys and relative directory
values follow the [Ultralytics dataset documentation](https://docs.ultralytics.com/datasets/detect/);
the [official loader](https://github.com/ultralytics/ultralytics/blob/main/ultralytics/data/utils.py)
uses the YAML directory when `path` is omitted and accepts list class names.
Images use `ZIP_STORED`; JSON, YAML, CSV and text use deflate.

Both formats include `points.json` with
`{"images":[{"image_id":1,"file_name":"images/<UUID>.<ext>","points":[[x,y],...]}]}`.
Points remain top-left-origin pixel points and never become boxes. Point-only
images have empty YOLO label files. `manifest.csv` contains only image filename,
annotation public UUID, count UUID, box count, point count, captured voided flag
and UTC annotation time. `README.txt` explains schema, coordinates, counts,
filters and the voided policy. No author UUID/name, organization ID, location,
Bag/ovitrap code or original filename leaves in archive metadata; the author
filter is described only as applied/not applied.
There are no personal data in metadata, file names or manifest. Photos themselves
may show handwritten codes or labels; both the archive README and W72 display
this notice before sharing or training.

Migrations `0017_egg_annotation_exports` and `0018_egg_annotation_export_guards`
add new tables, same-organization links, sealed selections and insert-only/state
transition guards. `0019_annotation_export_expiry` expands the retained states;
expiry facts prevent reversal. Populated export history prevents table removal. The format and
private stream tests live in `tests/test_annotation_export_archive.py`; API,
eager-task and PostgreSQL invariants live in `tests/test_annotation_exports.py`.
See [the API contract](../../docs/api-conventions.md#training-dataset-exports-w72)
and decision 177. Format references:
[COCO](https://cocodataset.org/#format-data),
[COCO reference API](https://github.com/cocodataset/cocoapi/blob/master/PythonAPI/pycocotools/coco.py),
[Ultralytics detection datasets](https://docs.ultralytics.com/datasets/detect/),
[Python ZIP streams](https://docs.python.org/3.13/library/zipfile.html) and
[temporary files](https://docs.python.org/3.13/library/tempfile.html).

## Corrections and independent QA

`corrections.py` appends a canonical-catalog reason plus a normalized note of at
least 10 visible and at most 1000 stored characters for EVERY code. Void and optional
same-Bag replacement share one CAS revision/command transaction. Original values,
methods, clocks, evidence and authors remain. Pending requests append supersession
and carry to a new count; a rejection cannot erase an outstanding obligation.
Source void keeps audit or refuses active results through the canonical ovitrap
hook and a deferred SQL completion guard. The hook checks only this named deferred
constraint in a savepoint, restores its deferred mode on success, and maps its exact
SQL marker AND source UUID AFTER rollback, retaining
`ovitrap_void_blocked` without queries in a broken transaction. Other failures
propagate. Independent execution and physical reuse retain those same dependencies.

`recounts.py` creates immediate requests and deterministic closed LOCAL-day draws.
The default rate is 5 per 100 first-pass counts (configurable 1..20), ceil/minimum
one for nonempty population. Store real population members/hash, timezone, UTC
bounds, rule/configuration proof and selection. Recovery is idempotent; supplements
retain earlier selections/requests after corrections. Requests preserve the first
counter and independent requirement. `independent_qa/` owns actual second/third
execution, explicit adjudication and forward physical paddle identity/reuse (#115).

The one public history publisher receives authentic human result facts. Lab adds
five variants to the existing review/shift/relocation/transfer union and advances
the history producer from 3 to 4. Root bootstrap remains 2. System QA changes alter
the human count's projected QA state without forging a human QA action. Count,
rejection and void projections retain the exact original result UUIDs; updates
append new projections and never rewrite original history rows. Current
source/recipient scope filters before LIMIT/bootstrap/changes; regrant can read the
retained updated projection. No new producer, courier event or queue exists.

## Persistence and verification owners

Every fact is insert-only, same-tenant and source coherent. SQL guards complete
commands/results, current revision chains, named ratio/method pins, mandatory QA,
actual day populations and evidence binding. A populated downgrade raises before
dropping audit, evidence, origins or history receipts. Legacy upgrade seeds no
receipt/count/method approval. `test_lab_migrations_114.py` is the sixth explicitly
classified whole MigrationExecutor owner; Lab is covered and strict, with the
existing 85% combined coverage gate unchanged.

| Criterion | Owning test |
| --- | --- |
| Integer/ratio/quota edge rules | test_lab_policy_114.py |
| Real reception, no-paddle, discrepancy/configuration recovery | test_lab_reception_114.py |
| Method/source/rule pins, counts/rejections/correction obligations | test_lab_counts_114.py |
| Winner orders, lost reply and every saved subject | test_lab_concurrency_114.py |
| Actual closed-day frames and supplements | test_lab_recounts_114.py |
| One history owner and current regrant/download boundary | test_lab_history_114.py |
| One HTTP/CSRF/paired authority/void-only context owner and no-DB schema | test_lab_api_114.py |
| Real private Lab bytes and parent access | existing test_uploads_b_04.py |
| Upgrade/raw guards/reverse/restoration | test_lab_migrations_114.py |
| Once-only defaults/revocations | existing test_seed_defaults.py |

Read ../README.md, ../../docs/api-conventions.md and ../../docs/glossary.md before
changing the domain. Local pure/schema/collection checks do not execute PostgreSQL
guards, barriers or migrations. Fresh full CI owns that qualification. A technical
test fixture is never an approved operational biological method.

## Whole-material disposal integration (#107)

Only an actual BagDisposition with current receipt/result and closed-day unselected
assessment removes physical availability. Open/missing/stale draw and unresolved
independent recount are blockers, never implicit clearance. Disposal retains Bag,
Reading/source, count/method/rule proof and every QA obligation. Later #115 work
reports material_unavailable, never inferred completion or reuse.
New first counts, physical replacements and rejections are blocked after disposal
in the shared writer and additive SQL guard. Optional count-replacement
measurement_kind=data_correction requires its real same-Bag/source/predecessor/
command proof and preserves scientific pins. Omitted or physical_measurement keeps
the old canonical command shape/hash and exact saved replay before material gates.
No new Lab model, science default, ledger or history publisher is introduced.

## Independent observations and physical reuse (#115)

`independent_qa/` extends the existing Command, first-result, request and draw
owners. Claims append real counter/role/current first/result/policy/cause pins.
Independent attempts keep a distinct typed identity and never join first-pass
sampling N. A strict exact difference greater than max(absolute tolerance,
relative tolerance * first value / 100) needs a distinct third person and real
third observation before selecting one original candidate. Equality stays within
tolerance. Below tolerance the completing second counter may select with current
recount.create; another adjudicator needs recount.adjudicate. The third needs both.
Every selection retains the canonical reason plus a 10-visible/1000-stored note.

The queue exposes nonnumeric work identity/state/CAS only. One central blindness
predicate covers result/detail/void/request causes, Bag.lab, lab_status facets,
history bootstrap/changes and stored responses before mutable execution gates.
Hidden numeric/inferential rows are removed before filter/count/order/page/LIMIT;
hidden Bag.lab is null, while field/receipt facts remain. Actual numeric or derived
status delivery records a minimal immutable actor/count/surface receipt, even
without a current recount grant. Later grants do not erase what was disclosed.
Own first authors and previously exposed actors cannot become independent.
Historical payloads and cached response bodies are never rewritten for redaction.

Only completion of a genuinely new first observation records the forward blind
boundary. Legacy/replayed/replacement observations do not acquire it. A legacy
request may receive an explicit external operational independence assessment from
a different current adjudicator with egg_count.read. It pins the exact request,
first/result, target, role, real pair, opaque reference and reason. Second target
requires create; third target requires create+adjudicate. Disclosure always wins.
This declaration does not certify what somebody knew outside the system.

EggPaddle registration is a forward human physical observation of a real positive
Piece. Bindings require a later actual issue for this Bag's real collection/check
or historical placement. A type label/code/UUID alone never establishes identity.
The complete actor/source closure includes both placement and collection authors.
Every later cycle requires both original collection clocks to follow the prior
drying fact; a later ledger debit cannot turn an older collection into a new cycle.
HTTP command retries authorize their saved subjects before current mutable state;
a later binding never enlarges the original retry's authority vector. GET keeps
the paddle's complete current read scope.
Reuse requires the current negative selected observation, genuine closed-day
member/frame and all current obligations resolved, named current verified QA and
treatment procedures, actual evidence and the configured 0..2 bound. No procedure,
verification, duration, chemical recipe or biological approval is seeded.

Consumed material creates one typed PaddleStockReturn credit for its exact debit,
Piece/lot/unit/cycle. Positive custody instead retains the canonical return_accept
receipt and creates zero additional operations. Neither branch reverses SupplyUse.
Later real QA selection after treatment remains awaiting_material; it cannot
measure washed material, undo the return, erase a cause or authorize another cycle.
Counts/rejections/corrections/source void preserve physical dependents or return
their existing safe blocker. History7 extends the one publisher with three typed
QA/reuse variants; root2 and supplies1 remain unchanged.

The existing B19 service, Lab HTTP/history/concurrency, B04 real-byte and whole Lab
MigrationExecutor owners cover these boundaries. Pure checks/collection do not
qualify PostgreSQL guards, stock effects, migrations or races.
