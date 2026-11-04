TITLE: [Backend][Web] Move password-reset uid/token from URL path to fragment
LABELS: backend,web

## 1. Context
#28 (web sign-in) serves the password-reset link as `/reset-password/<uid>/<token>`. The path reaches the web server access log on the first request, and until the page rewrites the URL it can leak through `Referer`. #28 mitigates this: the page keeps the values in memory and calls `history.replaceState`, nginx turns off `access_log` for that location, and `Referrer-Policy` is `no-referrer`. Even so, any TLS proxy or log aggregator in front of nginx still sees the token, which stays valid for up to `PASSWORD_RESET_TIMEOUT` (3600 s).

## 2. Goal
Reset tokens never travel to any server as part of a URL path or query.

## 3. Scope / Out of scope
**In:** the backend email link format (`WEB_BASE_URL` + `/reset-password#uid=<uid>&token=<token>`), the web route reading the fragment and clearing it, tests on both sides, and an update to `docs/api-conventions.md` if the link format is documented there.
**Out:** confirm endpoint contract (unchanged), token lifetime ([PENDING] in #4).

## 4. Data model
N/A.

## 5. Contract (API / interfaces)
`POST /api/v1/auth/password-reset/confirm/` is unchanged. Only the link in the email changes.

## 6. Behavior
- The backend builds the link with the values in the fragment.
- The web reads the fragment, keeps the values in memory, and calls `replaceState` to `/reset-password` before any other request.

## 7. Edge cases & errors
- Old links (path format) issued before deploy: keep the path route for one token lifetime, then remove it (note the date in the PR).
- Fragment missing or malformed: show the existing "invalid link" state.

## 8. Acceptance criteria
- [ ] The email link contains no uid or token in its path or query (backend test).
- [ ] The web reads the fragment and the URL bar shows `/reset-password` after load (unit test + e2e).
- [ ] The access log of the nginx e2e run has no token.

## Notes
Origin: security review of #28 (M2), 2026-11-04.

