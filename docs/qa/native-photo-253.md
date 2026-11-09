# Native photo acquisition — partial delivery, issue #253

This is code/CI preparation, not completed device acceptance. Keep the PR draft
with `Refs #253`; do not close the issue until the owner-authorized physical matrix
below is complete. No hardware access was authorized for this implementation.

## Implemented boundary

M08 uses pinned Expo ImagePicker58.0.10 camera-only acquisition, then the existing
#246 private-file adoption/journal and event outbox. One immutable lowercase UUID
identifies the photo. No new schema, migration, event queue or backend route exists.
Permission/camera/file continuations retain the displayed unsaved draft UUID,
accepted actor/session, live assignment and shift. A conditional SQLite INSERT
arbitrates owner/session and the exact unsaved draft before private file creation.
File I/O stays outside locks. Ambiguous private bytes are retained, not deleted.

The serial #138 composition now supplies that SAME native port to M09 through its
real factory. M09 preserves its stricter original interactive unlock/context fence;
it never replaces that admission with a fresh actor after a permission or camera
await. Native cancel leaves the displayed draft unchanged. Its final partial SQL
publication consumes the captured file authority plus the original M09 target,
owner/session/context and scope guard, persisting only `{id,fileRef}`. Whole-draft
edits and Save compare their exact raw read to avoid erasing a concurrently adopted
photo. Stale edits retain recoverable buffered input; stale Save atomically rolls
back outbox, lifecycle projection/references and attachment enrollment. No automatic
retry or envelope repair occurs. Existing M09 AC3 owns both editor/photo orders,
quiet native cancel and stale Save rollback/explicit retry with real private files
and ordinary temporary SQLite. This adds no schema or device acceptance claim.

MO03 background/idle locking is unchanged. A permission prompt that locks the app
requires unlock and retry before camera launch. An already launched camera may
finish private same-context adoption under the opaque AuthGate. Unmount/draft
replacement retires callbacks; noncancelable native work retains its single-flight
lease until the native promise settles. A cold pending result lacks correlation
and is read and ignored; the courier retakes the photo. Cancellation is quiet.
Undo removes only the selected pending reference, never files, journal rows,
historical source evidence or a saved envelope. Save enrolls only retained IDs.

