import type { Schemas } from "@wolbachia/api-client";

export const TRAP_ID = "00000000-0000-4000-8000-0000000000a1";
export const OLD_TRAP_ID = "00000000-0000-4000-8000-0000000000a0";

/** The ovitrap that is at the point now. */
export function makeTrap(overrides: Partial<Schemas["Ovitrap"]> = {}): Schemas["Ovitrap"] {
  return {
    id: TRAP_ID,
    code: "OVT-0042",
    is_retired: false,
    device_time: "2026-11-03T16:00:00Z",
    voided_at: null,
    void_reason: "",
    ...overrides,
  } as Schemas["Ovitrap"];
}

/** A check with a paddle, collected in a bag. */
export function makeReading(overrides: Partial<Schemas["Reading"]> = {}): Schemas["Reading"] {
  return {
    id: "00000000-0000-4000-8000-0000000000b1",
    ovitrap: TRAP_ID,
    device_time: "2026-11-10T16:00:00Z",
    created_by_name: "Luis Repartidor",
    paddle_present: true,
    has_eggs: true,
    bag_code: "B-031",
    epi_week: "2026-W46",
    voided_at: null,
    void_reason: "",
    ...overrides,
  } as Schemas["Reading"];
}

export function makeEntry(
  overrides: Partial<Schemas["HistoryEntry"]> = {},
): Schemas["HistoryEntry"] {
  return {
    event_id: "00000000-0000-4000-8000-0000000000c1",
    type: "ovitrap.place",
    device_time: "2026-11-03T16:00:00Z",
    author_name: "Luis Repartidor",
    voided_at: null,
    void_reason: "",
    payload: { ovitrap_id: TRAP_ID.replaceAll("-", "") },
    ...overrides,
  } as Schemas["HistoryEntry"];
}
