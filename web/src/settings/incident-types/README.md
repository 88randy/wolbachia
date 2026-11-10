# Incident type configuration (W64, #149)

`/settings/incident-types` requires `incident.manage_type`. This is organization
configuration; empty center scope does not imply loss of that organization-wide
action. The list remains server-paged and supports exact code lookup plus the
backend's ordering. Protected Other stays last at the backend.

The generated client is the only transport. Configuration reads consume named
supervisor/coordinator/terminal projections, exact selected-membership eligibility,
paged owner discovery and immutable type history. A paginated roster never proves
that a selected owner is absent: `membership_id` performs its own exact current
lookup. Optional unavailable levels must be cleared or replaced; terminal must be
active and eligible. No profile names are hard-coded into authorization.

The separate server-paged unconfigured-items list discovers real CatalogItems,
including seeded Other before its first version. Exact code lookup resolves the
selected item independently of the visible page. Initial setup PATCHes its real
id with `expected_revision: 0`; required policy fields start empty and are authored
explicitly. No configuration version or policy values are synthesized in the UI.

Every query uses `orgScopedQueryOptions`. Actor, organization, authorization and
active-center changes remount private drafts. Same-identity read failures and
reauthentication preserve input in RAM. Expected revision remains the reviewed
version; conflicts and uncertain outcomes require an explicit current read before
another write. Commands are never replayed automatically. A synchronous attempt
token prevents duplicates and stale completions cannot unlock a newer request.

Configuration includes exact evidence minima, supported blockers and SLA seconds;
no sample-screen SLA is used. The terminal hourly reminder describes the existing
backend policy. Other's label, icon and active state are disabled and omitted from
updates. Existing incidents keep their captured configuration version.
System-owned blocker kinds such as `lot_dispatch` render read-only. Editing any
other field omits `blocker_kinds` from PATCH, preserving the exact retained policy
without expanding the human configuration writer's allowed kinds.

Design deviations: the shared responsive card editor replaces the desktop-only
fixed side panel; actual named owners replace sample profile labels. SLA is edited
in backend seconds, with units explicit. Version history uses an accessible Radix
dialog. The API supports one retained label rather than separate translation fields.
No export, delete or void endpoint is fabricated for configuration versions.

## Verification ownership

- `w-06.test.tsx`: exact named chain/evidence/blocker/revision roundtrip and history;
  protected Other, ineligible terminal, coded validation and conflict retention;
  real Other initial setup, missing action denial, opaque unavailable codes,
  current authorization change clearing the editor and deterministic stale-write
  ownership across same-identity reauthentication.
  The SLA-only system-blocker regression protects retained `lot_dispatch` policy.
- `web/e2e/w-06.spec.ts`: one wiring journey over es-MX/en and light/dark, keyboard
  capture/history focus restoration/live success, axe, expanded text and 320px.

The parent delivery reports actual executed commands and remaining browser limits.
