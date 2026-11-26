/** Payload of a final `track.segment` older than 30 days: positions dropped, the rest kept. */
export function compactSegmentPayload(payload: string): string {
  return `json_set(${payload},'$.positions',json('[]'),'$.compacted',json('true'))`;
}

const ENVELOPE = [
  "id",
  "type",
  "schema_version",
  "device_time",
  "shift_id",
  "gps",
  "rules_version",
  "catalog_version",
  "manual_capture",
  "voids_event_id",
];

/**
 * Additive schema25 (#370): the phone's own courier track, a local cache of filtered fixes.
 * `segment_event_id` is the `track.segment` outbox event that carries the point (NULL = unsent);
 * `owner_user_id` holds the owner key. Rows are pruned after 30 days only once their event has a
 * final server answer. The envelope stays immutable except for ONE change: compacting the
 * positions of a final `track.segment` (the server keeps the track; the phone keeps 30 days).
 */
export const TRACK_SCHEMA = [
  `CREATE TABLE track_point (id INTEGER PRIMARY KEY, owner_user_id TEXT NOT NULL,
    shift_id TEXT NOT NULL, recorded_at INTEGER NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
    accuracy_m REAL NOT NULL, segment_event_id TEXT)`,
  "CREATE INDEX track_point_shift_time ON track_point (shift_id, recorded_at)",
  "CREATE INDEX track_point_time ON track_point (recorded_at)",
  "DROP TRIGGER outbox_event_envelope_immutable",
  `CREATE TRIGGER outbox_event_envelope_immutable
    BEFORE UPDATE OF id, type, schema_version, device_time, payload, shift_id, gps,
      rules_version, catalog_version, manual_capture, voids_event_id ON outbox_event
    WHEN NOT (OLD.type = 'track.segment' AND OLD.local_status IN ('sent', 'in_review', 'rejected')
      AND NEW.local_status IS OLD.local_status
      AND NEW.payload IS ${compactSegmentPayload("OLD.payload")}
      AND ${ENVELOPE.map((column) => `NEW.${column} IS OLD.${column}`).join(" AND ")})
    BEGIN SELECT RAISE(ABORT, 'the event envelope never changes'); END`,
] as const;
