/**
 * Additive schema25 (#370): the phone's own courier track, a local cache of filtered fixes.
 * `segment_event_id` is the `track.segment` outbox event that carries the point (NULL = unsent).
 * Rows are pruned after 30 days only once their event has a final server answer.
 */
export const TRACK_SCHEMA = [
  `CREATE TABLE track_point (id INTEGER PRIMARY KEY, owner_user_id TEXT NOT NULL,
    shift_id TEXT NOT NULL, recorded_at INTEGER NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
    accuracy_m REAL NOT NULL, segment_event_id TEXT)`,
  "CREATE INDEX track_point_shift_time ON track_point (shift_id, recorded_at)",
  "CREATE INDEX track_point_time ON track_point (recorded_at)",
] as const;
