# tracks: courier track (#370)

Where the courier went while the shift was open. The phone records positions only between its
local shift open and close and uploads them as `track.segment` sync events (contract:
`docs/sync.md` "Courier track"). The server keeps every segment forever; nothing is edited or
deleted (a wrong segment is voided through its source event).

| File | Content |
| --- | --- |
| `models.py` | `TrackSegment` (one accepted `track.segment`, trimmed to the shift window) and `TrackViewReceipt` (who read positions or a track, once per viewer, kind, shift and UTC hour). Both insert-only: model, manager and the PostgreSQL trigger of migration 0001. |
| `payloads.py` | `TrackSegmentPayloadSerializer`: 1..250 positions `[offset_s, lat, lng, accuracy_m]`. |
| `handlers.py` | `track.segment` schema 1, registered from `AppConfig.ready()`. Own shift check (`checks_shift=False`): `shift_not_open` for a missing, foreign or other courier's shift, `causal_parent_pending` (in review) when the sender's own opening waits in review; positions outside the window or ahead of the server clock are trimmed; `record.void` is refused (`track_segment_not_voidable`). |
| `selectors.py` | `last_positions` (one query: latest id per shift in a `DISTINCT ON` subquery, then those rows) and `shift_track` (segments plus `pending_review_count`, without voided or terminally decided sources). Callers pass shifts already scoped with `shifts.validation.readable_shifts`. |
| `services.py` | `record_track_view`: the deduplicated view receipt. |
| `serializers.py` | Response shapes of `GET /shifts/positions/` and `GET /shifts/{id}/track/`. |
| `permissions.py` | `courier_track.read` (supervisor, coordinator, admin; never courier). |

The views are actions of `shifts.views.ShiftViewSet`; `field_sync` never imports this app.
The phone's capture parameters are the `track_*` rule parameters (`rules/README.md`).
Logs never carry coordinates, only identifiers.
