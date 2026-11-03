TITLE: [Epic] [Backend] OpenAPI schema and shared api-client package for mobile and web
LABELS: epic,backend,web
## 1. Context
The web app is being designed in parallel by another team and shares this backend.
## 2. Goal
Agree and deliver the backend contracts the web needs first: lab egg count, relocation approval, discrepancies, incidents, catalogs/rules admin.
## 3. Scope / Out of scope
Backend endpoints + OpenAPI. Out: web UI.
## 4. Data model
LabCount (reading, eggs, counted_by, counted_at), approvals.
## 5. Contract
Published OpenAPI schema (drf-spectacular) as single source of truth.
## 6. Behavior
Lab count updates reading state to positive/negative; phone history shows result read-only.
## 7. Edge cases & errors
Count on a voided reading → rejected.
## 8. Acceptance criteria
- [ ] OpenAPI published in CI artifacts.
## Notes
Sync with web team weekly.