Final publication is one partial evidence-array UPDATE guarded by the original
adoption owner/session/generation and immutable file, exact unsaved UUID and
original target/point/shift/pinned/live assignment. Whole-draft writers compare
their exact raw read version. A losing buffered edit remains pending for explicit
retry. Only a still-current request reloads the target/draft after stale publication;
aborted/unmounted/replacement-view completions cannot start reloads or post errors.
Save checks the same version inside its existing atomic outbox transaction,
so it cannot capture a stale evidence list; no version column/schema is added.
SQLite's [JSON mutation functions](https://www.sqlite.org/json1.html#jins) provide
the partial array update; its [scalar subquery semantics](https://www.sqlite.org/lang_expr.html#cosub)
let an absent matching read version fail the existing NOT NULL constraint and roll
back Save in the same transaction. Native SQLCipher execution remains unrun.

Operational shift authority is also part of that final UPDATE. One coherent
ShiftOpenStore read supplies the raw shift draft/link, opening identity/status/
result_code and current catalog/map to the existing gate implementation and its
original SQL guard. captureShiftId validates that same snapshot before acquisition;
the guard is never reacquired to authorize an older camera result. No checklist,
map or odometer gate is reimplemented in SQL. lastOdometer/rules/attempts/params are
not gate inputs and are excluded. Normal ShiftOpen.read still exposes catalog/map
before any shift state exists.

This partial delivery conservatively rejects an in-flight capture if a compared
shift input changes, including a benign opening status/result transition. The
current-view reload/retake path applies and private bytes/journal remain retained;
there is no false Saved or automatic adoption under a fresh proof. This tradeoff
requires explicit MO01 qualification along with the remaining physical matrix.

Shift-open photo contract work is [#260](https://github.com/88randy/wolbachia/issues/260).
M09 is connected in source through the actual serial #138 composition described
above. Native camera behavior and the physical acceptance matrix remain pending;
the separate shift-open binding is not represented as working camera integration.

## Dependency and permission evidence

ImagePicker58.0.10 is MIT and matches Expo58.0.23's bundled `~58.0.10` range.
Only its required expo-image-loader58.0.3 dependency was added. The installed types,
plugin and Android manifest were inspected. SecureStore58.0.2, build-from-source
configuration and the native commit plugin remain exact. Options request images
only, no editing, base64 or JS EXIF. The plugin sets microphone/photos permission
to false; existing Android external-storage permission blocks remain.
`exif:false` does not strip metadata from bytes: #102 server sanitation remains
responsible. No location/audit claim is inferred from a photo.

The existing `mobile-apk` Check the APK step requires CAMERA and rejects microphone,
external-storage and media-library permissions in the merged APK. It preserves the
bundled JavaScript and SecureStore DEX checks. That assertion has not run locally;
native builds are permitted only through this existing workflow.

Primary sources: [SDK58 ImagePicker](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/),
[SDK58 package](https://github.com/expo/expo/blob/sdk-58/packages/expo-image-picker/package.json),
[config plugin](https://github.com/expo/expo/blob/sdk-58/packages/expo-image-picker/plugin/src/withImagePicker.ts),
[Android manifest](https://github.com/expo/expo/blob/sdk-58/packages/expo-image-picker/android/src/main/AndroidManifest.xml),
[AAPT2 dump](https://developer.android.com/tools/aapt2#dump).

## Criterion to test map

| Acceptance criterion / invariant | Cheapest meaningful evidence |
| --- | --- |
| Actual adapter, original UUID, private adoption, M08 Save enrollment, pending Undo | `attachments.test.ts`: `owned capture wiring commits M08 reference, binding and original event together before Saved` now runs the acquisition adapter with real temporary PNG/files and SQLite; Undo is idempotent, retains bytes/journal and rejects saved records |
| Displayed draft cannot be replaced during acquisition or just before reservation | Same suite: `native capture cannot adopt into a draft replaced while the camera is open`; `the exact unsaved draft is checked inside the reservation INSERT, before file I/O` |
| Actor/session/live shift/scope/saved continuation and file cancellation | Same suite: `a native continuation retains its original actor, session, live shift, scope and unsaved state`; `retiring a capture during a real file read stops publication and writes while retaining ambiguous bytes` |
| Final SQL publication and competing public draft writers in both orders | Same suite: `photo publication and public draft writers preserve both winner orders and original authority`: target-first, temperature-first, actual DayStore revoke/generation loss, assignment-first, photo-first with recoverable buffered edit/retry, stale Save rollback/retry with surviving UUID enrollment, and actual ShiftOpen claim→severe_check review at final SQL while generation/assignment remain unchanged |
| M09 actual adapter/adoption, original admission, partial publication and all-writer CAS | `m-09.test.ts`, existing `AC3: failed lifecycle transaction retains draft, references and truthfully pending state`: original generated-client upload journey, both photo/editor orders, quiet cancel, stale Save rollback and explicit retry enrolling surviving UUIDs |
| Permission allow/deny/permanent deny, pre-launch local lock, cold orphan, native failure, quiet cancel, invalid/type/size metadata, single flight through abort | `photo-acquisition.test.ts`: adapter-boundary cases with deferred native promises; no hardware/Expo framework behavior is claimed |
| UI retirement and quiet cancellation | Same suite: action-runner case proves late UI callbacks are suppressed after retirement; real screen/device navigation remains unrun |
| Existing file validation and upload invariants | Existing `attachments.test.ts` and `attachment-transport.test.ts` remain; their low-level capture fixture supplies a real current unsaved draft instead of an unconditional reservation guard |
| Localized messages | i18n catalog consistency suite; no English/es-MX keys embedded in UI |
| Native compilation and merged permission manifest | Actual-head existing `mobile-apk` workflow — pending orchestrator publication/CI |
| Physical lifecycle, real API and accessibility | Required matrix below — UNRUN |

## Mandatory physical acceptance — UNRUN

Run separately on Galaxy S24 Ultra SM-S928B / Android16 and a qualifying low-resource
arm64 / 4GB RAM / 64GB storage / Android13+ device (MO01 does not name or authorize
a second model). Record exact APK SHA/artifact, device/profile, OS, date/operator,
evidence location and pass/failure for each row. Never generalize one profile to
the other or claim certification from Node/APK checks.

| Journey | S24 reference | Low-resource profile |
| --- | --- | --- |
| Camera allow / deny / permanent deny / settings retry; camera unavailable | UNRUN | UNRUN |
| Cancel/back; rapid repeated presses; return focus and truthful draft status | UNRUN | UNRUN |
| Permission prompt background lock → unlock/retry; launched camera → opaque lock → same-context return | UNRUN | UNRUN |
| Originating actor/session/assignment/shift/draft changed while native work is suspended | UNRUN | UNRUN |
| Activity destruction/process restart before adoption: orphan ignored, no false Saved, retake usable | UNRUN | UNRUN |
| Force-stop after durable adoption: same UUID/private bytes/draft restored; Undo retains bytes/history | UNRUN | UNRUN |
| Save and real #102 authorization/PUT/finalize/receipt; missing/changed/unsupported/oversized files and storage full | UNRUN | UNRUN |
| Light/dark × es-MX/en × TalkBack × 130% font: capture/error/Undo/navigation/focus | UNRUN | UNRUN |

No local camera, phone, adb, Android prebuild/Gradle, Docker, Playwright or real API
execution was performed. Node uses real temporary ordinary files/SQLite, not native
SQLCipher or Android private storage. APK size, latency/memory and physical privacy,
accessibility and lifecycle behavior remain unverified.
