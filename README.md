# Wolbachia

Traceability platform for the *Aedes aegypti* / Wolbachia control program (Mexico).
This monorepo holds the shared backend (Django + DRF), the field app (React Native, Android), the web app (React) and shared packages (`packages/`).

- Design (Claude Design canvas): "Wolbachia · App Repartidor" — Ronda 1.
- Workflow: spec-first. Every change starts as a GitHub Issue (9 sections) and lands through a PR linked to it.
- Specs: GitHub Issues are the source of truth; `issues/` mirrors them by number (see `issues/README.md`).
- Decisions: `docs/decisions.md`. API contract rules: `docs/api-conventions.md`.
