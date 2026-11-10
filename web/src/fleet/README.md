# Fleet (W20–W21, #156)

The existing `/fleet/motorcycles` and human-code record routes consume the
canonical #72/#103/#296 contract. No backend, grant, shared session, dependency,
public route or generated API changes belong to this feature.

## Reads and URL ownership

- W20 uses the shared table, controls, chips, sorting, pagination and void detail.
  Only actual server facets (`code`, `center`, `is_blocked`, `include_voided`, `ordering`,
  `page`) are sent. The URL center takes precedence over the shell center. Real
  center references can filter the list without a directory lookup or new grant;
  courier references remain deep-link chips rather than an invented selector.
- W21 first resolves the code in that same scoped list, then reads the returned
  UUID's actual `MotorcycleDetail`. Its identity/code/center must agree. Unknown
  and foreign codes use the same not-found state. Nullable summary metrics are
  never inferred from the visible history page.
- Histories use `service_`, `letter_`, `fuel_` and `incident_` URL prefixes. Each
  applies only its supported server filters, sorting and page size. Services and
  letters support `include_voided`; fuel supports its saved comparison status,
  courier and date range. Fleet incidents use the single façade
  `/api/v1/incidents/?kind=fleet&motorcycle=<uuid>`.
- Tab links preserve other tabs' search state; Back removes history-only keys
  and restores the list address. Removing an unknown tab removes only that key.
  Source links select their real owning tab and say explicitly that the source
  may be off the accepted page. They never scan pages or imply a detail API.
  Every history heading and cell has a usable width inside the horizontal scroller,
  including complete UUIDs, actions and nested proof references. Private container
  sizing reserves room beside the bounded sticky identity instead of collapsing
  all columns to fit the page. The shared table and its scroller are unchanged.
- `use-fleet-scope` adds a private route/actor/org/authorization/center entry epoch
  to the existing org query keys. It checks session revision and cancellation
  before and after reads. No response or placeholder crosses a different entry,
  including A→B→A. The exact route owns query enablement during router transitions.

## Authority and writes

`GET /me/` action codes and explicit scope are coarse UI eligibility hints. They
cannot reconstruct hidden profile bindings or confer authority. Each actual
server read, write and download checks its current full parent scope. Missing
codes hide actions; unverified or voided state blocks them with a visible reason.
No profile slug is hardcoded.

- Service registration uses the real closed service-kind/body contract. Blank
  maintenance intervals remain null. Calendar dates, bounded integers and notes
  are validated locally; the server is final. Inspection registration by itself
  does not clear a fault.
- Clearance captures one actual open fault, the reviewed motorcycle revision,
  normalized reason and verified evidence IDs. A 409 retains the private capture
  and refreshes blockers. Explicit review reads the current record and the same
  incident page before accepting a new revision; it cannot mutate an issued
  command or discover another fault by scanning.
- B04 evidence uses each original JPEG/PNG (≤10 MiB), stable client UUID and
  original-buffer SHA-256, actual authorization/renewal, same authenticated raw
  PUT, and exact-parent finalization. Only the confirmed public verified UUID is
  usable. A lost verification renews the same upload; its pending ID is not proof.
  Grant URL/method/content type/lease are checked, with redirects refused.
- Files, values and immutable command snapshots live only in RAM above the
  replaceable read/dialog subtree. Current accepted target and authority gate
  restoration. Revocation, actor/org loss or an inaccessible target retires them;
  regrant cannot revive them. Every async stage also checks target/intent/session.
  No request is replayed after reauthentication or an unknown outcome. Retry-After
  unlocks only another manual action. Unknown writes require explicit discard
  after checking current history, not an automatic inverse or new POST.
  The retained dialog can explicitly reread the current record without adopting
  its revision or treating that read as proof of the unknown command's outcome.
- Service/letter void uses the existing reason catalog, `VoidDialog` and typed
  nested endpoints. Manual `UnblockDialog` (#186) remains text-only, with its
  existing conflict mapping and guards. It cannot substitute for named-fault
  inspection clearance. The returned server motorcycle and its other blockers
  are retained; the UI never changes `is_blocked` optimistically.

## Truthful histories and accessibility

Responsibility letters and fuel are read-only here. Opaque document/receipt
references have no guessed download URL. Actual clearance audit exposes only its
five returned fields; evidence downloads call current B04 private ACL each time.
Fuel rates are comparable only with the actual full-refill/baseline/nonprovisional
and saved status facts. Unknown/partial data is insufficient; saved thresholds
are advisory and no visible-page efficiency, biological or service default is
calculated. Audit clocks, rules, catalog snapshots and original references remain
separate facts.

The feature composes canonical Cards, DataTable, form fields, Buttons, native
modals, status pills, tokens and localized messages. Native dialogs start on
Cancel, refuse busy Escape/duplicates and restore focus to the current logical
opener even when the table replaces its DOM cell. Its ID contains only an opaque
React owner/entry epoch and the motorcycle/fault UUIDs, never the authorization
signature. Only an absent opener in that still-current owner may fall back to
the record's Refresh control after clearance. Shared widgets and
canonical #186 behavior are unchanged.

## Criterion → owning test

| Behavior                                                                                                                                       | Existing owner                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Scoped list, actual ordering/facets/paging, permission denial                                                                                  | `W20Page.test.tsx`, `centers/center-query.test.ts` |
| Code→UUID detail, independent history pages, voided controls, unknown tab preservation, real provenance and comparable/insufficient data       | `W21Page.test.tsx`                                 |
| Exact service/clearance/void payloads, B04 original bytes and verification, 409 explicit review, remaining blockers, missing grants            | `fleet-actions.test.tsx`                           |
| Deferred center ABA/current bodies, actor/org changes, revocation/regrant, late verification, expired/unknown writes without replay            | `fleet-session.test.tsx`                           |
| Existing create contract                                                                                                                       | `CreateMotorcycleDialog.test.tsx`                  |
| Actual browser wiring, native focus, axe, 320 px and +30% text in the existing four locale/theme cells; one service/B04/clearance wire journey | `e2e/fleet.spec.ts`                                |

Unit fixtures use synthetic attested responses, not backend qualification. Browser
contrast/native focus/reflow, actual PostgreSQL contracts and physical inspection
are separate verification boundaries; none is established by component tests.

Issue #218 connects the server exact-code filter and public ordering keys (code, plate,
created_at, center). All four rendered supported columns expose sort controls; status
remains unsortable. Code is the default order, and explicit filters/sorting/paging remain
URL-owned. No free-text search or derived fleet metrics are fabricated.
