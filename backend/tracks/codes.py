"""Event type, result code and limits of the courier track (documented in docs/sync.md)."""

TRACK_SEGMENT_EVENT_TYPE = "track.segment"

# `rejected`: `record.void` of a `track.segment` (tracks are observations, the courier cannot
# remove them; decision 174).
TRACK_SEGMENT_NOT_VOIDABLE = "track_segment_not_voidable"

MAX_POSITIONS = 250
MAX_SPAN_SECONDS = 86_400
MAX_ACCURACY_M = 5_000
COORDINATE_DECIMALS = 6
