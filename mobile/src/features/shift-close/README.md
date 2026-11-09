# M-14 close shift: P26/P27 (#143)

Drafts, receipt-backed reconciliation and close use the existing SQLite projection/outbox transaction. A local close stops capture/location even if later rejected or observed. Original JSON guards prevent stale writes; evidence references remain retained. Phone storage, server receipt and supervisor decisions are separate.

The real B10 command uses assignment/revision/receipt references, return destination, reason and photo UUIDs. Empty reconciliations and guessed usage are never generated. The source equation uses received custody separately from planned allocation. Assumption: returns go to the actual origin warehouse. Missing reception/usage integration remains visible.

The existing DayStore writer hydrates validated supply projections; source records are copied into the draft. Nested evidence and retry deadlines hold reconciliation and dependent close. No backend API/generated-client change, new dependency, second queue or mutable approved Shift.status is introduced. The existing translation adapter is retained; native i18next is not added.

m-14.test.ts covers AC1 decimal/null equation, source retention, real return ordering and nonblocking low odometer; AC2 file-backed reopen, returned observation and postclose location/capture denial; AC3 original UUID through runSyncPass, interrupted sends, point dispositions, failed/stale writes, admission loss and evidence/retry dependencies. PostgreSQL discrepancy counts, real API/native e2e, photo acquisition, TalkBack, 130% text, themes/locales and both MO01 devices remain unverified under #143. Node SQLite is not native SQLCipher qualification.

Read S12-Cierre PNG/source before editing. The issue supersedes the old sent banner. Confirmation is inline with Cancel and a full-width footer; controls reuse tokens and bilingual catalogs. References: https://reactnative.dev/docs/textinput#keyboardtype and https://github.com/facebook/hermes/blob/main/doc/Features.md .

Workspace installation failed with EPERM creating symlinks. Typecheck, ESLint/Prettier and physical qualification remain integration gates.
