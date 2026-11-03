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
| `MessageKey` | Union of every key, derived from `src/locales/es-MX.ts` |
| `Locale` | `'es-MX' \| 'en'` |
| `defaultLocale` | `'es-MX'` |

`es-MX` is the source of the key list. `en` is typed `Record<MessageKey, string>`, so a missing or extra key fails `tsc` (checked), and a test also compares both key sets.

## Key convention: `area.screen.element`

Exactly three segments, lowerCamelCase, joined by dots (`^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*){2}$`, enforced by a test).

- `area`: feature or shared area (`common`, `errors`, `sync`, later `shift`, `trap`, ...).
- `screen`: screen or group inside the area (`actions`, `api`, `inbox`).
- `element`: the piece of text (`save`, `notFound`, `acceptedTitle`).

Keys are flat strings, so no key is the prefix of another. Add new keys to **both** files in the same change.

## Placeholders

Messages use simple `{name}` placeholders (letters and digits, no spaces), for example `Espera {seconds} segundos`. There is no ICU syntax: no plurals, selects or formats. Both locales must use the same placeholder names for a key (tested). The runtime library that fills them and handles plurals is chosen later (#6 mobile, #27 web); if it needs ICU, the catalogs will be migrated then.

## Writing messages

Plain, blameless, with a next step. Mexican Spanish (tuteo, no regional slang) and natural English. Say what happened and what the person can do, without codes or blame ("No pudimos..." instead of "Error del usuario").

## Contents today

Only shared, cross-screen text. Screen copy lands with each screen.

- `common.actions.*`: save, cancel, retry, close, void. `common.fields.*`: void reason label, "Other (specify)" label.
- `errors.api.*`: generic, network, validation, notFound, permissionDenied, blocked (`{role}`), sessionRevoked, rateLimited (`{seconds}`), serverError.
- `sync.inbox.*`: title and hint for each sync result status (accepted, rejected, inReview) in the phone inbox.

Mapping from API `code` to `errors.api.*` key: the machine codes are not yet fixed in `docs/api-conventions.md`. Assumption: they will be the snake_case form of the key element (`not_found` -> `errors.api.notFound`, `permission_denied` -> `errors.api.permissionDenied`). Unknown codes fall back to `errors.api.generic`. Confirm when the API issues define the codes.

## Develop

```
npm install
npm run typecheck      # tsc --noEmit
npm test               # node:test
```
