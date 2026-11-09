# Backend CI partitions

This package belongs only to `.github/workflows/backend.yml`; application code does
not import it. No new Python dependency, application behavior or migration is involved.

`python -m ci.runner <partition>` collects the complete ordered pytest inventory,
then executes one disjoint selection serially. The single closed registry
`contract.MODULE_PARTITIONS` declares these whole-module cohorts:

- `migrations-foundation`: inventory105.
- `migrations-field`: geography.
- `migrations-material`: transfer106.
- `migrations-void-reason`: void-reason.
- `migrations-review`: review113.
- `migrations-lab`: lab114.
- `migrations-community`: community127.
- `migrations-supplies`: courier-supplies107.
- `migrations-session-audit`: session-audit181.
- `regular-integration`: complete B10 supplies and B04 private-upload test modules.

`regular` retains exactly the complement of ALL explicit module cohorts. The
derived `MIGRATION_MODULES` compatibility view feeds the existing exhaustive owner
detector; the explicitly ordinary `regular-integration` cohort is excluded from that
derived migration-only subset. No second module registry exists. Every migration
cohort contains exactly one whole module; the ordinary cohort retains both whole
modules. No module can belong to two cohorts. Each selection retains its original collected
order. Upgrade, raw-SQL, protected reverse and restoration assertions stay intact.
A direct MigrationExecutor owner outside the registry fails collection. No `-k`,
`-m`, external `PYTEST_ADDOPTS`,
xdist, skipped/xfail success or automatic retry is accepted. Adding a new owner
requires an explicit manifest review, not copying or weakening its tests.

One existing `test_device_admin.py` case creates a random UUID string at import.
The CI-only public `pytest_make_parametrize_id` hook labels syntactically valid
UUID-string `user_id` parameters `unknown-user-uuid`; all other IDs use pytest's
default behavior. The original random VALUE, fixture and 404 assertion stay exact.
This deliberate canonical node-ID rename is recorded in the session receipt;
pytest's actual emitted unique IDs and full ordered equality remain authoritative.

The runner binds evidence to the current repository/run/attempt/checkout/source,
workflow/configuration/lock hashes and locked tool versions. It refuses a dirty
tracked checkout. Pytest reports are buffered and include every setup/call/teardown
outcome and duration. Only a successful real PostgreSQL 18 session can finish its
session receipt. The parent records and fsyncs the actual pytest process exit before
reading any receipt or coverage file. Each invocation needs a fresh output directory;
incomplete evidence cannot become a successful fragment.

Shard coverage is **data only** (`--cov-report= --cov-fail-under=0`), never a passing
whole-backend percentage. The existing coverage source/omit configuration remains
unchanged except adding the Lab and Community domains: 17 configured apps,
migrations/WSGI/ASGI omitted, and the historical
absence of `shifts`. This is configured statement coverage, not all installed apps
or the monorepo. No percentage or exclusion is relaxed in the final gate.

The original `checks` job first requires all eleven matrix results to succeed. It runs
the existing Ruff lint/format, mypy and migration drift checks once, downloads the
eleven exact current artifacts and runs `python -m ci.aggregate`. The aggregate rejects
missing/duplicate/foreign/stale/incomplete fragments before combining, even when one
fragment could exceed 85% alone. It verifies ordered inventories, exact partition
membership, successful unique phases, PostgreSQL provenance and coverage digests,
readability, nonempty executed lines, statement mode and allowed source paths.
Every consumed input and the exact executed-line union are checked. Unexpected
artifact directories fail rather than silently remaining unconsumed. Only that union is
reported, with the existing **85%** threshold. Combine/report child exits are also
durable before parsing; warned/skipped combine inputs fail the gate.

Artifacts contain only `manifest.json`, `session.json`, `exit.json` and non-hidden
`coverage.data` for a shard, or the bounded combined result. Their exact names include
repository ID, run, attempt, checkout SHA and shard, with three-day retention. Hidden
path support is enabled only for these explicitly selected CI paths. A partial
failed-jobs rerun cannot reuse artifacts from a previous attempt: all eleven fragments must
be freshly produced for the same attempt. No repository permission or required-check
setting change is needed.

