# Decisions log (ADR-lite)

| # | Decision | Status | Owner |
|---|----------|--------|-------|
| 1 | Single PostgreSQL DB, row-level isolation by `organization_id` | Accepted | PYROBYTE |
| 2 | Offline-first mobile with idempotent event batches | Accepted | PYROBYTE |
| 3 | Immutable records; void-with-reason instead of delete | Accepted | Client rule |
| 4 | Egg count captured on web by entomologist; field user marks Yes/No only when the paddle is present | Accepted | Client |
| 5 | Configurable rules/catalogs per organization served by backend | Accepted | Client |
| 6 | Internal distribution, dedicated-mode devices, server-driven updates | Accepted, mechanism pending spike | Client / internal IT |
| 7 | Local DB library (WatermelonDB vs op-sqlite), QR lib, MapLibre offline tiles | Pending spike | PYROBYTE |
| 8 | Monorepo: backend + mobile + web + shared packages | Accepted | PYROBYTE |