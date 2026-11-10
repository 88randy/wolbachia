# P29 own offline history (#144)

History reads the existing SQLite outbox and the single typed CourierHistoryEntry
projection. No new queue, capture writer, API DTO or server command exists.
The DayStore writer now retains every history7 kind. Its full-bootstrap marker
forces upgrades to download previously excluded kinds; delta pages cannot hydrate
that marker. Bootstrap/revocation removes all downloaded `history.*` rows, while
authored outbox, drafts, evidence and retained lifecycle source facts remain.

The read runs in one SQLite snapshot under the existing short projection writer.
Current ready capture context, exact accepted owner/session and unlocked auth
must match before and after the await. Missing scope hides retained history rather
than implying no activity. The page labels its downloaded copy as partial.
Every displayed fact must fit a complete current grant pair over all its actual
subjects. Empty grants deny all. Local point facts use the real current point,
block and quadrant relation; voids inherit their exact source's proof. Unscoped
local facts remain in the inbox/outbox and are absent here until genuine server
source or whole-shift history supplies their subjects. A narrowed scope never
authorizes a retained old code, reason or observation.
Code search uses explicit local code/reference fields; it searches no arbitrary
payload notes. Timeline grouping uses the organization's timezone.

Local ingest state stays distinct from downloaded review facts. An accepted void
decision never rewrites its original source event. Author and correction target
UUIDs remain exact; unavailable names/times stay unavailable. No course or history
projection grants a field capture permission.

`history-domain.test.ts` covers actual SQLite reopen, local pending and server
observations/void provenance, all-kind materialization, bootstrap/revoke cleanup,
search, timezone grouping, scope narrowing and identity fences. Archived local
finding labels come from the original immutable M08 capture and catalog, preserving
offline observations after a catalog rename. `history-ui.test.ts` covers the
es-MX/en, light/dark, 130% host-prop matrix, status labels and search/back actions.
Native FlatList layout, TalkBack,
SQLCipher force-stop, both MO01 devices and real-API delivery remain unrun.
S13/S16 PNG and source were read; unavailable totals replace illustrative design
counts because no such authoritative contract exists.
