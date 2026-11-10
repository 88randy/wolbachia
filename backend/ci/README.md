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
- `migrations-people`: training/evaluation101.
- `regular-integration`: complete B10 supplies, B04 private uploads and all six #116
  permit/release test modules.
- `regular-lab`: all eight ordinary Lab test modules (API, concurrency, counts,
  history, policy, reception and both recount modules).

`regular` retains exactly the complement of ALL explicit module cohorts. The
derived `MIGRATION_MODULES` compatibility view feeds the existing exhaustive owner
detector; the explicitly ordinary `regular-integration` and `regular-lab` cohorts
are excluded from that derived migration-only subset. No second module registry
exists. Every migration cohort contains exactly one whole module; each ordinary
cohort retains its eight whole modules. No module can belong to two cohorts. Each selection retains its original collected
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
unchanged except adding the Lab, Community, People, Release, Privacy and Notification domains: 21 configured apps,
migrations/WSGI/ASGI omitted, and the historical
absence of `shifts`. This is configured statement coverage, not all installed apps
or the monorepo. No percentage or exclusion is relaxed in the final gate.

The original `checks` job first requires all thirteen matrix results to succeed. It runs
the existing Ruff lint/format, mypy and migration drift checks once, downloads the
thirteen exact current artifacts and runs `python -m ci.aggregate`. The aggregate rejects
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
failed-jobs rerun cannot reuse artifacts from a previous attempt: all thirteen fragments must
be freshly produced for the same attempt. No repository permission or required-check
setting change is needed.

The old `PostgreSQL (migrations)` check remains as an honest compatibility rollup.
It requires the complete matrix to succeed, so failed/cancelled/skipped partitions
cannot pass it. It executes no tests and emits no fragment or passing-test count.
`PostgreSQL (regular)` and the final `checks` contexts also remain. No branch
protection or repository setting is changed.

Eleven test jobs and final `checks` keep their 15-minute timeout and standard runner.
Only `migrations-field` and `migrations-review` temporarily allow 25 minutes (#331,
decision 172): each already owns exactly one complete module. The thirteen
PostgreSQL services and final drift service duplicate setup work and can increase
runner-minutes/storage; tests still execute exactly once. The operational target
remains at least three minutes' measured headroom per job. The temporary exception
unblocks merges; it does not certify that the original 900-second target was met.
Historic adjacent log intervals are
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

## Merge-unblocking headroom (#331)

The orchestrator explicitly prioritizes unblocking PRs #341/#344 while preserving
every test/assertion, whole migration-owner modules, disjoint exactly-once ordered
inventories and the combined 85% gate. This decision supersedes the issue's original
blanket 900-second restriction only for an already singleton owner that times out.

