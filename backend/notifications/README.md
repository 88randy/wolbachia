# Notifications (W5, #150)

The notification inbox is organization- and recipient-membership-scoped. Content
is immutable. Reading appends one `NotificationRead`; preference changes append
`PreferenceVersion` rows under a recipient membership lock. Database triggers
reject updates/deletes and cross-organization ownership. There is no public create
or delete endpoint.

`services.publish_notification(NotificationDraft(...))` is an internal producer seam.
It accepts only registered message codes and typed UUID/integer parameters. It does
not publish existing incident/training intents or send email. B-07/#49 continues to
own source wiring, deduplication and delivery. Critical in-app/email policy cannot
be disabled; a required email preference does not claim delivery.

Reads require `notification.read`; preference writes require
`notification_preference.update`. Both need a nonempty explicit paired scope.
Rows always belong to the current user and active organization. Safe references use
the real incident, motorcycle and review selectors; revoked, foreign and unknown
targets redact identity, code and void state. Only an authorized target's matching
identifier may appear in params. Unrelated source identifiers never leave the API.

Cursor pages order unread first, then creation time and UUID descending. A signed
snapshot fixes the unread rank at cutoff, so reading never skips a later page.
Bindings include user, membership, organization, effective grants and filters.
New arrivals appear on the next first-page poll. See
[`docs/notifications.md`](../../docs/notifications.md) for the contract.

Tests: `uv run pytest tests/test_notifications.py tests/test_seed_defaults.py` using
the issue's own PostgreSQL instance. No host port 5432.