The old `PostgreSQL (migrations)` check remains as an honest compatibility rollup.
It requires the complete matrix to succeed, so failed/cancelled/skipped partitions
cannot pass it. It executes no tests and emits no fragment or passing-test count.
`PostgreSQL (regular)` and the final `checks` contexts also remain. No branch
protection or repository setting is changed.

All eleven test jobs and final `checks` keep their 15-minute timeout and standard runner.
The eleven PostgreSQL test services and final drift service duplicate setup work and can
increase runner-minutes/storage. Session-audit181 adds one complete upgrade-owner
cohort to the canonical ten-partition workflow, including its own setup/service;
tests still execute exactly once. The target is at least three minutes' headroom per
job, to be measured in actual changed-head CI. Historic adjacent log intervals are
not individual test/SQL timings and no host-resource cause or speedup is certified.

Tests: `tests/test_ci_gate.py` owns grouped evidence/partition/coverage/exit regressions
at the lowest layer, using synthetic source/data and short non-DB child processes.
The actual workflow is the real PostgreSQL wiring proof; do not replace it with these
helper tests or run a second full suite just to check partition arithmetic.

Verified interfaces: [pytest collection hooks](https://docs.pytest.org/en/stable/reference/reference.html#pytest.hookspec.pytest_collection_modifyitems),
[pytest-cov configuration](https://pytest-cov.readthedocs.io/en/latest/config.html),
[coverage 7.17.1 CLI](https://github.com/coveragepy/coveragepy/blob/7.17.1/coverage/cmdline.py),
[coverage 7.17.1 public data](https://github.com/coveragepy/coveragepy/blob/7.17.1/coverage/sqldata.py),
[artifact upload v7.0.2](https://github.com/actions/upload-artifact/tree/cf430e030ddbb5b0abf93d22962f4752f3646cd9),
[artifact download v8.0.1](https://github.com/actions/download-artifact/tree/3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c).

## Eighth whole migration owner (#107)

tests/test_inventory_allocations_migrations_107.py is classified as a COMPLETE
MigrationExecutor owner, alongside the seven canonical modules unchanged. It upgrades
real old custody/Lab/source rows, checks append-only/tenant/custodian/source guards,
empty reverse and populated refusal/restoration. Exhaustive disjoint inventory,
exact setup/call/teardown union, combined85% threshold and900s job budgets remain.
Its two collected nodes remain together in `migrations-supplies`. The first real
#107 run exposed a900s field-cohort timeout and only34s material headroom; the
complete migration modules therefore each receive their own explicit cohort,
including the subsequently canonical Community owner and the Supply owner.
This retains every owner and assertion, adds service/setup/runner-minutes, and does
not predict a speedup. Collection/offline graph checks do not execute SQL. Fresh
changed-head CI must measure every cohort against the three-minute headroom target.
No timeout/classifier cut or local non-PostgreSQL substitute qualifies it.

## Ordinary integration cohort (#314)

Run 42404126772/attempt 1 at source `518aedfb7d1388709431b4f3bc09c8c19a013e9a`
passed 2,221 regular cases in 735.78s pytest / 764s job wall: 136s margin to 900,
44s below the 180s target. The existing regular artifact reports 27 B10 nodes with
57.008s summed setup/call/teardown and 35 B04 nodes with 38.321s, together 62 nodes
and 95.329s observed phases. The 101.48s initial setup belongs to the original
first selected case; it is not attributed to SQL/host/cache or removed from the
remaining regular selection. These observations justify one explicit ordinary
cohort, not product/test rewrites or a guaranteed wall-time reduction.

Both modules keep every original case, assertion and collected order. The other
regular modules remain in the residual `regular` cohort; all nine complete
MigrationExecutor modules remain independently classified by their real AST owner.
The unchanged final gate requires all eleven current fragments, including the ordinary
cohort. Its additional standard service/setup/runner-minutes are explicit; actual
final-head CI must measure every wall time/margin and the unchanged coverage union.
No paid runner, retry, skip, timeout or coverage exception is introduced.