In [run 42757560383](https://github.com/88randy/wolbachia/actions/runs/42757560383),
attempt 2, `regular` took 736s wall (164s margin to 900s). Its retained session
records 45 ordinary Lab cases with 117.893s summed setup/call/teardown. Those eight
complete modules now form `regular-lab`; all other ordinary modules remain in their
original cohort or the residual complement. The first regular case's 117.475s
setup is retained startup work, not a promised saving. One additional standard
runner/service/setup increases compute use.

The singleton [field owner](https://github.com/88randy/wolbachia/actions/runs/42757560383/job/129644429392)
was cancelled at 917s wall (890s runner step). The singleton
[review owner](https://github.com/88randy/wolbachia/actions/runs/42757560383/job/129644429310)
was cancelled at 906s wall (881s runner step), after pytest reported one passed case
in 874.48s: setup 152.78s, call 711.33s and teardown 1.39s. Finalization still needs
time to validate/seal the existing fragment. Splitting either module would violate
owner boundaries, so only these two jobs receive the authorized temporary 25-minute
limit. Restore 15 minutes when whole-owner execution plus finalization fits with
measured headroom; no SQL/host cause or future speedup is inferred.

The workflow matrix and downloads require thirteen fresh same-attempt fragments.
The existing runner choices and aggregate derive from the same registry; migration
AST detection, phase/provenance validation, coverage inputs/union and 85% threshold
remain mandatory. No tests, assertions, dependencies, retries, paid runners or
repository settings change. One complete measured PR CI run qualifies the change;
report every job's wall time and margin, including any missed headroom target.
The original 15-minute capacity target remains unqualified for the two exceptions.
Matrix include/timeout syntax follows the
[GitHub Actions reference](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstrategymatrixinclude).

The sections below describe historical configurations and measurements; their
job counts and blanket 900-second statements predate this #331 exception.

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
regular modules remain in the residual `regular` cohort; all ten complete
MigrationExecutor modules remain independently classified by their real AST owner.
The unchanged final gate requires all twelve current fragments, including the ordinary
cohort. Its additional standard service/setup/runner-minutes are explicit; actual
final-head CI must measure every wall time/margin and the unchanged coverage union.
No paid runner, retry, skip, timeout or coverage exception is introduced.

## Whole People migration owner (#101)

The complete tests/test_people_migrations_101.py module owns the real legacy
upgrade, immutable private certification/command/evaluation/notice/assessment
chains, raw constraints and protected populated reverse. Register it once as
migrations-people; retain every existing whole module and the ordinary B10/B04
cohort. Ten migration cohorts plus regular and regular-integration require twelve
fresh same-attempt fragments. The configured statement denominator adds the real
People app (18 sources) without changing old source paths, omissions or the 85%
threshold. Exact inventories/phases/provenance/coverage union, 900-second budgets
and the measured 180-second headroom target remain. One additional standard
runner/service/setup increases runner-minutes; no paid runner, test cut, retry,
timeout growth or repository-setting change is introduced.

The first full #101 qualification exposed a 900-second review-owner timeout
(run 42716557497). Its single complete test keeps the real legacy rollback,
upgrade, raw guards and rejected populated reverse. It now reuses Django's
returned ProjectState and wraps only the expected failing reverse in a PostgreSQL
transaction, verifying that its applied-migration recorder is unchanged. This
avoids rebuilding partially unapplied dependencies after the rejection; no
case, assertion, whole-module boundary, durability setting or budget is removed.

## Release integration capacity (#116)

Run 42739240917's residual `regular` job 129575926133 hit the existing 15-minute
limit (15m17s reported job duration). Pytest began at 01:56:49 UTC and was cancelled
at 02:11:28. It reached the release safety module at 02:10:30, finished release
concurrency at 02:10:41 and reached seed concurrency at 02:11:14, with 75% of the
inventory processed. Those log intervals establish capacity exhaustion; they do
not identify individual test durations or predict a saved wall time. The existing
`regular-integration` cohort passed in 4m4s in the prior full run.

Move the six complete new modules into the existing `regular-integration` cohort:
`test_permit_api_116.py`, `test_release_guards_116.py`, `test_release_stock_116.py`,
`test_release_uuid_116.py`, `test_releases_b_20.py` and
`test_releases_concurrency_116.py`. The existing B10/B04 modules remain there. The
residual cohort is still the exact ordered complement, and all ten complete
migration owners retain their own cohorts. The independent gate fixture requires
all eight ordinary modules and rejects a missing release owner. No matrix job,
service, timeout, assertion, retry or skip changes; twelve fresh same-attempt
fragments and the combined 85% coverage threshold remain mandatory. Measure actual
changed-head job times and the existing 180-second headroom target in CI.

Run 42745079885 passed the executed tests, but `migrations-material` job129595116293
was cancelled at15m9s before sealing its artifact. Its complete transfer migration
module reported1 passed in874.12s (setup163.38s, call699.80s); the run remains
unqualified without that fresh sealed fragment. Residual `regular` passed in12m21s,
leaving159s,21s below the180s target; `regular-integration` passed in7m43s.
The transfer106 owner now reuses MigrationExecutor's returned ProjectState and
wraps only the expected failing populated reverse in an atomic transaction,
asserting that the applied-migration recorder is unchanged. Legacy upgrade, raw
guards, empty reverse, populated refusal and final migration-plan restoration
remain intact, following the existing review113 pattern. Whole-module ownership,
all assertions, twelve jobs,900s budgets and the85% gate are unchanged. Real
PostgreSQL revalidation and fresh CI qualification are pending; no wall-time
improvement is predicted.

## Personnel integration capacity and measurement (#100)

Run 42761104367 cancelled residual `regular` at the unchanged 15-minute limit after
94% of its selection. Run 42756081997's successful regular session recorded 2307
nodes and 702.92s of setup/call/teardown phases; its integration session recorded 111
nodes and 391.58s. These are measured phase totals, not a promise about later wall
times. The first database-setup owner of each partition stays in place.

The initial #100 qualification moved 203 existing cases across seven complete modules into the existing
ordinary integration cohort: `test_lab_recounts_b_19.py`,
`test_lab_concurrency_114.py`, `test_ovitraps_lifecycle_b_15.py`,
`test_shift_concurrency.py`, `test_seed_defaults.py`, `test_sync_locks.py` and
`test_reviews_b_17.py`. Their prior phase total was 187.38s. Run 42767499787 passed
all twelve partitions and the combined gate: regular 8:12, integration 9:21,
field 6:55 and review 9:14. Those observations qualify that configuration only.

Normal integration of #348 preserves its thirteen-shard registry and temporary
field/review limits, taking its cohort layout verbatim. The two Lab modules now
belong solely to `regular-lab`; the other five return to residual `regular`. The residual remains
the exact ordered complement. All thirteen fresh fragments, migration-owner
boundaries, cases, assertions and the 85% combined gate are retained.

CI selects Coverage 7.17.1's documented `sysmon` core on Python 3.13 for the existing
statement-only/threaded configuration. Sources, omissions and aggregation remain
unchanged. Pytest treats `CoverageWarning` as an error, including startup core
fallback, so unsupported measurement cannot silently pass. Harness qualification
compares nonempty threaded executed-line sets against `ctrace` and verifies
startup and later warning failures with durable child-exit receipts. Fresh full
CI is still required to qualify wall time and the complete coverage union.

References: [Coverage core configuration](https://coverage.readthedocs.io/en/7.17.1/config.html#run-core),
[pytest warning filters](https://docs.pytest.org/en/stable/how-to/capture-warnings.html).
