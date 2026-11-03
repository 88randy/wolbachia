TITLE: [Mobile] Bootstrap React Native app: design tokens, offline store, outbox and sync inbox (P28)
LABELS: mobile,sync,priority:high

## 1. Context
Design system "Codequim" is defined as tokens in the design canvas. Every screen saves locally first and shows "Guardado en el teléfono" instantly.

## 2. Goal
App skeleton with tokens, i18n (es-MX default, en), local store and outbox chosen in the spike, sync worker, sync indicator in the top bar and the sync inbox screen.

## 3. Scope / Out of scope
**In:** project setup, theme tokens (light default + dark), Inter with tabular numbers, i18n keys, navigation shell with profile-based sections, top bar sync chip states (all sent / N to upload / no signal / error), P28 inbox, background sync with retry/backoff.
**Out:** feature screens.

## 4. Data model (local)
`outbox_event` mirrors `FieldEvent` envelope + local_status (pending | sending | sent | error | in_review | rejected), attempts, last_error.

## 5. Contract (API / interfaces)
Consumes `/api/field/sync/`, `/api/field/uploads/`, catalog and rules endpoints.

## 6. Behavior
- Never blocks UI on network.
- Inbox groups by type, shows plain-language messages, "Intentar ahora", never offers delete.

## 7. Edge cases & errors
App killed mid-upload, token expired while offline, storage almost full, 130 % font size without truncation.

## 8. Acceptance criteria
- [ ] Tokens match the design system page (colors, type scale, spacing, radii).
- [ ] TalkBack labels on icon buttons.
- [ ] Unit tests for outbox state machine.

## Notes
Depends on spike (local store choice) and #sync API.
