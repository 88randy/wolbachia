TITLE: [Web] Entomology dashboard with drill-down (W53)
LABELS: web,backend

## 1. Context
Part of epic #25. Indices are computed by the backend from lab egg counts (W35). Bands are configured per organization; if none are configured, the dashboard shows values without bands.

## 2. Goal
Entomologists and coordinators see weekly indices per block and quadrant, compare them with the configured bands, and get from any number to the underlying reading and bag in five clicks or fewer (journey R8).

## 3. Scope / Out of scope
**Scope:**
- index cards and charts per week, quadrant and center;
- a table alternative for each chart;
- an exclusions note (e.g. bags without a count, voided records);
- drill-down: block index → points → reading → bag with its lab count;
- 1280 and 1440 layouts;
- light and dark themes;
- es-MX and en.

**Out of scope:** prevalence (W54); official exports (W57).

## 4. Data model
Read model: index per block per epi week, with numerator, denominator and excluded count.

## 5. Contract (API / interfaces)
- `GET /api/v1/dashboards/entomology/?week=&quadrant=&center=` returns indices, bands (if configured), exclusions, and `link_filters` per figure.
- The drill-down uses the existing list endpoints with those filters.

## 6. Behavior
- Each figure is a link.
- Bands are color + pattern + label, never color alone.
- Missing thresholds → notice "No thresholds configured" with a link to W62 (for admins).

## 7. Edge cases & errors
- Week without data → empty state.
- Partial current week → marked as partial.
- Index with denominator 0 → "—" and the reason, not 0.

## 8. Acceptance criteria
- [ ] R8 reaches bag B-4471 from the block index in ≤ 5 clicks.
- [ ] Every chart has a keyboard-accessible table.
- [ ] No "field count" appears anywhere in the drill-down; only lab counts.
- [ ] Dark theme meets 4.5:1 text contrast.

## Notes
- [PENDING] Bands and thresholds from entomology (values in the design are samples).
- [PENDING] Pupae index, IPP and ICPP formulas. Only ICP, IRP and Breteau were confirmed from the CENAPRECE guide.
