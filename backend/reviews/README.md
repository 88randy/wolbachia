# reviews

Review items (issue #5): what a supervisor must look at because the server did not simply accept a field event.

| Module | What lives there |
| --- | --- |
| `models.py` | `ReviewItem`: insert-only, one per rejected or in-review `FieldEvent` (`kind`, `code`, `params`, `event_type`, `courier`, `courier_sequence`, `device`); a trigger blocks raw `UPDATE` and `DELETE` |
| `services.py` | `create_review_item`: called by the sync pipeline in the same savepoint that stores the event |
| `selectors.py` | The supervisor list (filters) and the courier's pull used by `changes.reviews` |
| `views.py`, `serializers.py` | `GET /review-items/` (`review_item.read`; cursor paging, `?kind=`, `?code=`) |

**Invariant for every writer of a courier's review items (#22 and others):** take `field_sync.services.lock_courier_batches` for that (organization, courier) first and create items only through `reviews.services.create_review_item`, which assigns `courier_sequence` (`max + 1`, unique per organization and courier). The phone's `changes` cursor is that sequence, so a writer outside the lock could commit a lower number behind a cursor already issued and the item would never reach the phone. See `docs/sync.md`.

Dependency: `reviews` depends on `field_sync.models` (the foreign key and the status constants); `field_sync.services` calls `reviews.services.create_review_item` and `field_sync.selectors` calls `reviews.selectors`. Imports stay one-way at module level (models never import services).

Decisions (accept, void, open an incident) are new insert-only rows added by #22; nothing here is ever edited. The Spanish label for the web is [ASSUMPTION] "elemento de revisión" (glossary).
