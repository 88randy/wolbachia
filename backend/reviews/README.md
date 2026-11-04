# reviews

Review items (issue #5): what a supervisor must look at because the server did not simply accept a field event.

| Module | What lives there |
| --- | --- |
| `models.py` | `ReviewItem`: insert-only, one per rejected or in-review `FieldEvent` (`kind`, `code`, `params`, `event_type`, `courier`, `device`); a trigger blocks raw `UPDATE` and `DELETE` |
| `services.py` | `create_review_item`: called by the sync pipeline in the same savepoint that stores the event |
| `selectors.py` | The supervisor list (filters) and the courier's pull used by `changes.reviews` |
| `views.py`, `serializers.py` | `GET /review-items/` (`review_item.read`; cursor paging, `?kind=`, `?code=`) |

Decisions (accept, void, open an incident) are new insert-only rows added by #22; nothing here is ever edited. The Spanish label for the web is [ASSUMPTION] "elemento de revisión" (glossary).
