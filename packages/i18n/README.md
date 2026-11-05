# @wolbachia/i18n

Shared message catalogs (`es-MX` default, `en`) for `mobile/` and `web/`. Apps never hard-code user-facing text: they look it up by key. Issue: #17.

Rule from `docs/api-conventions.md`: the API never returns user-facing text. It returns `code` + `params` and the client translates with this package. Exception: per-organization catalog item labels (`label_es`, `label_en`) are data.

## API

```ts
import { defaultLocale, messages } from '@wolbachia/i18n';
import type { Locale, MessageKey } from '@wolbachia/i18n';

const text = messages['es-MX']['common.actions.save']; // "Guardar"
```

| Export | What |
|---|---|
| `messages` | `Record<Locale, Record<MessageKey, string>>` |
| `MessageKey` | Union of every key, derived from `src/locales/es-MX/index.ts` |
| `Locale` | `'es-MX' \| 'en'` |
| `defaultLocale` | `'es-MX'` |

`es-MX` is the source of the key list. `en` is typed `Record<MessageKey, string>`, so a missing or extra key fails `tsc` (checked), and a test also compares both key sets.

## Where new keys go (one file per area)

Catalogs are split so parallel PRs touch different files (#67):

```
src/locales/
  area.ts            AreaCatalog<"area"> type
  es-MX/<area>.ts    es-MX messages of one area (source of that area's keys)
  es-MX/index.ts     composes every area; derives MessageKey
  en/<area>.ts       en messages of the same area (typed from the es-MX file)
  en/index.ts        composes every area
```

Areas today: `common`, `errors`, `shell`, `states`, `auth`, `sync`, `table`, `phones`, `rules`, `voiding`, `mobile`.

- A new key goes in the file named after its first segment, in **both** languages: `auth.login.title` -> `es-MX/auth.ts` and `en/auth.ts`.
- A new area (first segment) means: create `es-MX/<area>.ts` and `en/<area>.ts` (copy a small pair such as `common.ts`), then add one line to each `index.ts`. `test/areas.test.ts` reads the directories, so it needs no edit.
- Do not create a second file for an existing area and do not put keys of one area in another file. `AreaCatalog<"area">` (`satisfies` in each es-MX file) makes `tsc` fail when a key does not start with its file's area, so a key cannot be defined in two files. `test/areas.test.ts` also checks that no key is overwritten when composing.
- The split was verified equal to the previous catalogs in PR #70.

## Key convention: `area.screen.element`

Exactly three segments, lowerCamelCase, joined by dots (`^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*){2}$`, enforced by a test).

- `area`: feature or shared area (`common`, `errors`, `sync`, later `shift`, `trap`, ...).
- `screen`: screen or group inside the area (`actions`, `api`, `inbox`).
- `element`: the piece of text (`save`, `notFound`, `acceptedTitle`).

Keys are flat strings, so no key is the prefix of another. Add new keys to **both** files in the same change.

## Placeholders

Messages use simple `{name}` placeholders (letters and digits, no spaces), for example `Espera {seconds} segundos`. There is no ICU syntax: no plurals, selects or formats. Both locales must use the same placeholder names for a key (tested). The runtime library that fills them and handles plurals is chosen later (#6 mobile, #27 web); if it needs ICU, the catalogs will be migrated then.

A message may only take a placeholder if it is listed in `ALLOWED_PLACEHOLDERS` in `test/messages.test.ts` (a test fails otherwise): adding one is a deliberate act, and its wording must not need plural or gender agreement.

`{minutes}` in `auth.lockout.message` is a whole number taken from the `Retry-After` header; the unit is the abbreviation "min" in both languages, so no plural agreement is needed. Without a usable header the client shows `auth.lockout.noWait`, which has no number.

`{role}` in `errors.api.blocked` is the **already translated role label** (for example "Supervisor"), never a code. The sentence is built so the label stands alone after a colon: no articles, gender or plural agreement depends on it. Avoid interpolating numbers or nouns into sentences that need agreement; prefer wording without the number (as `errors.api.rateLimited` does) or separate singular and plural keys.

## Writing messages

Plain, blameless, with a next step. Mexican Spanish (tuteo, no regional slang) and natural English. Say what happened and what the person can do, without codes or blame ("No pudimos..." instead of "Error del usuario").

## Contents today

Only shared, cross-screen text. Screen copy lands with each screen.

- `common.actions.*`: save, cancel, retry, close, void. `common.fields.*`: void reason label, "Other (specify)" label.
- `errors.api.*`: generic, network, validation, notFound, permissionDenied, blocked (`{role}`), sessionRevoked, rateLimited, serverError.
- `shell.*` (web): brand, skip link, sidebar, top bar, language switch and one `shell.nav.<area>` entry per area of `web/README.md`; `shell.group.*` are the sidebar group headings.
- `states.*` (web): placeholder, loading, not found, error, configuration error and offline banner. `common.actions.goHome` serves the not-found and error screens.
- `auth.*` (web, #28): sign-in (`auth.login.*`), lockout (`auth.lockout.*`), password reset request and confirm (`auth.forgot.*`, `auth.reset.*`, including the four password-validator codes), organization choice (`auth.organization.*`) and the re-authentication dialog (`auth.session.*`). `shell.userMenu.*` is the user menu of the top bar; `states.noPermission.*` the "no permission" state.
- `table.*` (web, #29): the shared `DataTable` and `FilterBar`: sort announcements (`{column}` is the translated header), result range and count, pager, filters and chips, the notice for ignored URL parameters, empty states, row selection, voided rows and export. No plurals: counts are written as "Showing {from} to {to} of {total}" and "Selected: {count}".
- `phones.*` (web, #29): the phones list of W67 (title, column headers, status, filter label, empty cells).
- `rules.*` (web, #36): the W62 screens: list columns and statuses, the names of the seeded parameters (`rules.param.*`, one per API key, camelCase) and units (`rules.unit.*`, written out so no number needs plural agreement), the summary, the new-version form, its field errors (`rules.error.*`; `{min}` and `{max}` are the formatted limits) and the history. Placeholders: `{date}` (formatted), `{min}`, `{max}` and `{id}` (short user reference).
- `voiding.*` (web, #32): the void dialog (`voiding.dialog.*`, placeholders `{record}`, `{count}`, `{min}`, `{max}`), its errors (`voiding.error.*`, `{min}`). The area is named `voiding` because `void` is a reserved word in TypeScript imports.
- `sync.inbox.*`: title and hint for each sync result status (accepted, rejected, inReview) in the phone inbox.
- `sync.result.*`: one message per per-event result code of `/field/sync/` (key = camelCase of the code, e.g. `clock_skew` -> `sync.result.clockSkew`); `sync.batch.*`: the batch-level errors (`device_mismatch`, `payload_too_large`, `invalid_cursor`). The code table is `docs/sync.md`; a backend test fails when a code has no key in both languages. Messages carry no placeholders: the `params` of a result are for logs and support.

Mapping from API `code` to `errors.api.*` key: the machine codes are not yet fixed in `docs/api-conventions.md`. Assumption: they will be the snake_case form of the key element (`not_found` -> `errors.api.notFound`, `permission_denied` -> `errors.api.permissionDenied`). Unknown codes fall back to `errors.api.generic`. Confirm when the API issues define the codes.

## Develop

```
npm install
npm run typecheck      # tsc --noEmit
npm test               # node:test
```
