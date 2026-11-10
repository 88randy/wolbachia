# M05 signed courier supply receipt (#134)

P8 retains the downloaded assignment/release version, declared unit UUID and exact
decimal quantity. It never converts boxes to pieces or treats a new plan as the
original receipt. An explicit quantity may be zero. Wrong-kind, unknown, ambiguous
and unassigned QR identities share generic feedback. Repeated scans change feedback
only. Lot scans select a countable line; its quantity is entered in the declared unit.

One service edit queue and the existing projection writer serialize local commands.
Every mutation compares its original raw draft, current owner/session/file generation,
current downloaded projection/profile/context and live shift facts in SQLite. UI
callbacks carry the displayed event UUID. Native file work runs outside those queues;
its continuation retains the original guards. Changing any signed input invalidates
the signature. A complete raster signature is adopted into the existing private
file journal before it becomes a draft reference.

Schema17 adds retained receipt drafts and immutable saved/owner guards after the
unchanged released1–16 prefix. No owner is inferred from a username or newly loaded
profile. No-file drafts already block activation of a different file owner. A signed
draft, its outbox event and signature enrollment commit together before phone-saved
feedback. Storage failure rolls the whole transaction back. One existing SyncEngine
uploads the signature and verifies it before claiming the JSON event; unrelated
events remain eligible. Final-sync JSON retains the existing documented exception.

P8 uses the generated supplies1/schema1 contract: command/assignment/release UUIDs,
plan_revision, reconciliation expected_revision, actual line UUIDs and signature.
Server verdicts remain distinct from later canonical review decisions. Review
outcomes join the exact original source UUID and highest authored decision revision;
they never rewrite the original ingest receipt. An offline assignment change leaves
the captured original intact for the server's explicit review path.

The #143 closing consumer shares this canonical projection boundary with its own
reconciliation permission. Receipt capture still requires receive/upload; file-free
reconciliation requires neither. Both consumers validate readiness, original
owner/session and paired scope, then consume the raw projection guard in the same
local write. Retained closing source frames remain unchanged after plan updates.

## Contract boundaries and design differences

- Actual supply projection has no human lot codes, unit labels or packaging/kind.
  P8 shows explicit immutable UUIDs, offers canonical QR/manual UUID entry and never
  invents a human-code resolver or conversion. Old releases lacking their original
  plan-line metadata cannot start a new capture.
- The supplies producer filters own full vectors for receive OR reconcile. The
  delivered capture_context describes paired field_event.sync, while Me.permissions
  supplies global action codes. Local admission checks that actual owner, pair and
  receive/upload codes; the backend independently rechecks the exact action vector.
  This feed cannot prove distinct per-action vectors offline.
- B04 supplies.receive declares only signature_upload_id. Additional evidence_ids
  are rejected by the strict backend serializer. Damage photos are retained privately
  on the phone and visibly labeled as unavailable for server submission. They are
  never enrolled for unsupported uploads or represented as server evidence.
- Saved receipts are read-only. Administrative corrections remain the existing
  backend reasoned void/review workflow; P8 offers no destructive edit/delete action.
- Device qualification and a real API journey are pending. Host/SQLite tests do not
  certify native camera, SVG raster, SQLCipher or TalkBack.

## Criterion to test

| Criterion / invariant                                                           | Cheapest owning test                                        |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Mismatch, Other, signature, declared units / indivisible pieces                 | m-05.test.ts domain matrix                                  |
| Duplicate, wrong kind/foreign/ambiguous scan                                    | m-05.test.ts scan matrix                                    |
| Original signed receipt survives restart and changed plan                       | m-05.test.ts file-backed reopen + changed-plan cases        |
| Lost response retries original UUID; pending signature blocks only related JSON | m-05.test.ts generated transport and attachment eligibility |
| Failed save has no outbox/success; stale owner/session/UI cannot mutate         | m-05.test.ts rollback, deferred ABA and expected UUID cases |
| Strict feed, bootstrap recovery, original projection CAS                        | supply-projections.test.ts                                  |
| Failed editor retry preserves inputs                                            | m-05-editor.test.ts                                         |
| Local/server/review copy and es-MX/en, theme, 130% host controls                | m-05-ui.test.ts                                             |

Native force-stop/cold start, physical QR/signature/photo, real B04/B10/review/API,
TalkBack, 130% native layout, light/dark and both MO01 hardware profiles are UNRUN.

Official APIs: [Expo Camera58](https://docs.expo.dev/versions/v58.0.0/sdk/camera/),
[FileSystem58](https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/),
[react-native-svg15.16 raster export](https://github.com/software-mansion/react-native-svg/blob/v15.16.0/src/elements/Svg.tsx).
Expo Camera58.0.14 adds actual QR scanning using the SDK58 native integration;
it is MIT/Expo-maintained. Existing ImagePicker cannot read QR codes. Audio and
gallery permissions are not enabled. This dependency requires a new qualified APK.
