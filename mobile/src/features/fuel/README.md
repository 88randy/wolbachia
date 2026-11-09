# M11 fuel capture and receipt retake (#140)

P22 is reachable from the operational-shift home. It pins the original shift and
motorcycle **code** (the B05 `motorcycle_id` wire value), litres, MXN amount and km.
Raw input persists independently of validation. Full refill is explicit; the
initial partial state cannot manufacture a comparable interval.

One edit queue and the original downloaded context/profile, shift, raw draft and
attachment session SQL predicates arbitrate every write. Camera/file I/O runs
outside those queues. Retake adopts private bytes first, then replaces only the
receipt reference under the original predicates. Failed/cancelled/stale attempts
preserve quantities and the previous file. Superseded files remain retained and
are never enrolled for upload. Saved observations are immutable.

Schema18 appends owner-bound drafts after unchanged SQL1–17. Even an unfinished
draft without a photo prevents another owner from activating the phone. Save
atomically enrolls the draft, original event UUID and only its declared receipt
in the existing outbox/file journal. No new event queue, scheduler or HTTP client
exists. Invalid quantities or failed storage never report Saved.

Normal JSON waits for the exact enrolled receipt to be verified; missing receipts
are explicitly pending and do not block local capture. An earlier pending fuel
event holds same-shift close JSON until its terminal ingest response, including
when its retry is not yet due. This prevents B05 rejecting fuel after an overtaking
close. Local close is never gated; in-review/rejected fuel releases transport
ordering, and the existing final-upload exception remains.
Fuel JSON also waits for a pending matching opening response, even when opening
retry is not yet due. A prior-shift draft remains readable without disabling a
new capture for the currently authorized shift.

## Advisory and review

The canonical bundle has no fuel-history producer. This client cannot prove a
comparable previous refill across devices/couriers, so unknown/partial intervals
display insufficient data. It does not use a partial local outbox as a baseline
or assume access to supervisor-only fleet reads. The domain calculation accepts
only a proven adjacent accepted full refill and downloaded inclusive bounds;
tests exercise 15/60 and unrounded outliers. Original server review parameters
provide the displayed efficiency and threshold facts when available. A decreased
reading warns without changing the number or blocking Save/close.

Phone-saved, receipt verification, server ingestion and subsequent exact-source
review outcomes remain separate. Reviews never rewrite the original event or
captured values. Current downloaded scope/profile authority is required for new
writes; unavailable authority retains local history without granting capture.

[ASSUMPTION] Currency is fixed to MXN: there is no organization-currency capture
configuration in the current mobile contract. No new dependency or API is added.
The issue supersedes the static design's automatic time/location subtitle: time
is retained locally; no unmeasured GPS is fabricated. Receipt legibility is a
user check with a real private preview and Retake, not an automatic detector.

## Criterion → test

| Criterion | Cheapest owning tests |
| --- | --- |
| Retake preserves fields, fixed motorcycle/units, invalid input recovery | `fuel-domain.test.ts`, `m-11.test.ts`, `fuel-editor.test.ts` |
| Partial/unknown and inclusive efficiency policy; review preserves input | `fuel-domain.test.ts`, exact-source review journey in `m-11.test.ts` |
| Atomic offline save/reopen, original UUID retry, truthful pending/delivery | `m-11.test.ts`, `fuel-authority.test.ts` |
| Local capture/close remains available; opening/fuel/close JSON retains unsent order | `fuel-authority.test.ts` |
| es-MX/en, light/dark, 130% host scale, labels/48dp actions | `fuel-ui.test.ts` (host renderer only) |

The tests use real ordinary SQLite and private temporary files, and the generated
API client with scripted transport. They do not qualify native SQLCipher,
Android force-stop, camera lifecycle, real B04/B05 service interoperability or
TalkBack. MO01 reference and low-resource physical qualification remain UNRUN;
no phone installation or deployment is authorized here.

Official references checked for existing APIs:
[React Native TextInput](https://reactnative.dev/docs/textinput),
[React Native accessibility](https://reactnative.dev/docs/accessibility),
[Expo ImagePicker SDK58](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/).
