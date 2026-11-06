import { OvitrapStore } from "../../src/features/ovitrap-check/store.ts";
import { OvitrapService } from "../../src/features/ovitrap-check/service.ts";
import { SyncEngine } from "../../src/sync/sync-engine.ts";
import { createStores, FIXED_NOW, FIXED_DEVICE_ID } from "./factories.ts";
import type { TestStores } from "./factories.ts";
import { scriptedTransport, answer } from "./scripted-transport.ts";
import { CATALOG, RULES, ASSIGNMENT } from "./m-08-fixtures.ts";
import type { EvidenceCaptureContext } from "../../src/features/ovitrap-check/types.ts";
export function engineFor(
  local: TestStores,
  transport = scriptedTransport([answer([])]).transport,
  hasSession = false,
) {
  return new SyncEngine({
    pass: {
      ...local,
      deviceId: FIXED_DEVICE_ID,
      now: () => FIXED_NOW,
      transport,
    },
    hasSession: () => hasSession,
    hasServer: () => true,
    hasPendingFinalUpload: () => Promise.resolve(false),
    random: () => 0,
    schedule: () => () => undefined,
    report: () => undefined,
  });
}
const PORTS = {
  gps: { locate: () => Promise.resolve({ lat: 19, lng: -99, accuracy_m: 5 }) },
  scanner: {
    scan: () =>
      Promise.resolve({
        status: "read" as const,
        value: "wbf:1:bag:33333333-3333-4333-8333-333333333333",
      }),
  },
  evidence: {
    capture: (context: EvidenceCaptureContext) =>
      Promise.resolve({
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        fileRef: "file:///evidence/test.jpg",
        authority: {
          sql: "SELECT 1 FROM ovitrap_draft WHERE slot=1 AND event_id IS NULL AND json_extract(draft,'$.eventId')=?",
          params: [context.draftId],
        },
      }),
  },
} as const;
let sequence = 0;
function serviceFor(
  deps: { store: OvitrapStore; engine: SyncEngine },
  overrides: Partial<ConstructorParameters<typeof OvitrapService>[0]>,
) {
  const { store, engine } = deps;
  const shiftId =
    overrides.shiftId ?? (() => Promise.resolve("55555555-5555-4555-8555-555555555555"));
  return new OvitrapService({
    store,
    engine,
    now: () => FIXED_NOW,
    uuid: () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++sequence).padStart(12, "0")}`,
    ...PORTS,
    shiftId,
    evidenceShift: async () => {
      const id = await shiftId();
      return {
        id,
        guard: {
          sql: "SELECT 1 FROM ovitrap_draft WHERE slot=1 AND event_id IS NULL AND json_extract(draft,'$.shiftId')=?",
          params: [id],
        },
      };
    },
    ...overrides,
  });
}
export async function harness(
  stores?: TestStores,
  overrides: Partial<ConstructorParameters<typeof OvitrapService>[0]> = {},
) {
  const local = stores ?? (await createStores());
  const engine = engineFor(local);
  const store = new OvitrapStore(local.db);
  await store.saveSnapshots({ catalog: CATALOG, rules: RULES, assignment: ASSIGNMENT });
  const service = serviceFor({ store, engine }, overrides);
  return { ...local, engine, store, service };
}
export async function prepareCheck(service: OvitrapService): Promise<void> {
  await service.update(
    {
      finding: "fine",
      paddlePresent: true,
      hasEggs: true,
      paddleType: "standard",
      prepared: ["clean", "water", "liner"],
      bagCode: "B-TEST",
      reviewAcknowledged: true,
    },
    await currentEventId(service),
  );
}

/** Snapshot identity supplied by each test caller; stale-view tests retain an earlier explicit ID. */
export async function currentEventId(reader: Pick<OvitrapStore, "read">): Promise<string | null> {
  return (await reader.read()).draft?.eventId ?? null;
}
