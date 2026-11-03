TITLE: [Web] Spike: choose web build, routing, data, table, chart and map libraries
LABELS: web,spike,priority:high

## 1. Context
The standard stack fixes React, but not the libraries around it. The design needs:
- server-side tables with URL-synced filters;
- charts with an equivalent table;
- maps with MapLibre and OSM;
- a keyboard-first count screen;
- i18n es-MX/en.

## 2. Goal
A written decision (ADR in `docs/`) for each choice, with a short proof of concept.

## 3. Scope / Out of scope
**Scope:** build tool; router; server-state / data fetching over the generated client; table; charts; form validation; testing (unit + e2e); maps (MapLibre GL JS is already set by the design brief; confirm only the React integration approach).

**Out of scope:** UI kit purchase; backend choices.

## 4. Data model
None.

## 5. Contract (API / interfaces)
The proof of concept calls `GET /me/` and one paged list endpoint through `packages/api-client`.

## 6. Behavior
Each candidate is evaluated on:
- accessibility support;
- bundle size;
- maintenance activity;
- license;
- fit with the generated client;
- support for URL-synced state.

## 7. Edge cases & errors
- A library without adequate keyboard / ARIA support for tables or charts is discarded, or wrapped with our own accessible layer.

## 8. Acceptance criteria
- [ ] ADR merged with one decision per category and the reasons.
- [ ] PoC branch shows a paged, filterable table and one chart with its table.
- [ ] Licenses compatible with client delivery.

## Notes
- [PENDING] No library is decided yet. This spike decides them; nothing in the docs should name one as chosen before it closes.
- [PENDING] Whether the same i18n runtime is shared with mobile through `packages/i18n`.
