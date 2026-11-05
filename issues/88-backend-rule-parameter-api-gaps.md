TITLE: [Backend] Rule parameter versions: author names, include_voided and the revisit-frequency parameter (found in #36)
LABELS: backend,spec

## 1. Context
Found while building W62 (#36, web). The web shows the history of a rule parameter and the journey R9 (revisit frequency 7 → 6 days) with what the API returns today, and three things are missing or differ from the conventions:

- `created_by` and `voided_by` of a version are user UUIDs only. The history must show the author; the web can name only the signed-in user and writes "User 9d3c8a77" for anybody else. (`Device` already sends `last_user_username`.)
- `GET /rule-parameters/{key}/versions/` always returns voided versions and has no `include_voided` parameter, while `docs/api-conventions.md` says lists exclude voided records unless `?include_voided=true`. The web hides the voided versions of the page in view, and its total only counts that page.
- The seed has no revisit-frequency parameter and the `unit` enum has no `day`, so journey R9 (design P-R9) cannot run against the real API. The web e2e uses a fixture. #36 lists "Initial parameter list and units" as [PENDING].

## 2. Goal
The W62 history names every author, filters voided versions on the server, and the real API can run journey R9.

## 3. Scope / Out of scope
**Scope:**
- add the author's username to the version answer;
- `include_voided` on the versions list;
- the revisit-frequency parameter and the `day` unit (after the client confirms name, unit, limits and default).

**Out of scope:** a users endpoint for the web, regional overrides (decision 42), the web changes that follow (a small web PR once this merges: remove `useAuthorLabel`'s id fallback and `hideVoidedVersions`).

## 4. Data model
- `Unit` gets `day` (migration of choices only).
- One more `ParameterSeed` (`revisit_frequency_days`, integer, `day`). [PENDING client] value (7 in the design), minimum and maximum.

## 5. Contract (API / interfaces)
- `RuleParameterVersion`: `created_by_username` and `voided_by_username` (string, null when there is no author), next to the ids (not a breaking change).
- `GET /rule-parameters/{key}/versions/?include_voided=true`: without it, voided versions are left out. This changes today's answer, which includes them: mark the PR "API breaking change" and decide with the web (decision 42 says the history includes them).
- `Unit` enum adds `day`; the generated client and `docs/api-conventions.md` change in the same PR.

## 6. Behavior
- A version written by the seed has no author: both usernames are null.
- The filter is applied before paging, so counts and pages are right.

## 7. Edge cases & errors
- A user who left the organization: the username is still returned (history is never rewritten).
- `include_voided` with a value that is not `true` or `false`: `400 validation_error`, `fields.include_voided`.

## 8. Acceptance criteria
- [ ] The versions answer carries `created_by_username` and `voided_by_username`.
- [ ] `include_voided` works and is documented in OpenAPI.
- [ ] The revisit-frequency parameter is seeded (value and limits confirmed by the client) with unit `day`.
- [ ] `docs/api-conventions.md` and `packages/api-client` are updated in the same PR.

## Notes
- Opened from the W62 PR. Web follow-up: switch `web/src/rules/use-author-label.ts` to the username, drop `web/src/rules/hide-voided-versions.ts`, add the unit label for `day` and the parameter name.

- Decisions taken (lead, from docs/pending-decisions-proposal.md OP02/OP03): key `revisit_interval_days` (not `revisit_frequency_days`), integer, unit `day`, default 7, range 1 to 28. `include_voided` accepts only `true` or `false`. The web follow-up is done in the same PR.
