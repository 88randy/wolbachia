import { hasLocalRecords } from "../../src/db/owner-data.ts";
import { KvStore } from "../../src/db/kv-store.ts";
import type { SqlExecutor } from "../../src/db/sql.ts";
import type { FieldEventEnvelope } from "../../src/outbox/outbox-event.ts";
import { OutboxRepository } from "../../src/outbox/outbox-repository.ts";
import { createTestDatabase } from "./sqlite-executor.ts";

const FIXED_NOW = new Date("2026-01-15T12:00:00.000Z");

let counter = 0;

/** A valid envelope with a unique, deterministic id. */
export function makeEnvelope(overrides: Partial<FieldEventEnvelope> = {}): FieldEventEnvelope {
  counter += 1;
  const suffix = String(counter).padStart(12, "0");
  return {
    id: `00000000-0000-4000-8000-${suffix}`,
    type: "ovitrap.check",
    schema_version: 1,
    device_time: `2026-01-15T10:${String(counter % 60).padStart(2, "0")}:00.000Z`,
    payload: { note: "test" },
    shift_id: null,
    gps: null,
    rules_version: "rules-v1",
    catalog_version: "catalog-v1",
    manual_capture: false,
    voids_event_id: null,
    ...overrides,
  };
}

export interface TestStores {
  readonly db: SqlExecutor;
  readonly kv: KvStore;
  readonly outbox: OutboxRepository;
}

/** An empty, migrated database with its stores. The clock is fixed: no test depends on the date. */
export async function createStores(): Promise<
  TestStores & { readonly hasLocalRecords: () => Promise<boolean> }
> {
  const db = await createTestDatabase();
  return {
    db,
    kv: new KvStore(db),
    outbox: new OutboxRepository(db, () => FIXED_NOW),
    hasLocalRecords: () => hasLocalRecords(db),
  };
}

export const FIXED_DEVICE_ID = "11111111-1111-4111-8111-111111111111";
export { FIXED_NOW };
