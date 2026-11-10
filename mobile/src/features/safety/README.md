# M16 speed lock and global states (#145)

P32 covers the app (kept mounted, so open forms and drafts survive) when a fresh usable fix reaches
`speed_lock_kmh`. It lifts only after fresh usable fixes stay below `unlock_speed_kmh` for
`speed_unlock_seconds`; a missing, stale, inaccurate or speedless fix resets that interval and never
counts as stopped. Rules come from the downloaded snapshot (`auth_rules_snapshot`), clamped to the
documented ranges, with lock always above unlock. The lock runs only with an open shift and reuses
the day location stream (local fixes, independent of upload pings).

While locked only the existing work-contact dialer is offered (no data entry, no capture route).
Its capability fallback text stays visible.

`GlobalState` = cause + blocking level + next action (`global-state.ts`, one ordered rule table).
Banners flow above the screen, never over it; level is text, not color alone. Sources today: sync
connectivity, auth session and clock skew, location, free disk. Battery and update sources are
inputs held at "ok/none" until the native adapters of M-17 exist.

[ASSUMPTION] fix freshness 60 s and free-space bounds (20 MB full, 200 MB low) are documented
defaults in code, to be versioned with the client. Drafts, outbox and attachments stay in the
transactional store: this module adds no queue.
