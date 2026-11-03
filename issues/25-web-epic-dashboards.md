TITLE: [Web] Epic: Dashboards, exports and public portal
LABELS: web,epic

## 1. Context
Dashboards turn lab counts and field data into entomological indices, Wolbachia prevalence and operational metrics:
- W53 entomology;
- W54 prevalence;
- W55 operations;
- W56 comparison;
- W57 official exports.

Government users get a read-only aggregated portal (W69–W71).

## 2. Goal
Indices people can trust: every number links to the records behind it, every chart has a table, and every export respects data-transfer authorizations.

## 3. Scope / Out of scope
**Scope:**
- W53 entomology dashboard (#38);
- W54–W57;
- W69–W71 portal.

**Out of scope:** computing indices in the browser (the backend computes them); BI tools.

## 4. Data model
Read models only. Proposed:
- index snapshot per block / week;
- prevalence per quadrant / week with CI;
- band configuration per organization (from rule parameters).

## 5. Contract (API / interfaces)
See `docs/web-api-needs.md` § Dashboards and exports, § Public portal. Each figure returns `link_filters` so the UI can open the list behind it.

## 6. Behavior
- Without configured thresholds, charts show values with no bands and a notice.
- Exclusions (e.g. bags without a count) are listed under the indices.
- Portal data shows its cut-off date.

## 7. Edge cases & errors
- A week with no data → empty state, not zero.
- Partial week → marked as partial.
- Aggregates below a minimum group size in the portal → suppressed ([PENDING] threshold).

## 8. Acceptance criteria
- [ ] Every number on W53–W56 opens its filtered list.
- [ ] Every chart has an equivalent table.
- [ ] Portal endpoints return no personal data (automated test on the schema).

## Notes
- [PENDING] Index bands and thresholds from entomology. Values in the design are samples.
- [PENDING] Formulas for pupae index, IPP and ICPP (only ICP, IRP and Breteau were confirmed from the CENAPRECE guide).
- [PENDING] Wolbachia prevalence threshold (60 % in the design is a sample value).
