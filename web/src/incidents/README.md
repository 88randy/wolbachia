# Incident workspace (W6/W7, #33)

The workspace consumes only generated `packages/api-client` reads and commands.
`/incidents` is guarded by `incident.read`; `/incidents/<code>` resolves the exact
human code in the reported facade before retrieving its returned UUID. Fleet
consumers retain the facade's original default behavior.

## Reads and session boundary

- Every read uses `orgScopedQueryOptions` and `useSessionIdentity`; the session
  controller remains the only writer of session identity. URL center filters
  override the shell filter and participate in placeholder isolation.
- The tray uses server filtering, ordering and pagination. Critical priority
  comes from the backend. Open is the visible default; All explicitly removes
  the state predicate. Voided incidents have their own explicit state selection.
- Each audience count is an independent server count for the predicates its
  link opens. The counters are not an atomic multi-counter snapshot. Named type,
  center/quadrant and eligible owner choices are paginated metadata reads, not
  inferred from the accepted incident page or fetched with directory permissions.
- Record observers and private work are remounted by actor, organization,
  authorization, center and code. Text drafts use identity/code/kind session
  storage and fall back to RAM when storage is unavailable. Files remain in RAM.

## Commands and evidence

Current server action permissions hide unavailable actions. State, protected
severity, dependents, upload capability, the archived close minimum and `/me/`
reason limits explain and block unavailable operations. Each POST includes the
reviewed `expected_revision`; nothing is changed optimistically.

A synchronous attempt token prevents duplicate writes. Session guards abort on
unmount and refuse stale publication. Session revision changes release busy
state and require manual review of uncertain commands. A late attempt cannot
unlock a newer attempt. A 409 or unknown outcome retains text, blocks another
command and offers an explicit current-state read; no request is replayed.

Evidence uses B04 authorization/renewal, original-buffer SHA-256, authenticated
same-origin byte PUT and exact incident finalization. Pending UUIDs never count.
A retry renews the same authorized upload. Only distinct readable verified audit
references or newly finalized IDs enter the close capture, with current upload
permission. Backend admission and immutable parent ACLs remain authoritative.
Downloads request fresh B04 byte authority and are not cached as query data.

## Design and integration boundaries

The implementation follows W6/W7 content within the shared shell and UI kit,
using token surfaces, status text/icons, skeletons, scoped errors and bilingual
copy. It uses a responsive action column rather than a permanently open sheet.
The actual API accepts a closing reason and evidence IDs; it has no structured
result, reopen, incident map or export operation, so none is invented.
Unavailable linked records stay opaque. Existing motorcycle and lot record
routes are linked and marked Voided when applicable; other record kinds remain
labels until their actual web routes exist.

`IncidentThread` renders the complete returned timeline without truncation and
is reusable by W4. This branch contains no universal-record W4 implementation;
its consumer integration remains pending and acceptance criterion 3 is only
covered here for W7. The report description (including Other free text) is
preserved as returned; this workspace does not add an incident-report composer.

## Criterion to test

| Criterion or invariant | Owning test |
| --- | --- |
| Every tray header count links to its actual server-filtered list | `incidents.test.tsx`: every header count |
| Missing/duplicate/unverified/restricted evidence, reason limits and closed state cannot authorize close | `incident-command.test.ts` |
| W7 close command sends the reviewed revision and verified IDs after confirmation | `incidents.test.tsx`: close sends only verified evidence |
| Full W7 thread, Other description and voided source | `incidents.test.tsx`: resolves a human code |
| Scoped permissions, filters/sort/All, missing code, independent retry, reassign/severity and duplicate comments | `incidents.test.tsx` |
| Original evidence bytes, exact parent and stable-ID renewal | `incident-evidence.test.ts` |
| A retired upload releases busy state and drops its late result | `incident-session.test.tsx` |
| W6/W7 keyboard navigation, axe and 320 px, both themes/locales | `../../e2e/incidents.spec.ts` |

Verification must distinguish these authored tests from executed results. Local
web checks were blocked because `npm ci` cannot create the workspace symlink
(`EPERM`); the pinned TypeScript, ESLint, Prettier, Vitest and browser matrix
require a prepared dependency installation. No database/API qualification or
browser visual result is established by these fixtures.
