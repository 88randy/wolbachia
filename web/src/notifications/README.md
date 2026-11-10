# Notifications (W5, #150)

`/notifications` and the shell panel consume the generated notification inbox,
read/read-all and per-type preference contracts. API `code` values map to shared
es-MX/en messages; the client never renders API text or arbitrary destination URLs.
The backend rechecks ownership, organization and object scope on every request.

The shared table owns cursor/filter URLs. Polling runs every 30 seconds in active
tabs and reconnect refreshes the head. The visible cursor snapshot merges by ID
with its refreshed head so a duplicate cannot replace a new unread notification.
Session identity, effective authorization and the selected center isolate query
keys; obsolete scopes are cancelled and removed. Drafts stay in memory.

Read commands and channel toggles update provisionally. A single per-identity
command lock serializes panel/page writes. Failure restores only still-provisional
cache results, preserving newer authoritative poll responses. Writes never replay
after reauthentication. Required channels are disabled with the policy explanation;
the backend remains the authority for policy and stored preferences.

| Acceptance criterion | Test |
| --- | --- |
| Read/read-all/badge and explicit failed-write retry | `w-08.test.tsx`: read rollback/read-all |
| Stored optional preferences and mandatory channels | `w-08.test.tsx`: preference rollback |
| Reconnect/new rows/duplicate cursor safety | `notification-state.test.ts` and deferred reconnect test |
| Scope changes and inaccessible object references | `w-08.test.tsx`: delayed cursor and safe-reference tests |
| Panel keyboard focus and announcements | Component panel test; `web/e2e/w-08.spec.ts` |
| Light/dark, es-MX/en, +30% copy, 320px, axe/focus | `web/e2e/w-08.spec.ts` matrix |

Design deviations: W5 uses the existing Radix side sheet for focus trapping and
the shared DataTable/FilterBar on the full page, instead of the static design's
custom dropdown/table. Preferences are editable on `/notifications`. No producer,
email delivery, FCM or server-push success is claimed; #49 retains delivery wiring.
