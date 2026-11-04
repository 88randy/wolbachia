TITLE: [Web] Scaffold web app, app shell and CI
LABELS: web,priority:high

## 1. Context
Part of epic #20. `web/` exists in the monorepo but has no app yet. It depends on the choices made in spike #27.

## 2. Goal
A runnable React app in `web/`, dockerized and built in GitHub Actions, with the app shell from the design: dark navy sidebar, top bar with search and notifications slots, and content area.

## 3. Scope / Out of scope
**Scope:**
- project setup with the stack chosen in #27;
- Docker service `web`;
- CI job (install, lint, type-check, test, build);
- shell layout;
- consumption of `packages/tokens` (light and dark) and `packages/i18n`;
- one placeholder route per area.

**Out of scope:** auth (#28); real screens.

## 4. Data model
None.

## 5. Contract (API / interfaces)
- The API base URL comes from an environment variable (name [PENDING]).
- `packages/api-client` is imported as a workspace package.

## 6. Behavior
- The sidebar shows the areas of `docs/web-screens.md`.
- Collapsed mode is 64 px wide.
- The theme follows the user setting (light by default).

## 7. Edge cases & errors
- Missing API URL env var → clear startup error, not a blank page.
- Token package version mismatch → CI fails.

## 8. Acceptance criteria
- [ ] `docker compose up web` serves the shell locally.
- [ ] CI green on PR.
- [ ] No color, radius or font literal in web code; only tokens.
- [ ] Shell passes axe with no violations; full keyboard navigation of the sidebar.
- [ ] Smoke test: `GET /api/v1/me/` through `@wolbachia/api-client` (see #12).

## Notes
- [PENDING] Final commands in `web/README.md` once #27 closes.
- [PENDING] Deploy target (static hosting vs container on the droplet).
