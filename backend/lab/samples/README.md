# Wolbachia samples (#117 / B-21)

This module extends the existing Lab app and canonical Reading, Lot and Release
identities. It never creates a parallel release model or inventory ledger.

`sample.collect` schema1 preserves a client UUID, organization-reserved human code,
the delivered `sample-origin` item, exact verified Wolbachia-capable LabMethodVersion,
one typed `source_ref` (`reading`, `lot` or `release`), GPS and both source clocks.
Reading/release collection belongs to its authentic source author. A lot reference
is scoped provenance, not proof of courier custody. Current paired sample.collect
and field_event.sync authority precedes dependency diversion and replay.

Reception and result commands retain immutable UUID receipts and exact replies.
Replay rechecks the current action and actual source pair before returning a saved
reply. Results require a real reception. Invalid/disputed results have no binary
value; only an explicit valid positive/negative enters analytical inputs. A repeat
must name the latest invalid/disputed attempt; valid history cannot be silently
replaced. No tested denominator means unknown. These are input facts, not an assay
protocol, biological approval or an establishment declaration.

Methods use the existing Lab owner, with explicit `supports_wolbachia`. No method,
procedure, result threshold or verification is seeded. Collection retains historical
method/catalog proof; acceptance also checks current source and method safety.

HTTP commands use the existing Lab transaction: sorted authentic Users, actor
Device/Session/Pair, known FieldEvents, Organization NOWAIT, courier TRY, domain.
Sync/review keep their existing outer lock owner. In-review ingest creates no
Sample, reception or attempt. Source correction uses the existing record.void;
reception/result dependents block it rather than losing history. Reasons require
10 visible characters and at most1000 stored characters for every reason code.

All rows are tenant-scoped and insert-only in ORM and PostgreSQL. Selectors apply
current paired scope before filters/count/page. Optional private evidence uses the
existing FieldEvent upload parent and grants no new download capability.

Owning acceptance tests: `tests/test_lab_samples_b_21.py`. API documentation:
[API conventions](../../../../docs/api-conventions.md) and
[sync](../../../../docs/sync.md).
