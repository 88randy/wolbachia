# Operations (W30/W31/W33, #160)

`/operations` links only to granted review and relocation workspaces. Their
lists use server filtering, ordering and paging. `/quadrants/<code>/closure`
resolves the exact scoped human quadrant code before reading readiness by UUID.

See [reviews](reviews/README.md), [relocations](relocations/README.md) and
[closure](closure/README.md) for commands, scope/session isolation and explicit
contract/design limits. All writes are deliberate guarded attempts, never
automatically replayed after reauthentication. No backend contract is changed.
