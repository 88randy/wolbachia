# Biological lot conditions (W18, #154)

`/inventory/lots/<code>/conditions` resolves the human lot code under current
`lot.read`, organization, paired scope and optional explicit `custody_location`.
The private inventory read fence and central org-scoped query helper discard stale
results on context changes. Capture drafts are in component memory and survive
same-identity reauthentication; changed user, organization, authorization, lot or
location retires them. Unknown and inaccessible lot codes share the same state.

`GET /lots/{id}/condition-status/` is authoritative for the evaluated local date,
timezone, exact retained protocol, distinct complete windows and global safety.
The nested current supply protocol never substitutes for the lot's exact pin.
Only currently readable blocking incidents are linked by their actual human code;
redaction does not clear the global hold. A later normal reading cannot release
an unresolved incident. No automatic incident close or stock action is added.

History uses the existing paged `/lots/{id}/conditions/` with server date/evaluation
filters, ordering and URL paging. The chart shows that same page chronologically,
with each reading's retained minimum and maximum; missing ranges are explicit in
the table and excluded from the chart. Temperature and humidity have separate
units. Historical limit lines replace the design's single constant filled band,
so changed protocol ranges are represented truthfully with existing shared charts.
No seven-day completeness is inferred from a page.

Chart order compares actual observation instants, then receipt instants and stable
ids. Equivalent instants with different UTC offsets never use textual ISO ordering.

Capture requires `condition.create`, connectivity and a fresh accepted status.
The status frame's `can_create_condition` also checks that action's actual location
pair; an action code granted at another site never reveals capture controls here.
An explicit ISO instant with UTC offset is evaluated by the backend in the
organization timezone. Coded field errors retain input. Ambiguous results freeze
resubmission for manual history review; no write replays after reauthentication.
Condition readings remain immutable: this contract exposes no void writer.

| Criterion                                                                                | Owning proof          |
| ---------------------------------------------------------------------------------------- | --------------------- |
| Exact retained range, global breach link, distinct server windows                        | `conditions.test.tsx` |
| Coded capture errors and exact aware timestamp payload                                   | `conditions.test.tsx` |
| Missing configuration, forbidden capture, opaque code lookup                             | `conditions.test.tsx` |
| Context change drops a delayed old result                                                | `conditions.test.tsx` |
| Cookie/CSRF/org wiring, keyboard capture/chart, es-MX/en, light/dark, 320px +30% and axe | `e2e/w-12.spec.ts`    |

Backend authorization, retained protocol evaluation and redaction are independently
covered in `backend/tests/test_inventory_condition_status.py`. Browser fixture
tests do not prove PostgreSQL policies or actual incident delivery. The PNG's
location-wide lot table is replaced by this issue's lot-specific route and history;
no sample readings, scientific ranges or notification delivery claims are copied.
