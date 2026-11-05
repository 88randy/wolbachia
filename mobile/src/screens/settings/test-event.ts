import { randomUUID } from "expo-crypto";

import type { FieldEventEnvelope } from "../../outbox/outbox-event.ts";

/**
 * A record for trying the sync end to end (development builds only). It voids an event that does
 * not exist, so a real server answers `rejected` / `void_target_not_found`, which exercises the
 * "Con problema" path of the inbox without touching real data.
 */
export function buildTestEvent(now: Date): FieldEventEnvelope {
  return {
    id: randomUUID(),
    type: "record.void",
    schema_version: 1,
    device_time: now.toISOString(),
    payload: { reason: "Mobile bootstrap test record" },
    shift_id: null,
    gps: null,
    rules_version: "test",
    catalog_version: "test",
    manual_capture: false,
    voids_event_id: randomUUID(),
  };
}
