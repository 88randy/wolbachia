# Notification inbox and channel preferences (#150 / W5)

The backend provides durable notification content, append-only user read receipts
and channel preference versions. Every row carries organization identity. Inbox
rows belong to one recipient membership; only its user can list/read them.

## Endpoints

| Method | Path | Permission | Result |
| --- | --- | --- | --- |
| GET | `/api/v1/notifications/` | `notification.read` | Cursor page below |
| POST | `/api/v1/notifications/{id}/read/` | `notification.read` | 204; idempotent first receipt |
| POST | `/api/v1/notifications/read-all/` | `notification.read` | 204; current owner's visible unread rows |
| GET | `/api/v1/me/notification-preferences/` | `notification.read` | Current preferences and policy |
| PATCH | `/api/v1/me/notification-preferences/` | `notification_preference.update` | Atomic partial per-kind updates |

Both permissions require a contributing profile with nonempty explicit paired
scope. Notification context identifiers intersect that same profile's scope.
Government defaults receive neither code. Existing seeded internal profiles receive
codes through the normal additive seed command, respecting earlier revocations.

List filters are `kind=critical|incident|training|system`, `unread=true|false`,
`page_size=1..100` (default 50) and opaque `cursor`. Invalid/unknown filters fail with
400. Pages return `{results,next,previous:null,unread_total}` without a total-page
claim. `unread_total` counts the same visible owner inbox independently of active
list filters. Refresh the first page after a read/read-all mutation.

Results are `{id,kind,code,params,created_at,read_at,object_ref}`. `object_ref` is null
or `{kind,available,id,code,is_voided}` with closed `incident|motorcycle|review_item`
kind. Current source selectors reauthorize the real object; unavailable targets
have null identity/code/void state and empty params. Only a matching authorized
incident/review identifier is exposed in params. Other source identifiers remain
private. No raw user message or web href exists.

The cursor signs user/membership/organization, effective grants and filters. Its
seven-day snapshot orders unread-at-cutoff first, then immutable creation time/UUID
descending. Receipts after cutoff preserve original rank; new arrivals appear on
the next first-page poll. Tampering, expiration or a different scope/session
identity yields 400 `validation_error`, field code `invalid_cursor`.

## Preferences and errors

GET/PATCH return `{preferences:[{kind,in_app,email,required_in_app,required_email}]}`.
PATCH accepts `{preferences:[{kind,in_app?,email?}]}`; omitted kinds/channels retain
current values. Duplicate kinds and unknown fields, including owner/tenant
overrides, fail validation. Critical notifications require both channels; disabling
either yields 400 `validation_error`, field code `required_channel`, without partial
writes. Other kinds default to in-app enabled and email disabled. Identical updates
do not append redundant history.

Read bodies are empty objects. Unknown, foreign and another user's ids all yield
404. Missing grants/empty scopes yield 403. Authentication, CSRF and standard coded
error envelopes remain unchanged.

## Producer boundary

The internal publication service accepts a closed registered code catalog and
typed technical params; there is no API create endpoint. Supported codes are
`incident.created|comment|reassigned|severity_changed|closed|escalated`,
`incident.critical_source|critical_review|severe_fault`,
`training.certification_expired|third_adverse` and `notification.system`.
Producer wiring, deduplication, recipient routing and email delivery stay with
B-07/#49. These contracts make no delivery claim.

Existing dependencies: [Django signing](https://docs.djangoproject.com/en/5.2/topics/signing/)
and [DRF pagination](https://www.django-rest-framework.org/api-guide/pagination/#cursorpagination).
