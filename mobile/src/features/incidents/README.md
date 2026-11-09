# M12 incidents and emergency (#141)

P23/P24 are reachable from P3. Reports pin downloaded immutable
`IncidentType.current_version_id`, its evidence minimum, original UUID, shift,
device time and catalog/rule hashes. Search places Other last. Raw text and
unconfirmed private photos persist independently of validation. Save atomically
links the retained draft, existing event outbox and only declared attachment IDs.
Undo removes a draft reference and retains its bytes/journal. Saved observations
cannot be rewritten or deleted.

One serialized local writer and original downloaded profile/scope, shift,
raw-draft and attachment-session SQL predicates arbitrate edits, photo publication
and Save. Camera/file/HTTP work runs outside the writer. Schema19 appends after
unchanged1–18; even no-file drafts prevent another owner activating this database.
The existing SyncEngine owns recovery, upload, Retry and JSON delivery. Declared
photos wait for verified evidence; unrelated pulls continue. Incident JSON waits
for its matching opening receipt even across a future retry. Local closure is
never held by incident transport; the backend accepts original pre-close clocks.

Phone-saved, attachment verification, server-received and in-review are separate.
Neither accepted ingestion nor `publication_state=outboxed` proves supervisor,
email or emergency-service delivery. A persisted accident offers the existing
close-shift flow and retains its source throughout. Missing scope/configuration
remains a real backend review outcome, never a fabricated case.

## Available contracts and gaps

Remaining contract/native work is tracked in [#327](https://github.com/88randy/wolbachia/issues/327),
with notification delivery owned by [#49](https://github.com/88randy/wolbachia/issues/49)
and whole-product qualification by [#130](https://github.com/88randy/wolbachia/issues/130).

- `incident.report` and `emergency.accident` v1 use the existing queue. B06 requires
  nonblank description even for an accident. Detail-free capture uses the explicit
  technical marker `emergency.accident`, not invented user testimony. Optional GPS
  preloads only already granted permission and a usable last-known fix, without a
  prompt, tracking, fresh-fix wait or authorization inferred from coordinates.
  Capture snapshots the available fix or null without waiting for that preload;
  a late GPS result never mutates a saved source.
- Types and supervisor timelines use the generated REST client. Only the first
  authorized page is cached; genuine `created_by` or local `source_event` proves
  ownership. The UI labels this a partial own list. No own-author server filter,
  incident/comment/notification sync producer or dedicated read cursor exists.
  HTTP refresh supplements sync and never blocks local Save.
- Replies are read-only in this mobile delivery: the backend has HTTP revision
  comments but no offline comment event. No parallel command queue is invented.
- `/me/` exposes free-form `support_contact`, not typed emergency configuration.
  Only a complete validated telephone string can open the native dialer, clearly
  labelled work support. Missing/denied dialer paths preserve capture and direct
  the user to the phone's emergency-call facility. No number is manufactured.
  Opening a dialer does not certify a call, signal or dispatched help.
- The local-lock surface offers only a cached work call and device fallback;
  it exposes no drafts/thread and grants no capture unlock. There is no delivered
  speed-lock policy in this runtime. Native lock/speed qualification and configured
  emergency contacts remain follow-up work.
- Existing mobile i18n adapter, tokens, camera253 and evidence246 are reused;
  no API, generated client, dependency or server handler changes.

REST caches are private to original owner/session/scope/profile. A changed source
rejects late publication atomically. Connectivity loss retains the matching cache;
observed scope/permission loss hides it without deleting captured evidence.

## Criterion → test

| Criterion / edge | Owning check |
| --- | --- |
| Offline report, storage rollback, journal reopen, original UUID lost-response retry, truthful review | `m-12.test.ts` report journey |
| Other/nonblank description and immutable type version | Report journey |
| Accident with absent detail/GPS, owner isolation, immutable saved capture | `m-12.test.ts` accident journey; `incident-domain.test.ts` |
| Photo denial/Undo/enrollment, pending file and revocation during camera/REST | `m-12.test.ts` photo and barrier journeys |
| Opening retry ordering and unrelated pulls | `m-12.test.ts` opening regression |
| Call present/absent/denied and URI injection | `incident-domain.test.ts` |
| Generated REST types/timeline/work contact and stale session | `remote.test.ts` |
| es-MX/en, light/dark, 130% host text, labels/actions/status/safe close | `incident-ui.test.ts` |

Node uses ordinary SQLite, private fixture files and scripted HTTP through the real
generated client. These checks do not certify live B06/B07, SQLCipher, Android
force-stop, native camera/GPS/dialer, TalkBack, physical font layout or either MO01
profile. Real API e2e and those native gates remain UNRUN; no phone installation
or deployment is performed.

Existing APIs verified in official documentation:
[React Native Linking](https://reactnative.dev/docs/linking),
[Expo Location SDK58](https://docs.expo.dev/versions/v58.0.0/sdk/location/),
[React Native accessibility](https://reactnative.dev/docs/accessibility).
